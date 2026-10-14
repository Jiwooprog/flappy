import type { LeaderboardEntry, Difficulty, BirdSkin } from './types';

const USERNAME_STORAGE_KEY = 'flappy_username';
const LOCAL_LEADERBOARD_KEY = 'flappy_local_leaderboard';

export function getStoredUsername(): string {
  const saved = localStorage.getItem(USERNAME_STORAGE_KEY);
  if (saved && saved.trim()) {
    return saved.trim();
  }
  // Generate a fun random arcade gamer tag by default
  const randNum = Math.floor(100 + Math.random() * 900);
  const defaultNames = ['SkyAce', 'WingStar', 'CloudPilot', 'AeroGamer', 'BirdMaster'];
  const generated = `${defaultNames[Math.floor(Math.random() * defaultNames.length)]}_${randNum}`;
  localStorage.setItem(USERNAME_STORAGE_KEY, generated);
  return generated;
}

export function saveUsername(username: string): string {
  const cleaned = username.trim().substring(0, 16) || getStoredUsername();
  localStorage.setItem(USERNAME_STORAGE_KEY, cleaned);
  return cleaned;
}

export async function fetchLeaderboard(difficulty?: string): Promise<LeaderboardEntry[]> {
  try {
    const url = difficulty && difficulty !== 'all'
      ? `/api/leaderboard?difficulty=${encodeURIComponent(difficulty)}`
      : '/api/leaderboard';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    if (data && Array.isArray(data.leaderboard)) {
      return data.leaderboard;
    }
  } catch {
    // Fallback to local storage if API is unreachable
  }

  // Local fallback
  try {
    const local = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    let list: LeaderboardEntry[] = local ? JSON.parse(local) : [];
    if (difficulty && difficulty !== 'all') {
      list = list.filter((item) => item.difficulty === difficulty);
    }
    list.sort((a, b) => b.score - a.score);
    return list;
  } catch {
    return [];
  }
}

export async function submitLeaderboardScore(
  username: string,
  score: number,
  difficulty: Difficulty,
  skin: BirdSkin
): Promise<{ rank: number; entry: LeaderboardEntry } | null> {
  if (score <= 0) return null;

  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.trim() || 'PLAYER',
        score,
        difficulty,
        skin,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // API failed, fallback to local save
  }

  // Local storage fallback (deduplicated: 1 entry per username per difficulty)
  try {
    const local = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    const list: LeaderboardEntry[] = local ? JSON.parse(local) : [];
    const cleanName = username.trim().substring(0, 16) || 'PLAYER';
    const uKey = cleanName.toLowerCase();


    let entry: LeaderboardEntry = {

      id: `${uKey}-${difficulty}`,
      username: cleanName,
      score,
      difficulty,
      skin,
      timestamp: Date.now(),
    };

    const existingIdx = list.findIndex(
      (item) => item.username.toLowerCase() === uKey && item.difficulty === difficulty
    );

    if (existingIdx !== -1) {
      if (score > list[existingIdx].score) {
        list[existingIdx] = entry;
      } else {
        entry = list[existingIdx];
      }
    } else {
      list.push(entry);
    }

    list.sort((a, b) => b.score - a.score);
    const trimmed = list.slice(0, 100);
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(trimmed));

    const diffList = trimmed.filter((item) => item.difficulty === difficulty);
    const rank = diffList.findIndex((item) => item.username.toLowerCase() === uKey) + 1;

    return { rank: rank || 1, entry };
  } catch {
    return null;
  }
}
