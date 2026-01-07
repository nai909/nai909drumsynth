import React, { useRef, useCallback } from 'react';
import { DrumTrack } from '../types';
import { DrumIcons } from './DrumIcons';
import './StepSequencer.css';

interface StepSequencerProps {
  tracks: DrumTrack[];
  currentStep: number;
  selectedTrack: number;
  onStepToggle: (trackIndex: number, stepIndex: number) => void;
  onSelectTrack: (trackIndex: number) => void;
  mode: 'sequencer' | 'pad';
  onPadTrigger: (trackIndex: number, velocity?: number) => void;
}

const StepSequencer: React.FC<StepSequencerProps> = ({
  tracks,
  currentStep,
  selectedTrack,
  onStepToggle,
  onSelectTrack,
  mode,
  onPadTrigger,
}) => {
  const touchedRef = useRef<boolean>(false);

  const handlePadTrigger = useCallback((trackIndex: number, e?: React.TouchEvent) => {
    onSelectTrack(trackIndex);

    // Get velocity from touch force if available, otherwise default
    let velocity = 0.8;
    if (e && e.touches && e.touches[0]) {
      const touch = e.touches[0] as any;
      // Use force if available (Force Touch / 3D Touch)
      if (touch.force && touch.force > 0) {
        velocity = Math.min(1, 0.3 + touch.force * 0.7);
      }
    }

    onPadTrigger(trackIndex, velocity);
  }, [onSelectTrack, onPadTrigger]);

  if (mode === 'pad') {
    return (
      <div className="drum-pads">
        {tracks.map((track, trackIndex) => (
          <button
            key={track.id}
            className={`drum-pad ${trackIndex === selectedTrack ? 'selected' : ''}`}
            onClick={() => {
              // Only trigger on click if not touched (prevents double trigger on mobile)
              if (!touchedRef.current) {
                handlePadTrigger(trackIndex);
              }
              touchedRef.current = false;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              touchedRef.current = true;
              handlePadTrigger(trackIndex, e);
            }}
            onTouchEnd={() => {
              // Reset after a short delay to allow click to be blocked
              setTimeout(() => {
                touchedRef.current = false;
              }, 100);
            }}
          >
            {DrumIcons[track.soundEngine] && (
              <span className="drum-pad-icon">
                {React.createElement(DrumIcons[track.soundEngine], { className: 'pad-icon-svg' })}
              </span>
            )}
            <span className="drum-pad-name">{track.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="step-sequencer">
      <div className="step-grid">
        {tracks.map((track, trackIndex) => (
          <div
            key={track.id}
            className={`step-row ${trackIndex === selectedTrack ? 'selected' : ''}`}
          >
            <button
              className={`track-icon-btn ${trackIndex === selectedTrack ? 'selected' : ''}`}
              onClick={() => {
                onSelectTrack(trackIndex);
                onPadTrigger(trackIndex, 0.8);
              }}
              title={track.name}
            >
              {DrumIcons[track.soundEngine] && (
                React.createElement(DrumIcons[track.soundEngine], { className: 'track-icon-svg' })
              )}
            </button>
            <div className="step-buttons">
              {track.steps.map((active, stepIndex) => (
                <button
                  key={stepIndex}
                  className={`step-btn ${active ? 'active' : ''} ${
                    stepIndex === currentStep ? 'current' : ''
                  } ${stepIndex % 4 === 0 ? 'beat' : ''}`}
                  onClick={() => onStepToggle(trackIndex, stepIndex)}
                >
                  <div className="step-led" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepSequencer;
