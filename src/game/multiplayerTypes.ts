/**
 * Multiplayer types & seeded-random pipe generation.
 *
 * Both players derive identical pipe layouts from the same roomSeed so
 * the game is fair without any server-side pipe authority.
 */

export type MPPhase =
  | 'LOBBY'       // waiting for opponent to join
  | 'COUNTDOWN'   // 3-2-1 before game starts
  | 'PLAYING'     // race in progress
  | 'RESULT';     // winner/loser screen

export interface MPPlayerState {
  playerId: string;
  username: string;
  skin: string;
  y: number;
  vy: number;
  score: number;
  alive: boolean;
  finished: boolean; // died or won
}

export interface MPBroadcast {
  type: 'STATE' | 'READY' | 'HOST_ACK' | 'FLAP' | 'LEAVE';
  player: MPPlayerState;
}

// ---------------------------------------------------------------------------
// Seeded pseudo-random number generator (mulberry32)
// ---------------------------------------------------------------------------
export function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Convert a room-code string to a numeric seed */
export function roomCodeToSeed(roomCode: string): number {
  let h = 0;
  for (let i = 0; i < roomCode.length; i++) {
    h = Math.imul(31, h) + roomCode.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

/** Generate a random 6-character room code */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
