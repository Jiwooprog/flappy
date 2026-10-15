/**
 * useMultiplayer – manages the full lifecycle of a multiplayer room:
 *   lobby → countdown → playing → result
 *
 * Uses Supabase Realtime Broadcast (no database writes needed).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../game/supabase';
import type { MPPhase, MPPlayerState, MPBroadcast } from '../game/multiplayerTypes';
import { generateRoomCode } from '../game/multiplayerTypes';
import type { BirdSkin } from '../game/types';

const BROADCAST_HZ = 15;   // state syncs per second
const COUNTDOWN_SEC = 3;

interface UseMPOptions {
  username: string;
  skin: BirdSkin;
  onCountdownEnd: () => void;   // called when game actually starts
  onOpponentLeft: () => void;   // opponent disconnected
}

interface UseMPReturn {
  phase: MPPhase;
  roomCode: string;
  myId: string;
  myState: MPPlayerState;
  opponentState: MPPlayerState | null;
  countdown: number;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  broadcastFlap: () => void;
  broadcastState: (patch: Partial<MPPlayerState>) => void;
  leave: () => void;
}

function makeInitialPlayer(id: string, username: string, skin: string): MPPlayerState {
  return { playerId: id, username, skin, y: 270, vy: 0, score: 0, alive: true, finished: false };
}

export function useMultiplayer(opts: UseMPOptions): UseMPReturn {
  const { username, skin } = opts;

  const [phase, setPhase] = useState<MPPhase>('LOBBY');
  const [roomCode, setRoomCode] = useState('');
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [opponentState, setOpponentState] = useState<MPPlayerState | null>(null);

  const myId = useRef(`p_${Math.random().toString(36).slice(2, 9)}`).current;
  const myStateRef = useRef<MPPlayerState>(makeInitialPlayer(myId, username, skin));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const broadcast = useCallback((msg: MPBroadcast) => {
    channelRef.current?.send({ type: 'broadcast', event: 'mp', payload: msg });
  }, []);

  const startCountdown = useCallback(() => {
    setPhase('COUNTDOWN');
    let remaining = COUNTDOWN_SEC;
    setCountdown(remaining);
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current!);
        setPhase('PLAYING');
        optsRef.current.onCountdownEnd();
      }
    }, 1000);
  }, []);

  const subscribeToChannel = useCallback((code: string) => {
    const ch = supabase.channel(`mp_room_${code}`, {
      config: { broadcast: { self: false } },
    });

    ch.on('broadcast', { event: 'mp' }, ({ payload }: { payload: MPBroadcast }) => {
      if (payload.player.playerId === myId) return; // ignore echoes

      if (payload.type === 'LEAVE') {
        setOpponentState(null);
        optsRef.current.onOpponentLeft();
        return;
      }

      if (payload.type === 'READY') {
        setOpponentState(payload.player);
        startCountdown();
        return;
      }

      if (payload.type === 'STATE') {
        setOpponentState((prev) => ({ ...(prev ?? payload.player), ...payload.player }));
      }
    });

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = ch;
      }
    });

    return ch;
  }, [myId, startCountdown]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    myStateRef.current = makeInitialPlayer(myId, username, skin);
    subscribeToChannel(code);
    // Host waits for READY signal from joiner
  }, [myId, username, skin, subscribeToChannel]);

  const joinRoom = useCallback((code: string) => {
    const upperCode = code.trim().toUpperCase();
    setRoomCode(upperCode);
    myStateRef.current = makeInitialPlayer(myId, username, skin);
    subscribeToChannel(upperCode);
    // Give subscription a moment to establish before broadcasting READY
    setTimeout(() => {
      broadcast({ type: 'READY', player: myStateRef.current });
      setOpponentState(makeInitialPlayer('opponent', '...', 'classic'));
      startCountdown();
    }, 600);
  }, [myId, username, skin, subscribeToChannel, broadcast, startCountdown]);

  const broadcastFlap = useCallback(() => {
    broadcast({ type: 'FLAP', player: myStateRef.current });
  }, [broadcast]);

  const broadcastState = useCallback((patch: Partial<MPPlayerState>) => {
    myStateRef.current = { ...myStateRef.current, ...patch };
  }, []);

  const leave = useCallback(() => {
    broadcast({ type: 'LEAVE', player: myStateRef.current });
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    clearInterval(broadcastTimerRef.current!);
    clearInterval(countdownTimerRef.current!);
    setPhase('LOBBY');
    setRoomCode('');
    setOpponentState(null);
  }, [broadcast]);

  // ---------------------------------------------------------------------------
  // Periodic state broadcast while playing
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    broadcastTimerRef.current = setInterval(() => {
      broadcast({ type: 'STATE', player: myStateRef.current });
    }, 1000 / BROADCAST_HZ);
    return () => clearInterval(broadcastTimerRef.current!);
  }, [phase, broadcast]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
      clearInterval(broadcastTimerRef.current!);
      clearInterval(countdownTimerRef.current!);
    };
  }, []);

  return {
    phase,
    roomCode,
    myId,
    myState: myStateRef.current,
    opponentState,
    countdown,
    createRoom,
    joinRoom,
    broadcastFlap,
    broadcastState,
    leave,
  };
}
