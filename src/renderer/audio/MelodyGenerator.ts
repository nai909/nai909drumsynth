/**
 * MelodyGenerator - A music theory-based melody generation engine
 *
 * Philosophy: Music is not random notes. Music is organized sound that tells a story.
 *
 * A melody has:
 *   - Beginning: establish an idea (the motif)
 *   - Middle: develop it, build tension
 *   - End: resolve, come home
 *
 * This generator thinks like a composer, not a random number generator.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Step {
  active: boolean;
  note: string;
}

/**
 * Parameters that make sense to musicians, not programmers.
 */
export interface MelodyParams {
  /** How active/dense the melody feels (0 = sparse, 1 = dense) */
  energy: number;

  /** How much the melody develops and varies (0 = repetitive, 1 = complex) */
  complexity: number;

  /** How much dissonance and unresolved tension (0 = consonant, 1 = tense) */
  tension: number;

  /** The overall shape of the melody */
  contour: 'arch' | 'ascending' | 'descending' | 'wave' | 'flat' | 'random';

  /** How many bars constitute one musical phrase */
  phraseLength: 2 | 4 | 8;

  /** What to generate: melody only, chords only, or both */
  mode: 'melody' | 'chords' | 'both';

  /** Optional genre hint for rhythm patterns */
  genre?: 'electronic' | 'ambient' | 'hiphop' | 'jazz' | 'classical' | 'pop';
}

/**
 * A motif is the seed of the melody - a small musical idea that gets developed.
 */
interface Motif {
  /** Intervals relative to starting position (0 = same, 1 = one scale step up, -1 = down) */
  intervals: number[];

  /** Which steps in a 4-step unit have notes (true = note, false = rest) */
  rhythm: boolean[];
}

/**
 * Scale degree information for music theory calculations
 */
interface ScaleDegreeInfo {
  degree: number;        // 1-7
  isChordTone: boolean;  // 1, 3, 5 are stable
  tendency?: {
    target: number;      // Where it naturally wants to resolve
    strength: number;    // How strongly (0-1)
  };
}

/**
 * Context for the current position in the melody
 */
interface MelodicContext {
  beatStrength: number;  // 0 = weak, 1 = strong
  phrasePosition: number; // 0-1 within the phrase
  targetTension: number; // Desired tension at this point
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Scale degree tendencies - the soul of tonal music
 * These are the "desires" of each scale degree to resolve
 */
const SCALE_DEGREE_INFO: Record<number, ScaleDegreeInfo> = {
  1: { degree: 1, isChordTone: true },   // Tonic - home, stable
  2: { degree: 2, isChordTone: false, tendency: { target: 1, strength: 0.5 } },  // Supertonic - mild pull down
  3: { degree: 3, isChordTone: true },   // Mediant - stable
  4: { degree: 4, isChordTone: false, tendency: { target: 3, strength: 0.7 } },  // Subdominant - wants to fall
  5: { degree: 5, isChordTone: true },   // Dominant - stable but active
  6: { degree: 6, isChordTone: false, tendency: { target: 5, strength: 0.4 } },  // Submediant - gentle pull
  7: { degree: 7, isChordTone: false, tendency: { target: 1, strength: 0.9 } },  // Leading tone - STRONG pull up to tonic
};

/**
 * Rhythm pattern templates by energy level
 * Each pattern is 16 steps (one bar of 16th notes)
 */
const RHYTHM_TEMPLATES = {
  sparse: [
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],  // Half notes
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],  // Dotted feel
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],  // Breathing space
  ],
  low: [
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],  // Quarter notes
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],  // Syncopated quarters
    [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],  // Dotted eighths
  ],
  medium: [
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],  // Eighth notes
    [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],  // Eighths with rests
    [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],  // Syncopated
  ],
  high: [
    [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],  // Busy
    [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],  // 16th runs
    [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0],  // Complex syncopation
  ],
  dense: [
    [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0],  // Near-continuous
    [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1],  // Flowing 16ths
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],  // Full 16ths
  ],
};

/**
 * Chord progressions - from professional orchestral MIDI libraries
 * Each progression is an array of scale degrees (1-indexed)
 * Source: /Documents/Sample Packs/Orchestral Midi/90-115bpm
 */
const CHORD_PROGRESSIONS = {
  // EMOTIONAL - Minor key, cinematic feel
  emotional: [
    [6, 4, 1, 5],     // Am-F-C-G - THE emotional progression
    [6, 1, 6, 5],     // Am-C-Am-G - haunting, cyclical
    [6, 1, 4, 1],     // Am-C-F-C - gentle resolution
    [6, 1, 5, 6],     // Am-C-G-Am - dramatic return
    [6, 5, 4, 5],     // Am-G-F-G - building tension
    [6, 5, 1, 4],     // Am-G-C-F - hopeful
    [6, 5, 3, 4],     // Am-G-Em-F - deeply emotional
    [6, 5, 4, 2],     // Am-G-F-Dm - melancholic
    [6, 5, 4, 3],     // Am-G-F-Em - cascading sadness
    [6, 3, 4, 1],     // Am-Em-F-C - bittersweet
    [6, 2, 6, 3],     // Am-Dm-Am-Em - circular
    [6, 2, 3],        // Am-Dm-E - flamenco
    [6, 3, 4],        // Am-Em-F - suspended
  ],
  // UPLIFTING - Major key, bright
  uplifting: [
    [1, 5, 6, 4],     // C-G-Am-F - biggest pop progression
    [1, 6, 4, 5],     // C-Am-F-G - classic
    [1, 4, 5, 1],     // C-F-G-C - pure resolution
    [1, 2, 4],        // C-Dm-F - gentle
    [1, 2, 4, 6],     // C-Dm-F-A - extended
    [1, 6, 3, 4],     // C-Am-E-F - surprising
    [1, 5, 2, 6],     // C-G-D-A - open fifths
  ],
};

/**
 * Chord rhythm patterns - when chords hit in a bar
 * Sparse = whole notes, dense = quarter notes
 */
const CHORD_RHYTHMS = {
  sparse: [
    [0],                    // One chord per bar (whole note)
    [0, 8],                 // Two chords per bar (half notes)
  ],
  medium: [
    [0, 8],                 // Half notes
    [0, 4, 8, 12],          // Quarter notes
    [0, 6, 8, 14],          // Syncopated
  ],
  dense: [
    [0, 4, 8, 12],          // Quarter notes
    [0, 2, 4, 6, 8, 10, 12, 14], // Eighth notes
    [0, 3, 6, 8, 11, 14],   // Complex syncopation
  ],
};

/**
 * Contour shapes define the melodic arc
 * Values are relative positions (0 = low, 1 = high) at each point in the phrase
 */
const CONTOUR_SHAPES: Record<string, (position: number) => number> = {
  // Classic arch - rise to middle, fall to end
  arch: (pos) => Math.sin(pos * Math.PI),

  // Steadily rising - builds energy
  ascending: (pos) => pos,

  // Steadily falling - releases energy
  descending: (pos) => 1 - pos,

  // Undulating wave - creates interest through motion
  wave: (pos) => 0.5 + 0.5 * Math.sin(pos * Math.PI * 2),

  // Relatively flat - drone-like, meditative
  flat: () => 0.5,

  // Random but smoothed - unpredictable but not jarring
  random: (pos) => {
    // Use position as seed for deterministic "randomness"
    const seed = Math.sin(pos * 12.9898) * 43758.5453;
    return (seed - Math.floor(seed));
  },
};

// ============================================================================
// MELODY GENERATOR CLASS
// ============================================================================

export class MelodyGenerator {
  private scaleNotes: string[] = [];
  private scaleLength: number = 7;

  /**
   * Generate music that tells a story - melody, chords, or both.
   *
   * @param scaleNotes - Available notes in the scale
   * @param bars - Total number of bars to generate
   * @param params - Musical parameters
   * @returns Array of steps for the sequencer
   */
  generate(scaleNotes: string[], bars: number, params: MelodyParams): Step[] {
    this.scaleNotes = scaleNotes;
    this.scaleLength = this.detectScaleLength(scaleNotes);

    const steps: Step[] = Array.from({ length: 256 }, () => ({ active: false, note: 'C4' }));
    const mode = params.mode || 'melody';

    if (mode === 'chords') {
      // Generate only chords
      this.generateChords(steps, bars, params);
    } else if (mode === 'melody') {
      // Generate only melody
      this.generateMelodyOnly(steps, bars, params);
    } else {
      // Generate both - chords as foundation, melody dancing above
      // First, generate the chord progression
      const chordInfo = this.generateChords(steps, bars, params);
      // Then, generate melody that's aware of the chords
      this.generateMelodyOverChords(steps, bars, params, chordInfo);
    }

    return steps;
  }

  /**
   * Generate melody only (original behavior)
   */
  private generateMelodyOnly(steps: Step[], bars: number, params: MelodyParams): void {
    const totalSteps = bars * 16;
    const motif = this.generateMotif(params);
    const phrases = Math.ceil(bars / params.phraseLength);

    for (let phraseIndex = 0; phraseIndex < phrases; phraseIndex++) {
      const phraseStart = phraseIndex * params.phraseLength * 16;
      const phraseEnd = Math.min(phraseStart + params.phraseLength * 16, totalSteps);
      const isLastPhrase = phraseIndex === phrases - 1;

      this.generatePhrase(steps, phraseStart, phraseEnd, motif, params, phraseIndex, isLastPhrase);
    }
  }

  /**
   * Generate chord progression - the harmonic foundation
   * Uses the same proven approach as the DICE generator's chord mode
   */
  private generateChords(
    steps: Step[],
    bars: number,
    params: MelodyParams
  ): { stepToChordRoot: Map<number, number> } {
    const stepToChordRoot = new Map<number, number>();

    // Select progression style based on tension
    // Higher tension = emotional (minor feel), lower tension = uplifting (major feel)
    const style: keyof typeof CHORD_PROGRESSIONS = params.tension > 0.5 ? 'emotional' : 'uplifting';

    const progressions = CHORD_PROGRESSIONS[style];
    const progression = progressions[Math.floor(Math.random() * progressions.length)];

    // Use the full scale range (like DICE does)
    const noteRange = this.scaleNotes;
    if (noteRange.length === 0) return { stepToChordRoot };

    // Find a good starting range (middle-low for chords)
    const rangeStart = Math.max(0, Math.floor(noteRange.length * 0.2));
    const rangeEnd = Math.min(noteRange.length - 1, Math.floor(noteRange.length * 0.5));
    const chordRange = noteRange.slice(rangeStart, rangeEnd + 1);

    if (chordRange.length < 5) return { stepToChordRoot };

    // Chord rhythm patterns - how many chord hits per bar
    // Based on energy: low = 1-2 hits, high = 3-4 hits
    const hitsPerBar = params.energy < 0.3 ? 1 : params.energy < 0.6 ? 2 : params.energy < 0.8 ? 3 : 4;

    // Step positions for chord hits (grouped consecutive steps for polyphony)
    const hitPatterns: { [key: number]: number[][] } = {
      1: [[0, 1, 2, 3]],  // One sustained chord
      2: [[0, 1, 2], [8, 9, 10]],  // Two chords per bar
      3: [[0, 1, 2], [5, 6, 7], [10, 11, 12]],  // Three
      4: [[0, 1, 2], [4, 5, 6], [8, 9, 10], [12, 13, 14]],  // Four (quarter notes)
    };

    const hitPattern = hitPatterns[hitsPerBar];

    // Generate chords for each bar
    for (let bar = 0; bar < bars; bar++) {
      const chordIndex = bar % progression.length;
      const rootDegree = progression[chordIndex];

      // Find root position in chord range
      const rootPosition = ((rootDegree - 1) % this.scaleLength);

      // Build triad: root (0), 3rd (+2), 5th (+4)
      // Add 7th (+6) for complexity
      const intervals = params.complexity > 0.6 ? [0, 2, 4, 6] : [0, 2, 4];

      // Place chord tones on consecutive steps (creates polyphonic sound with sustain)
      for (let hitIdx = 0; hitIdx < hitPattern.length; hitIdx++) {
        const stepPositions = hitPattern[hitIdx];
        const chordForThisHit = hitIdx % progression.length;
        const hitRootDegree = progression[(bar + Math.floor(hitIdx / 2)) % progression.length];

        // Record for melody awareness
        const globalHitStart = bar * 16 + stepPositions[0];
        stepToChordRoot.set(globalHitStart, hitRootDegree);

        // Place each chord tone on consecutive steps
        for (let i = 0; i < Math.min(stepPositions.length, intervals.length); i++) {
          const globalStep = bar * 16 + stepPositions[i];
          if (globalStep >= 256) continue;

          // Find the note for this chord tone
          const targetDegree = ((hitRootDegree - 1 + intervals[i]) % this.scaleLength);
          let noteIndex = -1;

          // Search for this degree in chord range
          for (let j = 0; j < chordRange.length; j++) {
            if (j % this.scaleLength === targetDegree) {
              noteIndex = j;
              break;
            }
          }

          if (noteIndex >= 0 && noteIndex < chordRange.length) {
            steps[globalStep] = {
              active: true,
              note: chordRange[noteIndex],
            };
          }
        }
      }
    }

    return { stepToChordRoot };
  }

  /**
   * Generate melody that complements the chords
   * Uses higher register and musical patterns (not random)
   */
  private generateMelodyOverChords(
    steps: Step[],
    bars: number,
    params: MelodyParams,
    chordInfo: { stepToChordRoot: Map<number, number> }
  ): void {
    // Find notes in higher register for melody
    const rangeStart = Math.floor(this.scaleNotes.length * 0.5);
    const rangeEnd = Math.min(this.scaleNotes.length - 1, Math.floor(this.scaleNotes.length * 0.85));
    const melodyNotes = this.scaleNotes.slice(rangeStart, rangeEnd + 1);

    if (melodyNotes.length < 4) return;

    // Melody rhythm patterns based on energy (complementing the chords)
    const melodyRhythms: { [key: string]: number[] } = {
      sparse: [2, 6, 10, 14],           // Off-beat, breathing room
      low: [2, 4, 10, 12],              // Gentle syncopation
      medium: [0, 2, 4, 8, 10, 12],     // Steady eighth feel
      high: [0, 2, 3, 6, 8, 10, 11, 14], // Busier with syncopation
    };

    let rhythmKey: string;
    if (params.energy < 0.3) rhythmKey = 'sparse';
    else if (params.energy < 0.5) rhythmKey = 'low';
    else if (params.energy < 0.75) rhythmKey = 'medium';
    else rhythmKey = 'high';

    const rhythm = melodyRhythms[rhythmKey];

    // Generate melodic sequence using contour
    const contourFn = CONTOUR_SHAPES[params.contour] || CONTOUR_SHAPES.arch;

    // Create the melodic sequence for one phrase, then repeat with variation
    const phraseSteps = params.phraseLength * 16;
    const notesPerPhrase = rhythm.length * params.phraseLength;

    for (let bar = 0; bar < bars; bar++) {
      const phrasePosition = (bar % params.phraseLength) / params.phraseLength;

      for (const rhythmStep of rhythm) {
        const globalStep = bar * 16 + rhythmStep;
        if (globalStep >= 256) continue;

        // Skip if chord is already there
        if (steps[globalStep].active) continue;

        // Get contour position for this step
        const stepInPhrase = (bar % params.phraseLength) * 16 + rhythmStep;
        const contourPos = stepInPhrase / phraseSteps;
        const contourValue = contourFn(contourPos);

        // Map contour to note index
        let noteIndex = Math.floor(contourValue * (melodyNotes.length - 1));

        // Add some variation based on complexity
        if (params.complexity > 0.3) {
          const variation = Math.floor((Math.random() - 0.5) * params.complexity * 3);
          noteIndex = Math.max(0, Math.min(melodyNotes.length - 1, noteIndex + variation));
        }

        // On strong beats, favor chord tones
        const beatStrength = this.getBeatStrength(rhythmStep);
        if (beatStrength > 0.6 && params.tension < 0.7) {
          const currentChord = this.findNearestChordRoot(globalStep, chordInfo.stepToChordRoot);
          if (currentChord !== null) {
            noteIndex = this.snapToChordTone(noteIndex, currentChord, melodyNotes.length);
          }
        }

        steps[globalStep] = {
          active: true,
          note: melodyNotes[noteIndex],
        };
      }
    }
  }

  /**
   * Snap a note index to the nearest chord tone
   */
  private snapToChordTone(noteIndex: number, chordRoot: number, rangeSize: number): number {
    const rootDegree = ((chordRoot - 1) % this.scaleLength);
    const chordDegrees = [rootDegree, (rootDegree + 2) % this.scaleLength, (rootDegree + 4) % this.scaleLength];

    // Find nearest chord tone
    let bestIndex = noteIndex;
    let bestDistance = Infinity;

    for (let i = Math.max(0, noteIndex - 3); i <= Math.min(rangeSize - 1, noteIndex + 3); i++) {
      const degree = i % this.scaleLength;
      if (chordDegrees.includes(degree)) {
        const distance = Math.abs(i - noteIndex);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
    }

    return bestIndex;
  }

  /**
   * Find a note index that corresponds to a specific scale degree
   */
  private findNoteByDegree(notes: string[], degree: number): number {
    // Degree is 1-indexed, convert to 0-indexed position in scale
    const targetDegree = ((degree - 1) % this.scaleLength + this.scaleLength) % this.scaleLength;

    for (let i = 0; i < notes.length; i++) {
      const noteDegree = i % this.scaleLength;
      if (noteDegree === targetDegree) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Find the nearest chord root for a given step
   */
  private findNearestChordRoot(
    step: number,
    stepToChordRoot: Map<number, number>
  ): number | null {
    // Look backwards to find the most recent chord
    for (let i = step; i >= Math.max(0, step - 16); i--) {
      if (stepToChordRoot.has(i)) {
        return stepToChordRoot.get(i)!;
      }
    }
    return null;
  }

  /**
   * Find a chord tone within the melody range
   */
  private findChordToneInRange(
    chordRoot: number,
    currentIndex: number,
    rangeSize: number
  ): number {
    // Chord tones are root (0), 3rd (+2), 5th (+4) in scale steps
    const chordOffsets = [0, 2, 4];
    const rootPosition = ((chordRoot - 1) % this.scaleLength);

    // Find nearest chord tone to current position
    let bestIndex = currentIndex;
    let bestDistance = Infinity;

    for (const offset of chordOffsets) {
      const targetDegree = (rootPosition + offset) % this.scaleLength;
      // Find this degree near the current index
      for (let i = Math.max(0, currentIndex - 4); i < Math.min(rangeSize, currentIndex + 4); i++) {
        if (i % this.scaleLength === targetDegree) {
          const distance = Math.abs(i - currentIndex);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
          }
        }
      }
    }

    return bestIndex;
  }

  // ==========================================================================
  // MOTIF GENERATION
  // ==========================================================================

  /**
   * Generate the seed motif - a small musical idea that gets developed
   */
  private generateMotif(params: MelodyParams): Motif {
    // Motif length based on complexity (2-5 notes)
    const length = 2 + Math.floor(params.complexity * 3);

    // Generate intervals based on tension
    const intervals: number[] = [0]; // Start on "home"

    for (let i = 1; i < length; i++) {
      const maxInterval = params.tension < 0.5 ? 2 : 4; // Larger intervals = more tension
      const interval = this.weightedRandomInt(-maxInterval, maxInterval, params.tension);
      intervals.push(intervals[i - 1] + interval);
    }

    // Generate rhythm based on energy
    const rhythmLength = Math.min(length * 2, 8);
    const rhythm = this.generateMotifRhythm(rhythmLength, params.energy);

    return { intervals, rhythm };
  }

  /**
   * Generate rhythm pattern for a motif
   */
  private generateMotifRhythm(length: number, energy: number): boolean[] {
    const rhythm: boolean[] = [];

    for (let i = 0; i < length; i++) {
      if (i === 0) {
        // First beat usually has a note
        rhythm.push(true);
      } else {
        // Probability of note increases with energy
        const prob = 0.3 + energy * 0.5;
        rhythm.push(Math.random() < prob);
      }
    }

    // Ensure at least 2 notes
    const noteCount = rhythm.filter(r => r).length;
    if (noteCount < 2) {
      rhythm[Math.floor(length / 2)] = true;
    }

    return rhythm;
  }

  // ==========================================================================
  // PHRASE GENERATION
  // ==========================================================================

  /**
   * Generate a single musical phrase
   */
  private generatePhrase(
    steps: Step[],
    start: number,
    end: number,
    motif: Motif,
    params: MelodyParams,
    phraseIndex: number,
    isLastPhrase: boolean
  ): void {
    const phraseLength = end - start;

    // Get the contour shape for this phrase
    const contourFn = CONTOUR_SHAPES[params.contour] || CONTOUR_SHAPES.arch;

    // Determine the note range to use
    const rangeCenter = Math.floor(this.scaleNotes.length / 2);
    const rangeSize = Math.floor(this.scaleNotes.length * 0.6);

    // Get rhythm template based on energy
    const rhythmTemplate = this.selectRhythmTemplate(params.energy, phraseLength);

    // Develop the motif across the phrase
    let currentNoteIndex = rangeCenter;
    let motifPosition = 0;

    for (let i = 0; i < phraseLength && (start + i) < steps.length; i++) {
      const stepIndex = start + i;
      const phrasePosition = i / phraseLength;
      const beatPosition = i % 16;

      // Get the target contour height at this position
      const contourHeight = contourFn(phrasePosition);

      // Determine if this step should have a note (from rhythm template)
      const hasNote = rhythmTemplate[i % rhythmTemplate.length];

      if (hasNote) {
        // Calculate context
        const context: MelodicContext = {
          beatStrength: this.getBeatStrength(beatPosition),
          phrasePosition,
          targetTension: this.calculateTargetTension(phrasePosition, params.tension),
        };

        // Get the note based on motif, contour, and music theory
        const noteIndex = this.calculateNoteIndex(
          currentNoteIndex,
          motif,
          motifPosition,
          contourHeight,
          rangeCenter,
          rangeSize,
          context,
          params
        );

        // Resolve phrase ending if needed
        const finalNoteIndex = this.maybeResolvePhraseEnding(
          noteIndex,
          phrasePosition,
          isLastPhrase,
          params
        );

        // Clamp to valid range
        const clampedIndex = Math.max(0, Math.min(this.scaleNotes.length - 1, finalNoteIndex));

        steps[stepIndex] = {
          active: true,
          note: this.scaleNotes[clampedIndex],
        };

        currentNoteIndex = clampedIndex;
        motifPosition++;
      }
    }
  }

  /**
   * Calculate the note index based on all musical factors
   */
  private calculateNoteIndex(
    currentIndex: number,
    motif: Motif,
    motifPosition: number,
    contourHeight: number,
    rangeCenter: number,
    rangeSize: number,
    context: MelodicContext,
    params: MelodyParams
  ): number {
    // Base: follow the motif pattern
    const motifInterval = motif.intervals[motifPosition % motif.intervals.length];
    let targetIndex = currentIndex + motifInterval;

    // Apply contour influence (stronger in middle of phrase)
    const contourInfluence = Math.sin(context.phrasePosition * Math.PI) * 0.5;
    const contourTarget = rangeCenter - rangeSize/2 + contourHeight * rangeSize;
    targetIndex = Math.round(
      targetIndex * (1 - contourInfluence) + contourTarget * contourInfluence
    );

    // Apply music theory rules on strong beats
    if (context.beatStrength > 0.5) {
      targetIndex = this.favorChordTones(targetIndex, params.tension);
    }

    // Add complexity-based variation
    if (params.complexity > 0.5 && Math.random() < params.complexity * 0.3) {
      const variation = this.weightedRandomInt(-2, 2, params.tension);
      targetIndex += variation;
    }

    return targetIndex;
  }

  /**
   * Determine if and how to resolve the phrase ending
   */
  private maybeResolvePhraseEnding(
    noteIndex: number,
    phrasePosition: number,
    isLastPhrase: boolean,
    params: MelodyParams
  ): number {
    // Only affect the last ~10% of the phrase
    if (phrasePosition < 0.9) return noteIndex;

    // Resolution strength based on tension (lower tension = stronger resolution)
    const resolutionStrength = 1 - params.tension;

    if (Math.random() > resolutionStrength) return noteIndex;

    // Find the nearest chord tone
    const scaleDegree = this.getScaleDegree(noteIndex);
    const degreeInfo = SCALE_DEGREE_INFO[scaleDegree];

    if (degreeInfo?.tendency) {
      // Resolve tendency tones
      const resolution = this.findNearestDegree(noteIndex, degreeInfo.tendency.target);

      // Interpolate based on how close to phrase end
      const endProximity = (phrasePosition - 0.9) / 0.1;
      return Math.round(noteIndex + (resolution - noteIndex) * endProximity);
    }

    // If last phrase, pull toward tonic
    if (isLastPhrase && phrasePosition > 0.95) {
      return this.findNearestDegree(noteIndex, 1);
    }

    return noteIndex;
  }

  // ==========================================================================
  // MUSIC THEORY HELPERS
  // ==========================================================================

  /**
   * Detect the scale length from the notes (pentatonic = 5, diatonic = 7, etc.)
   */
  private detectScaleLength(scaleNotes: string[]): number {
    // Count unique pitch classes
    const pitchClasses = new Set<string>();
    scaleNotes.forEach(note => {
      const pitchClass = note.replace(/\d+$/, '');
      pitchClasses.add(pitchClass);
    });
    return pitchClasses.size;
  }

  /**
   * Get the scale degree (1-7) for a note index
   */
  private getScaleDegree(noteIndex: number): number {
    // Map to 1-7 based on position in scale
    return ((noteIndex % this.scaleLength) + this.scaleLength) % this.scaleLength + 1;
  }

  /**
   * Adjust note index to favor chord tones (1, 3, 5)
   */
  private favorChordTones(noteIndex: number, tension: number): number {
    const degree = this.getScaleDegree(noteIndex);
    const degreeInfo = SCALE_DEGREE_INFO[degree];

    // If already a chord tone, keep it
    if (degreeInfo?.isChordTone) return noteIndex;

    // Probability of adjusting based on inverse tension
    if (Math.random() < tension) return noteIndex;

    // Move to nearest chord tone
    const upDegree = this.getScaleDegree(noteIndex + 1);
    const downDegree = this.getScaleDegree(noteIndex - 1);

    const upIsChord = SCALE_DEGREE_INFO[upDegree]?.isChordTone;
    const downIsChord = SCALE_DEGREE_INFO[downDegree]?.isChordTone;

    if (upIsChord && !downIsChord) return noteIndex + 1;
    if (downIsChord && !upIsChord) return noteIndex - 1;
    if (upIsChord && downIsChord) return noteIndex + (Math.random() < 0.5 ? 1 : -1);

    return noteIndex;
  }

  /**
   * Find the nearest note that is a specific scale degree
   */
  private findNearestDegree(noteIndex: number, targetDegree: number): number {
    // Search up and down for the target degree
    for (let offset = 0; offset <= this.scaleLength; offset++) {
      if (this.getScaleDegree(noteIndex + offset) === targetDegree) {
        return noteIndex + offset;
      }
      if (this.getScaleDegree(noteIndex - offset) === targetDegree) {
        return noteIndex - offset;
      }
    }
    return noteIndex;
  }

  /**
   * Get beat strength (1.0 for downbeat, decreasing for weaker beats)
   */
  private getBeatStrength(beatPosition: number): number {
    // In 4/4 time with 16th notes:
    // Beat 1 (step 0) = strongest
    // Beat 3 (step 8) = strong
    // Beats 2,4 (steps 4, 12) = medium
    // Other quarter note positions = weak
    // 16th positions = weakest

    if (beatPosition === 0) return 1.0;
    if (beatPosition === 8) return 0.9;
    if (beatPosition === 4 || beatPosition === 12) return 0.7;
    if (beatPosition % 4 === 0) return 0.5;
    if (beatPosition % 2 === 0) return 0.3;
    return 0.1;
  }

  /**
   * Calculate the target tension at a given phrase position
   */
  private calculateTargetTension(phrasePosition: number, baseTension: number): number {
    // Tension tends to build toward 2/3 of the phrase, then release
    const naturalTensionCurve = Math.sin(phrasePosition * Math.PI * 0.75);
    return baseTension * 0.5 + naturalTensionCurve * 0.5;
  }

  // ==========================================================================
  // RHYTHM HELPERS
  // ==========================================================================

  /**
   * Select a rhythm template based on energy level
   */
  private selectRhythmTemplate(energy: number, phraseLength: number): number[] {
    // Determine energy category
    let category: keyof typeof RHYTHM_TEMPLATES;
    if (energy < 0.15) category = 'sparse';
    else if (energy < 0.35) category = 'low';
    else if (energy < 0.6) category = 'medium';
    else if (energy < 0.85) category = 'high';
    else category = 'dense';

    // Pick a random template from the category
    const templates = RHYTHM_TEMPLATES[category];
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Extend to phrase length
    const extended: number[] = [];
    for (let i = 0; i < phraseLength; i++) {
      extended.push(template[i % template.length]);
    }

    return extended;
  }

  // ==========================================================================
  // UTILITY HELPERS
  // ==========================================================================

  /**
   * Generate a weighted random integer (higher weight = bias toward extremes)
   */
  private weightedRandomInt(min: number, max: number, weight: number): number {
    const range = max - min;
    const center = (max + min) / 2;

    // Higher weight = more likely to be at extremes
    const random = Math.random();
    const biased = weight > 0.5
      ? (random < 0.5 ? Math.pow(random * 2, 2 - weight) / 2 : 1 - Math.pow((1 - random) * 2, 2 - weight) / 2)
      : Math.pow(random, 1 + weight);

    return Math.round(min + biased * range);
  }
}

// ============================================================================
// DEFAULT PARAMETERS
// ============================================================================

export const DEFAULT_MELODY_PARAMS: MelodyParams = {
  energy: 0.5,
  complexity: 0.4,
  tension: 0.3,
  contour: 'arch',
  phraseLength: 4,
  mode: 'both',
  genre: 'electronic',
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new melody generator instance
 */
export function createMelodyGenerator(): MelodyGenerator {
  return new MelodyGenerator();
}
