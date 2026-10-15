/**
 * MultiplayerGame – renders the local player's canvas game plus a live
 * opponent status bar, 1v1 match series score, and seamless in-room rematches.
 *
 * Pipe seeding: the room code / round seed is hashed into a numeric seed;
 * createPipe() is replaced with a seeded variant here.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { Bird, Pipe, Particle } from '../game/types';
import type { BirdSkin, Difficulty } from '../game/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DIFFICULTY_CONFIGS, SKINS } from '../game/constants';
import {
  createInitialBird,
  flapBird,
  updateBirdPhysics,
  checkCollision,
  updateParticles,
  createFlapParticles,
  createImpactParticles,
  createScoreParticles,
  PIPE_WIDTH,
} from '../game/physics';
import { GameRenderer } from '../game/renderer';
import { sound } from '../game/audio';
import { seededRng, roomCodeToSeed } from '../game/multiplayerTypes';
import type { MPPlayerState } from '../game/multiplayerTypes';
import { ArrowLeft, Wifi, Skull, RefreshCw, Loader2 } from 'lucide-react';

interface MultiplayerGameProps {
  roomCode: string;
  myUsername: string;
  skin: BirdSkin;
  difficulty: Difficulty;
  opponentState: MPPlayerState | null;
  onFlap: () => void;
  onStateChange: (patch: Partial<MPPlayerState>) => void;
  onLeave: () => void;
  /** countdown value from hook (0 means game is live) */
  countdown: number;
  phase: 'COUNTDOWN' | 'PLAYING' | 'RESULT';
  myWins: number;
  opponentWins: number;
  roundNumber: number;
  roundSeed: number;
  rematchRequested: boolean;
  opponentWantsRematch: boolean;
  onRequestRematch: () => void;
  onAcceptRematch: () => void;
  onRecordRoundWin: (winner: 'me' | 'opponent') => void;
}

// Seeded pipe creator that matches physics.createPipe signature
function createSeededPipe(
  rng: () => number,
  x: number,
  gap: number,
  pipeId: number
): Pipe {
  const playAreaHeight = CANVAS_HEIGHT - 90; // GROUND_HEIGHT
  const minTopHeight = 65;
  const maxTopHeight = playAreaHeight - gap - 65;
  const topHeight = Math.floor(minTopHeight + rng() * (maxTopHeight - minTopHeight));
  return { id: pipeId, x, topHeight, bottomY: topHeight + gap, width: PIPE_WIDTH, passed: false };
}

export const MultiplayerGame: React.FC<MultiplayerGameProps> = ({
  roomCode,
  myUsername,
  skin,
  difficulty,
  opponentState,
  onFlap,
  onStateChange,
  onLeave,
  countdown,
  phase,
  myWins,
  opponentWins,
  roundNumber,
  roundSeed,
  rematchRequested,
  opponentWantsRematch,
  onRequestRematch,
  onAcceptRematch,
  onRecordRoundWin,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const birdRef = useRef<Bird>(createInitialBird());
  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scrollOffsetRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const lastPipeIdRef = useRef(0);
  const flashAlphaRef = useRef(0);
  const shakeTimerRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const scoreRef = useRef(0);
  const rngRef = useRef<(() => number) | null>(null);

  const [score, setScore] = useState(0);
  const [isAlive, setIsAlive] = useState(true);
  const [gameResult, setGameResult] = useState<'WIN' | 'LOSE' | null>(null);

  const config = DIFFICULTY_CONFIGS[difficulty];
  const currentSkin = SKINS[skin];

  // Re-seed RNG when roundSeed or roomCode changes
  useEffect(() => {
    const seed = roundSeed || roomCodeToSeed(roomCode);
    rngRef.current = seededRng(seed);
    setGameResult(null);
    setIsAlive(true);
    setScore(0);
    aliveRef.current = true;
    scoreRef.current = 0;
  }, [roomCode, roundSeed]);

  // Check if opponent died → we win (if we're still alive)
  useEffect(() => {
    if (opponentState && !opponentState.alive && aliveRef.current && phase === 'PLAYING' && !gameResult) {
      setGameResult('WIN');
      onRecordRoundWin('me');
    }
  }, [opponentState, phase, gameResult, onRecordRoundWin]);

  // -----------------------------------------------------------------------
  // Flap handler
  // -----------------------------------------------------------------------
  const handleFlap = useCallback(() => {
    if (!aliveRef.current || phase !== 'PLAYING') return;
    birdRef.current = flapBird(birdRef.current, config.jumpForce);
    particlesRef.current.push(...createFlapParticles(birdRef.current, currentSkin.particleColor));
    sound.playFlap();
    onFlap();
  }, [config.jumpForce, currentSkin.particleColor, onFlap, phase]);

  // -----------------------------------------------------------------------
  // Keyboard & click (canvas area)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        handleFlap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleFlap]);

  // -----------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const renderer = new GameRenderer(ctx);

    // Reset state for fresh round
    birdRef.current = createInitialBird();
    birdRef.current = flapBird(birdRef.current, config.jumpForce); // initial flap
    pipesRef.current = [];
    particlesRef.current = [];
    scrollOffsetRef.current = 0;
    lastPipeIdRef.current = 0;
    aliveRef.current = true;
    scoreRef.current = 0;
    setScore(0);
    setIsAlive(true);
    setGameResult(null);
    rngRef.current = seededRng(roundSeed || roomCodeToSeed(roomCode));

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      if (aliveRef.current) {
        // Scroll
        scrollOffsetRef.current += config.pipeSpeed * dt;

        // Bird physics
        updateBirdPhysics(birdRef.current, dt, config.gravity);

        // Pipes: spawn using seeded rng
        const pipes = pipesRef.current;
        let write = 0;
        for (let i = 0; i < pipes.length; i++) {
          const pipe = pipes[i];
          pipe.x -= config.pipeSpeed * dt;
          if (!pipe.passed && birdRef.current.x > pipe.x + pipe.width / 2) {
            pipe.passed = true;
            scoreRef.current += 1;
            const next = scoreRef.current;
            setScore(next);
            sound.playScore();
            particlesRef.current.push(...createScoreParticles(birdRef.current.x, birdRef.current.y));
            onStateChange({ score: next });
          }
          if (pipe.x + pipe.width + 10 > 0) pipes[write++] = pipe;
        }
        pipes.length = write;

        // Spawn new pipes
        if (pipes.length === 0) {
          lastPipeIdRef.current += 1;
          pipes.push(createSeededPipe(rngRef.current!, CANVAS_WIDTH + 30, config.pipeGap, lastPipeIdRef.current));
        } else if (pipes[pipes.length - 1].x <= CANVAS_WIDTH - config.pipeInterval) {
          lastPipeIdRef.current += 1;
          pipes.push(createSeededPipe(rngRef.current!, CANVAS_WIDTH + 10, config.pipeGap, lastPipeIdRef.current));
        }

        // Collision
        if (checkCollision(birdRef.current, pipes)) {
          aliveRef.current = false;
          setIsAlive(false);
          setGameResult('LOSE');
          onRecordRoundWin('opponent');
          flashAlphaRef.current = 0.85;
          shakeTimerRef.current = 0.28;
          sound.playHit();
          setTimeout(() => sound.playFall(), 120);
          particlesRef.current.push(...createImpactParticles(birdRef.current, currentSkin.bodyColor));
          onStateChange({ alive: false, finished: true });
        }

        // Sync Y position periodically
        onStateChange({ y: birdRef.current.y, vy: birdRef.current.vy });
      } else {
        // Dead: bird falls
        if (birdRef.current.y + birdRef.current.radius < CANVAS_HEIGHT - 90) {
          birdRef.current.vy += config.gravity * dt;
          birdRef.current.y += birdRef.current.vy * dt;
          birdRef.current.rotation = Math.min(Math.PI / 2, birdRef.current.rotation + dt * 5);
        }
      }

      // Particles
      particlesRef.current = updateParticles(particlesRef.current, dt);

      // Decrement screen fx
      if (shakeTimerRef.current > 0) shakeTimerRef.current -= dt;
      if (flashAlphaRef.current > 0) flashAlphaRef.current = Math.max(0, flashAlphaRef.current - dt * 2.8);

      // RENDER
      ctx.save();
      if (shakeTimerRef.current > 0) {
        const shakeMag = (shakeTimerRef.current / 0.28) * 7;
        ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);
      }

      renderer.clear();
      renderer.renderBackground('day', scrollOffsetRef.current);
      renderer.renderPipes(pipesRef.current, 'day');
      renderer.renderGround('day', scrollOffsetRef.current);
      renderer.renderParticles(particlesRef.current);

      // Render local player bird
      renderer.renderBird(birdRef.current, skin);

      // Render opponent ghost bird
      if (opponentState && opponentState.alive) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        const opponentBird: Bird = {
          x: birdRef.current.x,
          y: opponentState.y,
          vy: opponentState.vy,
          radius: birdRef.current.radius,
          rotation: Math.min(Math.PI / 2, Math.max(-Math.PI / 4, opponentState.vy * 0.04)),
          wingFrame: birdRef.current.wingFrame,
          wingTimer: 0,
        };
        const oppSkinKey = (opponentState.skin as BirdSkin) in SKINS ? (opponentState.skin as BirdSkin) : 'classic';
        renderer.renderBird(opponentBird, oppSkinKey);
        ctx.restore();
      }

      renderer.renderFlash(flashAlphaRef.current);
      ctx.restore();

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      lastTimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundSeed]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="mp-game-wrapper">
      {/* 1v1 Series Match Scorebar */}
      <div className="mp-scorebar">
        <div className="mp-scorebar-player mine">
          <span className="mp-scorebar-name">{myUsername}</span>
          <span className="mp-round-badge" title="Rounds won">{myWins}W</span>
          <span className="mp-scorebar-score">{score}</span>
        </div>

        <div className="mp-scorebar-center">
          <span className="mp-scorebar-round">ROUND {roundNumber}</span>
          <span className="mp-scorebar-vs">VS</span>
        </div>

        <div className="mp-scorebar-player theirs">
          <span className="mp-scorebar-score">{opponentState?.score ?? 0}</span>
          <span className="mp-round-badge" title="Rounds won">{opponentWins}W</span>
          <span className="mp-scorebar-name">{opponentState?.username ?? 'Opponent'}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="mp-canvas-wrap" onClick={handleFlap}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas"
        />

        {/* Countdown overlay */}
        {phase === 'COUNTDOWN' && countdown > 0 && (
          <div className="mp-countdown-overlay">
            <div className="mp-countdown-num">{countdown}</div>
            <div className="mp-countdown-sub">ROUND {roundNumber}</div>
          </div>
        )}

        {/* Opponent disconnected badge */}
        {!opponentState?.alive && opponentState && phase === 'PLAYING' && (
          <div className="mp-opponent-dead-badge">
            <Skull size={14} className="mr-1" /> {opponentState.username} crashed!
          </div>
        )}

        {/* 1v1 Round Result Overlay */}
        {gameResult && (
          <div className="modal-overlay animate-fade-in mp-result-backdrop" onClick={(e) => e.stopPropagation()}>
            <div className={`mp-result-card animate-pop-up ${gameResult === 'WIN' ? 'mp-win' : 'mp-lose'}`}>
              {/* Top Series Score Banner */}
              <div className="mp-result-series-box">
                <span className="mp-result-series-title">1v1 MATCH SCORE</span>
                <div className="mp-result-series-scoreboard">
                  <div className="mp-series-side">
                    <span className="mp-series-player-name">{myUsername}</span>
                    <span className="mp-series-wins-num">{myWins}</span>
                  </div>
                  <span className="mp-series-colon">:</span>
                  <div className="mp-series-side">
                    <span className="mp-series-wins-num">{opponentWins}</span>
                    <span className="mp-series-player-name">{opponentState?.username ?? 'Opponent'}</span>
                  </div>
                </div>
              </div>

              <div className="mp-result-emoji">{gameResult === 'WIN' ? '🏆' : '💀'}</div>
              <div className="mp-result-label">
                {gameResult === 'WIN' ? 'ROUND WON!' : 'ROUND LOST!'}
              </div>
              <div className="mp-result-sub">
                {gameResult === 'WIN'
                  ? `You outlasted ${opponentState?.username ?? 'your opponent'}!`
                  : `You crashed first. Time for a rematch!`}
              </div>

              <div className="mp-result-scores">
                <span>Pipes passed: <strong>{score}</strong></span>
                <span>Theirs: <strong>{opponentState?.score ?? 0}</strong></span>
              </div>

              {/* Rematch Actions */}
              <div className="mp-result-actions">
                {opponentWantsRematch ? (
                  <button
                    type="button"
                    className="arcade-btn primary-btn mp-action-btn pulse-glow"
                    onClick={onAcceptRematch}
                  >
                    <RefreshCw size={18} className="mr-2" />
                    ACCEPT REMATCH!
                  </button>
                ) : rematchRequested ? (
                  <button
                    type="button"
                    className="arcade-btn secondary-btn mp-action-btn opacity-75 cursor-not-allowed"
                    disabled
                  >
                    <Loader2 size={16} className="animate-spin mr-2" />
                    WAITING FOR OPPONENT...
                  </button>
                ) : (
                  <button
                    type="button"
                    className="arcade-btn primary-btn mp-action-btn"
                    onClick={onRequestRematch}
                  >
                    <RefreshCw size={18} className="mr-2" />
                    PLAY AGAIN (ROUND {roundNumber + 1})
                  </button>
                )}

                <button
                  type="button"
                  className="arcade-btn secondary-btn mp-action-btn mp-leave-room-btn"
                  onClick={onLeave}
                >
                  <ArrowLeft size={16} className="mr-2" />
                  LEAVE ROOM
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leave button during active round */}
      {!gameResult && (
        <button type="button" className="mp-leave-btn" onClick={onLeave}>
          <ArrowLeft size={14} className="mr-1" /> Leave Room
        </button>
      )}

      {/* Opponent alive indicator */}
      <div className="mp-alive-bar">
        <Wifi size={12} className={opponentState ? 'text-emerald-400' : 'text-red-400'} />
        <span>{opponentState ? `${opponentState.username} connected` : 'Waiting for opponent…'}</span>
        {!isAlive && <span className="mp-you-dead">YOU CRASHED</span>}
      </div>
    </div>
  );
};
