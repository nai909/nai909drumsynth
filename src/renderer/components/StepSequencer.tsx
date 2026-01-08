import React, { useRef, useCallback, useEffect } from 'react';
import { DrumTrack } from '../types';
import { DrumIcons } from './DrumIcons';
import './StepSequencer.css';

type NoteRepeatRate = 'off' | '1/2' | '1/4' | '1/8' | '1/16';

interface StepSequencerProps {
  tracks: DrumTrack[];
  currentStep: number;
  selectedTrack: number;
  onStepToggle: (trackIndex: number, stepIndex: number) => void;
  onSelectTrack: (trackIndex: number) => void;
  mode: 'sequencer' | 'pad';
  onPadTrigger: (trackIndex: number, velocity?: number) => void;
  noteRepeat: NoteRepeatRate;
  onNoteRepeatChange: (rate: NoteRepeatRate) => void;
  tempo: number;
}

// Calculate interval in ms for note repeat
const getRepeatInterval = (rate: NoteRepeatRate, tempo: number): number => {
  if (rate === 'off') return 0;
  const beatMs = 60000 / tempo; // ms per beat
  const divisions: { [key: string]: number } = {
    '1/2': 2,
    '1/4': 1,
    '1/8': 0.5,
    '1/16': 0.25,
  };
  return beatMs * divisions[rate];
};

const NOTE_REPEAT_RATES: NoteRepeatRate[] = ['off', '1/2', '1/4', '1/8', '1/16'];

const StepSequencer: React.FC<StepSequencerProps> = ({
  tracks,
  currentStep,
  selectedTrack,
  onStepToggle,
  onSelectTrack,
  mode,
  onPadTrigger,
  noteRepeat,
  onNoteRepeatChange,
  tempo,
}) => {
  const touchedRef = useRef<boolean>(false);
  const repeatIntervalsRef = useRef<Map<number, number>>(new Map());

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      repeatIntervalsRef.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      repeatIntervalsRef.current.clear();
    };
  }, []);

  const startNoteRepeat = useCallback((trackIndex: number, velocity: number) => {
    // Stop any existing repeat for this specific pad
    if (repeatIntervalsRef.current.has(trackIndex)) {
      clearInterval(repeatIntervalsRef.current.get(trackIndex)!);
      repeatIntervalsRef.current.delete(trackIndex);
    }

    if (noteRepeat === 'off') return;

    const interval = getRepeatInterval(noteRepeat, tempo);

    const intervalId = window.setInterval(() => {
      onPadTrigger(trackIndex, velocity);
    }, interval);

    repeatIntervalsRef.current.set(trackIndex, intervalId);
  }, [noteRepeat, tempo, onPadTrigger]);

  const stopNoteRepeat = useCallback((trackIndex: number) => {
    if (repeatIntervalsRef.current.has(trackIndex)) {
      clearInterval(repeatIntervalsRef.current.get(trackIndex)!);
      repeatIntervalsRef.current.delete(trackIndex);
    }
  }, []);

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
    startNoteRepeat(trackIndex, velocity);
  }, [onSelectTrack, onPadTrigger, startNoteRepeat]);

  if (mode === 'pad') {
    return (
      <div className="pad-mode-container">
        {/* Note Repeat Selector */}
        <div className="note-repeat-selector">
          <span className="note-repeat-label">REPEAT</span>
          <div className="note-repeat-buttons">
            {NOTE_REPEAT_RATES.map((rate) => (
              <button
                key={rate}
                className={`note-repeat-btn ${noteRepeat === rate ? 'active' : ''}`}
                onClick={() => onNoteRepeatChange(rate)}
              >
                {rate === 'off' ? 'OFF' : rate}
              </button>
            ))}
          </div>
        </div>

        <div className="drum-pads">
          {tracks.map((track, trackIndex) => (
            <button
              key={track.id}
              className={`drum-pad ${trackIndex === selectedTrack ? 'selected' : ''}`}
              onMouseDown={() => {
                // Only trigger on mousedown if not touched (prevents double trigger on mobile)
                if (!touchedRef.current) {
                  handlePadTrigger(trackIndex);
                }
              }}
              onMouseUp={() => {
                if (!touchedRef.current) {
                  stopNoteRepeat(trackIndex);
                }
              }}
              onMouseLeave={() => {
                if (!touchedRef.current) {
                  stopNoteRepeat(trackIndex);
                }
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                touchedRef.current = true;
                handlePadTrigger(trackIndex, e);
              }}
              onTouchEnd={() => {
                stopNoteRepeat(trackIndex);
                // Reset after a short delay to allow click to be blocked
                setTimeout(() => {
                  touchedRef.current = false;
                }, 100);
              }}
              onTouchCancel={() => {
                stopNoteRepeat(trackIndex);
                touchedRef.current = false;
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
