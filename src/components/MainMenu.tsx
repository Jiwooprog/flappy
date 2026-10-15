import React from 'react';
import {
  Play,
  Palette,
  Trophy,
  HelpCircle,
  Settings,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import type { Difficulty, BirdSkin } from '../game/types';
import { DIFFICULTY_CONFIGS, SKINS } from '../game/constants';

interface MainMenuProps {
  onPlay: () => void;
  difficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  skin: BirdSkin;
  onOpenSkins: () => void;
  onOpenStats: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
  onOpenMultiplayer: () => void;
  bestScore: number;
  isMuted: boolean;
  onToggleMute: () => void;
  username: string;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlay,
  difficulty,
  onSelectDifficulty,
  skin,
  onOpenSkins,
  onOpenStats: _onOpenStats,
  onOpenHowToPlay,
  onOpenSettings,
  onOpenLeaderboard,
  onOpenMultiplayer,
  bestScore,
  isMuted,
  onToggleMute,
  username,
}) => {
  const currentSkin = SKINS[skin];
  const diffConfig = DIFFICULTY_CONFIGS[difficulty];

  return (
    <div className="main-menu-container animate-fade-in">
      {/* Top Bar with Best Score, Gamer Tag & Sound */}
      <div className="menu-top-row">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="menu-user-badge"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLeaderboard();
            }}
            title="Edit Gamer Tag & View Rankings"
          >
            <span className="text-sky-400 mr-1">👤</span>
            <span className="truncate max-w-[90px]">{username}</span>
          </button>

          <div className="menu-record-badge">
            <Trophy size={13} className="text-amber-400 mr-1" />
            <span>BEST: <strong>{bestScore}</strong></span>
          </div>
        </div>

        <div className="menu-top-actions">
          <button
            type="button"
            className="hud-icon-btn menu-icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Arcade Title */}
      <div className="menu-title-block animate-float">
        <h1 className="game-logo-text">FLAPPY</h1>
        <h2 className="game-logo-sub">BIRD</h2>
      </div>

      {/* Bird Avatar Preview Card */}
      <div
        className="menu-bird-preview animate-pulse-gentle"
        onClick={(e) => {
          e.stopPropagation();
          onOpenSkins();
        }}
        title="Change Skin"
      >
        <div
          className="menu-bird-circle"
          style={{
            backgroundColor: currentSkin.bodyColor,
            borderColor: '#ffffff',
            boxShadow: currentSkin.glowColor ? `0 0 16px ${currentSkin.glowColor}` : '0 4px 10px rgba(0,0,0,0.3)',
          }}
        >
          {currentSkin.imageUrl ? (
            <img src={currentSkin.imageUrl} alt={currentSkin.name} className="menu-bird-photo" />
          ) : (
            <div
              className="menu-bird-eye"
              style={{ backgroundColor: currentSkin.eyeColor === '#ffffff' ? '#0f172a' : currentSkin.eyeColor }}
            />
          )}
          <div
            className="menu-bird-wing animate-flap"
            style={{ backgroundColor: currentSkin.wingColor }}
          />
          <div
            className="menu-bird-beak"
            style={{ borderLeftColor: currentSkin.beakColor }}
          />
        </div>
        <div className="menu-skin-label">
          <Palette size={12} className="mr-1 inline text-sky-400" />
          <span>{currentSkin.name}</span>
        </div>
      </div>

      {/* Difficulty Quick Pills */}
      <div className="menu-difficulty-row">
        {(['casual', 'classic', 'hardcore'] as Difficulty[]).map((d) => {
          const isSelected = difficulty === d;
          const config = DIFFICULTY_CONFIGS[d];
          return (
            <button
              key={d}
              type="button"
              className={`diff-pill ${isSelected ? 'active' : ''}`}
              style={{
                borderColor: isSelected ? config.badgeColor : 'transparent',
                backgroundColor: isSelected ? `${config.badgeColor}35` : 'rgba(0,0,0,0.3)',
                color: isSelected ? '#ffffff' : '#cbd5e1',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDifficulty(d);
              }}
            >
              {d.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Action Buttons Menu */}
      <div className="menu-buttons-list">
        {/* Play Button */}
        <button
          type="button"
          className="arcade-btn primary-btn menu-play-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          autoFocus
        >
          <Play size={20} className="mr-2" fill="currentColor" />
          PLAY GAME
        </button>

        {/* Secondary Buttons Grid */}
        <div className="menu-secondary-grid">
          <button
            type="button"
            className="menu-sub-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSkins();
            }}
          >
            <Palette size={17} className="text-cyan-400 mb-1" />
            <span>SKINS</span>
          </button>

          <button
            type="button"
            className="menu-sub-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLeaderboard();
            }}
          >
            <Trophy size={17} className="text-amber-400 mb-1" />
            <span>RECORDS</span>
          </button>

          <button
            type="button"
            className="menu-sub-btn mp-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMultiplayer();
            }}
          >
            <Wifi size={17} className="text-emerald-400 mb-1" />
            <span>VERSUS</span>
          </button>

          <button
            type="button"
            className="menu-sub-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHowToPlay();
            }}
          >
            <HelpCircle size={17} className="text-emerald-400 mb-1" />
            <span>RULES</span>
          </button>

          <button
            type="button"
            className="menu-sub-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
          >
            <Settings size={17} className="text-purple-400 mb-1" />
            <span>CONFIG</span>
          </button>
        </div>
      </div>

      {/* Difficulty description footer */}
      <div className="menu-diff-hint">
        <span style={{ color: diffConfig.badgeColor }}>●</span> {diffConfig.description}
      </div>
    </div>
  );
};
