import * as Tone from 'tone';

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random';

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
  arpMode: ArpMode;
  arpRate: number; // 0-1, maps to different speeds
  mono: boolean; // true = monophonic, false = polyphonic
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
  arpMode: 'off',
  arpRate: 0.5,
  mono: false,
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

  // Arpeggiator state
  private heldNotes: string[] = [];
  private arpInterval: number | null = null;
  private arpIndex: number = 0;
  private arpDirection: 1 | -1 = 1;
  private currentArpNote: string | null = null;

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

    // Handle arpeggiator changes
    if (params.arpMode !== undefined) {
      if (params.arpMode === 'off') {
        this.stopArpeggiator();
      } else if (this.heldNotes.length > 0) {
        this.startArpeggiator();
      }
    }

    if (params.arpRate !== undefined && this.params.arpMode !== 'off' && this.heldNotes.length > 0) {
      // Restart with new rate
      this.startArpeggiator();
    }
  }

  // Convert note to MIDI number for sorting
  private noteToMidi(note: string): number {
    const noteMap: { [key: string]: number } = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
    };
    const match = note.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 0;
    const [, noteName, octave] = match;
    return noteMap[noteName] + (parseInt(octave) + 1) * 12;
  }

  private getArpRateMs(): number {
    // Map 0-1 to 400ms - 50ms (slow to fast)
    return 400 - (this.params.arpRate * 350);
  }

  private startArpeggiator() {
    this.stopArpeggiator();
    if (this.heldNotes.length === 0 || this.params.arpMode === 'off') return;

    // Sort notes by pitch
    const sortedNotes = [...this.heldNotes].sort((a, b) => this.noteToMidi(a) - this.noteToMidi(b));
    this.arpIndex = 0;
    this.arpDirection = 1;

    const playNextNote = () => {
      if (sortedNotes.length === 0 || !this.synth) return;

      // Release previous arp note
      if (this.currentArpNote) {
        this.synth.triggerRelease(this.currentArpNote, Tone.now());
      }

      let noteIndex: number;
      switch (this.params.arpMode) {
        case 'up':
          noteIndex = this.arpIndex % sortedNotes.length;
          this.arpIndex++;
          break;
        case 'down':
          noteIndex = (sortedNotes.length - 1) - (this.arpIndex % sortedNotes.length);
          this.arpIndex++;
          break;
        case 'updown':
          noteIndex = this.arpIndex;
          this.arpIndex += this.arpDirection;
          if (this.arpIndex >= sortedNotes.length - 1) {
            this.arpDirection = -1;
            this.arpIndex = sortedNotes.length - 1;
          } else if (this.arpIndex <= 0) {
            this.arpDirection = 1;
            this.arpIndex = 0;
          }
          break;
        case 'random':
          noteIndex = Math.floor(Math.random() * sortedNotes.length);
          break;
        default:
          return;
      }

      const note = sortedNotes[noteIndex];
      this.currentArpNote = note;
      this.synth.triggerAttack(note, Tone.now(), 0.8);
      this.filterEnv.triggerAttack(Tone.now());
    };

    // Play first note immediately
    playNextNote();

    // Continue arpeggiating
    this.arpInterval = window.setInterval(playNextNote, this.getArpRateMs());
  }

  private stopArpeggiator() {
    if (this.arpInterval !== null) {
      clearInterval(this.arpInterval);
      this.arpInterval = null;
    }
    if (this.currentArpNote && this.synth) {
      this.synth.triggerRelease(this.currentArpNote, Tone.now());
      this.currentArpNote = null;
    }
    this.arpIndex = 0;
    this.arpDirection = 1;
  }

  private restartArpIfNeeded() {
    if (this.params.arpMode !== 'off' && this.heldNotes.length > 0) {
      this.startArpeggiator();
    }
  }

  async noteOn(note: string, velocity: number = 0.8) {
    await this.init();
    if (!this.synth) return;

    // Add to held notes for arpeggiator
    if (!this.heldNotes.includes(note)) {
      this.heldNotes.push(note);
    }

    if (this.params.arpMode === 'off') {
      // Mono mode - release all other notes first
      if (this.params.mono && this.activeNotes.size > 0) {
        this.activeNotes.forEach(activeNote => {
          if (activeNote !== note) {
            this.synth!.triggerRelease(activeNote, Tone.now());
          }
        });
        this.activeNotes.clear();
      }

      // Normal mode - play note directly
      this.activeNotes.add(note);
      this.synth.triggerAttack(note, Tone.now(), velocity);
      this.filterEnv.triggerAttack(Tone.now());
    } else {
      // Arp mode - restart arpeggiator with new notes
      this.restartArpIfNeeded();
    }
  }

  noteOff(note: string) {
    if (!this.synth) return;

    // Remove from held notes
    this.heldNotes = this.heldNotes.filter(n => n !== note);

    if (this.params.arpMode === 'off') {
      // Normal mode
      this.activeNotes.delete(note);
      this.synth.triggerRelease(note, Tone.now());

      if (this.activeNotes.size === 0) {
        this.filterEnv.triggerRelease(Tone.now());
      }
    } else {
      // Arp mode
      if (this.heldNotes.length === 0) {
        this.stopArpeggiator();
        this.filterEnv.triggerRelease(Tone.now());
      } else {
        this.restartArpIfNeeded();
      }
    }
  }

  releaseAll() {
    if (!this.synth) return;
    this.stopArpeggiator();
    this.synth.releaseAll();
    this.filterEnv.triggerRelease();
    this.activeNotes.clear();
    this.heldNotes = [];
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
