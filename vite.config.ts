import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Redis } from '@upstash/redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
  difficulty: string;
  skin: string;
  timestamp: number;
}

function leaderboardPlugin(env: Record<string, string>): Plugin {
  const dbPath = path.resolve(__dirname, 'leaderboard.json');

  const redisUrl = env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

  const readDb = (): LeaderboardEntry[] => {
    try {
      if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, '[]', 'utf-8');
      }
      return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    } catch {
      return [];
    }
  };

  const writeDb = (data: LeaderboardEntry[]) => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Safe write ignore
    }
  };

  return {
    name: 'flappy-leaderboard-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/leaderboard')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');

        if (req.method === 'GET') {
          const difficulty = url.searchParams.get('difficulty') || 'all';

          if (redis) {
            try {
              const key = difficulty !== 'all' ? `flappy:leaderboard:${difficulty}` : 'flappy:leaderboard:all';
              const topUsernames = await redis.zrange<string[]>(key, 0, 99, { rev: true });
              if (topUsernames && topUsernames.length > 0) {
                const hashKeys = topUsernames.map((u) => `${difficulty}:${u}`);
                const rawProfiles = await redis.hmget<Record<string, LeaderboardEntry | string>>('flappy:profiles', ...hashKeys);
                const list: LeaderboardEntry[] = [];
                if (rawProfiles) {
                  for (const u of topUsernames) {
                    const profile = rawProfiles[`${difficulty}:${u}`];
                    if (profile) {
                      if (typeof profile === 'string') {
                        try {
                          list.push(JSON.parse(profile));
                        } catch {
                          // ignore
                        }
                      } else {
                        list.push(profile);
                      }
                    }
                  }
                }
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(JSON.stringify({ success: true, leaderboard: list, source: 'upstash' }));
                return;
              }
            } catch (err) {
              console.error('Local Upstash read failed, falling back to JSON:', err);
            }
          }

          let list = readDb();
          if (difficulty && difficulty !== 'all') {
            list = list.filter((item) => item.difficulty === difficulty);
          }
          list.sort((a, b) => b.score - a.score);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ success: true, leaderboard: list, source: 'local' }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const username = (data.username || 'PLAYER').trim().substring(0, 16) || 'PLAYER';
              const uKey = username.toLowerCase();
              const score = Math.max(0, parseInt(data.score, 10) || 0);
              const difficulty = ['casual', 'classic', 'hardcore'].includes(data.difficulty)
                ? data.difficulty
                : 'classic';
              const skin = data.skin || 'classic';

              if (score <= 0) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Score must be greater than 0' }));
                return;
              }

              let finalEntry: LeaderboardEntry = {
                id: `${uKey}-${difficulty}`,
                username,
                score,
                difficulty,
                skin,
                timestamp: Date.now(),
              };

              if (redis) {
                try {
                  const diffKey = `flappy:leaderboard:${difficulty}`;
                  const allKey = 'flappy:leaderboard:all';

                  const currentScore = await redis.zscore(diffKey, uKey);
                  if (currentScore === null || score > currentScore) {
                    const fields: Record<string, string> = {};
                    fields[`${difficulty}:${uKey}`] = JSON.stringify(finalEntry);
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
                    const rawExisting = await redis.hget<string | LeaderboardEntry>('flappy:profiles', `${difficulty}:${uKey}`);
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
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, rank, entry: finalEntry, source: 'upstash' }));
                  return;
                } catch (err) {
                  console.error('Local Upstash write failed, falling back to JSON:', err);
                }
              }

              // Local JSON deduplication (1 entry per username)
              const list = readDb();
              const existingIdx = list.findIndex(
                (item) => item.username.toLowerCase() === uKey && item.difficulty === difficulty
              );

              if (existingIdx !== -1) {
                if (score > list[existingIdx].score) {
                  list[existingIdx] = finalEntry;
                } else {
                  finalEntry = list[existingIdx];
                }
              } else {
                list.push(finalEntry);
              }

              list.sort((a, b) => b.score - a.score);
              const trimmed = list.slice(0, 100);
              writeDb(trimmed);

              const diffList = trimmed.filter((item) => item.difficulty === difficulty);
              const rank = diffList.findIndex((item) => item.username.toLowerCase() === uKey) + 1;

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, rank: rank || 1, entry: finalEntry, source: 'local' }));
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), leaderboardPlugin(env)],
    server: {
      host: true,
      port: 5173,
    },
  };
});

