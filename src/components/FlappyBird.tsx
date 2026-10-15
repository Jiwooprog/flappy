import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import type { GameState, BirdSkin, Difficulty, Theme, Bird, Pipe, Particle } from '../game/types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  DIFFICULTY_CONFIGS,
  SKINS,
} from '../game/constants';
import {
  createInitialBird,
  flapBird,
  updateBirdPhysics,
  updatePipesList,
  checkCollision,
  updateParticles,
  createFlapParticles,
  createScoreParticles,
  createImpactParticles,
} from '../game/physics';
import { GameRenderer } from '../game/renderer';
import { sound } from '../game/audio';
import { HUD } from './HUD';
import { ScoreBoard } from './ScoreBoard';
import { StartScreen } from './StartScreen';
import { GameOverModal } from './GameOverModal';
import { SettingsModal } from './SettingsModal';
import { MainMenu } from './MainMenu';
import { HowToPlayModal } from './HowToPlayModal';
import { StatsModal } from './StatsModal';
import { LeaderboardModal } from './LeaderboardModal';
import { UsernameSetupModal } from './UsernameSetupModal';
import { getStoredUsername, hasSetUsername, submitLeaderboardScore } from '../game/leaderboard';

export const FlappyBird: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // User Preferences & State
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState<number>(0);
  const [username, setUsername] = useState<string>(() => getStoredUsername());
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    return (localStorage.getItem('flappy_difficulty') as Difficulty) || 'classic';
  });
  const [skin, setSkin] = useState<BirdSkin>(() => {
    return (localStorage.getItem('flappy_skin') as BirdSkin) || 'classic';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('flappy_theme') as Theme) || 'day';
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState<boolean>(false);
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [submittedRank, setSubmittedRank] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [showUsernameSetup, setShowUsernameSetup] = useState<boolean>(() => !hasSetUsername());

  // Best score for current difficulty
  const [bestScore, setBestScore] = useState<number>(() => {
    const saved = localStorage.getItem(`flappy_best_${difficulty}`);
    return saved ? parseInt(saved, 10) : 0;
  });

  // Career statistics
  const [gamesPlayed, setGamesPlayed] = useState<number>(() => {
    const saved = localStorage.getItem('flappy_games_played');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [totalFlaps, setTotalFlaps] = useState<number>(() => {
    const saved = localStorage.getItem('flappy_total_flaps');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Game Engine Refs
  const birdRef = useRef<Bird>(createInitialBird());
  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scrollOffsetRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const lastPipeIdRef = useRef<number>(0);
  const flashAlphaRef = useRef<number>(0);
  const shakeTimerRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const celebratedScoreRef = useRef<boolean>(false);
  const idleFloatTimerRef = useRef<number>(0);

  // Keep state accessible to loop without re-binding
  const stateRef = useRef({
    gameState,
    difficulty,
    skin,
    theme,
    score,
    bestScore,
    username,
  });

  useEffect(() => {
    stateRef.current = {
      gameState,
      difficulty,
      skin,
      theme,
      score,
      bestScore,
      username,
    };
  }, [gameState, difficulty, skin, theme, score, bestScore, username]);

  const handleSelectDifficulty = useCallback((newDiff: Difficulty) => {
    setDifficulty(newDiff);
    const saved = localStorage.getItem(`flappy_best_${newDiff}`);
    setBestScore(saved ? parseInt(saved, 10) : 0);
    localStorage.setItem('flappy_difficulty', newDiff);
  }, []);

  useEffect(() => {
    localStorage.setItem('flappy_skin', skin);
  }, [skin]);

  useEffect(() => {
    localStorage.setItem('flappy_theme', theme);
  }, [theme]);

  // Restart / Reset Game Loop
  const resetGame = useCallback(() => {
    birdRef.current = createInitialBird();
    pipesRef.current = [];
    particlesRef.current = [];
    scrollOffsetRef.current = 0;
    lastPipeIdRef.current = 0;
    flashAlphaRef.current = 0;
    shakeTimerRef.current = 0;
    celebratedScoreRef.current = false;
    setScore(0);
    setIsNewBest(false);
    setSubmittedRank(null);
  }, []);

  const handleHome = useCallback(() => {
    resetGame();
    setGameState('MENU');
  }, [resetGame]);

  const handlePlayFromMenu = useCallback(() => {
    resetGame();
    setGameState('IDLE');
  }, [resetGame]);

  const handleStartGame = useCallback(() => {
    resetGame();
    setGamesPlayed((prev) => {
      const next = prev + 1;
      localStorage.setItem('flappy_games_played', String(next));
      return next;
    });

    // Immediate initial flap
    const currentDiff = stateRef.current.difficulty;
    const config = DIFFICULTY_CONFIGS[currentDiff];
    birdRef.current = flapBird(birdRef.current, config.jumpForce);
    particlesRef.current.push(...createFlapParticles(birdRef.current, SKINS[skin].particleColor));
    sound.playFlap();

    setTotalFlaps((prev) => {
      const next = prev + 1;
      localStorage.setItem('flappy_total_flaps', String(next));
      return next;
    });

    setGameState('PLAYING');
  }, [resetGame, skin]);

  const handleRestart = useCallback(() => {
    handleStartGame();
  }, [handleStartGame]);

  const handleFlap = useCallback(() => {
    if (stateRef.current.gameState === 'MENU') {
      return;
    }

    if (stateRef.current.gameState === 'IDLE') {
      handleStartGame();
      return;
    }

    if (stateRef.current.gameState === 'PLAYING') {
      const currentDiff = stateRef.current.difficulty;
      const config = DIFFICULTY_CONFIGS[currentDiff];
      birdRef.current = flapBird(birdRef.current, config.jumpForce);
      particlesRef.current.push(
        ...createFlapParticles(birdRef.current, SKINS[stateRef.current.skin].particleColor)
      );
      sound.playFlap();

      setTotalFlaps((prev) => {
        const next = prev + 1;
        localStorage.setItem('flappy_total_flaps', String(next));
        return next;
      });
    }
  }, [handleStartGame]);

  const handleGameOver = useCallback(() => {
    setGameState('GAMEOVER');
    flashAlphaRef.current = 0.85; // white screen flash
    shakeTimerRef.current = 0.28; // screen shake duration
    sound.playHit();
    setTimeout(() => sound.playFall(), 120);

    const currentScore = stateRef.current.score;
    const currentBest = stateRef.current.bestScore;
    const currentDiff = stateRef.current.difficulty;

    if (currentScore > currentBest) {
      setBestScore(currentScore);
      setIsNewBest(true);
      localStorage.setItem(`flappy_best_${currentDiff}`, String(currentScore));
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    // Auto-submit score to global shared leaderboard if score > 0
    if (currentScore > 0) {
      const currentUsername = stateRef.current.username;
      submitLeaderboardScore(currentUsername, currentScore, currentDiff, stateRef.current.skin).then((res) => {
        if (res && res.rank) {
          setSubmittedRank(res.rank);
        }
      });
    }

    // Impact particles
    particlesRef.current.push(
      ...createImpactParticles(birdRef.current, SKINS[stateRef.current.skin].bodyColor)
    );
  }, []);

  const handleScoreIncrement = useCallback(() => {
    setScore((prev) => {
      const next = prev + 1;
      sound.playScore();

      // Sparkles at bird
      particlesRef.current.push(...createScoreParticles(birdRef.current.x, birdRef.current.y));

      // Celebration if beating high score mid-game
      if (next > stateRef.current.bestScore && stateRef.current.bestScore > 0 && !celebratedScoreRef.current) {
        celebratedScoreRef.current = true;
        setIsNewBest(true);
        sound.playHighScore();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.4 },
        });
      }

      return next;
    });
  }, []);

  // Main Render & Physics Frame Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    const renderer = new GameRenderer(ctx);
    let isVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible && rafIdRef.current === null) {
        lastTimeRef.current = null;
        rafIdRef.current = requestAnimationFrame(loop);
      } else if (!isVisible && rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        lastTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const loop = (timestamp: number) => {
      if (!isVisible) return;
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }
      const rawDt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      // Clamp delta time to avoid large jumps when tabbing out
      const dt = Math.min(rawDt, 0.05);

      const currentState = stateRef.current.gameState;
      const currentConfig = DIFFICULTY_CONFIGS[stateRef.current.difficulty];
      const currentSkin = stateRef.current.skin;
      const currentTheme = stateRef.current.theme;

      // --- LOGIC UPDATES ---
      if (currentState === 'PLAYING') {
        // 1. Advance scroll offset
        scrollOffsetRef.current += currentConfig.pipeSpeed * dt;

        // 2. Bird Physics
        updateBirdPhysics(birdRef.current, dt, currentConfig.gravity);

        // 3. Pipes Movement & Spawning
        pipesRef.current = updatePipesList(
          pipesRef.current,
          dt,
          currentConfig,
          lastPipeIdRef,
          handleScoreIncrement,
          birdRef.current.x
        );

        // 4. Collision Check
        if (checkCollision(birdRef.current, pipesRef.current)) {
          handleGameOver();
        }
      } else if (currentState === 'IDLE' || currentState === 'MENU') {
        // Subtle background scroll & bird idle bobbing
        scrollOffsetRef.current += 30 * dt;
        idleFloatTimerRef.current += dt * 3.5;
        birdRef.current.y = 270 + Math.sin(idleFloatTimerRef.current) * 8;
        birdRef.current.rotation = 0;
        birdRef.current.wingTimer += dt * 10;
        birdRef.current.wingFrame = Math.floor(birdRef.current.wingTimer) % 4;
      } else if (currentState === 'GAMEOVER') {
        // Bird continues falling until it hits the ground
        if (birdRef.current.y + birdRef.current.radius < CANVAS_HEIGHT - 90) {
          birdRef.current.vy += currentConfig.gravity * dt;
          birdRef.current.y += birdRef.current.vy * dt;
          birdRef.current.rotation = Math.min(Math.PI / 2, birdRef.current.rotation + dt * 5);
        }
      }

      // Update particles
      particlesRef.current = updateParticles(particlesRef.current, dt);

      // Decrement shake and flash
      if (shakeTimerRef.current > 0) {
        shakeTimerRef.current -= dt;
      }
      if (flashAlphaRef.current > 0) {
        flashAlphaRef.current = Math.max(0, flashAlphaRef.current - dt * 2.8);
      }

      // --- RENDERING ---
      ctx.save();

      // Screen shake translation
      if (shakeTimerRef.current > 0) {
        const shakeMag = (shakeTimerRef.current / 0.28) * 7;
        const offsetX = (Math.random() - 0.5) * shakeMag;
        const offsetY = (Math.random() - 0.5) * shakeMag;
        ctx.translate(offsetX, offsetY);
      }

      renderer.clear();
      renderer.renderBackground(currentTheme, scrollOffsetRef.current);
      renderer.renderPipes(pipesRef.current, currentTheme);
      renderer.renderGround(currentTheme, scrollOffsetRef.current);
      renderer.renderParticles(particlesRef.current);
      if (currentState !== 'MENU') {
        renderer.renderBird(birdRef.current, currentSkin);
      }
      renderer.renderFlash(flashAlphaRef.current);

      ctx.restore();

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [handleGameOver, handleScoreIncrement]);

  // Global Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Flap keys
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (stateRef.current.gameState === 'GAMEOVER') {
          handleRestart();
        } else if (stateRef.current.gameState === 'MENU') {
          handlePlayFromMenu();
        } else {
          handleFlap();
        }
      }

      // Pause toggle
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (stateRef.current.gameState === 'PLAYING') {
          setGameState('PAUSED');
        } else if (stateRef.current.gameState === 'PAUSED') {
          setGameState('PLAYING');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlap, handleRestart, handlePlayFromMenu]);

  // Action Bar Handlers
  const handleTogglePause = () => {
    setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev));
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    sound.setMuted(nextMuted);
  };

  const handleCycleTheme = () => {
    const themes: Theme[] = ['day', 'sunset', 'night'];
    const nextIdx = (themes.indexOf(theme) + 1) % themes.length;
    setTheme(themes[nextIdx]);
  };

  const handleResetBestScore = () => {
    localStorage.removeItem(`flappy_best_${difficulty}`);
    setBestScore(0);
    setIsNewBest(false);
  };

  const handleResetAllStats = () => {
    (['casual', 'classic', 'hardcore'] as Difficulty[]).forEach((d) => {
      localStorage.removeItem(`flappy_best_${d}`);
    });
    localStorage.removeItem('flappy_games_played');
    localStorage.removeItem('flappy_total_flaps');
    setBestScore(0);
    setGamesPlayed(0);
    setTotalFlaps(0);
    setIsNewBest(false);
  };

  return (
    <div className="game-wrapper">
      {/* Arcade Cabinet Frame */}
      <div className="arcade-cabinet">
        {/* Top Marquee */}
        <div className="arcade-marquee">
          <div className="marquee-dots" />
          <span className="marquee-title">FLAPPY RETRO</span>
          <div className="marquee-dots" />
        </div>

        {/* Screen Bezel */}
        <div className="screen-bezel">
          <div className="screen-crt-container" onClick={handleFlap}>
            {/* The Canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="game-canvas"
            />

            {/* Top HUD Controls Overlay (hidden during MENU) */}
            {gameState !== 'MENU' && (
              <HUD
                gameState={gameState}
                isMuted={isMuted}
                theme={theme}
                onTogglePause={handleTogglePause}
                onToggleMute={handleToggleMute}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onCycleTheme={handleCycleTheme}
                onRestart={handleRestart}
                onHome={handleHome}
                onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
              />
            )}

            {/* Main Menu Screen */}
            {gameState === 'MENU' && (
              <MainMenu
                onPlay={handlePlayFromMenu}
                difficulty={difficulty}
                onSelectDifficulty={handleSelectDifficulty}
                skin={skin}
                onOpenSkins={() => setIsSettingsOpen(true)}
                onOpenStats={() => setIsStatsOpen(true)}
                onOpenHowToPlay={() => setIsHowToPlayOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
                bestScore={bestScore}
                isMuted={isMuted}
                onToggleMute={handleToggleMute}
                username={username}
              />
            )}

            {/* Dynamic Scoreboard during gameplay */}
            {gameState === 'PLAYING' && (
              <ScoreBoard score={score} bestScore={bestScore} />
            )}

            {/* Start Screen / Ready Prompt */}
            {gameState === 'IDLE' && (
              <StartScreen
                onStart={handleStartGame}
                difficulty={difficulty}
                onSelectDifficulty={handleSelectDifficulty}
                skin={skin}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}

            {/* Pause Overlay */}
            {gameState === 'PAUSED' && (
              <div className="modal-overlay animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="pause-dialog animate-pop-up">
                  <h2 className="pause-title">GAME PAUSED</h2>
                  <p className="pause-subtitle">Take a breather!</p>
                  <button
                    className="arcade-btn primary-btn mt-4"
                    onClick={() => setGameState('PLAYING')}
                  >
                    RESUME
                  </button>
                  <button
                    className="arcade-btn secondary-btn mt-2"
                    onClick={handleRestart}
                  >
                    RESTART
                  </button>
                  <button
                    className="arcade-btn secondary-btn mt-2"
                    onClick={handleHome}
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            )}

            {/* Game Over Modal */}
            {gameState === 'GAMEOVER' && (
              <GameOverModal
                score={score}
                bestScore={bestScore}
                isNewBest={isNewBest}
                difficulty={difficulty}
                onRestart={handleRestart}
                onHome={handleHome}
                username={username}
                onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
                submittedRank={submittedRank}
              />
            )}
          </div>
        </div>

        {/* Arcade Bottom Coin Door / Controls */}
        <div className="arcade-footer">
          <div className="arcade-instructions">
            <span>[SPACE] / CLICK TO FLAP</span> • <span>[P] PAUSE</span>
          </div>
        </div>
      </div>

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        skin={skin}
        onSelectSkin={setSkin}
        difficulty={difficulty}
        onSelectDifficulty={handleSelectDifficulty}
        theme={theme}
        onSelectTheme={setTheme}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onResetBestScore={handleResetBestScore}
        bestScore={bestScore}
      />

      {/* How To Play Modal */}
      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />

      {/* Career Stats / Records Modal */}
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        gamesPlayed={gamesPlayed}
        totalFlaps={totalFlaps}
        onResetAllStats={handleResetAllStats}
      />

      {/* Global Multi-user Leaderboard Modal */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentUsername={username}
        onUpdateUsername={setUsername}
        defaultFilter={difficulty}
      />

      {/* First-time Gamer Tag Setup */}
      {showUsernameSetup && (
        <UsernameSetupModal
          onComplete={(name) => {
            setUsername(name);
            setShowUsernameSetup(false);
          }}
        />
      )}
    </div>
  );
};
