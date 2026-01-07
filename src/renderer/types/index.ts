export interface DrumTrack {
  id: string;
  name: string;
  type: 'analog' | 'fm' | 'pcm' | 'sample';
  soundEngine: string;
  steps: boolean[];
  velocity: number[];
  muted: boolean;
  solo: boolean;
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
  layer2?: DrumTrack;
}

export interface DrumSynthParams {
  pitch: number;
  decay: number;
  tone: number;
  snap: number;
  distortion: number;
}

export interface Pattern {
  id: string;
  name: string;
  tracks: DrumTrack[];
  tempo: number;
  steps: number;
}

export interface SynthEngine {
  type: 'kick' | 'snare' | 'hihat' | 'clap' | 'tom' | 'cymbal' | 'fm' | 'pcm';
  params: Partial<DrumSynthParams>;
}

export type StepMode = 'live' | 'pattern';
