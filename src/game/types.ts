export type GameState = 'MENU' | 'IDLE' | 'PLAYING' | 'GAMEOVER' | 'PAUSED';

export type BirdSkin = 'classic' | 'cyber' | 'phoenix' | 'midnight' | 'gino' | 'jewel' | 'rj' | 'junjun';

export type Difficulty = 'casual' | 'classic' | 'hardcore';

export type Theme = 'day' | 'sunset' | 'night';

export interface Bird {
  x: number;
  y: number;
  vy: number;
  rotation: number;
  radius: number;
  wingFrame: number;
  wingTimer: number;
}

export interface Pipe {
  id: number;
  x: number;
  topHeight: number;
  bottomY: number;
  width: number;
  passed: boolean;
}

export type ParticleShape = 'circle' | 'feather' | 'star' | 'smoke' | 'spark';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  shape: ParticleShape;
  rotation?: number;
  rotSpeed?: number;
}

export interface DifficultyConfig {
  gravity: number;
  jumpForce: number;
  pipeSpeed: number;
  pipeGap: number;
  pipeInterval: number; // distance between pipes
  description: string;
  badgeColor: string;
}

export interface GameStats {
  score: number;
  bestScore: number;
  gamesPlayed: number;
  totalFlaps: number;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  score: number;
  difficulty: Difficulty;
  skin: BirdSkin;
  timestamp: number;
}
