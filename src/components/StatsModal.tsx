import React from 'react';
import { X, Trophy, Flame, Feather, Trash2 } from 'lucide-react';
import { DIFFICULTY_CONFIGS } from '../game/constants';
import type { Difficulty } from '../game/types';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gamesPlayed: number;
  totalFlaps: number;
  onResetAllStats: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  gamesPlayed,
  totalFlaps,
  onResetAllStats,
}) => {
  if (!isOpen) return null;

  const difficulties: Difficulty[] = ['casual', 'classic', 'hardcore'];

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="settings-card animate-pop-up" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">
            <Trophy size={20} className="text-amber-400 mr-2" />
            ARCADE RECORDS
          </div>
          <button className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="settings-scroll-body">
          {/* Best Scores per difficulty */}
          <div className="settings-section">
            <h3 className="section-heading">BEST SCORES</h3>
            <div className="stats-records-list">
              {difficulties.map((d) => {
                const config = DIFFICULTY_CONFIGS[d];
                const savedBest = localStorage.getItem(`flappy_best_${d}`);
                const best = savedBest ? parseInt(savedBest, 10) : 0;

                return (
                  <div key={d} className="stat-record-card">
                    <div className="stat-record-left">
                      <span
                        className="diff-badge"
                        style={{
                          backgroundColor: `${config.badgeColor}25`,
                          color: config.badgeColor,
                          borderColor: config.badgeColor,
                        }}
                      >
                        {d.toUpperCase()}
                      </span>
                    </div>
                    <div className="stat-record-val">
                      <Trophy size={16} className="text-amber-400 mr-1.5" />
                      <span>{best}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lifetime Career Stats */}
          <div className="settings-section">
            <h3 className="section-heading">CAREER STATS</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <Flame size={20} className="text-orange-400 mb-1" />
                <div className="stat-card-number">{gamesPlayed}</div>
                <div className="stat-card-label">Games Played</div>
              </div>

              <div className="stat-card">
                <Feather size={20} className="text-sky-400 mb-1" />
                <div className="stat-card-number">{totalFlaps}</div>
                <div className="stat-card-label">Total Flaps</div>
              </div>
            </div>
          </div>

          {/* Reset Stats Option */}
          <div className="settings-section danger-section">
            <h3 className="section-heading">DATA MANAGEMENT</h3>
            <button
              type="button"
              className="reset-score-btn w-full justify-center"
              onClick={() => {
                if (window.confirm('Reset all high scores and gameplay statistics?')) {
                  onResetAllStats();
                }
              }}
            >
              <Trash2 size={15} className="mr-2" />
              Reset All Arcade Records
            </button>
          </div>
        </div>

        <div className="settings-footer">
          <button type="button" className="arcade-btn primary-btn" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
