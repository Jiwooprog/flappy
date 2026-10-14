import React from 'react';
import { X, Volume2, VolumeX, Sparkles, Sun, Sunset, Moon, Trash2 } from 'lucide-react';
import type { BirdSkin, Difficulty, Theme } from '../game/types';
import { SKINS, DIFFICULTY_CONFIGS } from '../game/constants';
import { sound } from '../game/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skin: BirdSkin;
  onSelectSkin: (s: BirdSkin) => void;
  difficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  theme: Theme;
  onSelectTheme: (t: Theme) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onResetBestScore: () => void;
  bestScore: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  skin,
  onSelectSkin,
  difficulty,
  onSelectDifficulty,
  theme,
  onSelectTheme,
  isMuted,
  onToggleMute,
  onResetBestScore,
  bestScore,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="settings-card animate-pop-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-header">
          <div className="settings-title">
            <Sparkles size={20} className="text-amber-400 mr-2" />
            GAME SETTINGS
          </div>
          <button className="icon-btn-close" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="settings-scroll-body">
          {/* Section 1: Bird Skins */}
          <div className="settings-section">
            <h3 className="section-heading">SELECT BIRD SKIN</h3>
            <div className="skin-grid">
              {(Object.keys(SKINS) as BirdSkin[]).map((key) => {
                const s = SKINS[key];
                const isSelected = skin === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`skin-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectSkin(key);
                      sound.playFlap();
                    }}
                  >
                    {s.imageUrl ? (
                      <div
                        className="skin-avatar skin-avatar-img"
                        style={{
                          borderColor: isSelected ? '#ffffff' : s.bodyColor,
                          boxShadow: s.glowColor ? `0 0 10px ${s.glowColor}` : 'none',
                        }}
                      >
                        <img src={s.imageUrl} alt={s.name} className="skin-avatar-photo" />
                        <div
                          className="skin-avatar-wing-mini"
                          style={{ backgroundColor: s.wingColor }}
                        />
                      </div>
                    ) : (
                      <div
                        className="skin-avatar"
                        style={{
                          backgroundColor: s.bodyColor,
                          borderColor: isSelected ? '#ffffff' : s.wingColor,
                          boxShadow: s.glowColor ? `0 0 10px ${s.glowColor}` : 'none',
                        }}
                      >
                        <div
                          className="skin-avatar-wing"
                          style={{ backgroundColor: s.wingColor }}
                        />
                        <div
                          className="skin-avatar-eye"
                          style={{ backgroundColor: s.eyeColor === '#ffffff' ? '#000' : s.eyeColor }}
                        />
                      </div>
                    )}
                    <div className="skin-card-info">
                      <div className="skin-card-name">{s.name}</div>
                      <div className="skin-card-desc">{s.tagline}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Environment Theme */}
          <div className="settings-section">
            <h3 className="section-heading">ENVIRONMENT THEME</h3>
            <div className="theme-toggle-group">
              <button
                type="button"
                className={`theme-tab-btn ${theme === 'day' ? 'active' : ''}`}
                onClick={() => onSelectTheme('day')}
              >
                <Sun size={18} className="text-sky-400 mr-2" />
                Day
              </button>
              <button
                type="button"
                className={`theme-tab-btn ${theme === 'sunset' ? 'active' : ''}`}
                onClick={() => onSelectTheme('sunset')}
              >
                <Sunset size={18} className="text-orange-400 mr-2" />
                Sunset
              </button>
              <button
                type="button"
                className={`theme-tab-btn ${theme === 'night' ? 'active' : ''}`}
                onClick={() => onSelectTheme('night')}
              >
                <Moon size={18} className="text-indigo-400 mr-2" />
                Night
              </button>
            </div>
          </div>

          {/* Section 3: Difficulty */}
          <div className="settings-section">
            <h3 className="section-heading">DIFFICULTY</h3>
            <div className="difficulty-list">
              {(['casual', 'classic', 'hardcore'] as Difficulty[]).map((d) => {
                const config = DIFFICULTY_CONFIGS[d];
                const isSelected = difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`diff-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => onSelectDifficulty(d)}
                  >
                    <div className="diff-card-header">
                      <span
                        className="diff-badge"
                        style={{ backgroundColor: `${config.badgeColor}25`, color: config.badgeColor, borderColor: config.badgeColor }}
                      >
                        {d.toUpperCase()}
                      </span>
                    </div>
                    <div className="diff-card-desc">{config.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Sound Controls */}
          <div className="settings-section">
            <h3 className="section-heading">AUDIO</h3>
            <div className="sound-row">
              <span className="sound-label">Sound Effects</span>
              <button
                type="button"
                className={`sound-toggle-btn ${!isMuted ? 'active' : ''}`}
                onClick={() => {
                  onToggleMute();
                  if (isMuted) {
                    setTimeout(() => sound.playScore(), 50);
                  }
                }}
              >
                {isMuted ? (
                  <>
                    <VolumeX size={18} className="mr-1 text-red-400" />
                    <span>MUTED</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={18} className="mr-1 text-emerald-400" />
                    <span>ON</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 5: High Score Management */}
          <div className="settings-section danger-section">
            <h3 className="section-heading">DATA</h3>
            <div className="data-row">
              <div className="best-score-display">
                Current Best: <strong>{bestScore}</strong>
              </div>
              <button
                type="button"
                className="reset-score-btn"
                onClick={() => {
                  if (window.confirm('Are you sure you want to reset your high score?')) {
                    onResetBestScore();
                  }
                }}
              >
                <Trash2 size={14} className="mr-1" />
                Reset Record
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button type="button" className="arcade-btn primary-btn" onClick={onClose}>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
