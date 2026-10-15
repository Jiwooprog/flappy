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
  // Keep myStateRef updated if username or skin change
  useEffect(() => {
    myStateRef.current.username = username;
    myStateRef.current.skin = skin;
  }, [username, skin]);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinAttemptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countingDownRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const broadcast = useCallback((msg: MPBroadcast) => {
    channelRef.current?.send({ type: 'broadcast', event: 'mp', payload: msg });
  }, []);

  const startCountdown = useCallback(() => {
    if (countingDownRef.current) return;
    countingDownRef.current = true;

    if (joinAttemptTimerRef.current) {
      clearInterval(joinAttemptTimerRef.current);
      joinAttemptTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    setPhase('COUNTDOWN');
    let remaining = COUNTDOWN_SEC;
    setCountdown(remaining);

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        countingDownRef.current = false;
        setPhase('PLAYING');
        optsRef.current.onCountdownEnd();
      }
    }, 1000);
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    myStateRef.current = makeInitialPlayer(myId, username, skin);

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

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
        // Guest joined and sent READY
        setOpponentState(payload.player);
        // Reply so guest knows host's real info and can also start countdown
        ch.send({
          type: 'broadcast',
          event: 'mp',
          payload: { type: 'HOST_ACK', player: myStateRef.current },
        });
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
  }, [myId, username, skin, startCountdown]);

  const joinRoom = useCallback((code: string) => {
    const upperCode = code.trim().toUpperCase();
    setRoomCode(upperCode);
    myStateRef.current = makeInitialPlayer(myId, username, skin);

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    const ch = supabase.channel(`mp_room_${upperCode}`, {
      config: { broadcast: { self: false } },
    });

    ch.on('broadcast', { event: 'mp' }, ({ payload }: { payload: MPBroadcast }) => {
      if (payload.player.playerId === myId) return; // ignore echoes

      if (payload.type === 'LEAVE') {
        setOpponentState(null);
        optsRef.current.onOpponentLeft();
        return;
      }

      if (payload.type === 'HOST_ACK') {
        // Received host acknowledgment: both are connected!
        if (joinAttemptTimerRef.current) {
          clearInterval(joinAttemptTimerRef.current);
          joinAttemptTimerRef.current = null;
        }
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
        // Broadcast READY to Host with retries until HOST_ACK is received
        let attempts = 0;
        const sendReady = () => {
          ch.send({
            type: 'broadcast',
            event: 'mp',
            payload: { type: 'READY', player: myStateRef.current },
          });
          attempts++;
          if (attempts >= 6 && joinAttemptTimerRef.current) {
            clearInterval(joinAttemptTimerRef.current);
            joinAttemptTimerRef.current = null;
          }
        };
        sendReady();
        if (joinAttemptTimerRef.current) clearInterval(joinAttemptTimerRef.current);
        joinAttemptTimerRef.current = setInterval(sendReady, 600);
      }
    });
  }, [myId, username, skin, startCountdown]);

  const broadcastFlap = useCallback(() => {
    broadcast({ type: 'FLAP', player: myStateRef.current });
  }, [broadcast]);

  const broadcastState = useCallback((patch: Partial<MPPlayerState>) => {
    myStateRef.current = { ...myStateRef.current, ...patch };
  }, []);

  const leave = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'mp',
        payload: { type: 'LEAVE', player: myStateRef.current },
      });
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (joinAttemptTimerRef.current) clearInterval(joinAttemptTimerRef.current);
    countingDownRef.current = false;
    setPhase('LOBBY');
    setRoomCode('');
    setOpponentState(null);
  }, []);

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
      if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (joinAttemptTimerRef.current) clearInterval(joinAttemptTimerRef.current);
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
