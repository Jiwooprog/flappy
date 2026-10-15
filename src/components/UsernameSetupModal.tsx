import React, { useState, useRef, useEffect } from 'react';
import { UserCircle2, Sparkles } from 'lucide-react';
import { saveUsername } from '../game/leaderboard';

interface UsernameSetupModalProps {
  onComplete: (username: string) => void;
}

const ADJECTIVES = ['Neon', 'Turbo', 'Ultra', 'Hyper', 'Mega', 'Pixel', 'Blaze', 'Storm', 'Shadow', 'Cosmic'];
const NOUNS = ['Flapper', 'Birdie', 'Pilot', 'Ace', 'Wing', 'Dart', 'Glider', 'Bolt', 'Dash', 'Hawk'];

function generateTag(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}${noun}${num}`;
}

export const UsernameSetupModal: React.FC<UsernameSetupModalProps> = ({ onComplete }) => {
  const [value, setValue] = useState('');
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSuggest = () => {
    setValue(generateTag());
    inputRef.current?.focus();
  };

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      inputRef.current?.focus();
      return;
    }
    const saved = saveUsername(trimmed);
    onComplete(saved);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
  };

  return (
    <div className="modal-overlay animate-fade-in username-setup-backdrop" onClick={(e) => e.stopPropagation()}>
      <div className={`username-setup-card animate-pop-up ${shaking ? 'username-shake' : ''}`}>
        {/* Icon header */}
        <div className="username-setup-icon">
          <UserCircle2 size={40} className="text-sky-400" />
        </div>

        <h2 className="username-setup-title">ENTER YOUR GAMER TAG</h2>
        <p className="username-setup-sub">Your tag appears on the global leaderboard. Choose wisely!</p>

        {/* Input */}
        <div className="username-setup-input-row">
          <input
            ref={inputRef}
            type="text"
            className="username-setup-input"
            placeholder="e.g. TurboAce99"
            value={value}
            maxLength={16}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="username-suggest-btn"
            title="Generate a random tag"
            onClick={handleSuggest}
          >
            <Sparkles size={16} />
          </button>
        </div>
        <div className="username-char-count">{value.trim().length} / 16</div>

        {/* CTA */}
        <button
          type="button"
          className="arcade-btn primary-btn username-confirm-btn"
          onClick={handleConfirm}
        >
          LET'S PLAY!
        </button>

        <p className="username-setup-hint">You can change this later in Settings → Leaderboard</p>
      </div>
    </div>
  );
};
