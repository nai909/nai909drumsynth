import React from 'react';
import './Transport.css';

interface TransportProps {
  isPlaying: boolean;
  tempo: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
}

const Transport: React.FC<TransportProps> = ({
  isPlaying,
  tempo,
  onPlay,
  onPause,
  onStop,
  onTempoChange,
}) => {
  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTempoChange(parseInt(e.target.value));
  };

  return (
    <div className="transport">
      <div className="transport-controls">
        {!isPlaying ? (
          <button className="transport-btn play-btn" onClick={onPlay}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        ) : (
          <button className="transport-btn pause-btn" onClick={onPause}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          </button>
        )}
        <button className="transport-btn stop-btn" onClick={onStop}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" />
          </svg>
        </button>
      </div>

      <div className="tempo-control">
        <label className="tempo-label">TEMPO</label>
        <input
          type="range"
          min="60"
          max="200"
          value={tempo}
          onChange={handleTempoChange}
          className="tempo-slider"
        />
        <div className="tempo-display">{tempo} BPM</div>
      </div>
    </div>
  );
};

export default Transport;
