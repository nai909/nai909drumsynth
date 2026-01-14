import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { DrumSynth } from './audio/DrumSynth';
import { Sequencer } from './audio/Sequencer';
import { MelodicSynth, SynthParams, DEFAULT_SYNTH_PARAMS } from './audio/MelodicSynth';
import { Pattern, DrumTrack } from './types';
import StepSequencer from './components/StepSequencer';
import Transport from './components/Transport';
import TrackParams from './components/TrackParams';
import Synth from './components/Synth';
import SynthEffects from './components/SynthEffects';
import SynthSequencer, { Step as SynthStep } from './components/SynthSequencer';
import PsychedelicBackground from './components/PsychedelicBackground';
import './styles/App.css';

const THEMES = ['purple', 'blue', 'red', 'orange', 'green', 'cyan', 'pink'] as const;
type Theme = typeof THEMES[number];

// Saved project structure
interface SavedProject {
  name: string;
  timestamp: number;
  pattern: Pattern;
  synthSequence: SynthStep[];
  synthParams: SynthParams;
}

const STORAGE_KEY = 'drumsynth-saved-projects';

// Validation helpers for save/load
const validateSynthStep = (step: unknown): SynthStep => {
  if (!step || typeof step !== 'object') {
    return { active: false, note: 'C4' };
  }
  const s = step as Record<string, unknown>;
  return {
    active: typeof s.active === 'boolean' ? s.active : false,
    note: typeof s.note === 'string' ? s.note : 'C4',
    length: typeof s.length === 'number' ? s.length : undefined,
  };
};

const validateDrumTrack = (track: unknown, defaultTrack: DrumTrack): DrumTrack => {
  if (!track || typeof track !== 'object') {
    return defaultTrack;
  }
  const t = track as Record<string, unknown>;
  const validTypes: DrumTrack['type'][] = ['analog', 'fm', 'pcm', 'sample'];
  return {
    id: typeof t.id === 'string' ? t.id : defaultTrack.id,
    name: typeof t.name === 'string' ? t.name : defaultTrack.name,
    type: validTypes.includes(t.type as DrumTrack['type']) ? t.type as DrumTrack['type'] : defaultTrack.type,
    soundEngine: typeof t.soundEngine === 'string' ? t.soundEngine : defaultTrack.soundEngine,
    steps: Array.isArray(t.steps) ? t.steps.map(s => Boolean(s)) : defaultTrack.steps,
    velocity: Array.isArray(t.velocity) ? t.velocity.map(v => typeof v === 'number' ? v : 1) : defaultTrack.velocity,
    muted: typeof t.muted === 'boolean' ? t.muted : false,
    solo: typeof t.solo === 'boolean' ? t.solo : false,
    volume: typeof t.volume === 'number' ? t.volume : defaultTrack.volume,
    pan: typeof t.pan === 'number' ? t.pan : 0,
    tune: typeof t.tune === 'number' ? t.tune : 0,
    decay: typeof t.decay === 'number' ? t.decay : 0,
    attack: typeof t.attack === 'number' ? t.attack : 0.001,
    tone: typeof t.tone === 'number' ? t.tone : 0.5,
    snap: typeof t.snap === 'number' ? t.snap : 0.3,
    filterCutoff: typeof t.filterCutoff === 'number' ? t.filterCutoff : 0.8,
    filterResonance: typeof t.filterResonance === 'number' ? t.filterResonance : 0.2,
    drive: typeof t.drive === 'number' ? t.drive : 0,
  };
};

const validatePattern = (pattern: unknown, defaultPattern: Pattern): Pattern => {
  if (!pattern || typeof pattern !== 'object') {
    return defaultPattern;
  }
  const p = pattern as Record<string, unknown>;
  const maxTracks = defaultPattern.tracks.length;
  const validatedTracks = Array.isArray(p.tracks)
    ? p.tracks.slice(0, maxTracks).map((t, i) => validateDrumTrack(t, defaultPattern.tracks[i] ?? defaultPattern.tracks[0]))
    : defaultPattern.tracks;

  return {
    id: typeof p.id === 'string' ? p.id : defaultPattern.id,
    name: typeof p.name === 'string' ? p.name : defaultPattern.name,
    tracks: validatedTracks,
    tempo: typeof p.tempo === 'number' && p.tempo > 0 && p.tempo <= 300 ? p.tempo : defaultPattern.tempo,
    steps: typeof p.steps === 'number' ? p.steps : defaultPattern.steps,
  };
};

const validateSynthParams = (params: unknown): SynthParams => {
  if (!params || typeof params !== 'object') {
    return DEFAULT_SYNTH_PARAMS;
  }
  const p = params as Record<string, unknown>;
  const validWaveforms: SynthParams['waveform'][] = ['sine', 'triangle', 'sawtooth', 'square'];
  const validArpModes: SynthParams['arpMode'][] = ['off', 'up', 'down', 'updown', 'random'];
  const validLfoDestinations: SynthParams['lfoDestination'][] = ['filter', 'pitch', 'volume'];

  return {
    waveform: validWaveforms.includes(p.waveform as SynthParams['waveform'])
      ? p.waveform as SynthParams['waveform']
      : DEFAULT_SYNTH_PARAMS.waveform,
    attack: typeof p.attack === 'number' ? p.attack : DEFAULT_SYNTH_PARAMS.attack,
    decay: typeof p.decay === 'number' ? p.decay : DEFAULT_SYNTH_PARAMS.decay,
    sustain: typeof p.sustain === 'number' ? p.sustain : DEFAULT_SYNTH_PARAMS.sustain,
    release: typeof p.release === 'number' ? p.release : DEFAULT_SYNTH_PARAMS.release,
    filterCutoff: typeof p.filterCutoff === 'number' ? p.filterCutoff : DEFAULT_SYNTH_PARAMS.filterCutoff,
    filterResonance: typeof p.filterResonance === 'number' ? p.filterResonance : DEFAULT_SYNTH_PARAMS.filterResonance,
    filterEnvAmount: typeof p.filterEnvAmount === 'number' ? p.filterEnvAmount : DEFAULT_SYNTH_PARAMS.filterEnvAmount,
    detune: typeof p.detune === 'number' ? p.detune : DEFAULT_SYNTH_PARAMS.detune,
    volume: typeof p.volume === 'number' ? p.volume : DEFAULT_SYNTH_PARAMS.volume,
    pan: typeof p.pan === 'number' ? p.pan : DEFAULT_SYNTH_PARAMS.pan,
    arpMode: validArpModes.includes(p.arpMode as SynthParams['arpMode'])
      ? p.arpMode as SynthParams['arpMode']
      : DEFAULT_SYNTH_PARAMS.arpMode,
    arpRate: typeof p.arpRate === 'number' ? p.arpRate : DEFAULT_SYNTH_PARAMS.arpRate,
    mono: typeof p.mono === 'boolean' ? p.mono : DEFAULT_SYNTH_PARAMS.mono,
    // Effects
    reverbMix: typeof p.reverbMix === 'number' ? p.reverbMix : DEFAULT_SYNTH_PARAMS.reverbMix,
    reverbDecay: typeof p.reverbDecay === 'number' ? p.reverbDecay : DEFAULT_SYNTH_PARAMS.reverbDecay,
    delayMix: typeof p.delayMix === 'number' ? p.delayMix : DEFAULT_SYNTH_PARAMS.delayMix,
    delayTime: typeof p.delayTime === 'number' ? p.delayTime : DEFAULT_SYNTH_PARAMS.delayTime,
    delayFeedback: typeof p.delayFeedback === 'number' ? p.delayFeedback : DEFAULT_SYNTH_PARAMS.delayFeedback,
    // LFO
    lfoRate: typeof p.lfoRate === 'number' ? p.lfoRate : DEFAULT_SYNTH_PARAMS.lfoRate,
    lfoDepth: typeof p.lfoDepth === 'number' ? p.lfoDepth : DEFAULT_SYNTH_PARAMS.lfoDepth,
    lfoEnabled: typeof p.lfoEnabled === 'boolean' ? p.lfoEnabled : DEFAULT_SYNTH_PARAMS.lfoEnabled,
    lfoDestination: validLfoDestinations.includes(p.lfoDestination as SynthParams['lfoDestination'])
      ? p.lfoDestination as SynthParams['lfoDestination']
      : DEFAULT_SYNTH_PARAMS.lfoDestination,
    // Phaser
    phaserMix: typeof p.phaserMix === 'number' ? p.phaserMix : DEFAULT_SYNTH_PARAMS.phaserMix,
    phaserFreq: typeof p.phaserFreq === 'number' ? p.phaserFreq : DEFAULT_SYNTH_PARAMS.phaserFreq,
    phaserDepth: typeof p.phaserDepth === 'number' ? p.phaserDepth : DEFAULT_SYNTH_PARAMS.phaserDepth,
    // Flanger
    flangerMix: typeof p.flangerMix === 'number' ? p.flangerMix : DEFAULT_SYNTH_PARAMS.flangerMix,
    flangerDepth: typeof p.flangerDepth === 'number' ? p.flangerDepth : DEFAULT_SYNTH_PARAMS.flangerDepth,
    flangerFreq: typeof p.flangerFreq === 'number' ? p.flangerFreq : DEFAULT_SYNTH_PARAMS.flangerFreq,
  };
};

// Clickable theme smiley component
const ThemeSmiley: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button className="theme-smiley-btn" onClick={onClick} aria-label="Change color theme">
    <svg viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        className="theme-smiley-face"
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
      <ellipse className="theme-smiley-eye" cx="20" cy="28" rx="5" ry="8" />
      <ellipse className="theme-smiley-eye" cx="44" cy="28" rx="5" ry="8" />
      <path
        className="theme-smiley-mouth"
        d="M16 44 Q24 54, 32 52 Q40 50, 48 44"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  </button>
);

const MAX_STEPS = 64; // 4 bars of 16 steps

const createInitialPattern = (): Pattern => {
  const tracks: DrumTrack[] = [
    {
      id: '1',
      name: 'Kick',
      type: 'analog',
      soundEngine: 'kick',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.8,
      pan: 0,
      tune: 0,
      decay: 0,
      attack: 0.001,
      tone: 0.5,
      snap: 0.3,
      filterCutoff: 0.8,
      filterResonance: 0.2,
      drive: 0,
    },
    {
      id: '2',
      name: 'Snare',
      type: 'analog',
      soundEngine: 'snare',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.7,
      pan: 0,
      tune: 0,
      decay: 0.2,
      attack: 0.001,
      tone: 0.6,
      snap: 0.4,
      filterCutoff: 0.9,
      filterResonance: 0.15,
      drive: 0.1,
    },
    {
      id: '3',
      name: 'Closed HH',
      type: 'analog',
      soundEngine: 'hihat-closed',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.6,
      pan: 0.2,
      tune: 0,
      decay: 0.1,
      attack: 0.001,
      tone: 0.7,
      snap: 0.2,
      filterCutoff: 1,
      filterResonance: 0.1,
      drive: 0,
    },
    {
      id: '4',
      name: 'Open HH',
      type: 'analog',
      soundEngine: 'hihat-open',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.5,
      pan: -0.2,
      tune: 0,
      decay: 0.3,
      attack: 0.001,
      tone: 0.7,
      snap: 0.2,
      filterCutoff: 1,
      filterResonance: 0.1,
      drive: 0,
    },
    {
      id: '5',
      name: 'Clap',
      type: 'analog',
      soundEngine: 'clap',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.7,
      pan: 0,
      tune: 0,
      decay: 0.15,
      attack: 0.001,
      tone: 0.5,
      snap: 0.3,
      filterCutoff: 0.85,
      filterResonance: 0.2,
      drive: 0.15,
    },
    {
      id: '6',
      name: 'Tom Low',
      type: 'analog',
      soundEngine: 'tom-low',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.7,
      pan: -0.3,
      tune: 0,
      decay: 0.3,
      attack: 0.001,
      tone: 0.4,
      snap: 0.2,
      filterCutoff: 0.7,
      filterResonance: 0.15,
      drive: 0,
    },
    {
      id: '7',
      name: 'Tom Mid',
      type: 'analog',
      soundEngine: 'tom-mid',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.7,
      pan: 0,
      tune: 0,
      decay: 0.25,
      attack: 0.001,
      tone: 0.45,
      snap: 0.2,
      filterCutoff: 0.75,
      filterResonance: 0.15,
      drive: 0,
    },
    {
      id: '8',
      name: 'Rimshot',
      type: 'analog',
      soundEngine: 'rimshot',
      steps: new Array(MAX_STEPS).fill(false),
      velocity: new Array(MAX_STEPS).fill(1),
      muted: false,
      solo: false,
      volume: 0.7,
      pan: 0.3,
      tune: 0,
      decay: 0.1,
      attack: 0.001,
      tone: 0.5,
      snap: 0.5,
      filterCutoff: 0.9,
      filterResonance: 0.2,
      drive: 0.1,
    },
  ];

  return {
    id: '1',
    name: 'Pattern 1',
    tracks,
    tempo: 140,
    steps: 16,
  };
};

const MAX_SYNTH_STEPS = 64; // 4 bars max
const createInitialSynthSequence = (): SynthStep[] =>
  Array.from({ length: MAX_SYNTH_STEPS }, () => ({ active: false, note: 'C4' }));

// Genre-based drum pattern generator
// Track indices: 0=Kick, 1=Snare, 2=Closed HH, 3=Open HH, 4=Clap, 5=Tom Low, 6=Tom Mid, 7=Rimshot
type GenrePattern = {
  name: string;
  kick: { required: number[]; optional: number[]; probability: number };
  snare: { required: number[]; optional: number[]; probability: number };
  closedHH: { required: number[]; optional: number[]; probability: number };
  openHH: { required: number[]; optional: number[]; probability: number };
  clap: { required: number[]; optional: number[]; probability: number };
  extras: { track: number; steps: number[]; probability: number }[];
};

const GENRE_PATTERNS: GenrePattern[] = [
  // House - 4 on the floor, offbeat hats
  {
    name: 'House',
    kick: { required: [0, 4, 8, 12], optional: [], probability: 0 },
    snare: { required: [], optional: [], probability: 0 },
    closedHH: { required: [2, 6, 10, 14], optional: [0, 4, 8, 12], probability: 0.5 },
    openHH: { required: [], optional: [6, 14], probability: 0.3 },
    clap: { required: [4, 12], optional: [], probability: 0 },
    extras: [{ track: 7, steps: [2, 10], probability: 0.2 }],
  },
  // Garage / UK Garage - shuffled, 2-step feel
  {
    name: 'Garage',
    kick: { required: [0, 10], optional: [3, 6, 7, 14], probability: 0.4 },
    snare: { required: [4, 12], optional: [7], probability: 0.3 },
    closedHH: { required: [0, 2, 4, 6, 8, 10, 12, 14], optional: [1, 3, 5, 9, 11, 13], probability: 0.3 },
    openHH: { required: [], optional: [3, 7, 11, 15], probability: 0.25 },
    clap: { required: [], optional: [4, 12], probability: 0.5 },
    extras: [{ track: 7, steps: [2, 6, 10, 14], probability: 0.15 }],
  },
  // Dubstep - half-time, sparse
  {
    name: 'Dubstep',
    kick: { required: [0], optional: [6, 10, 14, 15], probability: 0.25 },
    snare: { required: [8], optional: [], probability: 0 },
    closedHH: { required: [], optional: [0, 2, 4, 6, 8, 10, 12, 14], probability: 0.4 },
    openHH: { required: [], optional: [6, 14], probability: 0.2 },
    clap: { required: [8], optional: [], probability: 0 },
    extras: [{ track: 5, steps: [12, 14], probability: 0.3 }],
  },
  // Hip Hop / Boom Bap
  {
    name: 'Hip Hop',
    kick: { required: [0, 10], optional: [3, 6, 8, 14], probability: 0.35 },
    snare: { required: [4, 12], optional: [], probability: 0 },
    closedHH: { required: [0, 2, 4, 6, 8, 10, 12, 14], optional: [1, 3, 5, 7, 9, 11, 13, 15], probability: 0.3 },
    openHH: { required: [], optional: [7, 15], probability: 0.25 },
    clap: { required: [], optional: [4, 12], probability: 0.4 },
    extras: [],
  },
  // Trap - hi-hat rolls, half-time snare
  {
    name: 'Trap',
    kick: { required: [0], optional: [4, 7, 10, 12, 14], probability: 0.3 },
    snare: { required: [8], optional: [4], probability: 0.2 },
    closedHH: { required: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], optional: [], probability: 0 },
    openHH: { required: [], optional: [3, 7, 11, 15], probability: 0.3 },
    clap: { required: [8], optional: [], probability: 0 },
    extras: [{ track: 7, steps: [6, 14], probability: 0.2 }],
  },
  // Lo-fi / Downtempo
  {
    name: 'Lo-fi',
    kick: { required: [0, 7], optional: [4, 10, 14], probability: 0.3 },
    snare: { required: [4, 12], optional: [10], probability: 0.2 },
    closedHH: { required: [2, 6, 10, 14], optional: [0, 4, 8, 12], probability: 0.35 },
    openHH: { required: [], optional: [6, 14], probability: 0.2 },
    clap: { required: [], optional: [], probability: 0 },
    extras: [{ track: 7, steps: [2, 10], probability: 0.15 }],
  },
  // Techno - driving, relentless
  {
    name: 'Techno',
    kick: { required: [0, 4, 8, 12], optional: [2, 6, 10, 14], probability: 0.15 },
    snare: { required: [], optional: [4, 12], probability: 0.3 },
    closedHH: { required: [0, 2, 4, 6, 8, 10, 12, 14], optional: [1, 3, 5, 7, 9, 11, 13, 15], probability: 0.4 },
    openHH: { required: [6, 14], optional: [], probability: 0 },
    clap: { required: [4, 12], optional: [2, 6, 10], probability: 0.15 },
    extras: [{ track: 7, steps: [3, 7, 11, 15], probability: 0.2 }],
  },
  // Breakbeat - syncopated, energetic
  {
    name: 'Breakbeat',
    kick: { required: [0, 6, 10], optional: [3, 8, 14], probability: 0.35 },
    snare: { required: [4, 12], optional: [7, 11, 15], probability: 0.25 },
    closedHH: { required: [0, 2, 4, 6, 8, 10, 12, 14], optional: [1, 5, 9, 13], probability: 0.45 },
    openHH: { required: [], optional: [3, 7, 11, 15], probability: 0.3 },
    clap: { required: [], optional: [4, 12], probability: 0.5 },
    extras: [{ track: 6, steps: [7, 15], probability: 0.25 }],
  },
];

const generateDrumPattern = (loopBars: number): { steps: boolean[][]; velocities: number[][] } => {
  const totalSteps = loopBars * 16;
  const genre = GENRE_PATTERNS[Math.floor(Math.random() * GENRE_PATTERNS.length)];

  // Initialize empty pattern for 8 tracks
  const steps: boolean[][] = Array.from({ length: 8 }, () => new Array(totalSteps).fill(false));
  const velocities: number[][] = Array.from({ length: 8 }, () => new Array(totalSteps).fill(1));

  // Helper to set step with velocity variation
  const setStep = (track: number, step: number, baseVelocity = 1) => {
    if (step < totalSteps) {
      steps[track][step] = true;
      // Add velocity variation (-20% to +10%)
      velocities[track][step] = Math.min(1, Math.max(0.5, baseVelocity * (0.8 + Math.random() * 0.3)));
    }
  };

  // Apply pattern for each bar
  for (let bar = 0; bar < loopBars; bar++) {
    const offset = bar * 16;

    // Kick
    genre.kick.required.forEach(step => setStep(0, offset + step, 1));
    genre.kick.optional.forEach(step => {
      if (Math.random() < genre.kick.probability) setStep(0, offset + step, 0.85);
    });

    // Snare
    genre.snare.required.forEach(step => setStep(1, offset + step, 1));
    genre.snare.optional.forEach(step => {
      if (Math.random() < genre.snare.probability) setStep(1, offset + step, 0.8);
    });

    // Closed Hi-Hat
    genre.closedHH.required.forEach(step => setStep(2, offset + step, 0.9));
    genre.closedHH.optional.forEach(step => {
      if (Math.random() < genre.closedHH.probability) setStep(2, offset + step, 0.7);
    });

    // Open Hi-Hat
    genre.openHH.required.forEach(step => setStep(3, offset + step, 0.85));
    genre.openHH.optional.forEach(step => {
      if (Math.random() < genre.openHH.probability) setStep(3, offset + step, 0.75);
    });

    // Clap
    genre.clap.required.forEach(step => setStep(4, offset + step, 0.95));
    genre.clap.optional.forEach(step => {
      if (Math.random() < genre.clap.probability) setStep(4, offset + step, 0.85);
    });

    // Extra instruments (toms, rimshot)
    genre.extras.forEach(extra => {
      extra.steps.forEach(step => {
        if (Math.random() < extra.probability) setStep(extra.track, offset + step, 0.8);
      });
    });
  }

  // Add slight variation between bars (remove some hits in later bars for interest)
  if (loopBars > 1) {
    for (let bar = 1; bar < loopBars; bar++) {
      const offset = bar * 16;
      // Occasionally add or remove a hit for variation
      for (let track = 0; track < 8; track++) {
        for (let step = 0; step < 16; step++) {
          const globalStep = offset + step;
          // 5% chance to flip a step (add variation)
          if (Math.random() < 0.05) {
            steps[track][globalStep] = !steps[track][globalStep];
            if (steps[track][globalStep]) {
              velocities[track][globalStep] = 0.7 + Math.random() * 0.2;
            }
          }
        }
      }
    }
  }

  return { steps, velocities };
};

const App: React.FC = () => {
  const [pattern, setPattern] = useState<Pattern>(createInitialPattern());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [synthCurrentStep, setSynthCurrentStep] = useState(-1);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [mode, setMode] = useState<'sequencer' | 'pad' | 'params' | 'synth' | 'effects'>('synth');
  const [noteRepeat, setNoteRepeat] = useState<'off' | '1/2' | '1/4' | '1/8' | '1/16'>('off');
  const [noteRepeatModifier, setNoteRepeatModifier] = useState<'normal' | 'dotted' | 'triplet'>('normal');
  const [loopBars, setLoopBars] = useState<1 | 2 | 3 | 4>(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [synthMode, setSynthMode] = useState<'keys' | 'seq'>('keys');
  const [synthSequence, setSynthSequence] = useState<SynthStep[]>(createInitialSynthSequence);
  const [synthLoopBars, setSynthLoopBars] = useState<1 | 2 | 3 | 4>(1);
  const [synthCurrentPage, setSynthCurrentPage] = useState(0);
  const [synthParams, setSynthParams] = useState<SynthParams>(DEFAULT_SYNTH_PARAMS);
  // Shared scale state for synth keys and sequencer
  const [synthScaleEnabled, setSynthScaleEnabled] = useState(false);
  const [synthScaleRoot, setSynthScaleRoot] = useState('C');
  const [synthScaleType, setSynthScaleType] = useState('major');
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('drumsynth-theme');
    return (saved as Theme) || 'purple';
  });
  const [isRecording, setIsRecording] = useState(false);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  // Count-in state for recording
  const [countIn, setCountIn] = useState<number>(0); // 0 = not counting, 1-4 = current beat
  const [countInBeats, setCountInBeats] = useState<4 | 2 | 0>(4); // Number of count-in beats (0 = off)
  // Undo state - store pattern before recording started
  const [patternBeforeRecording, setPatternBeforeRecording] = useState<Pattern | null>(null);
  const [synthSequenceBeforeRecording, setSynthSequenceBeforeRecording] = useState<SynthStep[] | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  // Recently recorded steps for visual feedback
  const [recentlyRecordedSteps, setRecentlyRecordedSteps] = useState<Set<string>>(new Set());
  // Synth loop capture mode - first recording pass defines the loop length
  const [isSynthLoopCapture, setIsSynthLoopCapture] = useState(true); // True when sequence is empty
  const [synthRecordingStartStep, setSynthRecordingStartStep] = useState<number | null>(null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out invalid entries (must have name and timestamp at minimum)
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (p): p is SavedProject =>
              p && typeof p === 'object' && typeof p.name === 'string' && typeof p.timestamp === 'number'
          );
        }
        return [];
      } catch (e) {
        console.error('Failed to load saved projects:', e);
        return [];
      }
    }
    return [];
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [audioReady, setAudioReady] = useState(false);

  const drumSynthRef = useRef<DrumSynth | null>(null);
  const sequencerRef = useRef<Sequencer | null>(null);
  const melodicSynthRef = useRef<MelodicSynth | null>(null);
  const synthSequencerRef = useRef<Tone.Sequence | null>(null);
  const synthSequenceRef = useRef<SynthStep[]>(synthSequence); // Ref to avoid recreating sequence
  const lastRecordedLoopStart = useRef<number>(-1);
  // Track hits recorded in current loop to prevent double-triggering via sequencer
  const recentlyRecordedHits = useRef<Set<string>>(new Set());
  // Ref to track recording state for sequencer callback
  const isRecordingRef = useRef(false);
  // Count-in timer and synth for clicks
  const countInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countInSynthRef = useRef<Tone.MembraneSynth | null>(null);
  // Track if we're in the middle of a count-in to prevent race conditions
  const isCountingInRef = useRef(false);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'purple') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('drumsynth-theme', theme);
  }, [theme]);


  useEffect(() => {
    drumSynthRef.current = new DrumSynth();
    sequencerRef.current = new Sequencer(drumSynthRef.current);
    melodicSynthRef.current = new MelodicSynth();
    // Initialize count-in click synth (distinct from metronome)
    const countInVolume = new Tone.Volume(-3).toDestination();
    countInSynthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.005,
      octaves: 4,
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.02,
      },
    }).connect(countInVolume);
    setAudioReady(true);

    let lastStep = -1;
    sequencerRef.current.onStep((step) => {
      // Clear recently recorded hits on loop wrap (when step goes back to 0 or lower than last)
      if (step < lastStep) {
        recentlyRecordedHits.current.clear();
      }
      lastStep = step;
      setCurrentStep(step);
    });

    // Set up callback to prevent double-triggering during recording
    // Only skip hits when actively recording AND the hit was just recorded
    sequencerRef.current.setShouldSkipHitCallback((trackIndex, stepIndex) => {
      if (!isRecordingRef.current) return false; // Don't skip anything when not recording
      const hitKey = `${trackIndex}-${stepIndex}`;
      return recentlyRecordedHits.current.has(hitKey);
    });

    sequencerRef.current.setPattern(pattern);

    // Initialize audio on first user interaction (required for mobile)
    const initAudioOnInteraction = async () => {
      if (drumSynthRef.current) {
        await drumSynthRef.current.init();
      }
    };

    // Listen for first touch/click to init audio
    document.addEventListener('touchstart', initAudioOnInteraction, { once: true });
    document.addEventListener('click', initAudioOnInteraction, { once: true });

    return () => {
      document.removeEventListener('touchstart', initAudioOnInteraction);
      document.removeEventListener('click', initAudioOnInteraction);
      sequencerRef.current?.dispose();
      drumSynthRef.current?.dispose();
      melodicSynthRef.current?.dispose();
      countInSynthRef.current?.dispose();
      if (countInTimerRef.current) {
        clearTimeout(countInTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (sequencerRef.current) {
      sequencerRef.current.setPattern(pattern);
    }
  }, [pattern]);

  // Keep synthSequenceRef in sync with synthSequence state
  useEffect(() => {
    synthSequenceRef.current = synthSequence;
  }, [synthSequence]);

  // Keep isRecordingRef in sync with isRecording state for sequencer callback
  useEffect(() => {
    isRecordingRef.current = isRecording;
    // Clear recently recorded hits when recording stops
    if (!isRecording) {
      recentlyRecordedHits.current.clear();
    }
  }, [isRecording]);

  // Synth sequencer playback (runs independently of UI mode)
  // Uses ref for synthSequence to avoid recreating sequence on every step toggle
  useEffect(() => {
    const activeTimeouts: ReturnType<typeof setTimeout>[] = [];

    if (isPlaying && melodicSynthRef.current) {
      const synth = melodicSynthRef.current;
      const stepDurationMs = 60000 / pattern.tempo / 4; // Duration of one 16th note step
      // In capture mode, use full 4 bars (64 steps) so recording can span all bars
      const synthLoopLength = isSynthLoopCapture ? 64 : synthLoopBars * 16;

      synthSequencerRef.current = new Tone.Sequence(
        (_time, step) => {
          setSynthCurrentStep(step);
          // Read from ref to get current sequence without recreating
          const currentStep = synthSequenceRef.current[step];
          if (currentStep && currentStep.active) {
            const noteToPlay = currentStep.note;
            // Use recorded length or default to 1 step, with 80% gate time
            const noteLength = currentStep.length || 1;
            const noteDurationMs = stepDurationMs * noteLength * 0.8;
            synth.noteOn(noteToPlay, 0.8);
            const timeoutId = setTimeout(() => {
              // Check synth still exists before calling noteOff
              if (melodicSynthRef.current) {
                melodicSynthRef.current.noteOff(noteToPlay);
              }
            }, noteDurationMs);
            activeTimeouts.push(timeoutId);
          }
        },
        Array.from({ length: synthLoopLength }, (_, i) => i),
        '16n'
      );
      synthSequencerRef.current.start(0);
    } else {
      if (synthSequencerRef.current) {
        synthSequencerRef.current.stop();
        synthSequencerRef.current.dispose();
        synthSequencerRef.current = null;
      }
      setSynthCurrentStep(-1);
      melodicSynthRef.current?.releaseAll();
    }

    return () => {
      // Clear all pending timeouts to prevent stale callbacks
      activeTimeouts.forEach(id => clearTimeout(id));
      if (synthSequencerRef.current) {
        synthSequencerRef.current.stop();
        synthSequencerRef.current.dispose();
        synthSequencerRef.current = null;
      }
    };
  }, [isPlaying, pattern.tempo, synthLoopBars, isSynthLoopCapture]);

  // Count-in and play function
  const startCountIn = async () => {
    if (isCountingInRef.current) return; // Prevent double count-in

    // Store current state for undo BEFORE we start recording
    if (isRecording) {
      setPatternBeforeRecording(JSON.parse(JSON.stringify(pattern)));
      setSynthSequenceBeforeRecording(JSON.parse(JSON.stringify(synthSequence)));
      setCanUndo(false); // Will enable after recording stops
    }

    isCountingInRef.current = true;

    // Init audio context
    if (drumSynthRef.current) {
      await drumSynthRef.current.init();
    }
    await Tone.start();

    const beatDurationMs = 60000 / pattern.tempo;
    let currentBeat = 1;

    const playCountInBeat = () => {
      if (!isCountingInRef.current) return; // Cancelled

      setCountIn(currentBeat);

      // Play click sound - higher pitch on beat 1
      if (countInSynthRef.current) {
        const pitch = currentBeat === 1 ? 'G5' : 'C5';
        countInSynthRef.current.triggerAttackRelease(pitch, '32n');
      }

      if (currentBeat < countInBeats) {
        currentBeat++;
        countInTimerRef.current = setTimeout(playCountInBeat, beatDurationMs);
      } else {
        // Count-in complete - start actual playback
        countInTimerRef.current = setTimeout(() => {
          setCountIn(0);
          isCountingInRef.current = false;
          actuallyStartPlayback();
        }, beatDurationMs);
      }
    };

    playCountInBeat();
  };

  const actuallyStartPlayback = async () => {
    if (sequencerRef.current) {
      await sequencerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePlay = async () => {
    // If recording is armed AND count-in is enabled, do count-in first
    if (isRecording && countInBeats > 0 && !isPlaying && !isCountingInRef.current) {
      await startCountIn();
    } else if (!isCountingInRef.current) {
      // Direct play without count-in
      if (sequencerRef.current) {
        await sequencerRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handlePause = () => {
    if (sequencerRef.current) {
      sequencerRef.current.pause();
      setIsPlaying(false);
      // Clear recorded hits on pause to prevent skipping on resume
      recentlyRecordedHits.current.clear();
    }
  };

  const handleStop = () => {
    // Cancel count-in if in progress
    if (isCountingInRef.current) {
      isCountingInRef.current = false;
      if (countInTimerRef.current) {
        clearTimeout(countInTimerRef.current);
        countInTimerRef.current = null;
      }
      setCountIn(0);
    }

    // Auto-set synth loop length if we were in capture mode
    if (isRecording && isSynthLoopCapture) {
      // Find the highest step index with an active note
      let highestActiveStep = -1;
      synthSequence.forEach((step, index) => {
        if (step.active) {
          // Account for note length extending past the step
          const noteEnd = index + (step.length || 1) - 1;
          highestActiveStep = Math.max(highestActiveStep, noteEnd);
        }
      });

      if (highestActiveStep >= 0) {
        // Calculate bars needed (round up to nearest bar)
        const barsNeeded = Math.ceil((highestActiveStep + 1) / 16) as 1 | 2 | 3 | 4;
        const newLoopBars = Math.min(4, Math.max(1, barsNeeded)) as 1 | 2 | 3 | 4;
        setSynthLoopBars(newLoopBars);
        // Exit capture mode - now in layer mode
        setIsSynthLoopCapture(false);
      }
    }

    // Enable undo if we were recording and have stored state
    if (isRecording && patternBeforeRecording) {
      setCanUndo(true);
    }

    // Always stop recording, even if sequencer isn't ready
    setIsRecording(false);
    // Clear recently recorded hits
    recentlyRecordedHits.current.clear();
    // Clear visual feedback
    setRecentlyRecordedSteps(new Set());

    if (sequencerRef.current) {
      sequencerRef.current.stop();
      setIsPlaying(false);
      setCurrentStep(0);
    }
  };

  // Undo last recording take
  const handleUndo = () => {
    if (patternBeforeRecording) {
      setPattern(patternBeforeRecording);
      setPatternBeforeRecording(null);
    }
    if (synthSequenceBeforeRecording) {
      setSynthSequence(synthSequenceBeforeRecording);
      setSynthSequenceBeforeRecording(null);
    }
    setCanUndo(false);
  };

  const handleTempoChange = (tempo: number) => {
    setPattern({ ...pattern, tempo });
    if (sequencerRef.current) {
      sequencerRef.current.setTempo(tempo);
    }
  };

  const handleMetronomeToggle = () => {
    const newValue = !metronomeEnabled;
    setMetronomeEnabled(newValue);
    if (sequencerRef.current) {
      sequencerRef.current.setMetronome(newValue);
    }
  };

  const handleStepToggle = (trackIndex: number, stepIndex: number) => {
    const newPattern = { ...pattern };
    newPattern.tracks[trackIndex].steps[stepIndex] = !newPattern.tracks[trackIndex].steps[stepIndex];
    setPattern(newPattern);
  };

  const handleParamChange = (param: keyof DrumTrack, value: number) => {
    const numericParams = ['volume', 'pan', 'tune', 'decay', 'attack', 'tone', 'snap', 'filterCutoff', 'filterResonance', 'drive'] as const;
    if (!numericParams.includes(param as typeof numericParams[number])) return;

    setPattern(prev => ({
      ...prev,
      tracks: prev.tracks.map((track, i) =>
        i === selectedTrack ? { ...track, [param]: value } : track
      )
    }));
  };

  const handleClearSequence = () => {
    const newPattern = { ...pattern };
    newPattern.tracks = newPattern.tracks.map(track => ({
      ...track,
      steps: new Array(MAX_STEPS).fill(false),
    }));
    setPattern(newPattern);
  };

  const handleRandomize = () => {
    const { steps, velocities } = generateDrumPattern(loopBars);
    const newPattern = { ...pattern };
    newPattern.tracks = newPattern.tracks.map((track, trackIndex) => ({
      ...track,
      steps: [...steps[trackIndex], ...new Array(MAX_STEPS - steps[trackIndex].length).fill(false)],
      velocity: [...velocities[trackIndex], ...new Array(MAX_STEPS - velocities[trackIndex].length).fill(1)],
    }));
    setPattern(newPattern);
  };

  // Auto-advance page to follow playhead
  useEffect(() => {
    if (isPlaying) {
      const totalSteps = loopBars * 16;
      const stepInLoop = currentStep % totalSteps;
      const targetPage = Math.floor(stepInLoop / 16);
      if (targetPage !== currentPage && targetPage < loopBars) {
        setCurrentPage(targetPage);
      }
    }
  }, [currentStep, isPlaying, loopBars, currentPage]);

  // Reset page if it exceeds loop length
  useEffect(() => {
    if (currentPage >= loopBars) {
      setCurrentPage(0);
    }
  }, [loopBars, currentPage]);

  const handleLoopBarsChange = (bars: 1 | 2 | 3 | 4) => {
    setLoopBars(bars);
    // Update pattern step count for sequencer
    const newPattern = { ...pattern, steps: bars * 16 };
    setPattern(newPattern);
  };

  // Auto-advance page for synth sequencer
  useEffect(() => {
    if (isPlaying) {
      const totalSteps = synthLoopBars * 16;
      const stepInLoop = synthCurrentStep % totalSteps;
      const targetPage = Math.floor(stepInLoop / 16);
      if (targetPage !== synthCurrentPage && targetPage < synthLoopBars) {
        setSynthCurrentPage(targetPage);
      }
    }
  }, [synthCurrentStep, isPlaying, synthLoopBars, synthCurrentPage]);

  // Reset synth page if it exceeds loop length
  useEffect(() => {
    if (synthCurrentPage >= synthLoopBars) {
      setSynthCurrentPage(0);
    }
  }, [synthLoopBars, synthCurrentPage]);

  const handleSynthLoopBarsChange = (bars: 1 | 2 | 3 | 4) => {
    setSynthLoopBars(bars);
  };

  const handlePadTrigger = async (trackIndex: number, velocity: number = 0.8, scheduledTime?: number) => {
    if (!drumSynthRef.current) return;

    // Get track first to validate
    const track = pattern.tracks[trackIndex];
    if (!track) return;

    await drumSynthRef.current.init();

    // Auto-start playback when recording is armed but not playing
    let justStartedPlayback = false;
    if (isRecording && !isPlaying && !isCountingInRef.current) {
      // Store pattern for undo before we start recording
      if (!patternBeforeRecording) {
        setPatternBeforeRecording(JSON.parse(JSON.stringify(pattern)));
        setSynthSequenceBeforeRecording(JSON.parse(JSON.stringify(synthSequence)));
      }
      // Start playback first, then continue to trigger the sound below
      await handlePlay();
      justStartedPlayback = true;
      // Don't return - continue to trigger the sound and record it
    }

    // Use scheduled time if provided (for note repeat), otherwise use current time
    const time = scheduledTime ?? Tone.now();
    const { volume, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive } = track;

    // Combine track volume with touch velocity
    const finalVelocity = volume * velocity;

    // Record the hit if recording and playing, or if we just started playback
    if (isRecording && (isPlaying || justStartedPlayback)) {
      const transportSeconds = Tone.Transport.seconds;
      const secondsPerStep = 60 / pattern.tempo / 4; // 16th note duration
      const loopLengthSteps = loopBars * 16;
      const loopLengthSeconds = loopLengthSteps * secondsPerStep;

      let stepIndex: number;

      if (justStartedPlayback) {
        // When we just started, record to step 0
        stepIndex = 0;
      } else {
        // Input latency compensation: shift recording time earlier
        // Use smaller compensation (30ms) for tighter feel
        const inputLatencyCompensation = 0.03;
        const compensatedTransportSeconds = Math.max(0, transportSeconds - inputLatencyCompensation);

        // Calculate position within current loop
        const positionInLoop = compensatedTransportSeconds % loopLengthSeconds;
        const exactStep = positionInLoop / secondsPerStep;

        // Round to nearest step (0.5 threshold) for more natural quantization
        stepIndex = Math.round(exactStep) % loopLengthSteps;
      }

      // Detect loop restart to clear recently recorded hits
      const currentLoopNumber = Math.floor(transportSeconds / loopLengthSeconds);
      if (currentLoopNumber !== lastRecordedLoopStart.current) {
        lastRecordedLoopStart.current = currentLoopNumber;
        // Clear recently recorded hits on new loop
        recentlyRecordedHits.current.clear();
      }

      // Track this hit to prevent double-triggering via sequencer
      const hitKey = `${trackIndex}-${stepIndex}`;
      recentlyRecordedHits.current.add(hitKey);

      setPattern(prevPattern => {
        const newPattern = { ...prevPattern };
        const newTracks = [...newPattern.tracks];
        const newTrack = { ...newTracks[trackIndex] };

        // Record the hit (always layer/overdub mode)
        newTrack.steps = [...newTrack.steps];
        newTrack.velocity = [...newTrack.velocity];
        newTrack.steps[stepIndex] = true;

        // Keep higher velocity if step already has a hit (layer behavior)
        if (prevPattern.tracks[trackIndex].steps[stepIndex]) {
          newTrack.velocity[stepIndex] = Math.max(newTrack.velocity[stepIndex], velocity);
        } else {
          newTrack.velocity[stepIndex] = velocity;
        }

        newTracks[trackIndex] = newTrack;
        newPattern.tracks = newTracks;
        return newPattern;
      });

      // Visual feedback: highlight the recorded step briefly
      const feedbackKey = `drum-${trackIndex}-${stepIndex}`;
      setRecentlyRecordedSteps(prev => new Set([...prev, feedbackKey]));
      // Remove the highlight after 300ms
      setTimeout(() => {
        setRecentlyRecordedSteps(prev => {
          const next = new Set(prev);
          next.delete(feedbackKey);
          return next;
        });
      }, 300);
    }

    // Always play the sound immediately for instant feedback
    // The sequencer will be notified to skip this hit to prevent double-triggering

    switch (track.soundEngine) {
      case 'kick':
        drumSynthRef.current.triggerKick(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'snare':
        drumSynthRef.current.triggerSnare(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'hihat-closed':
        drumSynthRef.current.triggerHiHat(time, finalVelocity, false, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'hihat-open':
        drumSynthRef.current.triggerHiHat(time, finalVelocity, true, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'clap':
        drumSynthRef.current.triggerClap(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'tom-low':
        drumSynthRef.current.triggerTom(time, finalVelocity, 'G2', tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'tom-mid':
        drumSynthRef.current.triggerTom(time, finalVelocity, 'C3', tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'tom-high':
        drumSynthRef.current.triggerTom(time, finalVelocity, 'F3', tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'rimshot':
        drumSynthRef.current.triggerRimshot(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
    }
  };

  // Handle synth params change (shared between Synth and SynthSequencer)
  const handleSynthParamsChange = (newParams: SynthParams) => {
    setSynthParams(newParams);
    if (melodicSynthRef.current) {
      melodicSynthRef.current.updateParams(newParams);
    }
  };

  // Randomly change to a different theme
  const handleThemeChange = () => {
    const otherThemes = THEMES.filter(t => t !== theme);
    const randomTheme = otherThemes[Math.floor(Math.random() * otherThemes.length)];
    setTheme(randomTheme);
  };


  // Save project handler
  const handleSaveProject = () => {
    if (!projectName.trim()) return;

    const newProject: SavedProject = {
      name: projectName.trim(),
      timestamp: Date.now(),
      pattern,
      synthSequence,
      synthParams,
    };

    const updatedProjects = [...savedProjects, newProject];
    setSavedProjects(updatedProjects);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
    setProjectName('');
    setShowSaveModal(false);
  };

  // Load project handler with validation
  const handleLoadProject = (project: SavedProject) => {
    try {
      const defaultPattern = createInitialPattern();

      // Validate and sanitize all loaded data
      const validatedPattern = validatePattern(project.pattern, defaultPattern);
      const validatedSynthSequence = Array.isArray(project.synthSequence)
        ? project.synthSequence.map(validateSynthStep)
        : createInitialSynthSequence();
      const validatedSynthParams = validateSynthParams(project.synthParams);

      setPattern(validatedPattern);
      setSynthSequence(validatedSynthSequence);
      setSynthParams(validatedSynthParams);

      if (melodicSynthRef.current) {
        melodicSynthRef.current.updateParams(validatedSynthParams);
      }
      setShowLoadModal(false);
    } catch (error) {
      console.error('Failed to load project:', error);
      // On error, just close modal - don't crash
      setShowLoadModal(false);
    }
  };

  // Delete project handler
  const handleDeleteProject = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedProjects = savedProjects.filter((_, i) => i !== index);
    setSavedProjects(updatedProjects);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
  };

  return (
    <div className="app">
      <PsychedelicBackground />
      {/* Clickable theme smiley */}
      <ThemeSmiley onClick={handleThemeChange} />

      {/* Save/Load buttons */}
      <div className="project-buttons">
        <button className="project-btn save-btn" onClick={() => setShowSaveModal(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          SAVE
        </button>
        <button className="project-btn load-btn" onClick={() => setShowLoadModal(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
          </svg>
          LOAD
        </button>
      </div>


      {/* Save Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Save Project</h2>
            <input
              type="text"
              className="modal-input"
              placeholder="Project name..."
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveProject()}
              autoFocus
            />
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button className="modal-btn confirm" onClick={handleSaveProject} disabled={!projectName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Load Project</h2>
            {savedProjects.length === 0 ? (
              <p className="modal-empty">No saved projects yet</p>
            ) : (
              <div className="project-list">
                {savedProjects.map((project, index) => (
                  <div
                    key={index}
                    className="project-item"
                    onClick={() => handleLoadProject(project)}
                  >
                    <div className="project-info">
                      <span className="project-name">{project.name}</span>
                      <span className="project-date">
                        {new Date(project.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      className="project-delete"
                      onClick={(e) => handleDeleteProject(index, e)}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => setShowLoadModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="center-section">
          <div className="sequencer-container">
            <div className="mode-toggle-wrapper">
              <div className={`section-group ${mode === 'synth' || mode === 'effects' ? 'section-active' : ''}`}>
                <span className="section-label">SYNTH</span>
                <div className="synth-toggle-group">
                  <button
                    className={`mode-toggle synth-toggle ${mode === 'synth' && synthMode === 'keys' ? 'active' : ''}`}
                    onClick={() => { setMode('synth'); setSynthMode('keys'); }}
                  >
                    KEYS
                  </button>
                  <button
                    className={`mode-toggle synth-toggle ${mode === 'effects' ? 'active' : ''}`}
                    onClick={() => setMode('effects')}
                  >
                    FX
                  </button>
                  <button
                    className={`mode-toggle synth-toggle ${mode === 'synth' && synthMode === 'seq' ? 'active' : ''}`}
                    onClick={() => { setMode('synth'); setSynthMode('seq'); }}
                  >
                    MELODY
                  </button>
                </div>
              </div>
              <div className={`section-group ${mode === 'params' || mode === 'sequencer' || mode === 'pad' ? 'section-active' : ''}`}>
                <span className="section-label">DRUMS</span>
                <div className="mode-toggle-container">
                  <button
                    className={`mode-toggle ${mode === 'pad' ? 'active' : ''}`}
                    onClick={() => setMode('pad')}
                  >
                    PADS
                  </button>
                  <button
                    className={`mode-toggle ${mode === 'sequencer' ? 'active' : ''}`}
                    onClick={() => setMode('sequencer')}
                  >
                    BEATS
                  </button>
                  <button
                    className={`mode-toggle ${mode === 'params' ? 'active' : ''}`}
                    onClick={() => setMode('params')}
                  >
                    EDIT
                  </button>
                </div>
              </div>
            </div>
            {mode === 'synth' ? (
              audioReady && melodicSynthRef.current && (
                <>
                  {synthMode === 'seq' ? (
                    <SynthSequencer
                      synth={melodicSynthRef.current}
                      isPlaying={isPlaying}
                      tempo={pattern.tempo}
                      steps={synthSequence}
                      onStepsChange={setSynthSequence}
                      params={synthParams}
                      onParamsChange={handleSynthParamsChange}
                      currentStep={synthCurrentStep}
                      loopBars={synthLoopBars}
                      onLoopBarsChange={handleSynthLoopBarsChange}
                      currentPage={synthCurrentPage}
                      onPageChange={setSynthCurrentPage}
                      scaleEnabled={synthScaleEnabled}
                      onScaleEnabledChange={setSynthScaleEnabled}
                      scaleRoot={synthScaleRoot}
                      onScaleRootChange={setSynthScaleRoot}
                      scaleType={synthScaleType}
                      onScaleTypeChange={setSynthScaleType}
                      isSynthLoopCapture={isSynthLoopCapture}
                      onSequenceCleared={() => {
                        setIsSynthLoopCapture(true);
                        setSynthLoopBars(1);
                      }}
                    />
                  ) : (
                    <Synth
                      synth={melodicSynthRef.current}
                      params={synthParams}
                      onParamsChange={handleSynthParamsChange}
                      isRecording={isRecording}
                      isPlaying={isPlaying}
                      tempo={pattern.tempo}
                      synthSequence={synthSequence}
                      onSynthSequenceChange={setSynthSequence}
                      onPlay={handlePlay}
                      synthLoopBars={synthLoopBars}
                      isSynthLoopCapture={isSynthLoopCapture}
                      scaleEnabled={synthScaleEnabled}
                      onScaleEnabledChange={setSynthScaleEnabled}
                      scaleRoot={synthScaleRoot}
                      onScaleRootChange={setSynthScaleRoot}
                      scaleType={synthScaleType}
                      onScaleTypeChange={setSynthScaleType}
                    />
                  )}
                </>
              )
            ) : mode === 'effects' ? (
              audioReady && melodicSynthRef.current && (
                <SynthEffects
                  synth={melodicSynthRef.current}
                  params={synthParams}
                  onParamsChange={handleSynthParamsChange}
                />
              )
            ) : mode === 'params' ? (
              <TrackParams
                track={pattern.tracks[selectedTrack]}
                trackIndex={selectedTrack}
                onParamChange={handleParamChange}
                onTrigger={handlePadTrigger}
              />
            ) : mode === 'pad' ? (
              <StepSequencer
                tracks={pattern.tracks}
                currentStep={currentStep}
                selectedTrack={selectedTrack}
                onStepToggle={handleStepToggle}
                onSelectTrack={setSelectedTrack}
                mode="pad"
                onPadTrigger={handlePadTrigger}
                noteRepeat={noteRepeat}
                onNoteRepeatChange={setNoteRepeat}
                noteRepeatModifier={noteRepeatModifier}
                onNoteRepeatModifierChange={setNoteRepeatModifier}
                tempo={pattern.tempo}
                onClearSequence={handleClearSequence}
                onRandomize={handleRandomize}
                loopBars={loopBars}
                onLoopBarsChange={handleLoopBarsChange}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                isRecording={isRecording}
                isPlayingWhileRecording={isRecording && isPlaying}
                recentlyRecordedSteps={recentlyRecordedSteps}
              />
            ) : (
              <StepSequencer
                tracks={pattern.tracks}
                currentStep={currentStep}
                selectedTrack={selectedTrack}
                onStepToggle={handleStepToggle}
                onSelectTrack={setSelectedTrack}
                mode="sequencer"
                onPadTrigger={handlePadTrigger}
                noteRepeat={noteRepeat}
                onNoteRepeatChange={setNoteRepeat}
                noteRepeatModifier={noteRepeatModifier}
                onNoteRepeatModifierChange={setNoteRepeatModifier}
                tempo={pattern.tempo}
                onClearSequence={handleClearSequence}
                onRandomize={handleRandomize}
                loopBars={loopBars}
                onLoopBarsChange={handleLoopBarsChange}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                isRecording={isRecording}
                isPlayingWhileRecording={isRecording && isPlaying}
                recentlyRecordedSteps={recentlyRecordedSteps}
              />
            )}
          </div>
        </div>
      </div>
      <Transport
        isPlaying={isPlaying}
        tempo={pattern.tempo}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onTempoChange={handleTempoChange}
        isRecording={isRecording}
        onRecordToggle={() => {
          if (isRecording) {
            // Turning off recording - clear recently recorded hits
            recentlyRecordedHits.current.clear();
            // Enable undo if we were recording
            if (patternBeforeRecording) {
              setCanUndo(true);
            }
          } else {
            // Arming recording - store current state for undo
            setPatternBeforeRecording(JSON.parse(JSON.stringify(pattern)));
            setSynthSequenceBeforeRecording(JSON.parse(JSON.stringify(synthSequence)));
            setCanUndo(false);
          }
          setIsRecording(!isRecording);
        }}
        metronomeEnabled={metronomeEnabled}
        onMetronomeToggle={handleMetronomeToggle}
        countIn={countIn}
        countInBeats={countInBeats}
        onCountInBeatsChange={setCountInBeats}
        canUndo={canUndo}
        onUndo={handleUndo}
      />
    </div>
  );
};

export default App;
