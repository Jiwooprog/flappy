import React, { useState } from 'react';
import { Copy, Check, LogIn, PlusCircle, ArrowLeft, Wifi } from 'lucide-react';

interface MultiplayerLobbyProps {
  roomCode: string;
  opponentJoined: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onBack: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  roomCode,
  opponentJoined,
  onCreateRoom,
  onJoinRoom,
  onBack,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const isCreating = roomCode !== '';

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 4) onJoinRoom(code);
  };

  return (
    <div className="modal-overlay animate-fade-in mp-lobby-backdrop" onClick={(e) => e.stopPropagation()}>
      <div className="mp-lobby-card animate-pop-up">
        {/* Header */}
        <div className="mp-lobby-header">
          <button className="mp-back-btn" onClick={onBack} type="button">
            <ArrowLeft size={16} />
          </button>
          <div className="mp-lobby-title-wrap">
            <Wifi size={20} className="text-cyan-400" />
            <span className="mp-lobby-title">MULTIPLAYER</span>
          </div>
        </div>

        {!isCreating ? (
          // ---- Choice screen ----
          <div className="mp-lobby-choice">
            <p className="mp-lobby-sub">Challenge a friend in real-time!</p>

            <button
              type="button"
              className="arcade-btn primary-btn mp-choice-btn"
              onClick={onCreateRoom}
            >
              <PlusCircle size={18} className="mr-2" />
              CREATE ROOM
            </button>

            <div className="mp-divider">
              <span>or join an existing room</span>
            </div>

            <div className="mp-join-row">
              <input
                type="text"
                className="username-setup-input mp-code-input"
                placeholder="ROOM CODE"
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="arcade-btn primary-btn mp-join-btn"
                onClick={handleJoin}
                disabled={joinCode.trim().length < 4}
              >
                <LogIn size={16} />
              </button>
            </div>
          </div>
        ) : (
          // ---- Waiting for opponent ----
          <div className="mp-lobby-waiting">
            <p className="mp-lobby-sub">Share this code with your friend:</p>

            <div className="mp-room-code-box">
              <span className="mp-room-code">{roomCode}</span>
              <button type="button" className="mp-copy-btn" onClick={handleCopy} title="Copy code">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>

            {!opponentJoined ? (
              <div className="mp-waiting-pulse">
                <div className="mp-waiting-dot" />
                <span>Waiting for opponent…</span>
              </div>
            ) : (
              <div className="mp-opponent-joined">
                <Check size={18} className="text-emerald-400 mr-2" />
                Opponent joined! Get ready…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
