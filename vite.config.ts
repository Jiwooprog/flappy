import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function leaderboardPlugin(): Plugin {
  const dbPath = path.resolve(__dirname, 'leaderboard.json');

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
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/leaderboard')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');

        if (req.method === 'GET') {
          const difficulty = url.searchParams.get('difficulty');
          let list = readDb();
          if (difficulty && difficulty !== 'all') {
            list = list.filter((item) => item.difficulty === difficulty);
          }
          list.sort((a, b) => b.score - a.score);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ success: true, leaderboard: list }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
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

              const list = readDb();
              const entry: LeaderboardEntry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                username,
                score,
                difficulty,
                skin,
                timestamp: Date.now(),
              };

              list.push(entry);
              list.sort((a, b) => b.score - a.score);

              // Keep top 100 entries
              const trimmed = list.slice(0, 100);
              writeDb(trimmed);

              const diffList = trimmed.filter((item) => item.difficulty === difficulty);
              const rank = diffList.findIndex((item) => item.id === entry.id) + 1;

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, rank, entry }));
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

export default defineConfig({
  plugins: [react(), leaderboardPlugin()],
  server: {
    host: true,
    port: 5173,
  },
});
