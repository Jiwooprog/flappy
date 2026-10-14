import React from 'react';
import { Play, Settings as SettingsIcon } from 'lucide-react';
import type { Difficulty, BirdSkin } from '../game/types';
import { DIFFICULTY_CONFIGS, SKINS } from '../game/constants';

interface StartScreenProps {
  onStart: () => void;
  difficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  skin: BirdSkin;
  onOpenSettings: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  difficulty,
  onSelectDifficulty,
  skin,
  onOpenSettings,
}) => {
  const currentSkin = SKINS[skin];

  return (
    <div className="start-screen-container">
      {/* Title with retro 3D text styling */}
      <div className="title-wrapper animate-float">
        <h1 className="game-logo-text">FLAPPY</h1>
        <h2 className="game-logo-sub">BIRD</h2>
      </div>

      {/* Floating Ready Prompt */}
      <div className="tap-prompt-container animate-pulse-gentle">
        <button className="play-cta-button" onClick={onStart}>
          <Play size={24} fill="currentColor" />
          <span>START GAME</span>
        </button>
        <p className="tap-hint-text">
          or press <kbd>Space</kbd> / Tap screen
        </p>
      </div>

      {/* Quick Selectors & Badges */}
      <div className="start-bottom-bar">
        {/* Difficulty Selector */}
        <div className="difficulty-pill-group">
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
                  backgroundColor: isSelected ? `${config.badgeColor}25` : 'rgba(0,0,0,0.25)',
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

        {/* Skin & Customization Trigger */}
        <button
          type="button"
          className="skin-quick-badge"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
        >
          {currentSkin.imageUrl ? (
            <img src={currentSkin.imageUrl} alt={currentSkin.name} className="skin-dot-img" />
          ) : (
            <div
              className="skin-dot"
              style={{
                backgroundColor: currentSkin.bodyColor,
                boxShadow: currentSkin.glowColor ? `0 0 8px ${currentSkin.glowColor}` : 'none',
              }}
            />
          )}
          <span className="skin-quick-name">{currentSkin.name}</span>
          <SettingsIcon size={14} className="ml-1 opacity-70" />
        </button>
      </div>
    </div>
  );
};
