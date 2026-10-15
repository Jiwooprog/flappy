import React, { useState } from 'react';
import { Copy, Check, LogIn, PlusCircle, ArrowLeft, Wifi, Loader2 } from 'lucide-react';

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
  const [mode, setMode] = useState<'CHOICE' | 'HOST' | 'JOINING'>(() => {
    return roomCode ? 'HOST' : 'CHOICE';
  });

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCreate = () => {
    setMode('HOST');
    onCreateRoom();
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 4) {
      setMode('JOINING');
      onJoinRoom(code);
    }
  };

  const handleCancel = () => {
    setMode('CHOICE');
    onBack();
  };

  return (
    <div className="modal-overlay animate-fade-in mp-lobby-backdrop" onClick={(e) => e.stopPropagation()}>
      <div className="mp-lobby-card animate-pop-up">
        {/* Header */}
        <div className="mp-lobby-header">
          <button
            className="mp-back-btn"
            onClick={mode === 'CHOICE' ? onBack : handleCancel}
            type="button"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="mp-lobby-title-wrap">
            <Wifi size={20} className="text-cyan-400" />
            <span className="mp-lobby-title">
              {mode === 'HOST' ? 'HOSTING ROOM' : mode === 'JOINING' ? 'JOINING ROOM' : 'MULTIPLAYER VERSUS'}
            </span>
          </div>
        </div>

        {mode === 'CHOICE' && (
          // ---- Choice screen ----
          <div className="mp-lobby-choice">
            <p className="mp-lobby-sub">Challenge a friend to a real-time race!</p>

            <button
              type="button"
              className="arcade-btn primary-btn mp-choice-btn"
              onClick={handleCreate}
            >
              <PlusCircle size={18} className="mr-2" />
              CREATE ROOM
            </button>

            <div className="mp-divider">
              <span>OR JOIN WITH CODE</span>
            </div>

            <div className="mp-join-block">
              <input
                type="text"
                className="username-setup-input mp-code-input"
                placeholder="ENTER 6-LETTER CODE"
                value={joinCode}
                maxLength={6}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCode.trim().length >= 4) {
                    handleJoin();
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className={`arcade-btn secondary-btn mp-join-submit-btn ${joinCode.trim().length < 4 ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleJoin}
                disabled={joinCode.trim().length < 4}
              >
                <LogIn size={18} className="mr-2" />
                JOIN GAME
              </button>
            </div>
          </div>
        )}

        {mode === 'HOST' && (
          // ---- Host waiting screen ----
          <div className="mp-lobby-waiting">
            <p className="mp-lobby-sub">Share this room code with your friend:</p>

            <div className="mp-room-code-box">
              <span className="mp-room-code">{roomCode || '...'}</span>
              <button type="button" className="mp-copy-btn" onClick={handleCopy} title="Copy code">
                {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
              </button>
            </div>

            {!opponentJoined ? (
              <div className="mp-waiting-pulse">
                <div className="mp-waiting-dot" />
                <span>Waiting for friend to join…</span>
              </div>
            ) : (
              <div className="mp-opponent-joined">
                <Check size={18} className="text-emerald-400 mr-2" />
                Opponent joined! Starting match…
              </div>
            )}
          </div>
        )}

        {mode === 'JOINING' && (
          // ---- Joiner connecting screen ----
          <div className="mp-lobby-waiting">
            <p className="mp-lobby-sub">Connecting to room:</p>

            <div className="mp-room-code-box">
              <span className="mp-room-code">{joinCode}</span>
            </div>

            {!opponentJoined ? (
              <div className="mp-waiting-pulse">
                <Loader2 size={16} className="animate-spin text-cyan-400 mr-1" />
                <span>Connecting to host…</span>
              </div>
            ) : (
              <div className="mp-opponent-joined">
                <Check size={18} className="text-emerald-400 mr-2" />
                Connected to host! Starting match…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
