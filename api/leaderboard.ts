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
const MAX_BODY_BYTES = 4 * 1024;
const MAX_SCORE = 10_000;
const RATE_LIMIT_PER_MINUTE = 30;
const VALID_DIFFICULTIES = new Set<LeaderboardEntry['difficulty']>(['casual', 'classic', 'hardcore']);
const VALID_SKINS = new Set([
  'classic', 'cyber', 'phoenix', 'midnight', 'gino', 'jewel', 'rj', 'junjun', 'bongbong',
]);

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) reject(new Error('Request body too large'));
      else resolve(body);
    });
    req.on('error', (err) => reject(err));
  });
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

async function isRateLimited(ip: string): Promise<boolean> {
  if (!redis) return false;
  const window = Math.floor(Date.now() / 60_000);
  const key = `flappy:rate-limit:${ip}:${window}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count > RATE_LIMIT_PER_MINUTE;
}

export default async function handler(
  req: IncomingMessage & { url?: string },
  res: ServerResponse
) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
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
      if (await isRateLimited(getClientIp(req))) {
        res.statusCode = 429;
        res.setHeader('Retry-After', '60');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Too many score submissions' }));
        return;
      }

      const rawBody = await readBody(req);
      const data = JSON.parse(rawBody || '{}') as Record<string, unknown>;

      const rawUsername = typeof data.username === 'string' ? data.username : 'PLAYER';
      const username = rawUsername.trim().substring(0, 16) || 'PLAYER';
      const uKey = username.toLowerCase();
      const submittedScore = Number(data.score);
      const score = Number.isSafeInteger(submittedScore) ? submittedScore : 0;
      const diffRaw = typeof data.difficulty === 'string' ? data.difficulty : '';
      const diff: LeaderboardEntry['difficulty'] = VALID_DIFFICULTIES.has(diffRaw as LeaderboardEntry['difficulty'])
        ? (diffRaw as LeaderboardEntry['difficulty'])
        : 'classic';
      const skin = typeof data.skin === 'string' && VALID_SKINS.has(data.skin) ? data.skin : 'classic';

      if (score <= 0 || score > MAX_SCORE) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: `Score must be an integer between 1 and ${MAX_SCORE}` }));
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
      const bodyTooLarge = err instanceof Error && err.message === 'Request body too large';
      res.statusCode = bodyTooLarge ? 413 : 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: bodyTooLarge ? 'Request body too large' : 'Invalid score submission payload' }));
    }
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
