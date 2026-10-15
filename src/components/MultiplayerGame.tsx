/**
 * MultiplayerGame – renders the local player's canvas game plus a live
 * opponent status bar.  Both players see the same seeded pipe sequence.
 *
 * Pipe seeding: the room code is hashed into a numeric seed;
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
import { ArrowLeft, Wifi, Skull } from 'lucide-react';

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

  // Build seeded RNG once per room
  useEffect(() => {
    rngRef.current = seededRng(roomCodeToSeed(roomCode));
  }, [roomCode]);

  // Check if opponent died → we win (if we're still alive)
  useEffect(() => {
    if (opponentState && !opponentState.alive && aliveRef.current && phase === 'PLAYING') {
      setGameResult('WIN');
    }
  }, [opponentState, phase]);

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
    rngRef.current = seededRng(roomCodeToSeed(roomCode)); // reset seed

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
          flashAlphaRef.current = 0.85;
          shakeTimerRef.current = 0.28;
          sound.playHit();
          setTimeout(() => sound.playFall(), 120);
          particlesRef.current.push(...createImpactParticles(birdRef.current, currentSkin.bodyColor));
          onStateChange({ alive: false, finished: true });
        }

        // Sync Y position periodically (state hook handles interval)
        onStateChange({ y: birdRef.current.y, vy: birdRef.current.vy });
      } else {
        // Dead: bird falls
        if (birdRef.current.y + birdRef.current.radius < CANVAS_HEIGHT - 90) {
          birdRef.current.vy += config.gravity * dt;
          birdRef.current.y += birdRef.current.vy * dt;
          birdRef.current.rotation = Math.min(Math.PI / 2, birdRef.current.rotation + dt * 5);
        }
        scrollOffsetRef.current += 30 * dt;
      }

      particlesRef.current = updateParticles(particlesRef.current, dt);

      if (shakeTimerRef.current > 0) shakeTimerRef.current -= dt;
      if (flashAlphaRef.current > 0) flashAlphaRef.current = Math.max(0, flashAlphaRef.current - dt * 2.8);

      // --- Render ---
      ctx.save();
      if (shakeTimerRef.current > 0) {
        const mag = (shakeTimerRef.current / 0.28) * 7;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      renderer.clear();
      renderer.renderBackground('night', scrollOffsetRef.current);
      renderer.renderPipes(pipesRef.current, 'night');
      renderer.renderGround('night', scrollOffsetRef.current);
      renderer.renderParticles(particlesRef.current);
      renderer.renderBird(birdRef.current, skin);

      // Draw opponent ghost bird
      if (opponentState && opponentState.alive) {
        const ghostBird: Bird = {
          x: birdRef.current.x - 30, // slightly behind local bird
          y: opponentState.y,
          vy: opponentState.vy,
          rotation: opponentState.vy > 100 ? 0.4 : -0.2,
          radius: 14,
          wingFrame: Math.floor(Date.now() / 100) % 4,
          wingTimer: 0,
        };
        ctx.globalAlpha = 0.55;
        renderer.renderBird(
          ghostBird,
          (opponentState.skin as BirdSkin) ?? 'classic'
        );
        ctx.globalAlpha = 1;
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
  }, [phase]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="mp-game-wrapper">
      {/* Top bar: scores */}
      <div className="mp-scorebar">
        <div className="mp-scorebar-player mine">
          <span className="mp-scorebar-name">{myUsername}</span>
          <span className="mp-scorebar-score">{score}</span>
        </div>
        <span className="mp-scorebar-vs">VS</span>
        <div className="mp-scorebar-player theirs">
          <span className="mp-scorebar-score">{opponentState?.score ?? 0}</span>
          <span className="mp-scorebar-name">{opponentState?.username ?? '...'}</span>
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
          </div>
        )}

        {/* Opponent disconnected badge */}
        {!opponentState?.alive && opponentState && phase === 'PLAYING' && (
          <div className="mp-opponent-dead-badge">
            <Skull size={14} className="mr-1" /> {opponentState.username} crashed!
          </div>
        )}

        {/* Result overlay */}
        {gameResult && (
          <div className="modal-overlay animate-fade-in">
            <div className={`mp-result-card animate-pop-up ${gameResult === 'WIN' ? 'mp-win' : 'mp-lose'}`}>
              <div className="mp-result-emoji">{gameResult === 'WIN' ? '🏆' : '💀'}</div>
              <div className="mp-result-label">{gameResult === 'WIN' ? 'YOU WIN!' : 'YOU CRASHED!'}</div>
              <div className="mp-result-sub">
                {gameResult === 'WIN'
                  ? `${opponentState?.username ?? 'Opponent'} bit the dust.`
                  : `Better luck next time!`}
              </div>
              <div className="mp-result-scores">
                <span>Your score: <strong>{score}</strong></span>
                <span>Their score: <strong>{opponentState?.score ?? 0}</strong></span>
              </div>
              <button
                type="button"
                className="arcade-btn primary-btn mt-4"
                onClick={onLeave}
              >
                BACK TO MENU
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Leave button */}
      {!gameResult && (
        <button type="button" className="mp-leave-btn" onClick={onLeave}>
          <ArrowLeft size={14} className="mr-1" /> Leave
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
