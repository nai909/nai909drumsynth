import React, { useRef, useCallback } from 'react';
import './Transport.css';

interface TransportProps {
  isPlaying: boolean;
  tempo: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
  isRecording: boolean;
  onRecordToggle: () => void;
  recordMode: 'overdub' | 'replace';
  onRecordModeToggle: () => void;
}

// Drippy Smiley Slider Thumb
const SmileyThumb: React.FC = () => (
  <svg viewBox="0 0 64 80" className="tempo-smiley">
    <path
      className="tempo-smiley-face"
      d="M32 4
         C14 4 4 16 4 32
         C4 44 10 52 14 56
         L14 66 C14 70 12 74 12 74 C12 78 16 78 16 74 L16 62
         C18 64 22 66 24 68
         L24 72 C24 76 22 80 22 80 C22 84 26 84 26 80 L26 70
         C28 71 30 71 32 71
         C34 71 36 71 38 70
         L38 76 C38 80 36 84 36 84 C36 88 40 88 40 80 L40 68
         C42 66 46 64 48 62
         L48 70 C48 74 46 78 46 78 C46 82 50 82 50 78 L50 58
         C54 54 60 46 60 32
         C60 16 50 4 32 4Z"
    />
    <ellipse className="tempo-smiley-eye" cx="20" cy="28" rx="5" ry="8" />
    <ellipse className="tempo-smiley-eye" cx="44" cy="28" rx="5" ry="8" />
    <path
      className="tempo-smiley-mouth"
      d="M16 44 Q24 54, 32 52 Q40 50, 48 44"
      strokeWidth="4"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const Transport: React.FC<TransportProps> = ({
  isPlaying,
  tempo,
  onPlay,
  onPause,
  onStop,
  onTempoChange,
  isRecording,
  onRecordToggle,
  recordMode,
  onRecordModeToggle,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const MIN_TEMPO = 60;
  const MAX_TEMPO = 200;

  const getTempoFromPosition = useCallback((clientX: number) => {
    if (!sliderRef.current) return tempo;
    const rect = sliderRef.current.getBoundingClientRect();
    const thumbWidth = 22; // Width of the smiley thumb
    const trackStart = rect.left + thumbWidth / 2;
    const trackEnd = rect.right - thumbWidth / 2;
    const trackWidth = trackEnd - trackStart;
    const position = Math.max(0, Math.min(1, (clientX - trackStart) / trackWidth));
    return Math.round(MIN_TEMPO + position * (MAX_TEMPO - MIN_TEMPO));
  }, [tempo]);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    onTempoChange(getTempoFromPosition(e.clientX));
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current) {
      onTempoChange(getTempoFromPosition(e.clientX));
    }
  }, [getTempoFromPosition, onTempoChange]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    onTempoChange(getTempoFromPosition(e.touches[0].clientX));
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (isDragging.current) {
      onTempoChange(getTempoFromPosition(e.touches[0].clientX));
    }
  }, [getTempoFromPosition, onTempoChange]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }, [handleTouchMove]);

  // Calculate thumb position as percentage
  const thumbPosition = ((tempo - MIN_TEMPO) / (MAX_TEMPO - MIN_TEMPO)) * 100;

  return (
    <div className="transport">
      <div className="transport-controls">
        <div className="record-control">
          <button
            className={`transport-btn record-btn ${isRecording ? 'active' : ''}`}
            onClick={onRecordToggle}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8" />
            </svg>
          </button>
          <button
            className={`record-mode-toggle ${recordMode}`}
            onClick={onRecordModeToggle}
            title={recordMode === 'overdub' ? 'Overdub Mode (layer)' : 'Replace Mode (clear)'}
          >
            {recordMode === 'overdub' ? 'OVR' : 'REP'}
          </button>
        </div>
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
        <div
          ref={sliderRef}
          className="tempo-slider-custom"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="tempo-slider-track" />
          <div
            className="tempo-slider-fill"
            style={{ width: `${thumbPosition}%` }}
          />
          <div
            className="tempo-slider-thumb"
            style={{ left: `${thumbPosition}%` }}
          >
            <SmileyThumb />
          </div>
        </div>
        <div className="tempo-display">{tempo} BPM</div>
      </div>

    </div>
  );
};

export default Transport;
