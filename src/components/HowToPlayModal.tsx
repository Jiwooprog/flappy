import React from 'react';
import { X, HelpCircle, MousePointer, Keyboard, Smartphone, Award } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="settings-card animate-pop-up" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title">
            <HelpCircle size={20} className="text-sky-400 mr-2" />
            HOW TO PLAY
          </div>
          <button className="icon-btn-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="settings-scroll-body">
          {/* Objective */}
          <div className="guide-card">
            <h4 className="guide-card-title">🎯 OBJECTIVE</h4>
            <p className="guide-card-text">
              Guide your bird through green pipe gaps. Each cleared pipe earns <strong>1 point</strong>. Don't hit pipes or the ground!
            </p>
          </div>

          {/* Controls */}
          <div className="guide-card">
            <h4 className="guide-card-title">🎮 CONTROLS</h4>
            <div className="control-items-list">
              <div className="control-item">
                <Keyboard size={18} className="text-amber-400" />
                <div>
                  <div className="control-name">Keyboard</div>
                  <div className="control-desc"><kbd>Space</kbd>, <kbd>↑</kbd>, or <kbd>W</kbd> to flap • <kbd>P</kbd> to pause</div>
                </div>
              </div>

              <div className="control-item">
                <MousePointer size={18} className="text-emerald-400" />
                <div>
                  <div className="control-name">Mouse</div>
                  <div className="control-desc">Click anywhere inside the screen to flap</div>
                </div>
              </div>

              <div className="control-item">
                <Smartphone size={18} className="text-purple-400" />
                <div>
                  <div className="control-name">Touch / Mobile</div>
                  <div className="control-desc">Tap anywhere on the screen</div>
                </div>
              </div>
            </div>
          </div>

          {/* Medal Tiers */}
          <div className="guide-card">
            <h4 className="guide-card-title">🏅 MEDALS & AWARDS</h4>
            <div className="medals-grid">
              <div className="medal-tier">
                <span className="medal-icon">🥉</span>
                <span className="tier-name">Bronze</span>
                <span className="tier-score">10 pts</span>
              </div>
              <div className="medal-tier">
                <span className="medal-icon">🥈</span>
                <span className="tier-name">Silver</span>
                <span className="tier-score">25 pts</span>
              </div>
              <div className="medal-tier">
                <span className="medal-icon">🥇</span>
                <span className="tier-name">Gold</span>
                <span className="tier-score">50 pts</span>
              </div>
              <div className="medal-tier">
                <span className="medal-icon">💎</span>
                <span className="tier-name">Platinum</span>
                <span className="tier-score">100 pts</span>
              </div>
            </div>
          </div>

          {/* Pro Tip */}
          <div className="guide-tip">
            <Award size={16} className="text-amber-400 flex-shrink-0" />
            <span><strong>Pro Tip:</strong> Tap rhythmically! Quick micro-taps help you stabilize height inside narrow gaps.</span>
          </div>
        </div>

        <div className="settings-footer">
          <button type="button" className="arcade-btn primary-btn" onClick={onClose}>
            GOT IT!
          </button>
        </div>
      </div>
    </div>
  );
};
