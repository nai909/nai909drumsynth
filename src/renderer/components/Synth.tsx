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
// Hand-crafted chord progressions with intentional voicings
// Each voicing is an array of scale degree offsets from a base octave
// These are designed with voice leading in mind - minimal movement between chords
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
}

const CRAFTED_PROGRESSIONS: CraftedProgression[] = [
  // === EMOTIONAL / POP ===
  {
    name: 'Hopeful',
    mood: 'uplifting, anthemic',
    // I - V - vi - IV with smooth voice leading
    voicings: [
      [0, 4, 7, 11],      // I: root, 5th, octave, 3rd above (spread voicing)
      [-1, 4, 7, 11],     // V: 7th below as bass, creates smooth bass line
      [-2, 4, 7, 9],      // vi: 6th below as bass, 3rd on top
      [-4, 3, 7, 10],     // IV: 4th below as bass, warm voicing
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Nostalgic',
    mood: 'bittersweet, reflective',
    // vi - IV - I - V (the "sad" version)
    voicings: [
      [5, 9, 12, 14],     // vi: minor feel, higher voicing
      [3, 7, 10, 14],     // IV: drops down smoothly
      [0, 4, 7, 11],      // I: resolution
      [4, 7, 11, 14],     // V: tension before repeat
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Yearning',
    mood: 'longing, emotional',
    // I - iii - IV - iv (major to minor IV - the heartbreak chord)
    voicings: [
      [0, 4, 7, 11],      // I: warm major
      [2, 5, 9, 12],      // iii: subtle shift
      [3, 7, 10, 14],     // IV: bright
      [3, 6, 10, 13],     // iv: the tear-jerker minor IV
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Sunrise',
    mood: 'awakening, gentle',
    // IV - V - iii - vi (building then falling)
    voicings: [
      [3, 7, 10, 14],     // IV: open, bright
      [4, 7, 11, 14],     // V: lifts up
      [2, 5, 9, 11],      // iii: gentle descent
      [5, 8, 12, 15],     // vi: settles into reflection
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },

  // === JAZZ / NEO-SOUL ===
  {
    name: 'Soulful',
    mood: 'warm, neo-soul',
    // ii7 - V7 - Imaj7 - vi7 (jazz turnaround)
    voicings: [
      [1, 4, 6, 8],       // ii7: rich minor 7th
      [4, 6, 8, 11],      // V7: dominant tension
      [0, 4, 6, 9],       // Imaj7: sweet resolution
      [5, 8, 11, 13],     // vi7: emotional color
    ],
    timing: [0, 12, 24, 40],
    lengths: [11, 11, 15, 15],
  },
  {
    name: 'Velvet',
    mood: 'silky, D\'Angelo',
    // Imaj9 - IVmaj7 - ii9 - V7#9 (neo-soul classic)
    voicings: [
      [0, 4, 6, 9, 14],   // Imaj9: lush with 9th on top
      [3, 6, 10, 13],     // IVmaj7: warm
      [1, 4, 6, 8, 13],   // ii9: thick voicing
      [4, 6, 8, 11, 15],  // V7#9: Hendrix chord tension
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Midnight',
    mood: 'smoky, jazz club',
    // iii7 - vi7 - ii7 - V7 (circle of fifths descent)
    voicings: [
      [2, 5, 8, 11],      // iii7
      [5, 8, 11, 14],     // vi7
      [1, 4, 7, 10],      // ii7
      [4, 7, 10, 13],     // V7
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Erykah',
    mood: 'floating, hypnotic',
    // Imaj7 - #IVm7b5 - IV7 - iii7 (chromatic inner voice movement)
    voicings: [
      [0, 4, 6, 11],      // Imaj7
      [3, 6, 9, 12],      // #IVm7b5: surprising color
      [3, 6, 9, 11],      // IV7: slides down
      [2, 5, 8, 11],      // iii7: resolution
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },
  {
    name: 'After Hours',
    mood: 'late night, intimate',
    // vi9 - ii11 - Imaj7 - Imaj7 (floating resolution)
    voicings: [
      [5, 8, 11, 14, 16], // vi9: rich minor
      [1, 4, 6, 8, 11],   // ii11: suspended feeling
      [0, 4, 6, 11],      // Imaj7: home
      [0, 4, 6, 11],      // Imaj7: rest
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },

  // === DREAMY / AMBIENT ===
  {
    name: 'Dreamy',
    mood: 'floating, ethereal',
    // Imaj7 - iii7 - vi7 - IVmaj7
    voicings: [
      [0, 4, 6, 11],      // Imaj7
      [2, 6, 9, 13],      // iii7
      [5, 9, 11, 14],     // vi7
      [3, 6, 10, 14],     // IVmaj7
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },
  {
    name: 'Clouds',
    mood: 'weightless, shoegaze',
    // IVmaj7 - Imaj7 - IVmaj7 - Imaj7 (simple but vast)
    voicings: [
      [3, 7, 10, 14],     // IVmaj7: bright and open
      [0, 4, 7, 11],      // Imaj7: home
      [3, 7, 10, 14],     // IVmaj7: return to brightness
      [0, 4, 7, 11],      // Imaj7: resolution
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },
  {
    name: 'Stardust',
    mood: 'cosmic, wonder',
    // Imaj7 - bVIImaj7 - IVmaj7 - Imaj7 (borrowed chord magic)
    voicings: [
      [0, 4, 6, 11],      // Imaj7
      [-2, 2, 4, 9],      // bVIImaj7: unexpected brightness
      [3, 6, 10, 14],     // IVmaj7: familiar
      [0, 4, 6, 11],      // Imaj7: return home
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },

  // === MELANCHOLIC / SAD ===
  {
    name: 'Melancholic',
    mood: 'sad, introspective',
    // i - VI - III - VII (natural minor)
    voicings: [
      [0, 3, 7, 10],      // i: minor root
      [5, 8, 12, 15],     // VI: major lift
      [2, 5, 9, 12],      // III: relative major
      [6, 9, 13, 16],     // VII: tension
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Rain',
    mood: 'grey, contemplative',
    // i - iv - VII - III (aeolian sadness)
    voicings: [
      [0, 3, 7, 12],      // i: minor root
      [3, 6, 10, 15],     // iv: deeper sadness
      [6, 10, 13, 17],    // VII: lift
      [2, 6, 9, 14],      // III: major resolve
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Goodbye',
    mood: 'farewell, bittersweet',
    // I - V/7 - vi - vi (lingering on the minor)
    voicings: [
      [0, 4, 7, 11],      // I: starts bright
      [4, 7, 11, 14],     // V/7: building
      [5, 9, 12, 14],     // vi: the turn
      [5, 9, 12, 16],     // vi: stays in sadness
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Fading',
    mood: 'loss, acceptance',
    // vi - V - IV - I (descending, letting go)
    voicings: [
      [5, 9, 12, 16],     // vi: high minor
      [4, 7, 11, 14],     // V: step down
      [3, 7, 10, 14],     // IV: warmer
      [0, 4, 7, 11],      // I: resolved acceptance
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },

  // === CINEMATIC / EPIC ===
  {
    name: 'Cinematic',
    mood: 'epic, building',
    // I - V/7 - vi - IV with octave reach
    voicings: [
      [0, 4, 7, 14],      // I: root with high octave
      [4, 7, 11, 16],     // V: reaches up
      [5, 9, 12, 17],     // vi: continues climbing
      [3, 7, 10, 15],     // IV: settles back
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },
  {
    name: 'Heroic',
    mood: 'triumphant, adventure',
    // I - IV - I - V (simple power)
    voicings: [
      [0, 4, 7, 12],      // I: strong root
      [3, 7, 10, 15],     // IV: builds
      [0, 4, 7, 14],      // I: returns bigger
      [4, 7, 11, 16],     // V: cliffhanger
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Vast',
    mood: 'expansive, Thomas Newman',
    // I - bVI - bVII - I (borrowed chords, wide)
    voicings: [
      [0, 4, 7, 14],      // I: home
      [-4, 0, 3, 8],      // bVI: unexpected shift
      [-2, 2, 5, 10],     // bVII: builds tension
      [0, 4, 7, 14],      // I: return
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },
  {
    name: 'Interstellar',
    mood: 'cosmic, Zimmer',
    // i - VI - III - VII (minor with epic spacing)
    voicings: [
      [0, 7, 12, 15],     // i: open fifths
      [5, 12, 15, 20],    // VI: massive spread
      [2, 9, 14, 17],     // III: climbing
      [6, 13, 17, 22],    // VII: peak
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },

  // === CHILL / LO-FI ===
  {
    name: 'Chill',
    mood: 'relaxed, lo-fi',
    // Imaj7 - vi7 - ii7 - V7
    voicings: [
      [0, 4, 6, 11],      // Imaj7
      [5, 9, 11, 14],     // vi7
      [1, 4, 8, 11],      // ii7
      [4, 8, 11, 13],     // V7
    ],
    timing: [0, 14, 28, 44],
    lengths: [13, 13, 15, 15],
  },
  {
    name: 'Lazy Sunday',
    mood: 'cozy, bedroom pop',
    // IVmaj7 - iii7 - ii7 - Imaj7 (descending by step)
    voicings: [
      [3, 6, 10, 13],     // IVmaj7
      [2, 5, 9, 12],      // iii7
      [1, 4, 8, 11],      // ii7
      [0, 4, 6, 11],      // Imaj7
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Coffee Shop',
    mood: 'warm, acoustic',
    // I - Iadd9 - IV - iv (simple with add9 color)
    voicings: [
      [0, 4, 7, 11],      // I
      [0, 4, 7, 9, 14],   // Iadd9: shimmer
      [3, 7, 10, 14],     // IV: bright
      [3, 6, 10, 13],     // iv: the turn
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },

  // === DARK / TENSION ===
  {
    name: 'Dark',
    mood: 'tension, mystery',
    // i - v - VI - iv (dramatic minor)
    voicings: [
      [0, 3, 7, 12],      // i: minor root
      [4, 7, 11, 14],     // v: minor v
      [5, 9, 12, 16],     // VI: major contrast
      [3, 6, 10, 15],     // iv: back to minor
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Shadows',
    mood: 'creeping, ominous',
    // i - bII - i - VII (phrygian darkness)
    voicings: [
      [0, 3, 7, 10],      // i
      [1, 4, 8, 11],      // bII: Neapolitan tension
      [0, 3, 7, 10],      // i: return
      [6, 10, 13, 17],    // VII: unresolved
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Descent',
    mood: 'falling, dramatic',
    // i - VII - VI - V (chromatic bass descent)
    voicings: [
      [0, 3, 7, 12],      // i
      [6, 10, 13, 18],    // VII
      [5, 9, 12, 17],     // VI
      [4, 7, 11, 16],     // V: dominant at bottom
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },

  // === GOSPEL / R&B ===
  {
    name: 'Gospel',
    mood: 'uplifting, church',
    // I - I7 - IV - iv (the gospel turn)
    voicings: [
      [0, 4, 7, 12],      // I: strong
      [0, 4, 7, 10],      // I7: dominant color
      [3, 7, 10, 15],     // IV: lifts
      [3, 6, 10, 15],     // iv: the cry
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Praise',
    mood: 'joyful, celebratory',
    // I - iii - IV - V (climbing praise)
    voicings: [
      [0, 4, 7, 14],      // I: big
      [2, 5, 9, 14],      // iii: step up
      [3, 7, 10, 15],     // IV: higher
      [4, 7, 11, 16],     // V: peak
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Whitney',
    mood: 'power ballad, soaring',
    // I - V - vi - iii - IV - I - IV - V (the classic)
    voicings: [
      [0, 4, 7, 11],      // I
      [4, 7, 11, 14],     // V
      [5, 9, 12, 14],     // vi
      [3, 7, 10, 14],     // IV to V
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },

  // === ANIME / J-POP ===
  {
    name: 'Anime Sad',
    mood: 'emotional, Japanese',
    // vi - V - IV - III (royal road to emotions)
    voicings: [
      [5, 9, 12, 16],     // vi: starts emotional
      [4, 8, 11, 15],     // V: builds
      [3, 7, 10, 14],     // IV: descends
      [2, 6, 9, 13],      // III: major resolution
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Anime Hope',
    mood: 'determined, shonen',
    // IV - V - iii - vi (the dramatic push)
    voicings: [
      [3, 7, 10, 14],     // IV: foundation
      [4, 7, 11, 14],     // V: energy
      [2, 5, 9, 12],      // iii: tender
      [5, 9, 12, 16],     // vi: emotional payoff
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Ghibli',
    mood: 'magical, innocent',
    // I - iii - IV - V (pure, childlike)
    voicings: [
      [0, 4, 7, 11],      // I: simple
      [2, 5, 9, 11],      // iii: wonder
      [3, 7, 10, 12],     // IV: lifting
      [4, 7, 11, 14],     // V: magic
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },

  // === ELECTRONIC / HOUSE ===
  {
    name: 'Deep House',
    mood: 'groovy, underground',
    // i7 - iv7 - VII7 - III7 (minor with 7ths)
    voicings: [
      [0, 3, 6, 10],      // i7
      [3, 6, 9, 13],      // iv7
      [6, 9, 13, 16],     // VII7
      [2, 5, 9, 12],      // III7
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Progressive',
    mood: 'building, trance',
    // i - VII - VI - VII (rising tension)
    voicings: [
      [0, 3, 7, 12],      // i
      [6, 10, 13, 18],    // VII
      [5, 9, 12, 17],     // VI
      [6, 10, 13, 18],    // VII: returns for tension
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },

  // === BLUES / ROCK ===
  {
    name: 'Blues',
    mood: 'soulful, classic',
    // I7 - I7 - IV7 - I7 (12-bar essence in 4)
    voicings: [
      [0, 4, 7, 10],      // I7
      [0, 4, 7, 10],      // I7
      [3, 6, 10, 13],     // IV7
      [0, 4, 7, 10],      // I7 back home
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Rock Anthem',
    mood: 'powerful, arena',
    // I - bVII - IV - I (the power sound)
    voicings: [
      [0, 4, 7, 12],      // I: strong
      [-2, 2, 5, 10],     // bVII: borrowed power
      [3, 7, 10, 15],     // IV: bright
      [0, 4, 7, 12],      // I: resolve
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },

  // === CLASSICAL INSPIRED ===
  {
    name: 'Baroque',
    mood: 'elegant, Bach',
    // I - V - vi - iii - IV - I - IV - V
    voicings: [
      [0, 4, 7, 11],      // I
      [4, 7, 11, 14],     // V
      [5, 9, 12, 14],     // vi
      [4, 7, 11, 14],     // V resolution
    ],
    timing: [0, 16, 32, 48],
    lengths: [14, 14, 14, 14],
  },
  {
    name: 'Romantic',
    mood: 'sweeping, Chopin',
    // I - vi - ii - V7 (classical with feeling)
    voicings: [
      [0, 4, 7, 11],      // I: warm
      [5, 9, 12, 16],     // vi: yearning
      [1, 4, 8, 11],      // ii: tension
      [4, 7, 10, 14],     // V7: resolution ahead
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },
  {
    name: 'Moonlight',
    mood: 'Beethoven, nocturnal',
    // i - VI - ii° - V (minor key drama)
    voicings: [
      [0, 3, 7, 12],      // i
      [5, 9, 12, 17],     // VI
      [1, 4, 7, 10],      // ii°: diminished feel
      [4, 7, 11, 14],     // V: waiting
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },

  // === MINIMAL / SPARSE ===
  {
    name: 'Minimal',
    mood: 'sparse, glass',
    // I - V - I - IV (simple movements)
    voicings: [
      [0, 7, 14],         // I: open fifth + octave
      [4, 11, 14],        // V: open
      [0, 7, 14],         // I: return
      [3, 10, 14],        // IV: color
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
  },
  {
    name: 'Breath',
    mood: 'meditative, still',
    // Imaj7 - Imaj7 - IVmaj7 - Imaj7 (barely moving)
    voicings: [
      [0, 4, 6, 11],      // Imaj7
      [0, 4, 6, 11],      // Imaj7: stay
      [3, 6, 10, 14],     // IVmaj7: gentle shift
      [0, 4, 6, 11],      // Imaj7: return
    ],
    timing: [0, 16, 32, 48],
    lengths: [15, 15, 15, 15],
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

// Generate chord progression pattern using crafted progressions
const generateChordProgression = (scaleNotes: string[], _loopBars: number): SynthStep[] => {
  const pattern: SynthStep[] = Array.from({ length: 256 }, () => ({ active: false, note: 'C4' }));

  // Pick a random crafted progression
  const progression = CRAFTED_PROGRESSIONS[Math.floor(Math.random() * CRAFTED_PROGRESSIONS.length)];

  // Base index in scaleNotes for middle register (around C4)
  const baseIndex = Math.floor(scaleNotes.length / 3);

  // Helper to get a note from scale by index (with bounds checking)
  const getNote = (scaleIndex: number): string => {
    // Handle negative indices (lower octaves) and high indices (upper octaves)
    const clampedIndex = Math.max(0, Math.min(scaleIndex, scaleNotes.length - 1));
    return scaleNotes[clampedIndex] || 'C4';
  };

  // Place each chord from the progression
  progression.voicings.forEach((voicing, chordIdx) => {
    const startStep = progression.timing[chordIdx];
    const length = progression.lengths[chordIdx];

    if (startStep >= 256) return;

    // Place each note in the voicing with slight strum (2 steps apart for musicality)
    voicing.forEach((scaleOffset, noteIdx) => {
      const noteStep = startStep + noteIdx * 2; // Strum effect: 2 steps between notes
      if (noteStep >= 256) return;

      const noteIndex = baseIndex + scaleOffset;
      const note = getNote(noteIndex);
      const noteLength = Math.max(1, length - noteIdx * 2); // Earlier notes ring longer

      pattern[noteStep] = { active: true, note, length: noteLength };
    });
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
