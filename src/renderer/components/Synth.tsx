import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { MelodicSynth, SynthParams, WaveformType, ArpMode } from '../audio/MelodicSynth';
import WaveformVisualizer from './WaveformVisualizer';
import CaptureRibbon, { RecordedNote } from './CaptureRibbon';
import { Step as SynthStep } from './SynthSequencer';
import './Synth.css';

interface SynthProps {
  synth: MelodicSynth;
  params: SynthParams;
  onParamsChange: (params: SynthParams) => void;
  // Recording props
  isRecording?: boolean;
  isPlaying?: boolean;
  tempo?: number;
  synthSequence?: SynthStep[];
  onSynthSequenceChange?: (steps: SynthStep[]) => void;
  onPlay?: () => Promise<void>;
  synthLoopBars?: 1 | 2 | 4 | 8 | 16;
  // Loop capture mode - first recording defines the loop length (up to 16 bars)
  isSynthLoopCapture?: boolean;
  // Current step position for capture ribbon visualization
  synthCurrentStep?: number;
  // Clear sequence callback - resets to capture mode
  onClearSequence?: () => void;
  // Set synth loop bars (exits capture mode)
  onSynthLoopBarsChange?: (bars: 1 | 2 | 4 | 8 | 16) => void;
  // Scale props
  scaleEnabled?: boolean;
  onScaleEnabledChange?: (enabled: boolean) => void;
  scaleRoot?: string;
  onScaleRootChange?: (root: string) => void;
  scaleType?: string;
  onScaleTypeChange?: (type: string) => void;
}

// Define keyboard notes
const OCTAVE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DEFAULT_OCTAVE = 3;
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 6;

// Scale definitions (intervals from root) - All Ableton scales
const SCALES: { [key: string]: number[] } = {
  // Basic scales
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic minor': [0, 2, 3, 5, 7, 9, 11],
  // Modes
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'phrygian': [0, 1, 3, 5, 7, 8, 10],
  'lydian': [0, 2, 4, 6, 7, 9, 11],
  'mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'locrian': [0, 1, 3, 5, 6, 8, 10],
  // Pentatonic & Blues
  'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'blues': [0, 3, 5, 6, 7, 10],
  'major blues': [0, 2, 3, 4, 7, 9],
  // Diminished & Whole Tone
  'whole tone': [0, 2, 4, 6, 8, 10],
  'half-whole dim': [0, 1, 3, 4, 6, 7, 9, 10],
  'whole-half dim': [0, 2, 3, 5, 6, 8, 9, 11],
  // Bebop
  'bebop dominant': [0, 2, 4, 5, 7, 9, 10, 11],
  'bebop major': [0, 2, 4, 5, 7, 8, 9, 11],
  'bebop minor': [0, 2, 3, 5, 7, 8, 9, 10],
  // World scales
  'arabic': [0, 1, 4, 5, 7, 8, 11],
  'hungarian minor': [0, 2, 3, 6, 7, 8, 11],
  'japanese': [0, 1, 5, 7, 8],
  'hirajoshi': [0, 2, 3, 7, 8],
  'gypsy': [0, 2, 3, 6, 7, 8, 10],
  'spanish': [0, 1, 3, 4, 5, 7, 8, 10],
  'phrygian dominant': [0, 1, 4, 5, 7, 8, 10],
  'double harmonic': [0, 1, 4, 5, 7, 8, 11],
  // Other useful scales
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'augmented': [0, 3, 4, 7, 8, 11],
  'prometheus': [0, 2, 4, 6, 9, 10],
  'tritone': [0, 1, 4, 6, 7, 10],
  'super locrian': [0, 1, 3, 4, 6, 8, 10],
};

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Melodic pattern generation types
// Hand-crafted chord progressions with intentional voicings and articulations
// Each voicing is an array of scale degree offsets from a base octave

// Articulation styles determine HOW chords are played
type ArticulationStyle =
  | 'block'      // All notes hit simultaneously - powerful, definitive
  | 'strum'      // Quick cascade low to high - guitar-like
  | 'arpeggio'   // Notes spread across the bar - flowing, harp-like
  | 'broken'     // Bass first, then upper voices - classic piano
  | 'pulse'      // Chord repeated rhythmically - driving, energetic
  | 'rolled'     // Very slow strum - dreamy, ethereal
  | 'stab'       // Short, punchy hits - funk, house
  | 'pad';       // Long sustained notes - ambient, cinematic

// Register affects octave placement
type RegisterPosition = 'low' | 'mid' | 'high' | 'wide';

interface CraftedProgression {
  name: string;
  mood: string;
  // Each chord: array of scale degree indices (0=root, 2=3rd, 4=5th, 6=7th)
  // Negative numbers = lower octave, +7 = next octave up
  voicings: number[][];
  // Timing: which 16th note steps each chord starts on (within 4 bars)
  timing: number[];
  // How long each chord rings (in steps)
  lengths: number[];
  // How the chord is articulated
  articulation: ArticulationStyle;
  // Where in the register to place chords
  register: RegisterPosition;
  // Optional: swing/laid-back feel (0 = on grid, positive = late, negative = early)
  swing?: number;
}

const CRAFTED_PROGRESSIONS: CraftedProgression[] = [
  // === EMOTIONAL / POP ===
  {
    name: 'Hopeful',
    mood: 'uplifting, anthemic',
    voicings: [
      [0, 4, 7, 11],
      [-1, 4, 7, 11],
      [-2, 4, 7, 9],
      [-4, 3, 7, 10],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'mid',
  },
  {
    name: 'Nostalgic',
    mood: 'bittersweet, reflective',
    voicings: [
      [5, 9, 12, 14],
      [3, 7, 10, 14],
      [0, 4, 7, 11],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
    swing: 1,
  },
  {
    name: 'Yearning',
    mood: 'longing, emotional',
    voicings: [
      [0, 4, 7, 11],
      [2, 5, 9, 12],
      [3, 7, 10, 14],
      [3, 6, 10, 13],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'rolled',
    register: 'mid',
  },
  {
    name: 'Sunrise',
    mood: 'awakening, gentle',
    voicings: [
      [3, 7, 10, 14],
      [4, 7, 11, 14],
      [2, 5, 9, 11],
      [5, 8, 12, 15],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'arpeggio',
    register: 'high',
  },

  // === JAZZ / NEO-SOUL ===
  {
    name: 'Soulful',
    mood: 'warm, neo-soul',
    voicings: [
      [1, 4, 6, 8],
      [4, 6, 8, 11],
      [0, 4, 6, 9],
      [5, 8, 11, 13],
    ],
    timing: [0, 12, 24, 40],
    lengths: [11, 11, 15, 15],
    articulation: 'broken',
    register: 'mid',
    swing: 2,
  },
  {
    name: 'Velvet',
    mood: 'silky, D\'Angelo',
    voicings: [
      [0, 4, 6, 9, 14],
      [3, 6, 10, 13],
      [1, 4, 6, 8, 13],
      [4, 6, 8, 11, 15],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'rolled',
    register: 'low',
    swing: 2,
  },
  {
    name: 'Midnight',
    mood: 'smoky, jazz club',
    voicings: [
      [2, 5, 8, 11],
      [5, 8, 11, 14],
      [1, 4, 7, 10],
      [4, 7, 10, 13],
    ],
    timing: [0, 14, 28, 44],
    lengths: [12, 12, 14, 14],
    articulation: 'broken',
    register: 'low',
    swing: 1,
  },
  {
    name: 'Erykah',
    mood: 'floating, hypnotic',
    voicings: [
      [0, 4, 6, 11],
      [3, 6, 9, 12],
      [3, 6, 9, 11],
      [2, 5, 8, 11],
    ],
    timing: [0, 18, 34, 50],
    lengths: [16, 14, 14, 12],
    articulation: 'pad',
    register: 'mid',
    swing: 3,
  },
  {
    name: 'After Hours',
    mood: 'late night, intimate',
    voicings: [
      [5, 8, 11, 14, 16],
      [1, 4, 6, 8, 11],
      [0, 4, 6, 11],
      [0, 4, 6, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'rolled',
    register: 'mid',
    swing: 2,
  },

  // === DREAMY / AMBIENT ===
  {
    name: 'Dreamy',
    mood: 'floating, ethereal',
    voicings: [
      [0, 4, 6, 11],
      [2, 6, 9, 13],
      [5, 9, 11, 14],
      [3, 6, 10, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'high',
  },
  {
    name: 'Clouds',
    mood: 'weightless, shoegaze',
    voicings: [
      [3, 7, 10, 14],
      [0, 4, 7, 11],
      [3, 7, 10, 14],
      [0, 4, 7, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'wide',
  },
  {
    name: 'Stardust',
    mood: 'cosmic, wonder',
    voicings: [
      [0, 4, 6, 11],
      [-2, 2, 4, 9],
      [3, 6, 10, 14],
      [0, 4, 6, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'arpeggio',
    register: 'wide',
  },

  // === MELANCHOLIC / SAD ===
  {
    name: 'Melancholic',
    mood: 'sad, introspective',
    voicings: [
      [0, 3, 7, 10],
      [5, 8, 12, 15],
      [2, 5, 9, 12],
      [6, 9, 13, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
  },
  {
    name: 'Rain',
    mood: 'grey, contemplative',
    voicings: [
      [0, 3, 7, 12],
      [3, 6, 10, 15],
      [6, 10, 13, 17],
      [2, 6, 9, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'arpeggio',
    register: 'mid',
  },
  {
    name: 'Goodbye',
    mood: 'farewell, bittersweet',
    voicings: [
      [0, 4, 7, 11],
      [4, 7, 11, 14],
      [5, 9, 12, 14],
      [5, 9, 12, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'rolled',
    register: 'mid',
  },
  {
    name: 'Fading',
    mood: 'loss, acceptance',
    voicings: [
      [5, 9, 12, 16],
      [4, 7, 11, 14],
      [3, 7, 10, 14],
      [0, 4, 7, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'high',
  },

  // === CINEMATIC / EPIC ===
  {
    name: 'Cinematic',
    mood: 'epic, building',
    voicings: [
      [0, 4, 7, 14],
      [4, 7, 11, 16],
      [5, 9, 12, 17],
      [3, 7, 10, 15],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'wide',
  },
  {
    name: 'Heroic',
    mood: 'triumphant, adventure',
    voicings: [
      [0, 4, 7, 12],
      [3, 7, 10, 15],
      [0, 4, 7, 14],
      [4, 7, 11, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'block',
    register: 'wide',
  },
  {
    name: 'Vast',
    mood: 'expansive, Thomas Newman',
    voicings: [
      [0, 4, 7, 14],
      [-4, 0, 3, 8],
      [-2, 2, 5, 10],
      [0, 4, 7, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'arpeggio',
    register: 'wide',
  },
  {
    name: 'Interstellar',
    mood: 'cosmic, Zimmer',
    voicings: [
      [0, 7, 12, 15],
      [5, 12, 15, 20],
      [2, 9, 14, 17],
      [6, 13, 17, 22],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'wide',
  },

  // === CHILL / LO-FI ===
  {
    name: 'Chill',
    mood: 'relaxed, lo-fi',
    voicings: [
      [0, 4, 6, 11],
      [5, 9, 11, 14],
      [1, 4, 8, 11],
      [4, 8, 11, 13],
    ],
    timing: [0, 14, 28, 44],
    lengths: [13, 13, 15, 15],
    articulation: 'broken',
    register: 'mid',
    swing: 2,
  },
  {
    name: 'Lazy Sunday',
    mood: 'cozy, bedroom pop',
    voicings: [
      [3, 6, 10, 13],
      [2, 5, 9, 12],
      [1, 4, 8, 11],
      [0, 4, 6, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'mid',
    swing: 1,
  },
  {
    name: 'Coffee Shop',
    mood: 'warm, acoustic',
    voicings: [
      [0, 4, 7, 11],
      [0, 4, 7, 9, 14],
      [3, 7, 10, 14],
      [3, 6, 10, 13],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'mid',
  },

  // === DARK / TENSION ===
  {
    name: 'Dark',
    mood: 'tension, mystery',
    voicings: [
      [0, 3, 7, 12],
      [4, 7, 11, 14],
      [5, 9, 12, 16],
      [3, 6, 10, 15],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'block',
    register: 'low',
  },
  {
    name: 'Shadows',
    mood: 'creeping, ominous',
    voicings: [
      [0, 3, 7, 10],
      [1, 4, 8, 11],
      [0, 3, 7, 10],
      [6, 10, 13, 17],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'arpeggio',
    register: 'low',
  },
  {
    name: 'Descent',
    mood: 'falling, dramatic',
    voicings: [
      [0, 3, 7, 12],
      [6, 10, 13, 18],
      [5, 9, 12, 17],
      [4, 7, 11, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'low',
  },

  // === GOSPEL / R&B ===
  {
    name: 'Gospel',
    mood: 'uplifting, church',
    voicings: [
      [0, 4, 7, 12],
      [0, 4, 7, 10],
      [3, 7, 10, 15],
      [3, 6, 10, 15],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'block',
    register: 'mid',
  },
  {
    name: 'Praise',
    mood: 'joyful, celebratory',
    voicings: [
      [0, 4, 7, 14],
      [2, 5, 9, 14],
      [3, 7, 10, 15],
      [4, 7, 11, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'wide',
  },
  {
    name: 'Whitney',
    mood: 'power ballad, soaring',
    voicings: [
      [0, 4, 7, 11],
      [4, 7, 11, 14],
      [5, 9, 12, 14],
      [3, 7, 10, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
  },

  // === ANIME / J-POP ===
  {
    name: 'Anime Sad',
    mood: 'emotional, Japanese',
    voicings: [
      [5, 9, 12, 16],
      [4, 8, 11, 15],
      [3, 7, 10, 14],
      [2, 6, 9, 13],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'arpeggio',
    register: 'high',
  },
  {
    name: 'Anime Hope',
    mood: 'determined, shonen',
    voicings: [
      [3, 7, 10, 14],
      [4, 7, 11, 14],
      [2, 5, 9, 12],
      [5, 9, 12, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'block',
    register: 'mid',
  },
  {
    name: 'Ghibli',
    mood: 'magical, innocent',
    voicings: [
      [0, 4, 7, 11],
      [2, 5, 9, 11],
      [3, 7, 10, 12],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'arpeggio',
    register: 'high',
  },

  // === ELECTRONIC / HOUSE ===
  {
    name: 'Deep House',
    mood: 'groovy, underground',
    voicings: [
      [0, 3, 6, 10],
      [3, 6, 9, 13],
      [6, 9, 13, 16],
      [2, 5, 9, 12],
    ],
    timing: [0, 16, 32, 48],
    lengths: [8, 8, 8, 8],
    articulation: 'stab',
    register: 'mid',
  },
  {
    name: 'Progressive',
    mood: 'building, trance',
    voicings: [
      [0, 3, 7, 12],
      [6, 10, 13, 18],
      [5, 9, 12, 17],
      [6, 10, 13, 18],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'wide',
  },
  {
    name: 'Tech House',
    mood: 'driving, hypnotic',
    voicings: [
      [0, 3, 7],
      [0, 3, 7],
      [5, 8, 12],
      [5, 8, 12],
    ],
    timing: [0, 8, 32, 40],
    lengths: [6, 6, 6, 6],
    articulation: 'pulse',
    register: 'low',
  },

  // === BLUES / ROCK ===
  {
    name: 'Blues',
    mood: 'soulful, classic',
    voicings: [
      [0, 4, 7, 10],
      [0, 4, 7, 10],
      [3, 6, 10, 13],
      [0, 4, 7, 10],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'low',
    swing: 2,
  },
  {
    name: 'Rock Anthem',
    mood: 'powerful, arena',
    voicings: [
      [0, 4, 7, 12],
      [-2, 2, 5, 10],
      [3, 7, 10, 15],
      [0, 4, 7, 12],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'block',
    register: 'wide',
  },
  {
    name: 'Power Ballad',
    mood: 'emotional, 80s',
    voicings: [
      [0, 4, 7, 11],
      [5, 9, 12, 16],
      [3, 7, 10, 14],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'mid',
  },

  // === CLASSICAL INSPIRED ===
  {
    name: 'Baroque',
    mood: 'elegant, Bach',
    voicings: [
      [0, 4, 7, 11],
      [4, 7, 11, 14],
      [5, 9, 12, 14],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'arpeggio',
    register: 'mid',
  },
  {
    name: 'Romantic',
    mood: 'sweeping, Chopin',
    voicings: [
      [0, 4, 7, 11],
      [5, 9, 12, 16],
      [1, 4, 8, 11],
      [4, 7, 10, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'rolled',
    register: 'mid',
  },
  {
    name: 'Moonlight',
    mood: 'Beethoven, nocturnal',
    voicings: [
      [0, 3, 7, 12],
      [5, 9, 12, 17],
      [1, 4, 7, 10],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'arpeggio',
    register: 'low',
  },

  // === MINIMAL / SPARSE ===
  {
    name: 'Minimal',
    mood: 'sparse, glass',
    voicings: [
      [0, 7, 14],
      [4, 11, 14],
      [0, 7, 14],
      [3, 10, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'arpeggio',
    register: 'wide',
  },
  {
    name: 'Breath',
    mood: 'meditative, still',
    voicings: [
      [0, 4, 6, 11],
      [0, 4, 6, 11],
      [3, 6, 10, 14],
      [0, 4, 6, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'mid',
  },

  // === FUNK / GROOVE ===
  {
    name: 'Funk',
    mood: 'groovy, tight',
    voicings: [
      [0, 4, 7, 10],
      [0, 4, 7, 10],
      [3, 6, 10, 13],
      [4, 7, 11, 14],
    ],
    timing: [0, 6, 16, 22, 32, 38, 48, 54],
    lengths: [4, 4, 4, 4, 4, 4, 4, 4],
    articulation: 'stab',
    register: 'mid',
  },
  {
    name: 'Disco',
    mood: 'pumping, Saturday night',
    voicings: [
      [0, 4, 7, 11],
      [5, 9, 12, 16],
      [3, 7, 10, 14],
      [4, 7, 11, 14],
    ],
    timing: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
    lengths: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    articulation: 'pulse',
    register: 'mid',
  },

  // === TRAP / MODERN HIP HOP ===
  {
    name: 'Mask Off',
    mood: 'iconic trap, Future',
    // i - VI - v - i
    voicings: [
      [0, 3, 7, 10],
      [5, 9, 12, 15],
      [4, 7, 11, 14],
      [0, 3, 7, 10],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'pad',
    register: 'low',
  },
  {
    name: 'Melodic Trap',
    mood: 'dark, Young Thug',
    // i - III - VI - VII
    voicings: [
      [0, 3, 7, 10],
      [2, 5, 9, 12],
      [5, 8, 12, 15],
      [6, 10, 13, 17],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'pad',
    register: 'low',
  },
  {
    name: 'Drake Type',
    mood: 'minimal, emotional',
    // III - i (two chord minimal)
    voicings: [
      [2, 5, 9, 12],
      [2, 5, 9, 12],
      [0, 3, 7, 10],
      [0, 3, 7, 10],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'pad',
    register: 'mid',
  },
  {
    name: 'Poppy Trap',
    mood: 'G-Eazy, crossover',
    // i - VI - VII - iv
    voicings: [
      [0, 3, 7, 10],
      [5, 8, 12, 15],
      [6, 10, 13, 17],
      [3, 6, 10, 13],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
  },
  {
    name: 'Tyler Type',
    mood: 'jazzy hip hop',
    // ii7 - V7 - Imaj7 (jazz in hip hop)
    voicings: [
      [1, 4, 6, 8, 11],
      [1, 4, 6, 8, 11],
      [4, 6, 8, 11, 14],
      [0, 4, 6, 9, 13],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'rolled',
    register: 'mid',
    swing: 2,
  },

  // === R&B CLASSICS ===
  {
    name: 'Smooth Operator',
    mood: 'silky R&B',
    // i - v - iv - v
    voicings: [
      [0, 3, 6, 10],
      [4, 7, 10, 14],
      [3, 6, 10, 13],
      [4, 7, 10, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
    swing: 1,
  },
  {
    name: 'Between Sheets',
    mood: 'classic slow jam',
    // VI - V - i - vii - III
    voicings: [
      [5, 9, 12, 16],
      [4, 8, 11, 14],
      [0, 3, 7, 10],
      [6, 9, 13, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'rolled',
    register: 'mid',
    swing: 2,
  },
  {
    name: 'Rock With You',
    mood: 'MJ, funky R&B',
    // I - iii - IV - ii - V
    voicings: [
      [0, 4, 6, 11],
      [2, 5, 9, 12],
      [3, 6, 10, 14],
      [1, 4, 8, 11],
    ],
    timing: [0, 12, 24, 40],
    lengths: [11, 11, 15, 14],
    articulation: 'strum',
    register: 'mid',
    swing: 1,
  },
  {
    name: 'Always Love You',
    mood: 'Whitney, power ballad',
    // I - vi - V - I
    voicings: [
      [0, 4, 7, 11],
      [5, 9, 12, 16],
      [4, 7, 11, 14],
      [0, 4, 7, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
  },

  // === POP HITS ===
  {
    name: 'Hey Soul Sister',
    mood: 'feel-good pop',
    // I - V - vi - IV (most popular)
    voicings: [
      [0, 4, 7, 11],
      [4, 7, 11, 14],
      [5, 9, 12, 14],
      [3, 7, 10, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'mid',
  },
  {
    name: 'Stand By Me',
    mood: '50s doo-wop',
    // I - vi - IV - V
    voicings: [
      [0, 4, 7, 11],
      [5, 9, 12, 14],
      [3, 7, 10, 14],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
  },
  {
    name: 'Firework',
    mood: 'anthemic, Pachelbel',
    // I - V - vi - iii
    voicings: [
      [0, 4, 7, 11],
      [4, 7, 11, 14],
      [5, 9, 12, 14],
      [2, 5, 9, 12],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'pad',
    register: 'wide',
  },
  {
    name: 'Somebody Used To',
    mood: 'Gotye, emotional',
    // vi - V - IV - V
    voicings: [
      [5, 9, 12, 16],
      [4, 7, 11, 14],
      [3, 7, 10, 14],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'arpeggio',
    register: 'mid',
  },
  {
    name: 'What Makes You',
    mood: 'bright pop',
    // I - IV - vi - V
    voicings: [
      [0, 4, 7, 11],
      [3, 7, 10, 14],
      [5, 9, 12, 14],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'high',
  },

  // === MORE JAZZ ===
  {
    name: 'Autumn Leaves',
    mood: 'jazz standard',
    // ii - V - I - IV - vii - III - vi
    voicings: [
      [1, 4, 6, 8],
      [4, 6, 8, 11],
      [0, 4, 6, 9],
      [3, 6, 9, 13],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
    swing: 2,
  },
  {
    name: 'Blue Bossa',
    mood: 'latin jazz',
    // i - iv - ii - V
    voicings: [
      [0, 3, 6, 10],
      [3, 6, 9, 13],
      [1, 4, 6, 9],
      [4, 6, 9, 11],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'broken',
    register: 'mid',
    swing: 1,
  },
  {
    name: 'Giant Steps',
    mood: 'Coltrane, complex',
    // I - III - VI - II
    voicings: [
      [0, 4, 6, 11],
      [2, 6, 8, 13],
      [5, 9, 11, 16],
      [1, 5, 7, 12],
    ],
    timing: [0, 8, 24, 40],
    lengths: [7, 15, 15, 12],
    articulation: 'strum',
    register: 'mid',
  },

  // === EDM / DANCE ===
  {
    name: 'Festival',
    mood: 'EDM anthem',
    // vi - IV - I - V
    voicings: [
      [5, 9, 12, 16],
      [3, 7, 10, 14],
      [0, 4, 7, 12],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'pad',
    register: 'wide',
  },
  {
    name: 'Euphoric',
    mood: 'trance, uplifting',
    // I - V - vi - IV (supersaw)
    voicings: [
      [0, 4, 7, 11, 14],
      [4, 7, 11, 14, 18],
      [5, 9, 12, 16, 19],
      [3, 7, 10, 14, 17],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'wide',
  },
  {
    name: 'Hypnotic',
    mood: 'techno, dark',
    // i - VI - III - VII
    voicings: [
      [0, 3, 7, 10],
      [5, 8, 12, 15],
      [2, 5, 9, 12],
      [6, 10, 13, 17],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'low',
  },

  // === LATIN / WORLD ===
  {
    name: 'Bossa Nova',
    mood: 'Brazilian, smooth',
    // Imaj7 - ii7 - iii7 - VI7
    voicings: [
      [0, 4, 6, 11],
      [1, 4, 6, 9],
      [2, 5, 8, 11],
      [5, 8, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'mid',
    swing: 1,
  },
  {
    name: 'Reggaeton',
    mood: 'Latin urban',
    // i - VI - III - VII
    voicings: [
      [0, 3, 7, 10],
      [5, 8, 12, 15],
      [2, 5, 9, 12],
      [6, 10, 13, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [8, 8, 8, 8],
    articulation: 'stab',
    register: 'mid',
  },
  {
    name: 'Flamenco',
    mood: 'Spanish, dramatic',
    // i - VII - VI - V (Andalusian cadence)
    voicings: [
      [0, 3, 7, 12],
      [6, 10, 13, 18],
      [5, 9, 12, 17],
      [4, 7, 11, 16],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'strum',
    register: 'mid',
  },

  // === INDIE / ALTERNATIVE ===
  {
    name: 'Indie Folk',
    mood: 'Bon Iver, intimate',
    // I - iii - vi - IV
    voicings: [
      [0, 4, 7, 11],
      [2, 5, 9, 12],
      [5, 9, 12, 14],
      [3, 7, 10, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'arpeggio',
    register: 'mid',
  },
  {
    name: 'Shoegaze Wall',
    mood: 'MBV, dreamy',
    // I - bVII - IV - I
    voicings: [
      [0, 4, 7, 11, 14],
      [-2, 2, 5, 9, 12],
      [3, 7, 10, 14, 17],
      [0, 4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
    articulation: 'pad',
    register: 'wide',
  },
  {
    name: 'Emo Revival',
    mood: 'twinkly, math rock',
    // vi - IV - I - V
    voicings: [
      [5, 9, 12, 16],
      [3, 7, 10, 14],
      [0, 4, 7, 11],
      [4, 7, 11, 14],
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
    articulation: 'arpeggio',
    register: 'high',
  },
];

// Generate scale notes across octaves
const generateScaleNotes = (root: string, scaleType: string): string[] => {
  const intervals = SCALES[scaleType] || SCALES['major'];
  const rootIndex = ROOT_NOTES.indexOf(root);
  const notes: string[] = [];

  for (let octave = 2; octave <= 5; octave++) {
    intervals.forEach(interval => {
      const noteIndex = (rootIndex + interval) % 12;
      const noteOctave = octave + Math.floor((rootIndex + interval) / 12);
      if (noteOctave <= 5) {
        notes.push(`${ROOT_NOTES[noteIndex]}${noteOctave}`);
      }
    });
  }
  return notes;
};

// Generate chord progression pattern using crafted progressions with articulations
const generateChordProgression = (scaleNotes: string[], _loopBars: number, octaveShift: number = -2): SynthStep[] => {
  const pattern: SynthStep[] = Array.from({ length: 256 }, () => ({ active: false, note: 'C4' }));

  // Pick a random crafted progression
  const progression = CRAFTED_PROGRESSIONS[Math.floor(Math.random() * CRAFTED_PROGRESSIONS.length)];

  // Calculate base index based on register
  const getBaseIndex = (register: RegisterPosition): number => {
    const scaleLen = scaleNotes.length;
    switch (register) {
      case 'low': return Math.floor(scaleLen / 5);      // Lower third
      case 'high': return Math.floor(scaleLen / 2);     // Upper half
      case 'wide': return Math.floor(scaleLen / 4);     // Start low for spread
      case 'mid':
      default: return Math.floor(scaleLen / 3);         // Middle
    }
  };

  // Apply octave shift (7 scale degrees = 1 octave in diatonic scales)
  const octaveOffset = octaveShift * 7;
  const baseIndex = getBaseIndex(progression.register) + octaveOffset;
  const swing = progression.swing || 0;

  // Helper to get a note from scale by index (with bounds checking)
  const getNote = (scaleIndex: number): string => {
    const clampedIndex = Math.max(0, Math.min(scaleIndex, scaleNotes.length - 1));
    return scaleNotes[clampedIndex] || 'C4';
  };

  // Helper to place a note in the pattern
  const placeNote = (step: number, note: string, length: number) => {
    const adjustedStep = Math.min(255, Math.max(0, step + swing));
    if (adjustedStep < 256) {
      pattern[adjustedStep] = { active: true, note, length: Math.max(1, length) };
    }
  };

  // Randomly decide direction for this progression (ascending vs descending)
  const invertDirection = Math.random() > 0.5;

  // Process each chord based on articulation style
  progression.voicings.forEach((voicing, chordIdx) => {
    const startStep = progression.timing[chordIdx % progression.timing.length];
    const length = progression.lengths[chordIdx % progression.lengths.length];

    if (startStep >= 256) return;

    const notes = voicing.map(offset => getNote(baseIndex + offset));
    // Apply inversion for sequential articulations
    const orderedNotes = invertDirection ? [...notes].reverse() : notes;

    switch (progression.articulation) {
      case 'block':
        // Quick stagger so all notes get recorded (sequencer stores 1 note per step)
        orderedNotes.forEach((note, i) => {
          placeNote(startStep + i, note, Math.max(1, length - i));
        });
        break;

      case 'strum':
        // Quick cascade (1 step apart) - direction varies
        orderedNotes.forEach((note, i) => {
          placeNote(startStep + i, note, Math.max(1, length - i));
        });
        break;

      case 'arpeggio':
        // Notes spread evenly across the chord duration - direction varies
        const arpSpacing = Math.max(2, Math.floor(length / orderedNotes.length));
        orderedNotes.forEach((note, i) => {
          placeNote(startStep + i * arpSpacing, note, Math.max(4, length - i * 2));
        });
        break;

      case 'broken':
        // Bass first, then upper voices staggered
        if (notes.length > 0) {
          placeNote(startStep, notes[0], length); // Bass note
          const upperNotes = invertDirection ? [...notes.slice(1)].reverse() : notes.slice(1);
          upperNotes.forEach((note, i) => {
            placeNote(startStep + 2 + i, note, Math.max(1, length - 2 - i));
          });
        }
        break;

      case 'pulse':
        // Chord repeated rhythmically - stagger notes within each pulse
        const pulseInterval = 4;
        const nextChordStart = progression.timing[(chordIdx + 1) % progression.timing.length];
        const sectionLength = chordIdx < progression.timing.length - 1
          ? nextChordStart - startStep
          : 16;

        for (let pulseStep = 0; pulseStep < sectionLength; pulseStep += pulseInterval) {
          orderedNotes.forEach((note, i) => {
            placeNote(startStep + pulseStep + i, note, Math.max(1, pulseInterval - 1 - i));
          });
        }
        break;

      case 'rolled':
        // Very slow strum - dreamy, harp-like (3 steps apart) - direction varies
        orderedNotes.forEach((note, i) => {
          placeNote(startStep + i * 3, note, Math.max(4, length - i * 2));
        });
        break;

      case 'stab':
        // Short, punchy hits - staggered
        const stabLength = Math.min(length, 6);
        orderedNotes.forEach((note, i) => {
          placeNote(startStep + i, note, Math.max(1, stabLength - i));
        });
        break;

      case 'pad':
        // Long sustained - slight stagger so all notes recorded
        orderedNotes.forEach((note, i) => {
          placeNote(startStep + i, note, Math.max(1, length - i));
        });
        break;

      default:
        // Fallback to block
        notes.forEach(note => {
          placeNote(startStep, note, length);
        });
    }
  });

  return pattern;
};

// Get notes in a scale
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

const getKeyboardNotes = (numOctaves: number, baseOctave: number) => {
  const notes: { note: string; isBlack: boolean }[] = [];
  for (let octave = baseOctave; octave < baseOctave + numOctaves; octave++) {
    OCTAVE_NOTES.forEach((note) => {
      notes.push({
        note: `${note}${octave}`,
        isBlack: note.includes('#'),
      });
    });
  }
  return notes;
};

// Computer keyboard mapping - returns mapping based on octave
const getKeyMap = (baseOctave: number): { [key: string]: string } => ({
  'a': `C${baseOctave}`, 'w': `C#${baseOctave}`, 's': `D${baseOctave}`, 'e': `D#${baseOctave}`, 'd': `E${baseOctave}`,
  'f': `F${baseOctave}`, 't': `F#${baseOctave}`, 'g': `G${baseOctave}`, 'y': `G#${baseOctave}`, 'h': `A${baseOctave}`,
  'u': `A#${baseOctave}`, 'j': `B${baseOctave}`, 'k': `C${baseOctave + 1}`, 'o': `C#${baseOctave + 1}`, 'l': `D${baseOctave + 1}`,
  'p': `D#${baseOctave + 1}`, ';': `E${baseOctave + 1}`, "'": `F${baseOctave + 1}`,
});

const Synth: React.FC<SynthProps> = ({
  synth,
  params,
  onParamsChange,
  isRecording,
  isPlaying,
  tempo = 120,
  synthSequence,
  onSynthSequenceChange,
  onPlay,
  synthLoopBars = 1,
  isSynthLoopCapture = false,
  synthCurrentStep = -1,
  onClearSequence,
  onSynthLoopBarsChange,
  scaleEnabled = false,
  onScaleEnabledChange,
  scaleRoot = 'C',
  onScaleRootChange,
  scaleType = 'major',
  onScaleTypeChange,
}) => {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [octave, setOctave] = useState(DEFAULT_OCTAVE);
  const keysToNotes = useRef<Map<string, string>>(new Map()); // physical key -> note being played
  const activeTouches = useRef<Map<number, string>>(new Map()); // touchId -> note
  const mouseDownNotes = useRef<Set<string>>(new Set()); // track which notes are held by mouse
  // Track note recording starts: note -> { stepIndex, realTime } using performance.now() for accurate duration
  const recordingNoteStarts = useRef<Map<string, { stepIndex: number; realTime: number }>>(new Map());
  // Ref to track latest synthSequence to avoid stale closures in handleNoteOff
  const synthSequenceRef = useRef(synthSequence);

  // Scale notes derived from props
  const scaleNotes = scaleEnabled ? getScaleNotes(scaleRoot, scaleType) : new Set<string>();

  // Extract recorded notes from synthSequence for the capture ribbon
  const recordedNotes: RecordedNote[] = useMemo(() => {
    if (!synthSequence) return [];
    const notes: RecordedNote[] = [];
    synthSequence.forEach((step, index) => {
      if (step.active) {
        notes.push({ step: index, note: step.note, length: step.length });
      }
    });
    return notes;
  }, [synthSequence]);

  // Scale change handlers (call parent if available)
  const setScaleEnabled = (enabled: boolean) => onScaleEnabledChange?.(enabled);
  const setScaleRoot = (root: string) => onScaleRootChange?.(root);
  const setScaleType = (type: string) => onScaleTypeChange?.(type);

  // Keep synthSequenceRef in sync with prop
  useEffect(() => {
    synthSequenceRef.current = synthSequence;
  }, [synthSequence]);

  // Check if a note is in the current scale
  const isInScale = useCallback((note: string): boolean => {
    if (!scaleEnabled) return false;
    const noteName = note.replace(/\d+$/, ''); // Remove octave number
    return scaleNotes.has(noteName);
  }, [scaleEnabled, scaleNotes]);

  // Check if a note can be played (either scale is off, or note is in scale)
  const canPlayNote = useCallback((note: string): boolean => {
    if (!scaleEnabled) return true;
    return isInScale(note);
  }, [scaleEnabled, isInScale]);

  // Responsive octaves - 1 on mobile, 2 on desktop
  const numOctaves = isMobile ? 1 : 2;
  const keyboardNotes = getKeyboardNotes(numOctaves, octave);
  const numWhiteKeys = keyboardNotes.filter(n => !n.isBlack).length;
  const keyMap = getKeyMap(octave);

  // Octave controls
  const octaveUp = () => setOctave(o => Math.min(MAX_OCTAVE, o + 1));
  const octaveDown = () => setOctave(o => Math.max(MIN_OCTAVE, o - 1));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Release all notes - safety function
  const releaseAllNotes = useCallback(() => {
    synth.releaseAll();
    setActiveNotes(new Set());
    activeTouches.current.clear();
    keysToNotes.current.clear();
    mouseDownNotes.current.clear();
    recordingNoteStarts.current.clear();
  }, [synth]);

  const handleNoteOn = useCallback(async (note: string, touchId?: number) => {
    if (touchId !== undefined) {
      activeTouches.current.set(touchId, note);
    }
    await synth.noteOn(note, 0.8);
    setActiveNotes((prev) => new Set([...prev, note]));

    // Auto-start playback when recording is armed but not playing
    let justStartedPlayback = false;
    if (isRecording && !isPlaying && onPlay) {
      // Start playback first, then continue to record this note
      await onPlay();
      justStartedPlayback = true;
    }

    // Record note to synth sequencer if recording and playing, or if we just started
    if (isRecording && (isPlaying || justStartedPlayback) && onSynthSequenceChange && synthSequence) {
      // In capture mode, use full 16 bars (256 steps) to capture the phrase
      // After recording stops, loop length will be auto-set based on where notes landed
      const loopLengthSteps = isSynthLoopCapture ? 256 : synthLoopBars * 16;
      let stepIndex: number;
      let transportSeconds: number;

      if (justStartedPlayback) {
        // Transport just started - position is 0, don't read stale Transport.seconds
        stepIndex = 0;
        transportSeconds = 0;
      } else {
        // Normal recording - calculate from transport position
        transportSeconds = Tone.Transport.seconds;
        const secondsPerStep = 60 / tempo / 4; // 16th note duration
        const loopLengthSeconds = loopLengthSteps * secondsPerStep;
        const positionInLoop = transportSeconds % loopLengthSeconds;
        // Use Math.min to prevent overflow at loop boundary
        stepIndex = Math.min(
          Math.round(positionInLoop / secondsPerStep),
          loopLengthSteps - 1
        );
      }

      // Track the start of this note for length calculation on noteOff
      // Use real time (performance.now) for accurate duration tracking
      recordingNoteStarts.current.set(note, { stepIndex, realTime: performance.now() });

      const newSteps = [...synthSequence];
      newSteps[stepIndex] = { active: true, note, length: 1 }; // Start with length 1, will be updated on noteOff
      // Update ref immediately so handleNoteOff sees the new step (avoids stale closure)
      synthSequenceRef.current = newSteps;
      onSynthSequenceChange(newSteps);
    }
  }, [synth, isRecording, isPlaying, tempo, synthSequence, onSynthSequenceChange, onPlay, synthLoopBars, isSynthLoopCapture]);

  const handleNoteOff = useCallback((note: string, touchId?: number) => {
    if (touchId !== undefined) {
      activeTouches.current.delete(touchId);
    }
    synth.noteOff(note);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });

    // Calculate note length if we were recording this note
    const noteStart = recordingNoteStarts.current.get(note);
    // Use ref to get latest sequence (avoids stale closure when note released quickly)
    const currentSequence = synthSequenceRef.current;
    // Note: Don't check isPlaying here - if noteStart exists, we were recording when note started
    // The isPlaying state may not have updated yet due to async React state
    if (noteStart && onSynthSequenceChange && currentSequence) {
      const msPerStep = 60000 / tempo / 4; // Duration of one 16th note step in ms
      // In capture mode, use full 16 bars
      const loopLengthSteps = isSynthLoopCapture ? 256 : synthLoopBars * 16;

      // Calculate how many steps the note was held using real elapsed time
      const elapsedMs = performance.now() - noteStart.realTime;
      // Use Math.floor for conservative note lengths - only count fully held steps
      // Cap at 8 steps (half bar) for more musical results
      const elapsedSteps = Math.floor(elapsedMs / msPerStep);
      const maxNoteLength = Math.min(8, loopLengthSteps);
      const noteLength = Math.max(1, Math.min(elapsedSteps, maxNoteLength));

      // Update the step with the calculated length
      const newSteps = [...currentSequence];
      if (newSteps[noteStart.stepIndex]?.active) {
        newSteps[noteStart.stepIndex] = {
          ...newSteps[noteStart.stepIndex],
          length: noteLength
        };
        // Update ref immediately
        synthSequenceRef.current = newSteps;
        onSynthSequenceChange(newSteps);
      }
    }

    // Always clean up the tracking, regardless of recording state
    // This prevents stale entries if recording stops while a note is held
    recordingNoteStarts.current.delete(note);
  }, [synth, isRecording, isPlaying, tempo, onSynthSequenceChange, synthLoopBars, isSynthLoopCapture]);

  // Global event handlers - catches any missed releases
  useEffect(() => {
    const handleGlobalTouchEnd = (e: TouchEvent) => {
      // Check if any tracked touches are no longer active
      const currentTouchIds = new Set(Array.from(e.touches).map(t => t.identifier));
      activeTouches.current.forEach((note, touchId) => {
        if (!currentTouchIds.has(touchId)) {
          handleNoteOff(note, touchId);
        }
      });
    };

    const handleGlobalMouseUp = () => {
      // Release all notes held by mouse when mouse is released anywhere
      mouseDownNotes.current.forEach((note) => {
        handleNoteOff(note);
      });
      mouseDownNotes.current.clear();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseAllNotes();
      }
    };

    const handleWindowBlur = () => {
      releaseAllNotes();
    };

    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      // Don't call releaseAllNotes here - it clears mouseDownNotes which breaks
      // recording when state changes cause effect to re-run mid-click
    };
  }, [handleNoteOff, releaseAllNotes]);

  // Computer keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      // Octave controls with z and x keys
      if (key === 'z') {
        octaveDown();
        return;
      }
      if (key === 'x') {
        octaveUp();
        return;
      }

      // Only trigger if this key isn't already playing a note and note is playable
      if (keyMap[key] && !keysToNotes.current.has(key)) {
        const note = keyMap[key];
        if (!canPlayNote(note)) return; // Skip if note is outside scale
        keysToNotes.current.set(key, note); // Remember which note this key triggered
        handleNoteOn(note);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Release the note that was originally triggered by this key
      const note = keysToNotes.current.get(key);
      if (note) {
        keysToNotes.current.delete(key);
        handleNoteOff(note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleNoteOn, handleNoteOff, keyMap, octaveUp, octaveDown, canPlayNote]);

  const handleParamChange = (param: keyof SynthParams, value: number | WaveformType | ArpMode | boolean) => {
    const newParams = { ...params, [param]: value };
    onParamsChange(newParams);
  };

  // Randomize all parameters (except output and effect settings)
  const randomizeParams = () => {
    const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];
    const newParams: SynthParams = {
      waveform: waveforms[Math.floor(Math.random() * waveforms.length)],
      attack: Math.random() * 0.5,
      decay: 0.05 + Math.random() * 0.5,
      sustain: Math.random(),
      release: 0.05 + Math.random() * 0.8,
      filterCutoff: 0.2 + Math.random() * 0.8,
      filterResonance: Math.random() * 0.7,
      filterEnvAmount: Math.random(),
      detune: params.detune, // Keep current setting
      volume: params.volume, // Keep current output settings
      pan: params.pan, // Keep current output settings
      arpMode: params.arpMode, // Keep current arp mode
      arpRate: params.arpRate, // Keep current arp rate
      mono: params.mono, // Keep current mono setting
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
      // Phaser settings
      phaserMix: params.phaserMix,
      phaserFreq: params.phaserFreq,
      phaserDepth: params.phaserDepth,
      // Flanger settings
      flangerMix: params.flangerMix,
      flangerDepth: params.flangerDepth,
      flangerFreq: params.flangerFreq,
    };
    onParamsChange(newParams);
  };

  // Clear sequence - use parent callback to reset to capture mode
  const clearSequence = () => {
    if (onClearSequence) {
      onClearSequence();
    }
  };

  // Generate random chord progression
  const randomizeChords = () => {
    if (!onSynthSequenceChange) return;
    const scaleNotesArray = generateScaleNotes(scaleRoot, scaleType);
    const barsToGenerate = isSynthLoopCapture ? 4 : synthLoopBars; // Default to 4 bars for full progression
    const newPattern = generateChordProgression(scaleNotesArray, barsToGenerate);
    onSynthSequenceChange(newPattern);
    // If in capture mode, set loop to 4 bars and exit capture mode
    if (isSynthLoopCapture && onSynthLoopBarsChange) {
      onSynthLoopBarsChange(4);
    }
  };

  const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];
  const arpModes: ArpMode[] = ['off', 'up', 'down', 'updown', 'random'];

  return (
    <div className="synth-container">
      <div className="synth-panel">
        {/* Output */}
        <div className="synth-section">
          <div className="section-label">OUTPUT</div>
          <SynthKnob
            label="VOLUME"
            value={params.volume}
            onChange={(v) => handleParamChange('volume', v)}
          />
        </div>

        {/* Octave control */}
        <div className="synth-section">
          <div className="section-label">OCTAVE</div>
          <div className="octave-controls">
            <button
              className="octave-btn"
              onClick={octaveDown}
              disabled={octave <= MIN_OCTAVE}
            >
              -
            </button>
            <span className="octave-display">{octave}</span>
            <button
              className="octave-btn"
              onClick={octaveUp}
              disabled={octave >= MAX_OCTAVE}
            >
              +
            </button>
          </div>
        </div>

        {/* Mono/Poly toggle */}
        <div className="synth-section">
          <div className="section-label">VOICE</div>
          <button
            className={`mono-poly-btn ${params.mono ? 'mono' : 'poly'}`}
            onClick={() => handleParamChange('mono', !params.mono)}
          >
            {params.mono ? 'MONO' : 'POLY'}
          </button>
        </div>

        {/* Scale */}
        <div className="synth-section">
          <div className="section-label">SCALE</div>
          <div className="scale-controls">
            <button
              className={`scale-toggle ${scaleEnabled ? 'active' : ''}`}
              onClick={() => setScaleEnabled(!scaleEnabled)}
            >
              {scaleEnabled ? 'ON' : 'OFF'}
            </button>
            {scaleEnabled && (
              <>
                <select
                  className="scale-select"
                  value={scaleRoot}
                  onChange={(e) => setScaleRoot(e.target.value)}
                >
                  {ROOT_NOTES.map((note) => (
                    <option key={note} value={note}>{note}</option>
                  ))}
                </select>
                <select
                  className="scale-select"
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

        {/* Waveform selector */}
        <div className="synth-section">
          <div className="section-label">WAVEFORM</div>
          <div className="waveform-buttons">
            {waveforms.map((wf) => (
              <button
                key={wf}
                className={`waveform-btn ${params.waveform === wf ? 'active' : ''}`}
                onClick={() => handleParamChange('waveform', wf)}
              >
                <WaveformIcon type={wf} />
              </button>
            ))}
          </div>
        </div>

        {/* ADSR */}
        <div className="synth-section">
          <div className="section-label">ENVELOPE</div>
          <div className="knob-row">
            <SynthKnob
              label="ATK"
              value={params.attack}
              onChange={(v) => handleParamChange('attack', v)}
              min={0.001}
              max={2}
            />
            <SynthKnob
              label="DEC"
              value={params.decay}
              onChange={(v) => handleParamChange('decay', v)}
              min={0.01}
              max={2}
            />
            <SynthKnob
              label="SUS"
              value={params.sustain}
              onChange={(v) => handleParamChange('sustain', v)}
            />
            <SynthKnob
              label="REL"
              value={params.release}
              onChange={(v) => handleParamChange('release', v)}
              min={0.01}
              max={3}
            />
          </div>
        </div>

        {/* Filter */}
        <div className="synth-section">
          <div className="section-label">FILTER</div>
          <div className="knob-row">
            <SynthKnob
              label="CUTOFF"
              value={params.filterCutoff}
              onChange={(v) => handleParamChange('filterCutoff', v)}
            />
            <SynthKnob
              label="RES"
              value={params.filterResonance}
              onChange={(v) => handleParamChange('filterResonance', v)}
            />
            <SynthKnob
              label="ENV"
              value={params.filterEnvAmount}
              onChange={(v) => handleParamChange('filterEnvAmount', v)}
            />
          </div>
        </div>

        {/* Arpeggiator */}
        <div className="synth-section">
          <div className="section-label">ARPEGGIATOR</div>
          <div className="arp-controls">
            <select
              className="arp-select"
              value={params.arpMode}
              onChange={(e) => handleParamChange('arpMode', e.target.value as ArpMode)}
            >
              {arpModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode.toUpperCase()}
                </option>
              ))}
            </select>
            <SynthKnob
              label="RATE"
              value={params.arpRate}
              onChange={(v) => handleParamChange('arpRate', v)}
            />
          </div>
        </div>

        {/* Action buttons - desktop only, mobile version is below keyboard */}
        <div className="synth-section random-section-desktop">
          <button className="action-btn mutate-btn" onClick={randomizeParams}>MUTATE</button>
          <button className="action-btn random-melody-btn" onClick={randomizeChords}>CHORDS</button>
          <button className="action-btn clear-btn" onClick={clearSequence}>CLEAR</button>
        </div>
      </div>

      {/* Keyboard */}
      <div className="keyboard-container">
        <div className="keyboard">
          {keyboardNotes.filter((n) => !n.isBlack).map((noteObj) => {
            const playable = canPlayNote(noteObj.note);
            return (
              <div
                key={noteObj.note}
                className={`key white-key ${activeNotes.has(noteObj.note) ? 'active' : ''} ${isInScale(noteObj.note) ? 'in-scale' : ''} ${scaleEnabled && !playable ? 'disabled' : ''}`}
                onMouseDown={() => {
                  if (!playable) return;
                  mouseDownNotes.current.add(noteObj.note);
                  handleNoteOn(noteObj.note);
                }}
                onMouseUp={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onMouseLeave={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (!playable) return;
                  const touch = e.changedTouches[0];
                  if (touch) handleNoteOn(noteObj.note, touch.identifier);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
              >
                <span className="key-label">{noteObj.note}</span>
              </div>
            );
          })}
          {keyboardNotes.filter((n) => n.isBlack).map((noteObj) => {
            const baseNote = noteObj.note.replace('#', '').replace(/\d/, '');
            const noteOctave = noteObj.note.slice(-1);
            const whiteIndex = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(baseNote);
            const octaveOffset = (parseInt(noteOctave) - octave) * 7;
            const position = whiteIndex + octaveOffset;
            const keyWidth = 100 / numWhiteKeys;
            const playable = canPlayNote(noteObj.note);

            // Position black key exactly on the boundary between white keys
            // The boundary is at (position + 1) * keyWidth, centered with half black key width
            return (
              <div
                key={noteObj.note}
                className={`key black-key ${activeNotes.has(noteObj.note) ? 'active' : ''} ${isInScale(noteObj.note) ? 'in-scale' : ''} ${scaleEnabled && !playable ? 'disabled' : ''}`}
                style={{ left: `calc(${(position + 1) * keyWidth}% - 15px)` }}
                onMouseDown={() => {
                  if (!playable) return;
                  mouseDownNotes.current.add(noteObj.note);
                  handleNoteOn(noteObj.note);
                }}
                onMouseUp={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onMouseLeave={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (!playable) return;
                  const touch = e.changedTouches[0];
                  if (touch) handleNoteOn(noteObj.note, touch.identifier);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Capture Ribbon - Visual timeline for recording */}
      {(isSynthLoopCapture || recordedNotes.length > 0) && (
        <CaptureRibbon
          currentStep={synthCurrentStep >= 0 ? synthCurrentStep : 0}
          isRecording={isRecording || false}
          isPlaying={isPlaying || false}
          isCaptureMode={isSynthLoopCapture}
          recordedNotes={recordedNotes}
          capturedBars={!isSynthLoopCapture ? synthLoopBars : undefined}
          maxBars={isSynthLoopCapture ? 16 : synthLoopBars}
        />
      )}

      {/* Waveform Visualizer */}
      <WaveformVisualizer synth={synth} />

      {/* Action buttons - mobile only, below keyboard */}
      <div className="synth-mobile-actions">
        <button className="action-btn-mobile mutate-btn" onClick={randomizeParams}>MUTATE</button>
        <button className="action-btn-mobile random-melody-btn" onClick={randomizeChords}>CHORDS</button>
        <button className="action-btn-mobile clear-btn" onClick={clearSequence}>CLEAR</button>
      </div>
    </div>
  );
};

// Knob component
interface SynthKnobProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const SynthKnob: React.FC<SynthKnobProps> = ({ label, value, onChange, min = 0, max = 1 }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135;

  const handleStart = (clientY: number) => {
    isDragging.current = true;
    startY.current = clientY;
    startValue.current = value;
  };

  const handleMove = (clientY: number) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - clientY;
    const deltaValue = (deltaY / 100) * (max - min);
    const newValue = Math.max(min, Math.min(max, startValue.current + deltaValue));
    onChange(newValue);
  };

  const handleEnd = () => {
    isDragging.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientY);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientY);
  };

  const handleMouseUp = () => {
    handleEnd();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className="synth-knob-container">
      <div
        ref={knobRef}
        className="synth-knob"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="knob-body" style={{ transform: `rotate(${rotation}deg)` }}>
          <div className="knob-indicator" />
        </div>
      </div>
      <div className="knob-label">{label}</div>
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
    <svg viewBox="0 0 28 24" className="waveform-icon">
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

export default Synth;
