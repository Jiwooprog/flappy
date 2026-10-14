import React from 'react';
import { Pause, Play, Volume2, VolumeX, Settings, Sun, Sunset, Moon, RotateCcw, Home, Trophy } from 'lucide-react';
import type { GameState, Theme } from '../game/types';

interface HUDProps {
  gameState: GameState;
  isMuted: boolean;
  theme: Theme;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onCycleTheme: () => void;
  onRestart: () => void;
  onHome: () => void;
  onOpenLeaderboard: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  gameState,
  isMuted,
  theme,
  onTogglePause,
  onToggleMute,
  onOpenSettings,
  onCycleTheme,
  onRestart,
  onHome,
  onOpenLeaderboard,
}) => {
  return (
    <div className="game-top-hud">
      {/* Left side actions */}
      <div className="hud-actions-left">
        {gameState !== 'MENU' && (
          <button
            type="button"
            className="hud-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onHome();
            }}
            title="Main Menu"
            aria-label="Return to Main Menu"
          >
            <Home size={18} />
          </button>
        )}

        {gameState === 'PLAYING' || gameState === 'PAUSED' ? (
          <button
            type="button"
            className="hud-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePause();
            }}
            title={gameState === 'PAUSED' ? 'Resume (P)' : 'Pause (P)'}
            aria-label="Pause or Resume"
          >
            {gameState === 'PAUSED' ? <Play size={18} /> : <Pause size={18} />}
          </button>
        ) : null}

        {gameState === 'PLAYING' || gameState === 'PAUSED' ? (
          <button
            type="button"
            className="hud-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            title="Restart"
            aria-label="Restart"
          >
            <RotateCcw size={18} />
          </button>
        ) : null}
      </div>

      {/* Right side actions */}
      <div className="hud-actions-right">
        {/* Theme quick-toggle */}
        <button
          type="button"
          className="hud-icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onCycleTheme();
          }}
          title={`Theme: ${theme}`}
          aria-label="Cycle Theme"
        >
          {theme === 'day' && <Sun size={18} className="text-amber-300" />}
          {theme === 'sunset' && <Sunset size={18} className="text-orange-400" />}
          {theme === 'night' && <Moon size={18} className="text-indigo-300" />}
        </button>

        {/* Audio Mute */}
        <button
          type="button"
          className="hud-icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          title={isMuted ? 'Unmute' : 'Mute'}
          aria-label="Toggle Sound"
        >
          {isMuted ? <VolumeX size={18} className="text-red-400" /> : <Volume2 size={18} />}
        </button>

        {/* Leaderboard button */}
        <button
          type="button"
          className="hud-icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLeaderboard();
          }}
          title="Global Leaderboard"
          aria-label="Open Leaderboard"
        >
          <Trophy size={18} className="text-amber-400" />
        </button>

        {/* Settings modal */}
        <button
          type="button"
          className="hud-icon-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          title="Settings"
          aria-label="Open Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
};
