import * as Tone from 'tone';

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type ArpMode = 'off' | 'up' | 'down' | 'updown' | 'random';
export type LfoDestination = 'filter' | 'pitch' | 'volume';

// Recorded note event
export interface RecordedNote {
  note: string;
  velocity: number;
  startTime: number; // Position in bars (0-8)
  duration: number;  // Duration in bars
}

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
  pan: number; // -1 (left) to 1 (right)
  arpMode: ArpMode;
  arpRate: number; // 0-1, maps to different speeds
  mono: boolean; // true = monophonic, false = polyphonic
  // Effects
  reverbMix: number; // 0-1 wet/dry mix
  reverbDecay: number; // 0-1 maps to 0.1-10 seconds
  delayMix: number; // 0-1 wet/dry mix
  delayTime: number; // 0-1 maps to 0.05-1 seconds
  delayFeedback: number; // 0-1
  // LFO for wobble
  lfoRate: number; // 0-1 maps to 0.1-20 Hz
  lfoDepth: number; // 0-1 amount of modulation
  lfoEnabled: boolean;
  lfoDestination: LfoDestination;
  // Phaser
  phaserMix: number; // 0-1 wet/dry
  phaserFreq: number; // 0-1 maps to 0.1-8 Hz
  phaserDepth: number; // 0-1 octaves
  // Flanger
  flangerMix: number; // 0-1 wet/dry
  flangerDepth: number; // 0-1
  flangerFreq: number; // 0-1 maps to 0.1-5 Hz
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
  waveform: 'triangle',
  attack: 0.01,
  decay: 0.2,
  sustain: 0.5,
  release: 0.3,
  filterCutoff: 0.7,
  filterResonance: 0.3,
  filterEnvAmount: 0.5,
  detune: 0,
  volume: 0.7,
  pan: 0,
  arpMode: 'off',
  arpRate: 0.5,
  mono: false,
  // Effects defaults
  reverbMix: 0.5,
  reverbDecay: 0.5,
  delayMix: 0,
  delayTime: 0.3,
  delayFeedback: 0.3,
  // LFO defaults
  lfoRate: 0.3,
  lfoDepth: 0,
  lfoEnabled: false,
  lfoDestination: 'filter',
  // Phaser defaults
  phaserMix: 0,
  phaserFreq: 0.3,
  phaserDepth: 0.5,
  // Flanger defaults
  flangerMix: 0,
  flangerDepth: 0.5,
  flangerFreq: 0.3,
};

export class MelodicSynth {
  private synth: Tone.PolySynth | null = null;
  private filter: Tone.Filter;
  private filterEnv: Tone.FrequencyEnvelope;
  private gain: Tone.Gain;
  private masterGain: Tone.Gain;
  private limiter: Tone.Limiter;
  private analyser: Tone.Analyser;
  private params: SynthParams;
  private initialized: boolean = false;
  private activeNotes: Set<string> = new Set();

  // Effects
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private lfo: Tone.LFO;
  private lfoGain: Tone.Gain; // Scales LFO output for filter modulation
  private dryGain: Tone.Gain;
  private reverbWet: Tone.Gain;
  private delayWet: Tone.Gain;
  private panner: Tone.Panner;
  private phaser: Tone.Phaser;
  private phaserWet: Tone.Gain;
  private flanger: Tone.FeedbackDelay;
  private flangerLfo: Tone.LFO;
  private flangerWet: Tone.Gain;

  // Arpeggiator state
  private heldNotes: string[] = [];
  private arpLoop: Tone.Loop | null = null; // Use Tone.Loop for audio-accurate timing
  private arpIndex: number = 0;
  private arpDirection: 1 | -1 = 1;
  private currentArpNote: string | null = null;
  private arpSortedNotes: string[] = []; // Cache sorted notes for arp callback

  // Recording state - simplified
  private _isRecording: boolean = false;
  private _isPlayingLoop: boolean = false;
  private _recordedNotes: RecordedNote[] = [];
  private _recordStartTime: number = 0;
  private _loopBars: number = 4;
  private _tempo: number = 120;
  private _noteStartTimes: Map<string, number> = new Map();
  private _playbackTimeouts: number[] = [];
  private _playbackPart: Tone.Part | null = null; // Tone.js Part for audio-accurate playback
  private _recordTimeout: number | null = null;
  private _onRecordDone: (() => void) | null = null;

  // Disposed flag to prevent operations after disposal
  private _disposed: boolean = false;

  constructor() {
    this.params = { ...DEFAULT_SYNTH_PARAMS };
    // Limiter to prevent clipping
    this.limiter = new Tone.Limiter(-1);
    this.limiter.toDestination();
    this.masterGain = new Tone.Gain(0.8);
    this.masterGain.connect(this.limiter);
    this.gain = new Tone.Gain(this.params.volume);
    this.analyser = new Tone.Analyser('waveform', 256);

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

    // Create effects
    this.reverb = new Tone.Reverb({
      decay: this.getReverbDecay(),
      wet: 1, // We control wet/dry with separate gains
    });

    this.delay = new Tone.FeedbackDelay({
      delayTime: this.getDelayTime(),
      feedback: this.params.delayFeedback,
      wet: 1, // We control wet/dry with separate gains
    });

    // LFO for wobble bass - modulates filter cutoff
    this.lfo = new Tone.LFO({
      frequency: this.getLfoRate(),
      min: 0,
      max: 1,
      type: 'sine',
    });

    // LFO gain scales the depth of modulation
    this.lfoGain = new Tone.Gain(0);

    // Phaser effect
    this.phaser = new Tone.Phaser({
      frequency: this.getPhaserFreq(),
      octaves: this.params.phaserDepth * 3,
      baseFrequency: 400,
      wet: 1,
    });
    this.phaserWet = new Tone.Gain(this.params.phaserMix);

    // Flanger effect (using short delay with LFO modulation)
    this.flanger = new Tone.FeedbackDelay({
      delayTime: 0.005,
      feedback: 0.5,
      wet: 1,
    });
    this.flangerLfo = new Tone.LFO({
      frequency: this.getFlangerFreq(),
      min: 0.001,
      max: 0.01,
      type: 'sine',
    });
    this.flangerLfo.connect(this.flanger.delayTime);
    this.flangerLfo.start();
    this.flangerWet = new Tone.Gain(this.params.flangerMix);

    // Wet/dry mixing gains - use defaults so reverb is on from start
    this.dryGain = new Tone.Gain(1 - this.params.reverbMix * 0.5);
    this.reverbWet = new Tone.Gain(this.params.reverbMix);
    this.delayWet = new Tone.Gain(this.params.delayMix);

    // Panner for stereo positioning
    this.panner = new Tone.Panner(this.params.pan);

    // Connect the audio chain
    // synth -> gain -> filter -> dry path + effects -> analyser -> panner -> master
    this.filterEnv.connect(this.filter.frequency);

    // Dry path
    this.gain.connect(this.filter);
    this.filter.connect(this.dryGain);
    this.dryGain.connect(this.analyser);

    // Reverb path
    this.filter.connect(this.reverb);
    this.reverb.connect(this.reverbWet);
    this.reverbWet.connect(this.analyser);

    // Delay path
    this.filter.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.analyser);

    // Phaser path
    this.filter.connect(this.phaser);
    this.phaser.connect(this.phaserWet);
    this.phaserWet.connect(this.analyser);

    // Flanger path
    this.filter.connect(this.flanger);
    this.flanger.connect(this.flangerWet);
    this.flangerWet.connect(this.analyser);

    // Analyser -> Panner -> Master
    this.analyser.connect(this.panner);
    this.panner.connect(this.masterGain);

    // LFO -> lfoGain -> filter frequency (for wobble)
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
  }

  private getFilterFreq(): number {
    return Math.pow(this.params.filterCutoff, 2) * 18000 + 100;
  }

  private getReverbDecay(): number {
    // Map 0-1 to 0.1-10 seconds
    return 0.1 + this.params.reverbDecay * 9.9;
  }

  private getDelayTime(): number {
    // Map 0-1 to 0.05-1 seconds
    return 0.05 + this.params.delayTime * 0.95;
  }

  private getLfoRate(): number {
    // Map 0-1 to 0.1-20 Hz (exponential for better feel)
    return 0.1 * Math.pow(200, this.params.lfoRate);
  }

  private getLfoDepthFreq(): number {
    // LFO modulation depth in Hz - up to 8000 Hz swing for wobble
    return this.params.lfoDepth * 8000;
  }

  private getPhaserFreq(): number {
    // Map 0-1 to 0.1-8 Hz
    return 0.1 + this.params.phaserFreq * 7.9;
  }

  private getFlangerFreq(): number {
    // Map 0-1 to 0.1-5 Hz
    return 0.1 + this.params.flangerFreq * 4.9;
  }

  async init() {
    try {
      await Tone.start();

      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
      }

      if (!this.initialized) {
        // Limit polyphony to prevent CPU overload
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
        this.synth.maxPolyphony = 12; // Max 12 simultaneous voices

        this.synth.set({ detune: this.params.detune * 100 });
        this.synth.connect(this.gain);
        this.initialized = true;
      }
    } catch (error) {
      console.error('Failed to initialize melodic synth:', error);
    }
  }

  updateParams(params: Partial<SynthParams>) {
    if (this._disposed) return;
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

    if (params.pan !== undefined) {
      this.panner.pan.value = params.pan;
    }

    // Handle arpeggiator changes
    if (params.arpMode !== undefined) {
      if (params.arpMode === 'off') {
        this.stopArpeggiator();
        // When switching FROM arp mode, start playing held notes directly
        // (mono mode: only play the last held note)
        if (this.heldNotes.length > 0 && this.synth) {
          const notesToPlay = this.params.mono
            ? [this.heldNotes[this.heldNotes.length - 1]]
            : this.heldNotes;
          notesToPlay.forEach(note => {
            this.activeNotes.add(note);
            this.synth!.triggerAttack(note, Tone.now(), 0.8);
          });
          this.filterEnv.triggerAttack(Tone.now());
        }
      } else if (this.heldNotes.length > 0) {
        // IMPORTANT: When switching TO arp mode, release any directly-played notes
        // Otherwise they'll play continuously while arp also plays them
        if (this.activeNotes.size > 0 && this.synth) {
          this.activeNotes.forEach(note => {
            this.synth!.triggerRelease(note, Tone.now());
          });
          this.activeNotes.clear();
        }
        this.startArpeggiator();
      }
    }

    if (params.arpRate !== undefined && this.params.arpMode !== 'off' && this.heldNotes.length > 0) {
      // Restart with new rate
      this.startArpeggiator();
    }

    // Effect parameters
    if (params.reverbMix !== undefined) {
      // Adjust dry/wet balance
      this.reverbWet.gain.value = params.reverbMix;
      this.dryGain.gain.value = 1 - Math.max(params.reverbMix, this.params.delayMix) * 0.5;
    }

    if (params.reverbDecay !== undefined) {
      this.reverb.decay = this.getReverbDecay();
    }

    if (params.delayMix !== undefined) {
      this.delayWet.gain.value = params.delayMix;
      this.dryGain.gain.value = 1 - Math.max(this.params.reverbMix, params.delayMix) * 0.5;
    }

    if (params.delayTime !== undefined) {
      this.delay.delayTime.value = this.getDelayTime();
    }

    if (params.delayFeedback !== undefined) {
      this.delay.feedback.value = params.delayFeedback;
    }

    // LFO parameters
    if (params.lfoRate !== undefined) {
      this.lfo.frequency.value = this.getLfoRate();
    }

    if (params.lfoDepth !== undefined) {
      this.lfoGain.gain.value = this.getLfoDepthFreq();
    }

    if (params.lfoEnabled !== undefined) {
      if (params.lfoEnabled) {
        this.lfo.start();
        this.lfoGain.gain.value = this.getLfoDepthFreq();
      } else {
        this.lfo.stop();
        this.lfoGain.gain.value = 0;
      }
    }

    // Phaser parameters
    if (params.phaserMix !== undefined) {
      this.phaserWet.gain.value = params.phaserMix;
    }

    if (params.phaserFreq !== undefined) {
      this.phaser.frequency.value = this.getPhaserFreq();
    }

    if (params.phaserDepth !== undefined) {
      // Phaser octaves needs to be set via set() method
      this.phaser.set({ octaves: this.params.phaserDepth * 3 });
    }

    // Flanger parameters
    if (params.flangerMix !== undefined) {
      this.flangerWet.gain.value = params.flangerMix;
    }

    if (params.flangerFreq !== undefined) {
      this.flangerLfo.frequency.value = this.getFlangerFreq();
    }

    if (params.flangerDepth !== undefined) {
      // Adjust flanger LFO depth (min/max delay time) - these are Signals
      const maxDelay = 0.003 + this.params.flangerDepth * 0.012;
      this.flangerLfo.set({ min: 0.001, max: maxDelay });
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

  private getArpRateSeconds(): number {
    // Map 0-1 to 0.4s - 0.05s (slow to fast)
    // These intervals work well musically at various tempos
    return 0.4 - (this.params.arpRate * 0.35);
  }

  private startArpeggiator() {
    this.stopArpeggiator();
    if (this.heldNotes.length === 0 || this.params.arpMode === 'off') return;

    // Sort notes by pitch and cache for the callback
    this.arpSortedNotes = [...this.heldNotes].sort((a, b) => this.noteToMidi(a) - this.noteToMidi(b));
    this.arpIndex = 0;
    this.arpDirection = 1;

    // Play first note immediately
    this.playArpNote(Tone.now());

    // Create Tone.Loop for audio-accurate arpeggiator timing
    const intervalSeconds = this.getArpRateSeconds();
    this.arpLoop = new Tone.Loop((time) => {
      this.playArpNote(time);
    }, intervalSeconds);

    // Start the loop
    this.arpLoop.start(Tone.now() + intervalSeconds);

    // Ensure Transport is running for the loop
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }

  // Separated arp note playing for cleaner code
  private playArpNote(time: number) {
    if (this.arpSortedNotes.length === 0 || !this.synth) return;

    // Release previous arp note
    if (this.currentArpNote) {
      this.synth.triggerRelease(this.currentArpNote, time);
    }

    let noteIndex: number;
    switch (this.params.arpMode) {
      case 'up':
        noteIndex = this.arpIndex % this.arpSortedNotes.length;
        this.arpIndex++;
        break;
      case 'down':
        noteIndex = (this.arpSortedNotes.length - 1) - (this.arpIndex % this.arpSortedNotes.length);
        this.arpIndex++;
        break;
      case 'updown':
        noteIndex = this.arpIndex;
        this.arpIndex += this.arpDirection;
        if (this.arpIndex >= this.arpSortedNotes.length - 1) {
          this.arpDirection = -1;
          this.arpIndex = this.arpSortedNotes.length - 1;
        } else if (this.arpIndex <= 0) {
          this.arpDirection = 1;
          this.arpIndex = 0;
        }
        break;
      case 'random':
        noteIndex = Math.floor(Math.random() * this.arpSortedNotes.length);
        break;
      default:
        return;
    }

    const note = this.arpSortedNotes[noteIndex];
    this.currentArpNote = note;
    this.synth.triggerAttack(note, time, 0.8);
    this.filterEnv.triggerAttack(time);
  }

  private stopArpeggiator() {
    if (this.arpLoop) {
      this.arpLoop.stop();
      this.arpLoop.dispose();
      this.arpLoop = null;
    }
    if (this.currentArpNote && this.synth) {
      this.synth.triggerRelease(this.currentArpNote, Tone.now());
      this.currentArpNote = null;
    }
    this.arpIndex = 0;
    this.arpDirection = 1;
    this.arpSortedNotes = [];
  }

  private restartArpIfNeeded() {
    if (this.params.arpMode !== 'off' && this.heldNotes.length > 0) {
      this.startArpeggiator();
    }
  }

  async noteOn(note: string, velocity: number = 0.8) {
    if (this._disposed) return;
    await this.init();
    if (!this.synth || this._disposed) return;

    // Record if recording
    this.recordNoteStart(note, velocity);

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
    if (this._disposed || !this.synth) return;

    // Record if recording
    this.recordNoteEnd(note);

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

  getWaveformData(): Float32Array {
    return this.analyser.getValue() as Float32Array;
  }

  // Recording methods - simplified
  setLoopLength(bars: number) {
    this._loopBars = Math.max(1, Math.min(8, bars));
  }

  getLoopLength(): number {
    return this._loopBars;
  }

  startRecording(tempo: number) {
    // Stop playback and clear old recording
    this.stopPlayback();
    this._recordedNotes = [];
    this._noteStartTimes.clear();
    this._tempo = tempo;
    this._recordStartTime = Date.now();
    this._isRecording = true;

    // Clear existing timer
    if (this._recordTimeout) clearTimeout(this._recordTimeout);

    // Calculate loop duration in ms (4 beats per bar)
    const msPerBar = (60000 / tempo) * 4;
    const loopMs = this._loopBars * msPerBar;

    // Auto-stop after loop duration
    this._recordTimeout = window.setTimeout(() => {
      this._isRecording = false;
      if (this._onRecordDone) this._onRecordDone();
    }, loopMs);
  }

  onRecordingComplete(callback: (() => void) | null) {
    this._onRecordDone = callback;
  }

  stopRecording() {
    this._isRecording = false;
    if (this._recordTimeout) {
      clearTimeout(this._recordTimeout);
      this._recordTimeout = null;
    }
    // Finalize any held notes
    this._noteStartTimes.forEach((startMs, note) => {
      const duration = (Date.now() - startMs) / 1000;
      const startTime = (startMs - this._recordStartTime) / 1000;
      this._recordedNotes.push({ note, velocity: 0.8, startTime, duration: Math.max(0.05, duration) });
    });
    this._noteStartTimes.clear();
  }

  isCurrentlyRecording(): boolean {
    return this._isRecording;
  }

  isCurrentlyPlaying(): boolean {
    return this._isPlayingLoop;
  }

  getRecordingProgress(): number {
    if (!this._isRecording) return 0;
    const msPerBar = (60000 / this._tempo) * 4;
    const loopMs = this._loopBars * msPerBar;
    const elapsed = Date.now() - this._recordStartTime;
    return Math.min(1, elapsed / loopMs);
  }

  clearRecording() {
    this.stopPlayback();
    this._recordedNotes = [];
    this._noteStartTimes.clear();
  }

  getRecordedNotes(): RecordedNote[] {
    return [...this._recordedNotes];
  }

  hasRecordedNotes(): boolean {
    return this._recordedNotes.length > 0;
  }

  // Called when a note is pressed during recording
  private recordNoteStart(note: string, _velocity: number) {
    if (!this._isRecording) return;
    this._noteStartTimes.set(note, Date.now());
  }

  // Called when a note is released during recording
  private recordNoteEnd(note: string) {
    if (!this._isRecording) return;

    const startMs = this._noteStartTimes.get(note);
    if (startMs !== undefined) {
      const startTime = (startMs - this._recordStartTime) / 1000; // seconds from loop start
      const duration = Math.max(0.05, (Date.now() - startMs) / 1000); // duration in seconds, min 50ms

      this._recordedNotes.push({
        note,
        velocity: 0.8,
        startTime,
        duration
      });
      this._noteStartTimes.delete(note);
    }
  }

  async startPlayback(tempo: number) {
    if (this._recordedNotes.length === 0) {
      return;
    }

    await this.init();
    this.stopPlayback();
    this._isPlayingLoop = true;
    this._tempo = tempo;

    // Calculate loop length in seconds for Tone.js scheduling
    const secondsPerBeat = 60 / tempo;
    const secondsPerBar = secondsPerBeat * 4;
    const loopLengthSeconds = this._loopBars * secondsPerBar;

    // Create a Tone.js Part for audio-accurate timing
    const events = this._recordedNotes.map(note => ({
      time: note.startTime, // Already in seconds
      note: note.note,
      duration: note.duration,
      velocity: note.velocity,
    }));

    // Use Tone.Part for sample-accurate scheduling
    this._playbackPart = new Tone.Part((time, event) => {
      if (!this._isPlayingLoop || !this.synth) return;

      // Schedule note on
      this.synth.triggerAttack(event.note, time, event.velocity);
      this.filterEnv.triggerAttack(time);

      // Schedule note off using Tone.Transport for accuracy
      Tone.Transport.scheduleOnce((releaseTime) => {
        if (this.synth && this._isPlayingLoop) {
          this.synth.triggerRelease(event.note, releaseTime);
          this.filterEnv.triggerRelease(releaseTime);
        }
      }, time + event.duration);
    }, events);

    // Set up looping
    this._playbackPart.loop = true;
    this._playbackPart.loopStart = 0;
    this._playbackPart.loopEnd = loopLengthSeconds;

    // Start the part
    this._playbackPart.start(0);

    // Ensure Transport is running
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }

  stopPlayback() {
    this._isPlayingLoop = false;

    // Stop and dispose the Tone.Part if it exists
    if (this._playbackPart) {
      this._playbackPart.stop();
      this._playbackPart.dispose();
      this._playbackPart = null;
    }

    // Also clear any legacy timeouts (for backwards compatibility)
    this._playbackTimeouts.forEach(id => clearTimeout(id));
    this._playbackTimeouts = [];
    this.synth?.releaseAll();
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    // Stop arpeggiator, playback, and LFO before disposing nodes
    this.stopArpeggiator();
    this.stopPlayback();

    // Dispose arp loop if it exists (safety - stopArpeggiator should handle this)
    if (this.arpLoop) {
      this.arpLoop.dispose();
      this.arpLoop = null;
    }

    // Dispose playback part if it exists
    if (this._playbackPart) {
      this._playbackPart.dispose();
      this._playbackPart = null;
    }

    this.flangerLfo.stop();
    this.lfo.stop();

    this.synth?.dispose();
    this.filter.dispose();
    this.filterEnv.dispose();
    this.gain.dispose();
    this.masterGain.dispose();
    this.limiter.dispose();
    this.analyser.dispose();
    this.reverb.dispose();
    this.delay.dispose();
    this.lfo.dispose();
    this.lfoGain.dispose();
    this.dryGain.dispose();
    this.reverbWet.dispose();
    this.delayWet.dispose();
    this.panner.dispose();
    this.phaser.dispose();
    this.phaserWet.dispose();
    this.flanger.dispose();
    this.flangerLfo.dispose();
    this.flangerWet.dispose();
  }

  get isDisposed(): boolean {
    return this._disposed;
  }
}
