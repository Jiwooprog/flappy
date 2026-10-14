import React, { useState, useEffect } from 'react';
import {
  X,
  Trophy,
  Crown,
  Medal,
  RefreshCw,
  User,
  Check,
  Edit2,
  Sparkles,
} from 'lucide-react';
import type { LeaderboardEntry, Difficulty } from '../game/types';
import { fetchLeaderboard, saveUsername } from '../game/leaderboard';
import { SKINS, DIFFICULTY_CONFIGS } from '../game/constants';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  onUpdateUsername: (newName: string) => void;
  defaultFilter?: Difficulty | 'all';
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUsername,
  onUpdateUsername,
  defaultFilter = 'all',
}) => {
  const [filter, setFilter] = useState<Difficulty | 'all'>(defaultFilter);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>(currentUsername);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      fetchLeaderboard(filter).then((data) => {
        if (active) {
          setEntries(data);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen, filter]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const data = await fetchLeaderboard(filter);
      setEntries(data);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveName = () => {
    const saved = saveUsername(tempName);
    onUpdateUsername(saved);
    setIsEditingName(false);
  };

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="settings-card leaderboard-card animate-pop-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-header">
          <div className="settings-title">
            <Trophy size={20} className="text-amber-400 mr-2" />
            GLOBAL LEADERBOARD
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`icon-btn-close ${isLoading ? 'animate-spin' : ''}`}
              onClick={handleRefresh}
              title="Refresh"
              aria-label="Refresh Leaderboard"
            >
              <RefreshCw size={16} />
            </button>
            <button className="icon-btn-close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* User Identity Banner */}
        <div className="leaderboard-user-bar">
          <div className="user-bar-left">
            <User size={16} className="text-sky-400 mr-1.5" />
            <span className="user-bar-label">Your Gamer Tag:</span>
            {isEditingName ? (
              <div className="user-name-edit-form">
                <input
                  type="text"
                  maxLength={15}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="user-name-input"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                />
                <button type="button" onClick={handleSaveName} className="user-name-save-btn">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <span className="user-name-tag font-bold">
                {currentUsername}
              </span>
            )}
          </div>

          {!isEditingName && (
            <button
              type="button"
              className="user-name-edit-trigger"
              onClick={() => setIsEditingName(true)}
              title="Change Username"
            >
              <Edit2 size={13} className="mr-1" />
              Change
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="leaderboard-tabs">
          {(['all', 'classic', 'casual', 'hardcore'] as (Difficulty | 'all')[]).map((tab) => {
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`leaderboard-tab ${isActive ? 'active' : ''}`}
                onClick={() => setFilter(tab)}
              >
                {tab.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Scrollable Leaderboard Body */}
        <div className="settings-scroll-body leaderboard-body">
          {entries.length === 0 && !isLoading && (
            <div className="leaderboard-empty">
              <Trophy size={36} className="text-gray-500 mb-2" />
              <p>No scores submitted yet!</p>
              <span>Be the first champion on the leaderboard!</span>
            </div>
          )}

          {/* Top 3 Podium */}
          {topThree.length > 0 && (
            <div className="podium-grid">
              {/* 2nd place */}
              {topThree[1] && (
                <div className="podium-card silver">
                  <div className="podium-rank silver-medal">
                    <Medal size={16} /> 2nd
                  </div>
                  <div className="podium-avatar">
                    {SKINS[topThree[1].skin]?.imageUrl ? (
                      <img
                        src={SKINS[topThree[1].skin].imageUrl}
                        alt=""
                        className="podium-photo"
                      />
                    ) : (
                      <div
                        className="podium-dot"
                        style={{ backgroundColor: SKINS[topThree[1].skin]?.bodyColor || '#facc15' }}
                      />
                    )}
                  </div>
                  <div className="podium-name" title={topThree[1].username}>
                    {topThree[1].username}
                  </div>
                  <div className="podium-score">{topThree[1].score}</div>
                </div>
              )}

              {/* 1st place */}
              {topThree[0] && (
                <div className="podium-card gold">
                  <div className="podium-crown">
                    <Crown size={20} className="text-amber-300" />
                  </div>
                  <div className="podium-rank gold-medal">1st</div>
                  <div className="podium-avatar gold-avatar">
                    {SKINS[topThree[0].skin]?.imageUrl ? (
                      <img
                        src={SKINS[topThree[0].skin].imageUrl}
                        alt=""
                        className="podium-photo"
                      />
                    ) : (
                      <div
                        className="podium-dot"
                        style={{ backgroundColor: SKINS[topThree[0].skin]?.bodyColor || '#facc15' }}
                      />
                    )}
                  </div>
                  <div className="podium-name font-bold" title={topThree[0].username}>
                    {topThree[0].username}
                  </div>
                  <div className="podium-score gold-text">{topThree[0].score}</div>
                </div>
              )}

              {/* 3rd place */}
              {topThree[2] && (
                <div className="podium-card bronze">
                  <div className="podium-rank bronze-medal">
                    <Medal size={16} /> 3rd
                  </div>
                  <div className="podium-avatar">
                    {SKINS[topThree[2].skin]?.imageUrl ? (
                      <img
                        src={SKINS[topThree[2].skin].imageUrl}
                        alt=""
                        className="podium-photo"
                      />
                    ) : (
                      <div
                        className="podium-dot"
                        style={{ backgroundColor: SKINS[topThree[2].skin]?.bodyColor || '#facc15' }}
                      />
                    )}
                  </div>
                  <div className="podium-name" title={topThree[2].username}>
                    {topThree[2].username}
                  </div>
                  <div className="podium-score">{topThree[2].score}</div>
                </div>
              )}
            </div>
          )}

          {/* Ranks 4+ Table */}
          {remaining.length > 0 && (
            <div className="leaderboard-table">
              {remaining.map((entry, idx) => {
                const rankNum = idx + 4;
                const isUser = entry.username.toLowerCase() === currentUsername.toLowerCase();
                const skinDef = SKINS[entry.skin] || SKINS.classic;
                const diffDef = DIFFICULTY_CONFIGS[entry.difficulty as Difficulty];

                return (
                  <div
                    key={entry.id || idx}
                    className={`leaderboard-row ${isUser ? 'user-highlight' : ''}`}
                  >
                    <div className="rank-num">#{rankNum}</div>
                    <div className="row-player">
                      <div className="row-avatar">
                        {skinDef.imageUrl ? (
                          <img src={skinDef.imageUrl} alt="" className="row-photo" />
                        ) : (
                          <div
                            className="row-dot"
                            style={{ backgroundColor: skinDef.bodyColor }}
                          />
                        )}
                      </div>
                      <div className="row-name-wrap">
                        <span className="row-username">{entry.username}</span>
                        {isUser && <span className="you-pill">YOU</span>}
                      </div>
                    </div>

                    <div className="row-right">
                      <span className="row-time">{formatTimeAgo(entry.timestamp)}</span>
                      {diffDef && (
                        <span
                          className="diff-mini-badge"
                          style={{
                            color: diffDef.badgeColor,
                            backgroundColor: `${diffDef.badgeColor}20`,
                          }}
                        >
                          {entry.difficulty.substring(0, 4).toUpperCase()}
                        </span>
                      )}
                      <div className="row-score">{entry.score}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="settings-footer flex justify-between items-center">
          <span className="leaderboard-hint">
            <Sparkles size={13} className="inline mr-1 text-amber-400" />
            Scores update live for everyone!
          </span>
          <button type="button" className="arcade-btn primary-btn min-w-[100px]" onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
