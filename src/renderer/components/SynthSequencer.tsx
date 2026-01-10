import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { MelodicSynth, SynthParams, WaveformType, ArpMode, DEFAULT_SYNTH_PARAMS } from '../audio/MelodicSynth';
import './SynthSequencer.css';

export interface Step {
  active: boolean;
  note: string;
}

interface SynthSequencerProps {
  synth: MelodicSynth;
  isPlaying: boolean;
  tempo: number;
  steps: Step[];
  onStepsChange: (steps: Step[]) => void;
  params: SynthParams;
  onParamsChange: (params: SynthParams) => void;
  currentStep: number;
  loopBars: 1 | 2 | 3 | 4;
  onLoopBarsChange: (bars: 1 | 2 | 3 | 4) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const STEPS_PER_PAGE = 16;

// All available notes (3 octaves for good range)
const ALL_NOTES = [
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
];

// Scale definitions
const SCALES: { [key: string]: number[] } = {
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'pentatonic': [0, 2, 4, 7, 9],
  'blues': [0, 3, 5, 6, 7, 10],
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'phrygian': [0, 1, 3, 5, 7, 8, 10],
};

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Get notes in a scale across all octaves
const getScaleNotes = (root: string, scale: string): string[] => {
  const rootIndex = ROOT_NOTES.indexOf(root);
  const intervals = SCALES[scale] || SCALES['chromatic'];
  const scaleNotes: string[] = [];

  ALL_NOTES.forEach(note => {
    const noteName = note.replace(/\d+$/, '');
    const noteIndex = ROOT_NOTES.indexOf(noteName);
    const interval = (noteIndex - rootIndex + 12) % 12;
    if (intervals.includes(interval)) {
      scaleNotes.push(note);
    }
  });

  return scaleNotes;
};

const SynthSequencer: React.FC<SynthSequencerProps> = ({
  synth, isPlaying, tempo, steps, onStepsChange, params, onParamsChange, currentStep,
  loopBars, onLoopBarsChange, currentPage, onPageChange
}) => {
  const [scaleRoot, setScaleRoot] = useState('C');
  const [scaleType, setScaleType] = useState('pentatonic');
  const [viewMode, setViewMode] = useState<'bars' | 'pianoroll'>('pianoroll');

  const containerRef = useRef<HTMLDivElement>(null);

  const scaleNotes = getScaleNotes(scaleRoot, scaleType);

  // Toggle step on/off
  const toggleStep = (index: number) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], active: !newSteps[index].active };
    onStepsChange(newSteps);
  };

  // Activate step with a specific note (called when clicking empty step)
  const activateWithNote = (index: number, note: string) => {
    const newSteps = [...steps];
    newSteps[index] = { active: true, note };
    onStepsChange(newSteps);
  };

  // Set or toggle a note at a specific step (for piano roll)
  const setNoteAtStep = (stepIndex: number, note: string, active: boolean) => {
    const newSteps = [...steps];
    // If the same note is already at this step, toggle it off
    if (newSteps[stepIndex].active && newSteps[stepIndex].note === note && !active) {
      newSteps[stepIndex] = { active: false, note: 'C4' };
    } else {
      newSteps[stepIndex] = { active, note };
    }
    onStepsChange(newSteps);
  };

  // Change note pitch via drag
  const handleDrag = useCallback((index: number, startY: number, currentY: number, startNote: string) => {
    const deltaY = startY - currentY;
    const noteSteps = Math.round(deltaY / 8); // 8px per note
    const startIndex = scaleNotes.indexOf(startNote);
    const newIndex = Math.max(0, Math.min(scaleNotes.length - 1, startIndex + noteSteps));
    const newNote = scaleNotes[newIndex];

    if (steps[index].note !== newNote) {
      const newSteps = [...steps];
      newSteps[index] = { ...newSteps[index], note: newNote };
      onStepsChange(newSteps);
    }
  }, [scaleNotes, steps, onStepsChange]);

  // Handle synth param changes
  const handleParamChange = (param: keyof SynthParams, value: number | WaveformType | ArpMode) => {
    const newParams = { ...params, [param]: value };
    onParamsChange(newParams);
  };

  // Randomize sequence (only randomize current loop length)
  const randomizeSequence = () => {
    const totalSteps = loopBars * STEPS_PER_PAGE;
    const newSteps = [...steps];
    for (let i = 0; i < totalSteps; i++) {
      newSteps[i] = {
        active: Math.random() < 0.5,
        note: scaleNotes[Math.floor(Math.random() * Math.min(scaleNotes.length, 24)) + Math.floor(scaleNotes.length / 4)],
      };
    }
    onStepsChange(newSteps);
  };

  // Randomize synth params (except output and effect settings)
  const randomizeParams = () => {
    const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];
    const newParams: SynthParams = {
      waveform: waveforms[Math.floor(Math.random() * waveforms.length)],
      attack: Math.random() * 0.3,
      decay: 0.05 + Math.random() * 0.3,
      sustain: 0.3 + Math.random() * 0.5,
      release: 0.1 + Math.random() * 0.4,
      filterCutoff: 0.3 + Math.random() * 0.7,
      filterResonance: Math.random() * 0.5,
      filterEnvAmount: Math.random() * 0.7,
      detune: params.detune, // Keep current output settings
      volume: params.volume, // Keep current output settings
      arpMode: 'off',
      arpRate: 0.5,
      mono: params.mono,
      // Keep current effect settings
      reverbMix: params.reverbMix,
      reverbDecay: params.reverbDecay,
      delayMix: params.delayMix,
      delayTime: params.delayTime,
      delayFeedback: params.delayFeedback,
      lfoRate: params.lfoRate,
      lfoDepth: params.lfoDepth,
      lfoEnabled: params.lfoEnabled,
      lfoDestination: params.lfoDestination,
    };
    onParamsChange(newParams);
  };

  // Clear sequence (only clear current loop length)
  const clearSequence = () => {
    const totalSteps = loopBars * STEPS_PER_PAGE;
    const newSteps = [...steps];
    for (let i = 0; i < totalSteps; i++) {
      newSteps[i] = { active: false, note: 'C4' };
    }
    onStepsChange(newSteps);
  };

  // Snap existing notes to new scale
  useEffect(() => {
    const snappedSteps = steps.map(step => {
      if (!step.active) return step;
      // Find closest note in new scale
      const currentIndex = ALL_NOTES.indexOf(step.note);
      let closestNote = scaleNotes[0];
      let closestDistance = Infinity;
      scaleNotes.forEach(note => {
        const distance = Math.abs(ALL_NOTES.indexOf(note) - currentIndex);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNote = note;
        }
      });
      return { ...step, note: closestNote };
    });
    // Only update if something changed
    if (JSON.stringify(snappedSteps) !== JSON.stringify(steps)) {
      onStepsChange(snappedSteps);
    }
  }, [scaleRoot, scaleType, scaleNotes]);

  const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  return (
    <div className="synth-seq-simple">
      {/* Controls */}
      <div className="seq-controls-simple">
        <div className="seq-control-group">
          <label className="seq-label">VIEW</label>
          <div className="view-toggle-buttons">
            <button
              className={`view-toggle-btn ${viewMode === 'pianoroll' ? 'active' : ''}`}
              onClick={() => setViewMode('pianoroll')}
            >
              ROLL
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'bars' ? 'active' : ''}`}
              onClick={() => setViewMode('bars')}
            >
              BARS
            </button>
          </div>
        </div>

        <div className="seq-control-group">
          <label className="seq-label">WAVE</label>
          <div className="waveform-buttons-small">
            {waveforms.map((wf) => (
              <button
                key={wf}
                className={`waveform-btn-small ${params.waveform === wf ? 'active' : ''}`}
                onClick={() => handleParamChange('waveform', wf)}
              >
                <WaveformIcon type={wf} />
              </button>
            ))}
          </div>
        </div>

        <div className="seq-control-group">
          <label className="seq-label">KEY</label>
          <select
            className="seq-select"
            value={scaleRoot}
            onChange={(e) => setScaleRoot(e.target.value)}
          >
            {ROOT_NOTES.map((note) => (
              <option key={note} value={note}>{note}</option>
            ))}
          </select>
        </div>

        <div className="seq-control-group">
          <label className="seq-label">SCALE</label>
          <select
            className="seq-select"
            value={scaleType}
            onChange={(e) => setScaleType(e.target.value)}
          >
            {Object.keys(SCALES).map((scale) => (
              <option key={scale} value={scale}>
                {scale.charAt(0).toUpperCase() + scale.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="seq-actions-simple">
          <button className="seq-btn" onClick={randomizeSequence}>DICE</button>
          <button className="seq-btn mutate" onClick={randomizeParams}>MUTATE</button>
          <button className="seq-btn clear" onClick={clearSequence}>CLEAR</button>
        </div>

        <div className="seq-control-group">
          <label className="seq-label">BARS</label>
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

        {loopBars > 1 && (
          <div className="seq-control-group">
            <label className="seq-label">PAGE</label>
            <div className="page-nav-buttons">
              <button
                className="page-nav-btn"
                onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                ◀
              </button>
              <span className="page-indicator">{currentPage + 1}/{loopBars}</span>
              <button
                className="page-nav-btn"
                onClick={() => onPageChange(Math.min(loopBars - 1, currentPage + 1))}
                disabled={currentPage === loopBars - 1}
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Piano Roll View */}
      {viewMode === 'pianoroll' ? (
        <PianoRoll
          steps={steps}
          currentStep={currentStep}
          scaleNotes={scaleNotes}
          onSetNote={setNoteAtStep}
          synth={synth}
          currentPage={currentPage}
        />
      ) : (
        <>
          {/* Bar View - Step grid */}
          <div className="melody-grid" ref={containerRef}>
            {Array.from({ length: STEPS_PER_PAGE }, (_, i) => {
              const stepIndex = currentPage * STEPS_PER_PAGE + i;
              const step = steps[stepIndex];
              return (
                <MelodyStep
                  key={stepIndex}
                  step={step}
                  index={stepIndex}
                  isCurrentStep={currentStep === stepIndex}
                  scaleNotes={scaleNotes}
                  onToggle={() => toggleStep(stepIndex)}
                  onActivateWithNote={activateWithNote}
                  onDrag={handleDrag}
                  synth={synth}
                />
              );
            })}
          </div>

          {/* Step numbers */}
          <div className="step-indicators">
            {Array.from({ length: STEPS_PER_PAGE }, (_, i) => {
              const stepIndex = currentPage * STEPS_PER_PAGE + i;
              return (
                <div
                  key={stepIndex}
                  className={`step-indicator ${currentStep === stepIndex ? 'active' : ''} ${i % 4 === 0 ? 'beat' : ''}`}
                >
                  {stepIndex + 1}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// Individual melody step component
interface MelodyStepProps {
  step: Step;
  index: number;
  isCurrentStep: boolean;
  scaleNotes: string[];
  onToggle: () => void;
  onActivateWithNote: (index: number, note: string) => void;
  onDrag: (index: number, startY: number, currentY: number, startNote: string) => void;
  synth: MelodicSynth;
}

const MelodyStep: React.FC<MelodyStepProps> = ({
  step,
  index,
  isCurrentStep,
  scaleNotes,
  onToggle,
  onActivateWithNote,
  onDrag,
  synth,
}) => {
  const stepRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const startY = useRef(0);
  const startNote = useRef(step.note);
  const lastNote = useRef(step.note);

  // Calculate bar height based on note position in scale
  const noteIndex = scaleNotes.indexOf(step.note);
  const barHeight = step.active ? 20 + (noteIndex / scaleNotes.length) * 60 : 0;

  // Calculate note from Y position within the step element
  const getNoteFromPosition = (clientY: number): string => {
    if (!stepRef.current) return scaleNotes[Math.floor(scaleNotes.length / 2)];
    const rect = stepRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const percentage = 1 - (relativeY / rect.height); // Invert so top = high note
    const noteIdx = Math.floor(percentage * scaleNotes.length);
    const clampedIdx = Math.max(0, Math.min(scaleNotes.length - 1, noteIdx));
    return scaleNotes[clampedIdx];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (!step.active) {
      // Activate with note based on position
      const note = getNoteFromPosition(e.clientY);
      onActivateWithNote(index, note);
      synth.noteOn(note, 0.8);
      setTimeout(() => synth.noteOff(note), 150);
      return;
    }
    // Active step - start drag or prepare for toggle
    isDragging.current = true;
    hasDragged.current = false;
    startY.current = e.clientY;
    startNote.current = step.note;
    lastNote.current = step.note;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaY = Math.abs(e.clientY - startY.current);
    if (deltaY > 5) hasDragged.current = true;
    onDrag(index, startY.current, e.clientY, startNote.current);
  };

  const handlePointerUp = () => {
    if (isDragging.current) {
      if (!hasDragged.current) {
        // No drag occurred - this was a tap, so toggle off
        onToggle();
      } else if (step.note !== lastNote.current) {
        // Drag occurred and note changed - play preview
        synth.noteOn(step.note, 0.7);
        setTimeout(() => synth.noteOff(step.note), 100);
      }
    }
    isDragging.current = false;
    hasDragged.current = false;
  };

  return (
    <div
      ref={stepRef}
      className={`melody-step ${step.active ? 'active' : ''} ${isCurrentStep ? 'current' : ''} ${index % 4 === 0 ? 'beat-start' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="step-bar-container">
        <div
          className="step-bar"
          style={{ height: `${barHeight}%` }}
        />
        {step.active && (
          <span className="step-note-label">{step.note}</span>
        )}
      </div>
    </div>
  );
};

// Waveform icons
const WaveformIcon: React.FC<{ type: WaveformType }> = ({ type }) => {
  const paths: { [key: string]: string } = {
    sine: 'M2 12 Q8 2, 14 12 Q20 22, 26 12',
    triangle: 'M2 12 L8 2 L20 22 L26 12',
    sawtooth: 'M2 12 L14 2 L14 22 L26 12',
    square: 'M2 12 L2 2 L14 2 L14 22 L26 22 L26 12',
  };

  return (
    <svg viewBox="0 0 28 24" className="waveform-icon-small">
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

// Piano Roll component
interface PianoRollProps {
  steps: Step[];
  currentStep: number;
  scaleNotes: string[];
  onSetNote: (stepIndex: number, note: string, active: boolean) => void;
  synth: MelodicSynth;
  currentPage: number;
}

const PianoRoll: React.FC<PianoRollProps> = ({ steps, currentStep, scaleNotes, onSetNote, synth, currentPage }) => {
  const isDragging = useRef(false);
  const dragMode = useRef<'add' | 'remove'>('add');

  // Display notes in reverse order (high notes at top)
  const displayNotes = [...scaleNotes].reverse();

  // Unified handler for both mouse and touch
  const handleCellPointerDown = (stepIndex: number, note: string, isActive: boolean, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    isDragging.current = true;
    dragMode.current = isActive ? 'remove' : 'add';

    if (dragMode.current === 'add') {
      onSetNote(stepIndex, note, true);
      synth.noteOn(note, 0.7);
      setTimeout(() => synth.noteOff(note), 100);
    } else {
      onSetNote(stepIndex, note, false);
    }
  };

  const handleCellPointerEnter = (stepIndex: number, note: string, isActive: boolean) => {
    if (!isDragging.current) return;

    if (dragMode.current === 'add' && !isActive) {
      onSetNote(stepIndex, note, true);
      synth.noteOn(note, 0.5);
      setTimeout(() => synth.noteOff(note), 50);
    } else if (dragMode.current === 'remove' && isActive) {
      onSetNote(stepIndex, note, false);
    }
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // Check if a note is black key
  const isBlackKey = (note: string) => note.includes('#');

  return (
    <div className="piano-roll-container">
      <div className="piano-roll">
        {/* Piano keys column */}
        <div className="piano-keys">
          {displayNotes.map((note) => (
            <div
              key={note}
              className={`piano-key ${isBlackKey(note) ? 'black' : 'white'}`}
              onClick={() => {
                synth.noteOn(note, 0.8);
                setTimeout(() => synth.noteOff(note), 200);
              }}
            >
              <span className="key-label">{note}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="piano-grid">
          {displayNotes.map((note) => (
            <div key={note} className={`piano-row ${isBlackKey(note) ? 'black-row' : ''}`}>
              {Array.from({ length: STEPS_PER_PAGE }, (_, i) => {
                const stepIndex = currentPage * STEPS_PER_PAGE + i;
                const step = steps[stepIndex];
                const isActive = step.active && step.note === note;
                return (
                  <div
                    key={stepIndex}
                    className={`piano-cell ${isActive ? 'active' : ''} ${currentStep === stepIndex ? 'current' : ''} ${i % 4 === 0 ? 'beat-start' : ''}`}
                    onPointerDown={(e) => handleCellPointerDown(stepIndex, note, isActive, e)}
                    onPointerEnter={() => handleCellPointerEnter(stepIndex, note, isActive)}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Step numbers */}
      <div className="piano-step-numbers">
        <div className="piano-keys-spacer" />
        <div className="step-numbers-row">
          {Array.from({ length: STEPS_PER_PAGE }, (_, i) => {
            const stepIndex = currentPage * STEPS_PER_PAGE + i;
            return (
              <div
                key={stepIndex}
                className={`step-number ${currentStep === stepIndex ? 'active' : ''} ${i % 4 === 0 ? 'beat' : ''}`}
              >
                {stepIndex + 1}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SynthSequencer;
