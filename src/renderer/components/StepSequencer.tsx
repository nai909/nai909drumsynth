import React, { useRef, useCallback, useEffect } from 'react';
import { DrumTrack } from '../types';
import { DrumIcons } from './DrumIcons';
import './StepSequencer.css';

type NoteRepeatRate = 'off' | '1/2' | '1/4' | '1/8' | '1/16';
type NoteRepeatModifier = 'normal' | 'dotted' | 'triplet';

interface StepSequencerProps {
  tracks: DrumTrack[];
  currentStep: number;
  selectedTrack: number;
  onStepToggle: (trackIndex: number, stepIndex: number) => void;
  onSelectTrack: (trackIndex: number) => void;
  mode: 'sequencer' | 'pad';
  onPadTrigger: (trackIndex: number, velocity?: number, time?: number) => void;
  noteRepeat: NoteRepeatRate;
  onNoteRepeatChange: (rate: NoteRepeatRate) => void;
  noteRepeatModifier: NoteRepeatModifier;
  onNoteRepeatModifierChange: (modifier: NoteRepeatModifier) => void;
  tempo: number;
  onClearSequence?: () => void;
  loopBars: 1 | 2 | 3 | 4;
  onLoopBarsChange: (bars: 1 | 2 | 3 | 4) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const NOTE_REPEAT_RATES: NoteRepeatRate[] = ['off', '1/2', '1/4', '1/8', '1/16'];
const NOTE_REPEAT_MODIFIERS: NoteRepeatModifier[] = ['normal', 'dotted', 'triplet'];

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
  noteRepeatModifier,
  onNoteRepeatModifierChange,
  tempo,
  onClearSequence,
  loopBars,
  onLoopBarsChange,
  currentPage,
  onPageChange,
}) => {
  const touchedRef = useRef<boolean>(false);
  const repeatIntervalsRef = useRef<Map<number, NodeJS.Timeout>>(new Map()); // trackIndex -> intervalId

  // Slide/paint support for step grid
  const isSliding = useRef<boolean>(false);
  const slidePaintMode = useRef<boolean | null>(null); // true = paint on, false = paint off
  const slidedSteps = useRef<Set<string>>(new Set()); // track which steps already toggled during this slide
  const stepGridRef = useRef<HTMLDivElement>(null);

  // Get step info from a point on screen
  const getStepFromPoint = useCallback((x: number, y: number): { trackIndex: number; stepIndex: number } | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;

    const stepBtn = element.closest('.step-btn') as HTMLElement;
    if (!stepBtn) return null;

    const trackIndex = parseInt(stepBtn.dataset.track || '-1');
    const stepIndex = parseInt(stepBtn.dataset.step || '-1');

    if (trackIndex >= 0 && stepIndex >= 0) {
      return { trackIndex, stepIndex };
    }
    return null;
  }, []);

  // Handle slide move
  const handleSlideMove = useCallback((x: number, y: number) => {
    if (!isSliding.current) return;

    const stepInfo = getStepFromPoint(x, y);
    if (!stepInfo) return;

    const stepKey = `${stepInfo.trackIndex}-${stepInfo.stepIndex}`;
    if (slidedSteps.current.has(stepKey)) return; // Already toggled this step

    slidedSteps.current.add(stepKey);

    // If this is the first step in the slide, determine paint mode
    if (slidePaintMode.current === null) {
      const currentState = tracks[stepInfo.trackIndex].steps[stepInfo.stepIndex];
      slidePaintMode.current = !currentState; // Will paint opposite of first step's state
    }

    // Only toggle if the step doesn't match paint mode
    const currentState = tracks[stepInfo.trackIndex].steps[stepInfo.stepIndex];
    if (currentState !== slidePaintMode.current) {
      onStepToggle(stepInfo.trackIndex, stepInfo.stepIndex);
    }
  }, [getStepFromPoint, onStepToggle, tracks]);

  // Global mouse handlers for step grid sliding
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isSliding.current) {
        handleSlideMove(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      isSliding.current = false;
      slidePaintMode.current = null;
      slidedSteps.current.clear();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleSlideMove]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      repeatIntervalsRef.current.forEach((intervalId) => {
        clearInterval(intervalId);
      });
      repeatIntervalsRef.current.clear();
    };
  }, []);

  // Calculate interval in ms from note value, tempo, and modifier
  const getRepeatIntervalMs = useCallback((rate: NoteRepeatRate): number => {
    const beatMs = 60000 / tempo; // ms per beat
    let baseInterval: number;
    switch (rate) {
      case '1/2': baseInterval = beatMs * 2; break;
      case '1/4': baseInterval = beatMs; break;
      case '1/8': baseInterval = beatMs / 2; break;
      case '1/16': baseInterval = beatMs / 4; break;
      default: baseInterval = beatMs;
    }

    // Apply modifier
    switch (noteRepeatModifier) {
      case 'dotted': return baseInterval * 1.5; // Dotted = 1.5x longer
      case 'triplet': return baseInterval * (2/3); // Triplet = 2/3 duration (3 in space of 2)
      default: return baseInterval;
    }
  }, [tempo, noteRepeatModifier]);

  const startNoteRepeat = useCallback((trackIndex: number, velocity: number) => {
    // Stop any existing repeat for this specific pad
    if (repeatIntervalsRef.current.has(trackIndex)) {
      clearInterval(repeatIntervalsRef.current.get(trackIndex)!);
      repeatIntervalsRef.current.delete(trackIndex);
    }

    if (noteRepeat === 'off') return;

    const intervalMs = getRepeatIntervalMs(noteRepeat);

    // Use setTimeout for initial delay, then setInterval for repeats
    const timeoutId = setTimeout(() => {
      // Trigger first repeat
      onPadTrigger(trackIndex, velocity);

      // Set up interval for subsequent repeats
      const intervalId = setInterval(() => {
        onPadTrigger(trackIndex, velocity);
      }, intervalMs);

      repeatIntervalsRef.current.set(trackIndex, intervalId);
    }, intervalMs); // Wait one full interval before first repeat

    // Store timeout as interval initially (will be replaced by actual interval)
    repeatIntervalsRef.current.set(trackIndex, timeoutId as unknown as NodeJS.Timeout);
  }, [noteRepeat, onPadTrigger, getRepeatIntervalMs]);

  const stopNoteRepeat = useCallback((trackIndex: number) => {
    if (repeatIntervalsRef.current.has(trackIndex)) {
      clearInterval(repeatIntervalsRef.current.get(trackIndex)!);
      clearTimeout(repeatIntervalsRef.current.get(trackIndex)! as unknown as NodeJS.Timeout);
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
          <div className="note-repeat-label-group">
            <span className="note-repeat-label">REPEAT</span>
            <span className="note-repeat-hint">(Hold Pad)</span>
          </div>
          <div className="note-repeat-controls">
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
            <div className="note-repeat-modifiers">
              {NOTE_REPEAT_MODIFIERS.map((mod) => (
                <button
                  key={mod}
                  className={`note-repeat-mod-btn ${noteRepeatModifier === mod ? 'active' : ''} ${noteRepeat === 'off' ? 'disabled' : ''}`}
                  onClick={() => onNoteRepeatModifierChange(mod)}
                  disabled={noteRepeat === 'off'}
                >
                  {mod === 'normal' ? '•' : mod === 'dotted' ? '••' : '•••'}
                </button>
              ))}
            </div>
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

  // Calculate which steps to show based on current page
  const pageStartStep = currentPage * 16;
  const pageEndStep = pageStartStep + 16;
  const totalSteps = loopBars * 16;

  return (
    <div className="step-sequencer">
      {/* Page navigation and loop length selector */}
      <div className="sequencer-header">
        <div className="loop-bars-selector">
          <span className="loop-bars-label">BARS</span>
          <div className="loop-bars-buttons">
            {([1, 2, 3, 4] as const).map((bars) => (
              <button
                key={bars}
                className={`loop-bars-btn ${loopBars === bars ? 'active' : ''}`}
                onClick={() => onLoopBarsChange(bars)}
              >
                {bars}
              </button>
            ))}
          </div>
        </div>
        <div className="page-navigation">
          <button
            className="page-nav-btn"
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            ◀
          </button>
          <div className="page-dots">
            {Array.from({ length: loopBars }, (_, i) => (
              <button
                key={i}
                className={`page-dot ${i === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(i)}
              />
            ))}
          </div>
          <button
            className="page-nav-btn"
            onClick={() => onPageChange(Math.min(loopBars - 1, currentPage + 1))}
            disabled={currentPage >= loopBars - 1}
          >
            ▶
          </button>
        </div>
      </div>
      <div
        ref={stepGridRef}
        className="step-grid"
        onTouchMove={(e) => {
          // Handle slide across steps on touch
          if (isSliding.current) {
            const touch = e.touches[0];
            handleSlideMove(touch.clientX, touch.clientY);
          }
        }}
        onTouchEnd={() => {
          isSliding.current = false;
          slidePaintMode.current = null;
          slidedSteps.current.clear();
        }}
        onTouchCancel={() => {
          isSliding.current = false;
          slidePaintMode.current = null;
          slidedSteps.current.clear();
        }}
      >
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
              {track.steps.slice(pageStartStep, pageEndStep).map((active, localStepIndex) => {
                const globalStepIndex = pageStartStep + localStepIndex;
                const isCurrentStep = globalStepIndex === (currentStep % totalSteps);
                return (
                  <button
                    key={localStepIndex}
                    data-track={trackIndex}
                    data-step={globalStepIndex}
                    className={`step-btn ${active ? 'active' : ''} ${
                      isCurrentStep ? 'current' : ''
                    } ${localStepIndex % 4 === 0 ? 'beat' : ''}`}
                    onClick={() => {
                      // Simple click toggles the step
                      if (!isSliding.current) {
                        onStepToggle(trackIndex, globalStepIndex);
                      }
                    }}
                    onMouseDown={() => {
                      // Prepare for potential slide
                      isSliding.current = false; // Will be set true on mouse move
                      slidePaintMode.current = !active;
                      slidedSteps.current.clear();
                    }}
                    onMouseMove={() => {
                      // If mouse moves while down, start sliding
                      if (!isSliding.current && slidePaintMode.current !== null) {
                        isSliding.current = true;
                        // Toggle this step as the first in the slide
                        slidedSteps.current.add(`${trackIndex}-${globalStepIndex}`);
                        onStepToggle(trackIndex, globalStepIndex);
                      }
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      // Start sliding and toggle this step immediately for touch
                      isSliding.current = true;
                      slidePaintMode.current = !active;
                      slidedSteps.current.clear();
                      slidedSteps.current.add(`${trackIndex}-${globalStepIndex}`);
                      onStepToggle(trackIndex, globalStepIndex);
                    }}
                  >
                    <div className="step-led" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {onClearSequence && (
        <div className="sequencer-footer">
          <button className="clear-sequence-btn" onClick={onClearSequence}>
            CLEAR
          </button>
        </div>
      )}
    </div>
  );
};

export default StepSequencer;
