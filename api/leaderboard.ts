import type { IncomingMessage, ServerResponse } from 'node:http';
import { Redis } from '@upstash/redis';

interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
  difficulty: 'casual' | 'classic' | 'hardcore';
  skin: string;
  timestamp: number;
}

// Initialize Upstash Redis client with either Upstash or Vercel KV environment variables
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Parse body helper for Node incoming messages
async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });
}

// Vercel Serverless Function Handler
export default async function handler(req: IncomingMessage & { query?: Record<string, string>; url?: string }, res: ServerResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const difficulty = url.searchParams.get('difficulty') || 'all';

  // GET: Retrieve Top 100 scores (Deduplicated: 1 entry per username, no fake population)
  if (req.method === 'GET') {
    if (!redis) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, leaderboard: [] }));
      return;
    }

    try {
      const key = difficulty !== 'all' ? `flappy:leaderboard:${difficulty}` : 'flappy:leaderboard:all';
      const topUsernames = await redis.zrange<string[]>(key, 0, 99, { rev: true });

      if (!topUsernames || topUsernames.length === 0) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, leaderboard: [] }));
        return;
      }

      // Fetch each user's profile card from flappy:profiles
      const hashKeys = topUsernames.map((u) => `${difficulty}:${u}`);
      const rawProfiles = await redis.hmget<Record<string, LeaderboardEntry | string>>('flappy:profiles', ...hashKeys);

      const leaderboard: LeaderboardEntry[] = [];
      if (rawProfiles) {
        for (const u of topUsernames) {
          const profile = rawProfiles[`${difficulty}:${u}`];
          if (profile) {
            if (typeof profile === 'string') {
              try {
                leaderboard.push(JSON.parse(profile));
              } catch {
                // Ignore parse errors
              }
            } else {
              leaderboard.push(profile);
            }
          }
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, leaderboard }));
      return;
    } catch (err) {
      console.error('Upstash GET error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to fetch leaderboard from Upstash' }));
      return;
    }
  }

  // POST: Submit a new score (1 entry per username - only updates if score beats personal best)
  if (req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const data = JSON.parse(rawBody || '{}');

      const username = (data.username || 'PLAYER').trim().substring(0, 16) || 'PLAYER';
      const uKey = username.toLowerCase();
      const score = Math.max(0, parseInt(data.score, 10) || 0);
      const diff: LeaderboardEntry['difficulty'] = ['casual', 'classic', 'hardcore'].includes(data.difficulty)
        ? data.difficulty
        : 'classic';
      const skin = data.skin || 'classic';

      if (score <= 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Score must be greater than 0' }));
        return;
      }

      if (!redis) {
        const demoEntry: LeaderboardEntry = {
          id: uKey,
          username,
          score,
          difficulty: diff,
          skin,
          timestamp: Date.now(),
        };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, rank: 1, entry: demoEntry }));
        return;
      }

      const diffKey = `flappy:leaderboard:${diff}`;
      const allKey = 'flappy:leaderboard:all';

      // Check user's current score for this difficulty
      const currentScore = await redis.zscore(diffKey, uKey);
      let finalEntry: LeaderboardEntry = {
        id: `${uKey}-${diff}`,
        username,
        score,
        difficulty: diff,
        skin,
        timestamp: Date.now(),
      };

      if (currentScore === null || score > currentScore) {
        // New personal record for this user in this difficulty!
        const fields: Record<string, string> = {};
        fields[`${diff}:${uKey}`] = JSON.stringify(finalEntry);
        await Promise.all([
          redis.hset('flappy:profiles', fields),
          redis.zadd(diffKey, { score, member: uKey }),
        ]);

        // Also check if it's their highest score across all modes
        const currentAllScore = await redis.zscore(allKey, uKey);
        if (currentAllScore === null || score > currentAllScore) {
          const allFields: Record<string, string> = {};
          allFields[`all:${uKey}`] = JSON.stringify(finalEntry);
          await Promise.all([
            redis.hset('flappy:profiles', allFields),
            redis.zadd(allKey, { score, member: uKey }),
          ]);
        }
      } else {
        // Lower than existing record: retain their best score
        const rawExisting = await redis.hget<string | LeaderboardEntry>('flappy:profiles', `${diff}:${uKey}`);
        if (rawExisting) {
          finalEntry = typeof rawExisting === 'string' ? JSON.parse(rawExisting) : rawExisting;
        }
      }

      // Calculate the player's 1-indexed rank among unique users
      const zeroRank = await redis.zrevrank(diffKey, uKey);
      const rank = zeroRank !== null && zeroRank !== undefined ? zeroRank + 1 : 1;

      // Keep only top 100 unique players
      await Promise.all([
        redis.zremrangebyrank(diffKey, 0, -101),
        redis.zremrangebyrank(allKey, 0, -101),
      ]);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, rank, entry: finalEntry }));
      return;
    } catch (err) {
      console.error('Upstash POST error:', err);
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid score submission payload' }));
      return;
    }
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
