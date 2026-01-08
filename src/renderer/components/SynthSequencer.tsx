import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { MelodicSynth, SynthParams, WaveformType, ArpMode, DEFAULT_SYNTH_PARAMS } from '../audio/MelodicSynth';
import './SynthSequencer.css';

interface SynthSequencerProps {
  synth: MelodicSynth;
  isPlaying: boolean;
  tempo: number;
}

const NUM_STEPS = 16;
const OCTAVE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Scale definitions
const SCALES: { [key: string]: number[] } = {
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic minor': [0, 2, 3, 5, 7, 9, 11],
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'phrygian': [0, 1, 3, 5, 7, 8, 10],
  'lydian': [0, 2, 4, 6, 7, 9, 11],
  'mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'locrian': [0, 1, 3, 5, 6, 8, 10],
  'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'blues': [0, 3, 5, 6, 7, 10],
};

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const getScaleNotes = (root: string, scale: string): Set<string> => {
  const scaleNotes = new Set<string>();
  const rootIndex = ROOT_NOTES.indexOf(root);
  const intervals = SCALES[scale] || [];
  intervals.forEach(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    scaleNotes.add(ROOT_NOTES[noteIndex]);
  });
  return scaleNotes;
};

// Generate notes for the grid (2 octaves, from high to low for display)
const generateGridNotes = (baseOctave: number): string[] => {
  const notes: string[] = [];
  for (let octave = baseOctave + 1; octave >= baseOctave; octave--) {
    for (let i = OCTAVE_NOTES.length - 1; i >= 0; i--) {
      notes.push(`${OCTAVE_NOTES[i]}${octave}`);
    }
  }
  return notes;
};

const SynthSequencer: React.FC<SynthSequencerProps> = ({ synth, isPlaying, tempo }) => {
  const [params, setParams] = useState<SynthParams>(DEFAULT_SYNTH_PARAMS);
  const [sequence, setSequence] = useState<Set<string>[]>(() =>
    Array.from({ length: NUM_STEPS }, () => new Set<string>())
  );
  const [currentStep, setCurrentStep] = useState(-1);
  const [baseOctave, setBaseOctave] = useState(3);
  const [scaleEnabled, setScaleEnabled] = useState(false);
  const [scaleRoot, setScaleRoot] = useState('C');
  const [scaleType, setScaleType] = useState('minor pentatonic');

  const sequencerRef = useRef<Tone.Sequence | null>(null);
  const gridNotes = generateGridNotes(baseOctave);
  const scaleNotes = scaleEnabled ? getScaleNotes(scaleRoot, scaleType) : new Set<string>();

  const isInScale = (note: string): boolean => {
    if (!scaleEnabled) return false;
    const noteName = note.replace(/\d+$/, '');
    return scaleNotes.has(noteName);
  };

  const isBlackKey = (note: string): boolean => {
    return note.includes('#');
  };

  // Toggle a note at a step
  const toggleNote = (stepIndex: number, note: string) => {
    setSequence(prev => {
      const newSequence = [...prev];
      const newSet = new Set(newSequence[stepIndex]);
      if (newSet.has(note)) {
        newSet.delete(note);
      } else {
        newSet.add(note);
        // Play the note when adding
        synth.noteOn(note, 0.8);
        setTimeout(() => synth.noteOff(note), 150);
      }
      newSequence[stepIndex] = newSet;
      return newSequence;
    });
  };

  // Clear all notes
  const clearSequence = () => {
    setSequence(Array.from({ length: NUM_STEPS }, () => new Set<string>()));
  };

  // Randomize sequence based on scale
  const randomizeSequence = () => {
    const newSequence: Set<string>[] = Array.from({ length: NUM_STEPS }, () => new Set<string>());
    const availableNotes = scaleEnabled
      ? gridNotes.filter(n => isInScale(n))
      : gridNotes;

    for (let step = 0; step < NUM_STEPS; step++) {
      // 40% chance of a note on each step
      if (Math.random() < 0.4 && availableNotes.length > 0) {
        const randomNote = availableNotes[Math.floor(Math.random() * availableNotes.length)];
        newSequence[step].add(randomNote);
      }
    }
    setSequence(newSequence);
  };

  // Handle synth param changes
  const handleParamChange = (param: keyof SynthParams, value: number | WaveformType | ArpMode) => {
    const newParams = { ...params, [param]: value };
    setParams(newParams);
    synth.updateParams({ [param]: value } as Partial<SynthParams>);
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
    };
    setParams(newParams);
    synth.updateParams(newParams);
  };

  // Sequencer playback
  useEffect(() => {
    if (isPlaying) {
      // Create Tone.js sequence
      const stepTime = `${NUM_STEPS}n`;

      sequencerRef.current = new Tone.Sequence(
        (time, step) => {
          setCurrentStep(step);
          const notes = sequence[step];
          notes.forEach(note => {
            synth.noteOn(note, 0.8);
            // Schedule note off
            Tone.getTransport().scheduleOnce(() => {
              synth.noteOff(note);
            }, time + Tone.Time('16n').toSeconds() * 0.8);
          });
        },
        Array.from({ length: NUM_STEPS }, (_, i) => i),
        stepTime
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
    };
  }, [isPlaying, sequence, synth]);

  // Update tempo
  useEffect(() => {
    Tone.getTransport().bpm.value = tempo;
  }, [tempo]);

  const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  return (
    <div className="synth-sequencer">
      {/* Controls row */}
      <div className="seq-controls">
        <div className="seq-control-group">
          <label className="seq-label">OCTAVE</label>
          <div className="octave-controls">
            <button
              className="octave-btn"
              onClick={() => setBaseOctave(o => Math.max(1, o - 1))}
              disabled={baseOctave <= 1}
            >-</button>
            <span className="octave-display">{baseOctave}</span>
            <button
              className="octave-btn"
              onClick={() => setBaseOctave(o => Math.min(5, o + 1))}
              disabled={baseOctave >= 5}
            >+</button>
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
          <label className="seq-label">SCALE</label>
          <div className="scale-controls-compact">
            <button
              className={`scale-toggle-small ${scaleEnabled ? 'active' : ''}`}
              onClick={() => setScaleEnabled(!scaleEnabled)}
            >
              {scaleEnabled ? 'ON' : 'OFF'}
            </button>
            {scaleEnabled && (
              <>
                <select
                  className="scale-select-small"
                  value={scaleRoot}
                  onChange={(e) => setScaleRoot(e.target.value)}
                >
                  {ROOT_NOTES.map((note) => (
                    <option key={note} value={note}>{note}</option>
                  ))}
                </select>
                <select
                  className="scale-select-small"
                  value={scaleType}
                  onChange={(e) => setScaleType(e.target.value)}
                >
                  {Object.keys(SCALES).map((scale) => (
                    <option key={scale} value={scale}>
                      {scale.charAt(0).toUpperCase() + scale.slice(1)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="seq-control-group seq-actions">
          <button className="seq-action-btn" onClick={randomizeSequence}>
            DICE
          </button>
          <button className="seq-action-btn mutate-btn" onClick={randomizeParams}>
            MUTATE
          </button>
          <button className="seq-action-btn clear-btn" onClick={clearSequence}>
            CLEAR
          </button>
        </div>
      </div>

      {/* Piano roll grid */}
      <div className="piano-roll-container">
        <div className="piano-roll">
          {/* Note labels */}
          <div className="note-labels">
            {gridNotes.map((note) => (
              <div
                key={note}
                className={`note-label ${isBlackKey(note) ? 'black' : 'white'} ${isInScale(note) ? 'in-scale' : ''}`}
              >
                {note}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid-container">
            {/* Step numbers */}
            <div className="step-numbers">
              {Array.from({ length: NUM_STEPS }, (_, i) => (
                <div key={i} className={`step-number ${currentStep === i ? 'active' : ''}`}>
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Note rows */}
            <div className="grid-rows">
              {gridNotes.map((note) => (
                <div key={note} className={`grid-row ${isBlackKey(note) ? 'black-row' : 'white-row'}`}>
                  {Array.from({ length: NUM_STEPS }, (_, stepIndex) => (
                    <div
                      key={stepIndex}
                      className={`grid-cell
                        ${sequence[stepIndex].has(note) ? 'active' : ''}
                        ${currentStep === stepIndex ? 'current' : ''}
                        ${isInScale(note) ? 'in-scale' : ''}
                        ${stepIndex % 4 === 0 ? 'beat-start' : ''}
                      `}
                      onClick={() => toggleNote(stepIndex, note)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Waveform icons (smaller version)
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
