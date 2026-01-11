// Default parameter values for each instrument type
// These are the "factory preset" values that can be restored with the reset button

export interface InstrumentParams {
  volume: number;
  pan: number;
  tune: number;
  decay: number;
  attack: number;
  tone: number;
  snap: number;
  filterCutoff: number;
  filterResonance: number;
  drive: number;
}

export const INSTRUMENT_DEFAULTS: Record<string, InstrumentParams> = {
  'kick': {
    volume: 0.8,
    pan: 0,
    tune: 0,
    decay: 0.4,
    attack: 0.001,
    tone: 0.5,
    snap: 0.3,
    filterCutoff: 0.8,
    filterResonance: 0.2,
    drive: 0,
  },
  'snare': {
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
  'hihat-closed': {
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
  'hihat-open': {
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
  'clap': {
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
  'tom-low': {
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
  'tom-mid': {
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
  'tom-high': {
    volume: 0.7,
    pan: 0.3,
    tune: 0,
    decay: 0.2,
    attack: 0.001,
    tone: 0.5,
    snap: 0.2,
    filterCutoff: 0.8,
    filterResonance: 0.15,
    drive: 0,
  },
  'rimshot': {
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
};

// Parameters that are safe to randomize (excludes volume and pan for user control)
export const RANDOMIZABLE_PARAMS = ['tune', 'decay', 'attack', 'tone', 'snap', 'filterCutoff', 'filterResonance', 'drive'] as const;

// Generate random values within musically useful ranges for each parameter
export function generateRandomParams(): Partial<InstrumentParams> {
  return {
    tune: (Math.random() * 2 - 1) * 0.5, // -0.5 to 0.5 (moderate pitch variation)
    decay: 0.05 + Math.random() * 0.6, // 0.05 to 0.65
    attack: Math.random() * 0.1, // 0 to 0.1
    tone: Math.random(), // 0 to 1
    snap: Math.random() * 0.7, // 0 to 0.7
    filterCutoff: 0.3 + Math.random() * 0.7, // 0.3 to 1
    filterResonance: Math.random() * 0.5, // 0 to 0.5
    drive: Math.random() * 0.5, // 0 to 0.5
  };
}
