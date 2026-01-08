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
}

const NUM_STEPS = 16;

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

const SynthSequencer: React.FC<SynthSequencerProps> = ({ synth, isPlaying, tempo, steps, onStepsChange }) => {
  const [params, setParams] = useState<SynthParams>(DEFAULT_SYNTH_PARAMS);
  const [currentStep, setCurrentStep] = useState(-1);
  const [scaleRoot, setScaleRoot] = useState('C');
  const [scaleType, setScaleType] = useState('pentatonic');

  const sequencerRef = useRef<Tone.Sequence | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scaleNotes = getScaleNotes(scaleRoot, scaleType);

  // Toggle step on/off
  const toggleStep = (index: number) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], active: !newSteps[index].active };
    if (newSteps[index].active) {
      // Play preview
      synth.noteOn(newSteps[index].note, 0.8);
      setTimeout(() => synth.noteOff(newSteps[index].note), 150);
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
    setParams(newParams);
    synth.updateParams({ [param]: value } as Partial<SynthParams>);
  };

  // Randomize sequence
  const randomizeSequence = () => {
    const newSteps = steps.map(() => ({
      active: Math.random() < 0.5,
      note: scaleNotes[Math.floor(Math.random() * Math.min(scaleNotes.length, 24)) + Math.floor(scaleNotes.length / 4)],
    }));
    onStepsChange(newSteps);
  };

  // Randomize synth params
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
      detune: (Math.random() - 0.5) * 0.2,
      volume: 0.6 + Math.random() * 0.2,
      arpMode: 'off',
      arpRate: 0.5,
      mono: params.mono,
    };
    setParams(newParams);
    synth.updateParams(newParams);
  };

  // Clear sequence
  const clearSequence = () => {
    onStepsChange(Array.from({ length: NUM_STEPS }, () => ({ active: false, note: 'C4' })));
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

  // Sequencer playback
  useEffect(() => {
    if (isPlaying) {
      sequencerRef.current = new Tone.Sequence(
        (time, step) => {
          setCurrentStep(step);
          if (steps[step].active) {
            const noteToPlay = steps[step].note; // Capture note to avoid stale closure
            synth.noteOn(noteToPlay, 0.8);
            Tone.getTransport().scheduleOnce(() => {
              synth.noteOff(noteToPlay);
            }, time + Tone.Time('16n').toSeconds() * 0.8);
          }
        },
        Array.from({ length: NUM_STEPS }, (_, i) => i),
        '16n'
      );
      sequencerRef.current.start(0);
    } else {
      if (sequencerRef.current) {
        sequencerRef.current.stop();
        sequencerRef.current.dispose();
        sequencerRef.current = null;
      }
      setCurrentStep(-1);
      synth.releaseAll();
    }

    return () => {
      if (sequencerRef.current) {
        sequencerRef.current.stop();
        sequencerRef.current.dispose();
        sequencerRef.current = null;
      }
      synth.releaseAll();
    };
  }, [isPlaying, steps, synth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      synth.releaseAll();
    };
  }, [synth]);

  // Update tempo
  useEffect(() => {
    Tone.getTransport().bpm.value = tempo;
  }, [tempo]);

  const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  return (
    <div className="synth-seq-simple">
      {/* Controls */}
      <div className="seq-controls-simple">
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
      </div>

      {/* Step grid */}
      <div className="melody-grid" ref={containerRef}>
        {steps.map((step, index) => (
          <MelodyStep
            key={index}
            step={step}
            index={index}
            isCurrentStep={currentStep === index}
            scaleNotes={scaleNotes}
            onToggle={() => toggleStep(index)}
            onDrag={handleDrag}
            synth={synth}
          />
        ))}
      </div>

      {/* Step numbers */}
      <div className="step-indicators">
        {steps.map((_, index) => (
          <div
            key={index}
            className={`step-indicator ${currentStep === index ? 'active' : ''} ${index % 4 === 0 ? 'beat' : ''}`}
          >
            {index + 1}
          </div>
        ))}
      </div>
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
  onDrag: (index: number, startY: number, currentY: number, startNote: string) => void;
  synth: MelodicSynth;
}

const MelodyStep: React.FC<MelodyStepProps> = ({
  step,
  index,
  isCurrentStep,
  scaleNotes,
  onToggle,
  onDrag,
  synth,
}) => {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startNote = useRef(step.note);
  const lastNote = useRef(step.note);

  // Calculate bar height based on note position in scale
  const noteIndex = scaleNotes.indexOf(step.note);
  const barHeight = step.active ? 20 + (noteIndex / scaleNotes.length) * 60 : 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!step.active) {
      onToggle();
      return;
    }
    isDragging.current = true;
    startY.current = e.clientY;
    startNote.current = step.note;
    lastNote.current = step.note;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    onDrag(index, startY.current, e.clientY, startNote.current);
  };

  const handleMouseUp = () => {
    if (isDragging.current && step.note !== lastNote.current) {
      synth.noteOn(step.note, 0.7);
      setTimeout(() => synth.noteOff(step.note), 100);
    }
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!step.active) {
      onToggle();
      return;
    }
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startNote.current = step.note;
    lastNote.current = step.note;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    onDrag(index, startY.current, e.touches[0].clientY, startNote.current);
  };

  const handleTouchEnd = () => {
    if (isDragging.current && step.note !== lastNote.current) {
      synth.noteOn(step.note, 0.7);
      setTimeout(() => synth.noteOff(step.note), 100);
    }
    isDragging.current = false;
  };

  const handleDoubleClick = () => {
    if (step.active) {
      onToggle(); // Turn off on double click
    }
  };

  return (
    <div
      className={`melody-step ${step.active ? 'active' : ''} ${isCurrentStep ? 'current' : ''} ${index % 4 === 0 ? 'beat-start' : ''}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
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

export default SynthSequencer;
