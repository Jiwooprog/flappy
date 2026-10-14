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

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
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

  // ── GET ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!redis) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, leaderboard: [] }));
      return;
    }

    try {
      const key =
        difficulty !== 'all'
          ? `flappy:leaderboard:${difficulty}`
          : 'flappy:leaderboard:all';

      const topUsernames = await redis.zrange<string[]>(key, 0, 99, { rev: true });

      if (!topUsernames || topUsernames.length === 0) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, leaderboard: [] }));
        return;
      }

      const hashKeys = topUsernames.map((u) => `${difficulty}:${u}`);
      const rawProfiles = await redis.hmget<Record<string, LeaderboardEntry | string>>(
        'flappy:profiles',
        ...hashKeys
      );

      const leaderboard: LeaderboardEntry[] = [];
      if (rawProfiles) {
        for (const u of topUsernames) {
          const profile = rawProfiles[`${difficulty}:${u}`];
          if (profile) {
            if (typeof profile === 'string') {
              try { leaderboard.push(JSON.parse(profile)); } catch { /* skip */ }
            } else {
              leaderboard.push(profile);
            }
          }
        }
      }

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, leaderboard }));
    } catch (err) {
      console.error('Upstash GET error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Failed to fetch leaderboard' }));
    }
    return;
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const data = JSON.parse(rawBody || '{}') as Record<string, unknown>;

      const username = ((data.username as string) || 'PLAYER').trim().substring(0, 16) || 'PLAYER';
      const uKey = username.toLowerCase();
      const score = Math.max(0, parseInt(String(data.score), 10) || 0);
      const diffRaw = data.difficulty as string;
      const diff: LeaderboardEntry['difficulty'] = (
        ['casual', 'classic', 'hardcore'] as string[]
      ).includes(diffRaw)
        ? (diffRaw as LeaderboardEntry['difficulty'])
        : 'classic';
      const skin = (data.skin as string) || 'classic';

      if (score <= 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Score must be greater than 0' }));
        return;
      }

      let finalEntry: LeaderboardEntry = {
        id: `${uKey}-${diff}`,
        username,
        score,
        difficulty: diff,
        skin,
        timestamp: Date.now(),
      };

      if (!redis) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, rank: 1, entry: finalEntry }));
        return;
      }

      const diffKey = `flappy:leaderboard:${diff}`;
      const allKey = 'flappy:leaderboard:all';

      const currentScore = await redis.zscore(diffKey, uKey);
      if (currentScore === null || score > currentScore) {
        const fields: Record<string, string> = {};
        fields[`${diff}:${uKey}`] = JSON.stringify(finalEntry);
        await Promise.all([
          redis.hset('flappy:profiles', fields),
          redis.zadd(diffKey, { score, member: uKey }),
        ]);

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
        const rawExisting = await redis.hget<string | LeaderboardEntry>(
          'flappy:profiles',
          `${diff}:${uKey}`
        );
        if (rawExisting) {
          finalEntry = typeof rawExisting === 'string' ? JSON.parse(rawExisting) : rawExisting;
        }
      }

      const zeroRank = await redis.zrevrank(diffKey, uKey);
      const rank = zeroRank !== null && zeroRank !== undefined ? zeroRank + 1 : 1;

      await Promise.all([
        redis.zremrangebyrank(diffKey, 0, -101),
        redis.zremrangebyrank(allKey, 0, -101),
      ]);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, rank, entry: finalEntry }));
    } catch (err) {
      console.error('Upstash POST error:', err);
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid score submission payload' }));
    }
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
