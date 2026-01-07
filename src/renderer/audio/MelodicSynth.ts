import * as Tone from 'tone';

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface SynthParams {
  waveform: WaveformType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterCutoff: number;
  filterResonance: number;
  filterEnvAmount: number;
  detune: number;
  volume: number;
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  waveform: 'sawtooth',
  attack: 0.01,
  decay: 0.2,
  sustain: 0.5,
  release: 0.3,
  filterCutoff: 0.7,
  filterResonance: 0.3,
  filterEnvAmount: 0.5,
  detune: 0,
  volume: 0.7,
};

export class MelodicSynth {
  private synth: Tone.PolySynth | null = null;
  private filter: Tone.Filter;
  private filterEnv: Tone.FrequencyEnvelope;
  private gain: Tone.Gain;
  private masterGain: Tone.Gain;
  private params: SynthParams;
  private initialized: boolean = false;
  private activeNotes: Set<string> = new Set();

  constructor() {
    this.params = { ...DEFAULT_SYNTH_PARAMS };
    this.masterGain = new Tone.Gain(0.8).toDestination();
    this.gain = new Tone.Gain(this.params.volume);

    this.filter = new Tone.Filter({
      frequency: this.getFilterFreq(),
      type: 'lowpass',
      Q: this.params.filterResonance * 15,
    });

    this.filterEnv = new Tone.FrequencyEnvelope({
      attack: this.params.attack,
      decay: this.params.decay,
      sustain: this.params.sustain,
      release: this.params.release,
      baseFrequency: this.getFilterFreq(),
      octaves: this.params.filterEnvAmount * 4,
    });

    this.filterEnv.connect(this.filter.frequency);
    this.gain.chain(this.filter, this.masterGain);
  }

  private getFilterFreq(): number {
    return Math.pow(this.params.filterCutoff, 2) * 18000 + 100;
  }

  async init() {
    try {
      await Tone.start();

      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
      }

      if (!this.initialized) {
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: this.params.waveform,
          },
          envelope: {
            attack: this.params.attack,
            decay: this.params.decay,
            sustain: this.params.sustain,
            release: this.params.release,
          },
        });

        this.synth.set({ detune: this.params.detune * 100 });
        this.synth.connect(this.gain);
        this.initialized = true;
        console.log('Melodic synth initialized');
      }
    } catch (error) {
      console.error('Failed to initialize melodic synth:', error);
    }
  }

  updateParams(params: Partial<SynthParams>) {
    this.params = { ...this.params, ...params };

    if (this.synth) {
      if (params.waveform !== undefined) {
        this.synth.set({
          oscillator: { type: params.waveform },
        });
      }

      if (params.attack !== undefined || params.decay !== undefined ||
          params.sustain !== undefined || params.release !== undefined) {
        this.synth.set({
          envelope: {
            attack: this.params.attack,
            decay: this.params.decay,
            sustain: this.params.sustain,
            release: this.params.release,
          },
        });

        this.filterEnv.set({
          attack: this.params.attack,
          decay: this.params.decay,
          sustain: this.params.sustain,
          release: this.params.release,
        });
      }

      if (params.detune !== undefined) {
        this.synth.set({ detune: params.detune * 100 });
      }
    }

    if (params.filterCutoff !== undefined) {
      this.filter.frequency.value = this.getFilterFreq();
      this.filterEnv.baseFrequency = this.getFilterFreq();
    }

    if (params.filterResonance !== undefined) {
      this.filter.Q.value = params.filterResonance * 15;
    }

    if (params.filterEnvAmount !== undefined) {
      this.filterEnv.octaves = params.filterEnvAmount * 4;
    }

    if (params.volume !== undefined) {
      this.gain.gain.value = params.volume;
    }
  }

  async noteOn(note: string, velocity: number = 0.8) {
    await this.init();
    if (!this.synth) return;

    this.activeNotes.add(note);
    this.synth.triggerAttack(note, Tone.now(), velocity);
    this.filterEnv.triggerAttack(Tone.now());
  }

  noteOff(note: string) {
    if (!this.synth) return;

    this.activeNotes.delete(note);
    this.synth.triggerRelease(note, Tone.now());

    if (this.activeNotes.size === 0) {
      this.filterEnv.triggerRelease(Tone.now());
    }
  }

  releaseAll() {
    if (!this.synth) return;
    this.synth.releaseAll();
    this.filterEnv.triggerRelease();
    this.activeNotes.clear();
  }

  getParams(): SynthParams {
    return { ...this.params };
  }

  dispose() {
    this.synth?.dispose();
    this.filter.dispose();
    this.filterEnv.dispose();
    this.gain.dispose();
    this.masterGain.dispose();
  }
}
