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

// Genre-based melodic pattern generator
type MelodicGenre = {
  name: string;
  // Rhythm patterns for one bar (which steps have notes) - multiple options
  rhythmPatterns: number[][];
  // Melodic movement type
  melodyType: 'arpeggio' | 'stepwise' | 'jumpy' | 'repetitive' | 'descending' | 'ascending';
  // Note range within scale (0 = root, higher = higher notes)
  noteRangeStart: number;
  noteRangeEnd: number;
  // Probability of variation between bars
  variationChance: number;
  // Whether to occasionally repeat notes
  allowRepeats: boolean;
};

const MELODIC_GENRES: MelodicGenre[] = [
  {
    name: 'House',
    rhythmPatterns: [
      [0, 3, 4, 7, 8, 11, 12, 14],      // Offbeat stabs
      [0, 2, 4, 6, 8, 10, 12, 14],      // Steady 8ths
      [0, 4, 6, 8, 12, 14],             // Syncopated
    ],
    melodyType: 'arpeggio',
    noteRangeStart: 8,
    noteRangeEnd: 20,
    variationChance: 0.2,
    allowRepeats: true,
  },
  {
    name: 'Techno',
    rhythmPatterns: [
      [0, 2, 4, 6, 8, 10, 12, 14],      // Driving 8ths
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // 16ths
      [0, 4, 8, 12],                    // Quarter notes
    ],
    melodyType: 'repetitive',
    noteRangeStart: 6,
    noteRangeEnd: 14,
    variationChance: 0.1,
    allowRepeats: true,
  },
  {
    name: 'Ambient',
    rhythmPatterns: [
      [0, 8],                           // Sparse
      [0, 4, 12],                       // Minimal
      [0, 6, 10],                       // Floating
    ],
    melodyType: 'stepwise',
    noteRangeStart: 10,
    noteRangeEnd: 24,
    variationChance: 0.4,
    allowRepeats: false,
  },
  {
    name: 'Hip Hop',
    rhythmPatterns: [
      [0, 3, 6, 10, 12],                // Laid back
      [0, 2, 7, 8, 11, 14],             // Boom bap feel
      [0, 4, 6, 9, 12, 15],             // Syncopated
    ],
    melodyType: 'jumpy',
    noteRangeStart: 8,
    noteRangeEnd: 18,
    variationChance: 0.3,
    allowRepeats: true,
  },
  {
    name: 'Trance',
    rhythmPatterns: [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Full 16ths
      [0, 2, 4, 6, 8, 10, 12, 14],      // 8ths
    ],
    melodyType: 'arpeggio',
    noteRangeStart: 10,
    noteRangeEnd: 22,
    variationChance: 0.15,
    allowRepeats: true,
  },
  {
    name: 'Lo-fi',
    rhythmPatterns: [
      [0, 4, 7, 10, 14],                // Chill
      [0, 3, 8, 11],                    // Sparse jazzy
      [2, 6, 9, 12],                    // Offbeat
    ],
    melodyType: 'stepwise',
    noteRangeStart: 8,
    noteRangeEnd: 18,
    variationChance: 0.35,
    allowRepeats: false,
  },
  {
    name: 'DnB',
    rhythmPatterns: [
      [0, 3, 6, 8, 11, 14],             // Broken
      [0, 2, 5, 8, 10, 13],             // Syncopated
      [0, 1, 4, 6, 9, 12, 14, 15],      // Fast
    ],
    melodyType: 'jumpy',
    noteRangeStart: 6,
    noteRangeEnd: 18,
    variationChance: 0.25,
    allowRepeats: true,
  },
  {
    name: 'Funk',
    rhythmPatterns: [
      [0, 3, 4, 6, 10, 12, 15],         // Funky
      [0, 2, 3, 6, 8, 11, 14],          // Groovy
      [1, 4, 7, 8, 11, 14],             // Offbeat
    ],
    melodyType: 'jumpy',
    noteRangeStart: 8,
    noteRangeEnd: 16,
    variationChance: 0.3,
    allowRepeats: true,
  },
];

const generateMelodicPattern = (
  scaleNotes: string[],
  loopBars: number,
  genre?: MelodicGenre
): { active: boolean; note: string }[] => {
  const totalSteps = loopBars * 16;
  const selectedGenre = genre || MELODIC_GENRES[Math.floor(Math.random() * MELODIC_GENRES.length)];

  // Initialize empty pattern
  const pattern: { active: boolean; note: string }[] = Array.from(
    { length: 64 },
    () => ({ active: false, note: 'C4' })
  );

  // Select a rhythm pattern
  const rhythmPattern = selectedGenre.rhythmPatterns[
    Math.floor(Math.random() * selectedGenre.rhythmPatterns.length)
  ];

  // Calculate usable note range
  const rangeStart = Math.min(selectedGenre.noteRangeStart, scaleNotes.length - 1);
  const rangeEnd = Math.min(selectedGenre.noteRangeEnd, scaleNotes.length - 1);
  const noteRange = scaleNotes.slice(rangeStart, rangeEnd + 1);

  if (noteRange.length === 0) return pattern;

  // Generate base melodic sequence based on melody type
  let melodicSequence: number[] = [];
  const seqLength = rhythmPattern.length;

  switch (selectedGenre.melodyType) {
    case 'arpeggio':
      // Create arpeggio pattern (up, down, or up-down)
      const arpDirection = Math.random();
      if (arpDirection < 0.33) {
        // Ascending
        for (let i = 0; i < seqLength; i++) {
          melodicSequence.push(i % noteRange.length);
        }
      } else if (arpDirection < 0.66) {
        // Descending
        for (let i = 0; i < seqLength; i++) {
          melodicSequence.push((noteRange.length - 1) - (i % noteRange.length));
        }
      } else {
        // Up-down
        const upDown = [];
        for (let i = 0; i < noteRange.length; i++) upDown.push(i);
        for (let i = noteRange.length - 2; i > 0; i--) upDown.push(i);
        for (let i = 0; i < seqLength; i++) {
          melodicSequence.push(upDown[i % upDown.length]);
        }
      }
      break;

    case 'stepwise':
      // Move by steps, occasionally jumping
      let currentNote = Math.floor(noteRange.length / 2);
      for (let i = 0; i < seqLength; i++) {
        melodicSequence.push(currentNote);
        const step = Math.random() < 0.7 ? (Math.random() < 0.5 ? 1 : -1) : (Math.random() < 0.5 ? 2 : -2);
        currentNote = Math.max(0, Math.min(noteRange.length - 1, currentNote + step));
      }
      break;

    case 'jumpy':
      // Larger intervals, more variation
      for (let i = 0; i < seqLength; i++) {
        melodicSequence.push(Math.floor(Math.random() * noteRange.length));
      }
      break;

    case 'repetitive':
      // Repeat a short motif
      const motifLength = 2 + Math.floor(Math.random() * 3); // 2-4 notes
      const motif = [];
      for (let i = 0; i < motifLength; i++) {
        motif.push(Math.floor(Math.random() * Math.min(noteRange.length, 6)));
      }
      for (let i = 0; i < seqLength; i++) {
        melodicSequence.push(motif[i % motifLength]);
      }
      break;

    case 'ascending':
      for (let i = 0; i < seqLength; i++) {
        melodicSequence.push(Math.min(i, noteRange.length - 1));
      }
      break;

    case 'descending':
      for (let i = 0; i < seqLength; i++) {
        melodicSequence.push(Math.max(0, noteRange.length - 1 - i));
      }
      break;
  }

  // Apply pattern to each bar
  for (let bar = 0; bar < loopBars; bar++) {
    const barOffset = bar * 16;

    rhythmPattern.forEach((step, i) => {
      const globalStep = barOffset + step;
      if (globalStep < totalSteps) {
        // Add variation in later bars
        if (bar > 0 && Math.random() < selectedGenre.variationChance) {
          // Vary the note slightly
          const variedIndex = Math.max(0, Math.min(
            noteRange.length - 1,
            melodicSequence[i % melodicSequence.length] + (Math.random() < 0.5 ? 1 : -1)
          ));
          pattern[globalStep] = {
            active: true,
            note: noteRange[variedIndex],
          };
        } else {
          pattern[globalStep] = {
            active: true,
            note: noteRange[melodicSequence[i % melodicSequence.length]],
          };
        }
      }
    });
  }

  return pattern;
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

  // Generate genre-based melodic sequence
  const randomizeSequence = () => {
    const generatedPattern = generateMelodicPattern(scaleNotes, loopBars);
    const newSteps = [...steps];
    for (let i = 0; i < generatedPattern.length; i++) {
      newSteps[i] = generatedPattern[i];
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
      {/* Scroll indicator */}
      <div className="scroll-indicator-bar">
        <div className="scroll-indicator-keys">
          <span className="scroll-arrow">▲</span>
          <span className="scroll-arrow">▼</span>
        </div>
        <div className="scroll-indicator-spacer" />
      </div>

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
