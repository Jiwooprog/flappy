/**
 * useMultiplayer – manages the full lifecycle of a multiplayer room:
 *   lobby → countdown → playing → result
 * Supports series rounds, 1v1 match scoring, and in-room rematches.
 *
 * Uses Supabase Realtime Broadcast (no database writes needed).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../game/supabase';
import type { MPPhase, MPPlayerState, MPBroadcast } from '../game/multiplayerTypes';
import { generateRoomCode, roomCodeToSeed } from '../game/multiplayerTypes';
import type { BirdSkin } from '../game/types';

const BROADCAST_HZ = 20;   // state syncs per second
const COUNTDOWN_SEC = 3;

interface UseMPOptions {
  username: string;
  skin: BirdSkin;
  onCountdownEnd: () => void;   // called when game actually starts
  onOpponentLeft: () => void;   // opponent disconnected
}

export interface UseMPReturn {
  phase: MPPhase;
  roomCode: string;
  myId: string;
  myState: MPPlayerState;
  opponentState: MPPlayerState | null;
  countdown: number;
  myWins: number;
  opponentWins: number;
  roundNumber: number;
  roundSeed: number;
  rematchRequested: boolean;
  opponentWantsRematch: boolean;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  broadcastFlap: () => void;
  broadcastState: (patch: Partial<MPPlayerState>) => void;
  recordRoundWin: (winner: 'me' | 'opponent') => void;
  requestRematch: () => void;
  acceptRematch: () => void;
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

  // 1v1 Series Score & Rematch State
  const [myWins, setMyWins] = useState(0);
  const [opponentWins, setOpponentWins] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundSeed, setRoundSeed] = useState(0);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);

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
  const rematchRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countingDownRef = useRef(false);
  const rematchRequestedRef = useRef(false);
  const opponentWantsRematchRef = useRef(false);
  const isHostRef = useRef(false);   // true only for the player who called createRoom()
  const roundNumberRef = useRef(roundNumber);
  roundNumberRef.current = roundNumber;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const broadcast = useCallback((msg: MPBroadcast) => {
    channelRef.current?.send({ type: 'broadcast', event: 'mp', payload: msg });
  }, []);

  const startCountdown = useCallback((startAt?: number) => {
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
    const targetTime = startAt || (Date.now() + 3200);

    const updateCountdown = () => {
      const diffMs = targetTime - Date.now();
      const remaining = Math.max(0, Math.ceil(diffMs / 1000));
      setCountdown(remaining);
      if (diffMs <= 0) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        countingDownRef.current = false;
        setPhase('PLAYING');
        optsRef.current.onCountdownEnd();
      }
    };

    updateCountdown();
    countdownTimerRef.current = setInterval(updateCountdown, 80);
  }, []);

  const recordRoundWin = useCallback((winner: 'me' | 'opponent') => {
    if (winner === 'me') {
      setMyWins((prev) => prev + 1);
    } else {
      setOpponentWins((prev) => prev + 1);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Rematch actions
  // ---------------------------------------------------------------------------

  /** Stop any pending REMATCH retry loop */
  const stopRematchRetry = useCallback(() => {
    if (rematchRetryRef.current) {
      clearInterval(rematchRetryRef.current);
      rematchRetryRef.current = null;
    }
  }, []);

  /**
   * Only ever called by the HOST. Generates the next round seed, updates
   * local state, broadcasts REMATCH_ACCEPT, and starts the countdown.
   * The joiner never calls this — it waits for REMATCH_ACCEPT from the host.
   */
  const acceptRematch = useCallback(() => {
    if (!isHostRef.current) return; // safety guard — only host is authority

    stopRematchRetry(); // stop any pending host REMATCH retry

    const nextSeed = Math.floor(Math.random() * 10000000);
    const nextRound = roundNumberRef.current + 1;
    const startAt = Date.now() + 3200;

    rematchRequestedRef.current = false;
    opponentWantsRematchRef.current = false;
    setRematchRequested(false);
    setOpponentWantsRematch(false);
    setRoundNumber(nextRound);
    setRoundSeed(nextSeed);

    myStateRef.current = makeInitialPlayer(myId, username, skin);
    setOpponentState((prev) => (prev ? { ...prev, y: 270, vy: 0, score: 0, alive: true, finished: false } : null));

    channelRef.current?.send({
      type: 'broadcast',
      event: 'mp',
      payload: {
        type: 'REMATCH_ACCEPT',
        player: myStateRef.current,
        round: nextRound,
        roundSeed: nextSeed,
        startAt,
      },
    });

    startCountdown(startAt);
  }, [myId, username, skin, startCountdown, stopRematchRetry]);

  const acceptRematchRef = useRef(acceptRematch);
  acceptRematchRef.current = acceptRematch;

  const requestRematch = useCallback(() => {
    rematchRequestedRef.current = true;
    setRematchRequested(true);

    if (isHostRef.current) {
      // HOST: if joiner already signalled, start immediately; else signal & retry until joiner responds
      if (opponentWantsRematchRef.current) {
        acceptRematch();
      } else {
        const sendRematch = () => {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'mp',
            payload: { type: 'REMATCH', player: myStateRef.current },
          });
        };
        sendRematch();
        if (rematchRetryRef.current) clearInterval(rematchRetryRef.current);
        rematchRetryRef.current = setInterval(sendRematch, 700);
      }
    } else {
      // JOINER: broadcast REMATCH and retry until REMATCH_ACCEPT is received
      const sendRematch = () => {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'mp',
          payload: { type: 'REMATCH', player: myStateRef.current },
        });
      };
      sendRematch();
      if (rematchRetryRef.current) clearInterval(rematchRetryRef.current);
      rematchRetryRef.current = setInterval(sendRematch, 700);
    }
  }, [acceptRematch, stopRematchRetry]);

  // ---------------------------------------------------------------------------
  // Actions: Create & Join
  // ---------------------------------------------------------------------------
  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    setRoundSeed(roomCodeToSeed(code));
    setMyWins(0);
    setOpponentWins(0);
    setRoundNumber(1);
    rematchRequestedRef.current = false;
    opponentWantsRematchRef.current = false;
    isHostRef.current = true;   // this player is the host for this room
    setRematchRequested(false);
    setOpponentWantsRematch(false);
    myStateRef.current = makeInitialPlayer(myId, username, skin);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
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
        const startAt = Date.now() + 3200;
        setOpponentState(payload.player);
        ch.send({
          type: 'broadcast',
          event: 'mp',
          payload: { type: 'HOST_ACK', player: myStateRef.current, startAt },
        });
        startCountdown(startAt);
        return;
      }

      if (payload.type === 'STATE' || payload.type === 'FLAP') {
        if (countingDownRef.current && !payload.player.alive) {
          return; // Ignore stale dead packets during countdown
        }
        setOpponentState((prev) => ({ ...(prev ?? payload.player), ...payload.player }));
        return;
      }

      if (payload.type === 'REMATCH') {
        // Joiner signals rematch → mark it; if host already clicked, start immediately
        opponentWantsRematchRef.current = true;
        setOpponentWantsRematch(true);
        if (rematchRequestedRef.current) {
          acceptRematchRef.current(); // host is sole authority: generates seed & starts countdown
        }
        return;
      }

      // NOTE: Host never receives REMATCH_ACCEPT — it's the sender (self:false).
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
    setRoundSeed(roomCodeToSeed(upperCode));
    setMyWins(0);
    setOpponentWins(0);
    setRoundNumber(1);
    rematchRequestedRef.current = false;
    opponentWantsRematchRef.current = false;
    isHostRef.current = false;   // this player is the joiner
    setRematchRequested(false);
    setOpponentWantsRematch(false);
    myStateRef.current = makeInitialPlayer(myId, username, skin);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
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
        if (joinAttemptTimerRef.current) {
          clearInterval(joinAttemptTimerRef.current);
          joinAttemptTimerRef.current = null;
        }
        setOpponentState(payload.player);
        startCountdown(payload.startAt);
        return;
      }

      if (payload.type === 'STATE' || payload.type === 'FLAP') {
        if (countingDownRef.current && !payload.player.alive) {
          return; // Ignore stale dead packets during countdown
        }
        setOpponentState((prev) => ({ ...(prev ?? payload.player), ...payload.player }));
        return;
      }

      if (payload.type === 'REMATCH') {
        // Host wants a rematch — update UI; joiner just waits for REMATCH_ACCEPT from host
        opponentWantsRematchRef.current = true;
        setOpponentWantsRematch(true);
        return;
      }

      if (payload.type === 'REMATCH_ACCEPT') {
        stopRematchRetry(); // joiner got the ack — stop retrying
        const nextSeed = payload.roundSeed ?? Math.floor(Math.random() * 10000000);
        const nextRound = payload.round ?? (roundNumberRef.current + 1);
        rematchRequestedRef.current = false;
        opponentWantsRematchRef.current = false;
        setRematchRequested(false);
        setOpponentWantsRematch(false);
        setRoundNumber(nextRound);
        setRoundSeed(nextSeed);

        myStateRef.current = makeInitialPlayer(myId, username, skin);
        setOpponentState((prev) => (prev ? { ...prev, y: 270, vy: 0, score: 0, alive: true, finished: false } : null));

        startCountdown(payload.startAt);
        return;
      }
    });

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = ch;
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
  }, [myId, username, skin, startCountdown, roundNumber]);

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
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (broadcastTimerRef.current) clearInterval(broadcastTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (joinAttemptTimerRef.current) clearInterval(joinAttemptTimerRef.current);
    if (rematchRetryRef.current) clearInterval(rematchRetryRef.current);
    countingDownRef.current = false;
    setPhase('LOBBY');
    setRoomCode('');
    setOpponentState(null);
    setMyWins(0);
    setOpponentWins(0);
    setRoundNumber(1);
    setRematchRequested(false);
    setOpponentWantsRematch(false);
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
      if (channelRef.current) supabase.removeChannel(channelRef.current);
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
    myWins,
    opponentWins,
    roundNumber,
    roundSeed,
    rematchRequested,
    opponentWantsRematch,
    createRoom,
    joinRoom,
    broadcastFlap,
    broadcastState,
    recordRoundWin,
    requestRematch,
    acceptRematch,
    leave,
  };
}
