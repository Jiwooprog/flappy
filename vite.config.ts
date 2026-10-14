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
              const raw = await redis.zrange(key, 0, 99, { rev: true });
              const list: LeaderboardEntry[] = (raw || []).map((item) => {
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
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, leaderboard: list, source: 'upstash' }));
              return;
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

              const entry: LeaderboardEntry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                username,
                score,
                difficulty,
                skin,
                timestamp: Date.now(),
              };

              if (redis) {
                try {
                  const member = JSON.stringify(entry);
                  await Promise.all([
                    redis.zadd(`flappy:leaderboard:${difficulty}`, { score, member }),
                    redis.zadd('flappy:leaderboard:all', { score, member }),
                  ]);
                  const zeroRank = await redis.zrevrank(`flappy:leaderboard:${difficulty}`, member);
                  const rank = zeroRank !== null && zeroRank !== undefined ? zeroRank + 1 : 1;
                  await Promise.all([
                    redis.zremrangebyrank(`flappy:leaderboard:${difficulty}`, 0, -101),
                    redis.zremrangebyrank('flappy:leaderboard:all', 0, -101),
                  ]);

                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, rank, entry, source: 'upstash' }));
                  return;
                } catch (err) {
                  console.error('Local Upstash write failed, falling back to JSON:', err);
                }
              }

              const list = readDb();
              list.push(entry);
              list.sort((a, b) => b.score - a.score);

              // Keep top 100 entries
              const trimmed = list.slice(0, 100);
              writeDb(trimmed);

              const diffList = trimmed.filter((item) => item.difficulty === difficulty);
              const rank = diffList.findIndex((item) => item.id === entry.id) + 1;

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, rank, entry, source: 'local' }));
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

