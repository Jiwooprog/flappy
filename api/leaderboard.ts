import { Redis } from '@upstash/redis';

interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
  difficulty: 'casual' | 'classic' | 'hardcore';
  skin: string;
  timestamp: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const difficulty = url.searchParams.get('difficulty') || 'all';

  // ── GET: fetch top-100 leaderboard ──────────────────────────────────────
  if (req.method === 'GET') {
    const redis = getRedis();
    if (!redis) {
      return new Response(JSON.stringify({ success: true, leaderboard: [] }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    try {
      const key =
        difficulty !== 'all'
          ? `flappy:leaderboard:${difficulty}`
          : 'flappy:leaderboard:all';

      const topUsernames = await redis.zrange<string[]>(key, 0, 99, { rev: true });

      if (!topUsernames || topUsernames.length === 0) {
        return new Response(JSON.stringify({ success: true, leaderboard: [] }), {
          status: 200,
          headers: corsHeaders,
        });
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
              try {
                leaderboard.push(JSON.parse(profile));
              } catch {
                // skip malformed entries
              }
            } else {
              leaderboard.push(profile);
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, leaderboard }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (err) {
      console.error('Upstash GET error:', err);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leaderboard' }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // ── POST: submit a score ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const data = (await req.json()) as Record<string, unknown>;

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
        return new Response(
          JSON.stringify({ error: 'Score must be greater than 0' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const redis = getRedis();

      let finalEntry: LeaderboardEntry = {
        id: `${uKey}-${diff}`,
        username,
        score,
        difficulty: diff,
        skin,
        timestamp: Date.now(),
      };

      if (!redis) {
        return new Response(
          JSON.stringify({ success: true, rank: 1, entry: finalEntry }),
          { status: 200, headers: corsHeaders }
        );
      }

      const diffKey = `flappy:leaderboard:${diff}`;
      const allKey = 'flappy:leaderboard:all';

      // Only update if score beats personal best for this difficulty
      const currentScore = await redis.zscore(diffKey, uKey);
      if (currentScore === null || score > currentScore) {
        const fields: Record<string, string> = {};
        fields[`${diff}:${uKey}`] = JSON.stringify(finalEntry);
        await Promise.all([
          redis.hset('flappy:profiles', fields),
          redis.zadd(diffKey, { score, member: uKey }),
        ]);

        // Update all-time board only if this is their overall best
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
        // Return their existing best entry
        const rawExisting = await redis.hget<string | LeaderboardEntry>(
          'flappy:profiles',
          `${diff}:${uKey}`
        );
        if (rawExisting) {
          finalEntry =
            typeof rawExisting === 'string' ? JSON.parse(rawExisting) : rawExisting;
        }
      }

      // 1-indexed rank
      const zeroRank = await redis.zrevrank(diffKey, uKey);
      const rank = zeroRank !== null && zeroRank !== undefined ? zeroRank + 1 : 1;

      // Keep only top 100
      await Promise.all([
        redis.zremrangebyrank(diffKey, 0, -101),
        redis.zremrangebyrank(allKey, 0, -101),
      ]);

      return new Response(
        JSON.stringify({ success: true, rank, entry: finalEntry }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err) {
      console.error('Upstash POST error:', err);
      return new Response(
        JSON.stringify({ error: 'Invalid score submission payload' }),
        { status: 400, headers: corsHeaders }
      );
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
}
