import React, { useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
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

// Get Tone.js note value for repeat rate
const getRepeatNoteValue = (rate: NoteRepeatRate): string => {
  const noteValues: { [key: string]: string } = {
    '1/2': '2n',
    '1/4': '4n',
    '1/8': '8n',
    '1/16': '16n',
  };
  return noteValues[rate] || '8n';
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
  const repeatEventsRef = useRef<Map<number, number>>(new Map()); // trackIndex -> eventId

  // Clean up scheduled events on unmount
  useEffect(() => {
    return () => {
      repeatEventsRef.current.forEach((eventId) => {
        Tone.Transport.clear(eventId);
      });
      repeatEventsRef.current.clear();
    };
  }, []);

  const startNoteRepeat = useCallback(async (trackIndex: number, velocity: number) => {
    // Stop any existing repeat for this specific pad
    if (repeatEventsRef.current.has(trackIndex)) {
      Tone.Transport.clear(repeatEventsRef.current.get(trackIndex)!);
      repeatEventsRef.current.delete(trackIndex);
    }

    if (noteRepeat === 'off') return;

    // Ensure audio context is started
    await Tone.start();

    const noteValue = getRepeatNoteValue(noteRepeat);

    // Use Tone.Transport.scheduleRepeat for precise timing synced to BPM
    // Start after a short delay to avoid double-triggering with initial note
    const eventId = Tone.Transport.scheduleRepeat(
      (time) => {
        // Trigger the pad at the scheduled time
        onPadTrigger(trackIndex, velocity);
      },
      noteValue,
      '+0.05' // Start 50ms after initial trigger to avoid overlap
    );

    repeatEventsRef.current.set(trackIndex, eventId);

    // Start Transport if not already running (needed for note repeat to work)
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }, [noteRepeat, onPadTrigger]);

  const stopNoteRepeat = useCallback((trackIndex: number) => {
    if (repeatEventsRef.current.has(trackIndex)) {
      Tone.Transport.clear(repeatEventsRef.current.get(trackIndex)!);
      repeatEventsRef.current.delete(trackIndex);
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

    // Always play the initial note immediately
    onPadTrigger(trackIndex, velocity);

    // Start note repeat if enabled (will handle subsequent triggers)
    if (noteRepeat !== 'off') {
      startNoteRepeat(trackIndex, velocity);
    }
  }, [onSelectTrack, onPadTrigger, startNoteRepeat, noteRepeat]);

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
