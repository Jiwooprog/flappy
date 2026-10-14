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

const SEED_ENTRIES: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    username: 'Gino_Champ',
    score: 45,
    difficulty: 'classic',
    skin: 'gino',
    timestamp: 1728910000000,
  },
  {
    id: 'seed-2',
    username: 'Jewel_Star',
    score: 38,
    difficulty: 'classic',
    skin: 'jewel',
    timestamp: 1728911000000,
  },
  {
    id: 'seed-3',
    username: 'RJ_Ace',
    score: 35,
    difficulty: 'classic',
    skin: 'rj',
    timestamp: 1728912000000,
  },
  {
    id: 'seed-6',
    username: 'SolarKing',
    score: 31,
    difficulty: 'hardcore',
    skin: 'phoenix',
    timestamp: 1728915000000,
  },
  {
    id: 'seed-4',
    username: 'FlappyMaster',
    score: 26,
    difficulty: 'classic',
    skin: 'classic',
    timestamp: 1728913000000,
  },
  {
    id: 'seed-5',
    username: 'PixelRider',
    score: 19,
    difficulty: 'casual',
    skin: 'cyber',
    timestamp: 1728914000000,
  },
];

// Initialize Upstash Redis client with either Upstash or Vercel KV environment variables
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// Ensure initial seed entries exist in Redis
async function ensureSeedData(client: Redis) {
  try {
    const exists = await client.exists('flappy:leaderboard:all');
    if (!exists) {
      for (const entry of SEED_ENTRIES) {
        const payload = JSON.stringify(entry);
        await client.zadd('flappy:leaderboard:all', { score: entry.score, member: payload });
        await client.zadd(`flappy:leaderboard:${entry.difficulty}`, { score: entry.score, member: payload });
      }
    }
  } catch (err) {
    console.error('Failed to seed Upstash Redis:', err);
  }
}

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

  // GET: Retrieve Top 100 scores
  if (req.method === 'GET') {
    if (!redis) {
      // Graceful fallback if Upstash environment variables are not yet configured on Vercel
      let list = [...SEED_ENTRIES];
      if (difficulty !== 'all') {
        list = list.filter((e) => e.difficulty === difficulty);
      }
      list.sort((a, b) => b.score - a.score);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, leaderboard: list, note: 'Running in demo mode. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel to activate cloud Redis.' }));
      return;
    }

    try {
      await ensureSeedData(redis);
      const key = difficulty !== 'all' ? `flappy:leaderboard:${difficulty}` : 'flappy:leaderboard:all';
      const raw = await redis.zrange(key, 0, 99, { rev: true });

      const leaderboard: LeaderboardEntry[] = (raw || []).map((item) => {
        if (typeof item === 'string') {
          try {
            return JSON.parse(item);
          } catch {
            return null;
          }
        }
        return item as LeaderboardEntry;
      }).filter(Boolean);

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

  // POST: Submit a new score
  if (req.method === 'POST') {
    try {
      const rawBody = await readBody(req);
      const data = JSON.parse(rawBody || '{}');

      const username = (data.username || 'PLAYER').trim().substring(0, 16) || 'PLAYER';
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

      const entry: LeaderboardEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        username,
        score,
        difficulty: diff,
        skin,
        timestamp: Date.now(),
      };

      if (!redis) {
        // Fallback demo response if no Upstash connected yet
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, rank: 1, entry }));
        return;
      }

      const member = JSON.stringify(entry);

      // Add to both the difficulty-specific sorted set and the global 'all' sorted set
      await Promise.all([
        redis.zadd(`flappy:leaderboard:${diff}`, { score, member }),
        redis.zadd('flappy:leaderboard:all', { score, member }),
      ]);

      // Calculate the player's 1-indexed rank in their difficulty
      const zeroRank = await redis.zrevrank(`flappy:leaderboard:${diff}`, member);
      const rank = zeroRank !== null && zeroRank !== undefined ? zeroRank + 1 : 1;

      // Maintain only top 100 entries (prune rank 101 onwards)
      await Promise.all([
        redis.zremrangebyrank(`flappy:leaderboard:${diff}`, 0, -101),
        redis.zremrangebyrank('flappy:leaderboard:all', 0, -101),
      ]);

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, rank, entry }));
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
