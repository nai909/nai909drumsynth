/**
 * Simple Progression Generator
 *
 * Click a button, get a melody from the MIDI library. That's it.
 */

import { MIDI_PATTERNS } from './midiPatterns';

export interface Step {
  active: boolean;
  note: string;
}

/**
 * Pick a random item from an array
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class MelodyGenerator {
  /**
   * Generate a melody by picking a random MIDI pattern.
   * Ignores scaleNotes - patterns are pre-composed in their original keys.
   */
  generate(_scaleNotes: string[], bars: number = 4): Step[] {
    // Initialize empty steps
    const steps: Step[] = Array.from({ length: 256 }, () => ({ active: false, note: 'C4' }));

    if (MIDI_PATTERNS.length === 0) return steps;

    // Pick a random pattern
    const pattern = pick(MIDI_PATTERNS);

    // Copy pattern steps (up to bars * 16 steps)
    const maxSteps = Math.min(bars * 16, pattern.steps.length, 256);
    for (let i = 0; i < maxSteps; i++) {
      steps[i] = { ...pattern.steps[i] };
    }

    return steps;
  }
}

export function createMelodyGenerator(): MelodyGenerator {
  return new MelodyGenerator();
}
