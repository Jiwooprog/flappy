import React from 'react';

interface ScoreBoardProps {
  score: number;
  bestScore: number;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({ score, bestScore }) => {
  const isNewRecord = score > 0 && score > bestScore;

  return (
    <div className="hud-scoreboard">
      <div className="arcade-score-main">
        {score}
      </div>
      {isNewRecord && (
        <div className="new-record-pill">
          ✨ NEW RECORD!
        </div>
      )}
    </div>
  );
};
