import React from 'react';
import { RotateCcw, Trophy, Award, Sparkles, Home } from 'lucide-react';
import type { Difficulty } from '../game/types';
import { DIFFICULTY_CONFIGS } from '../game/constants';

interface GameOverModalProps {
  score: number;
  bestScore: number;
  isNewBest: boolean;
  difficulty: Difficulty;
  onRestart: () => void;
  onHome: () => void;
  username: string;
  onOpenLeaderboard: () => void;
  submittedRank: number | null;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  bestScore,
  isNewBest,
  difficulty,
  onRestart,
  onHome,
  username,
  onOpenLeaderboard,
  submittedRank,
}) => {
  // Medal logic
  let medal: { name: string; icon: string; color: string; bg: string } | null = null;
  if (score >= 100) {
    medal = { name: 'Platinum', icon: '💎', color: '#38bdf8', bg: 'linear-gradient(135deg, #e0f2fe, #38bdf8)' };
  } else if (score >= 50) {
    medal = { name: 'Gold', icon: '🥇', color: '#f59e0b', bg: 'linear-gradient(135deg, #fef3c7, #f59e0b)' };
  } else if (score >= 25) {
    medal = { name: 'Silver', icon: '🥈', color: '#94a3b8', bg: 'linear-gradient(135deg, #f1f5f9, #94a3b8)' };
  } else if (score >= 10) {
    medal = { name: 'Bronze', icon: '🥉', color: '#d97706', bg: 'linear-gradient(135deg, #fed7aa, #d97706)' };
  }

  const diffConfig = DIFFICULTY_CONFIGS[difficulty];

  return (
    <div className="modal-overlay animate-fade-in">
      <div className="game-over-card animate-pop-up">
        {/* Header Title */}
        <div className="game-over-banner">
          <span className="banner-text">GAME OVER</span>
        </div>

        {/* Score Board Box */}
        <div className="score-panel">
          {/* Header Pill with Username and Difficulty */}
          <div className="flex justify-between items-center w-full">
            <span className="game-over-user-tag">
              👤 {username}
            </span>
            <div
              className="panel-diff-badge"
              style={{
                backgroundColor: `${diffConfig.badgeColor}22`,
                color: diffConfig.badgeColor,
                borderColor: diffConfig.badgeColor,
              }}
            >
              {difficulty.toUpperCase()}
            </div>
          </div>

          {/* Submitted Rank Pill */}
          {submittedRank !== null && (
            <div className="leaderboard-rank-alert animate-pulse-gentle">
              <Trophy size={14} className="text-amber-400 mr-1.5" />
              <span>Rank <strong>#{submittedRank}</strong> on Global Leaderboard!</span>
            </div>
          )}

          <div className="panel-content-grid">
            {/* Medal Column */}
            <div className="medal-section">
              <div className="section-label">MEDAL</div>
              {medal ? (
                <div className="medal-badge" style={{ background: medal.bg }}>
                  <span className="medal-emoji">{medal.icon}</span>
                  <span className="medal-name">{medal.name}</span>
                </div>
              ) : (
                <div className="no-medal">
                  <Award size={28} className="text-gray-400" />
                  <span>Reach 10</span>
                </div>
              )}
            </div>

            {/* Scores Column */}
            <div className="score-numbers-section">
              <div className="score-row">
                <span className="section-label">SCORE</span>
                <span className="score-val current">{score}</span>
              </div>

              <div className="score-row">
                <span className="section-label flex-row-center">
                  BEST <Trophy size={14} className="ml-1 text-amber-500" />
                </span>
                <div className="flex-row-center gap-1">
                  {isNewBest && (
                    <span className="new-tag">
                      <Sparkles size={11} className="inline mr-0.5" />
                      NEW
                    </span>
                  )}
                  <span className="score-val best">{bestScore}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="modal-actions-trio">
          <button
            onClick={onRestart}
            className="arcade-btn primary-btn flex-1"
            autoFocus
          >
            <RotateCcw size={16} className="mr-1" />
            RETRY
          </button>
          <button
            onClick={onOpenLeaderboard}
            className="arcade-btn leader-btn flex-1"
          >
            <Trophy size={16} className="mr-1" />
            RANKS
          </button>
          <button
            onClick={onHome}
            className="arcade-btn secondary-btn flex-1"
          >
            <Home size={16} className="mr-1" />
            MENU
          </button>
        </div>

        <div className="keyboard-hint">
          Press <kbd>Space</kbd> or Tap to retry
        </div>
      </div>
    </div>
  );
};
