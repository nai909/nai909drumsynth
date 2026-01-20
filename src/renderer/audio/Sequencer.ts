import * as Tone from 'tone';
import { DrumSynth } from './DrumSynth';
import { Pattern } from '../types';

export class Sequencer {
  private drumSynth: DrumSynth;
  private sequence: Tone.Sequence | null = null;
  private currentStep: number = 0;
  private isPlaying: boolean = false;
  private isStarting: boolean = false;  // Lock to prevent race condition in play()
  private disposed: boolean = false;
  private tempo: number = 120;
  private pattern: Pattern | null = null;
  private stepCallbacks: ((step: number) => void)[] = [];

  // Metronome
  private metronomeEnabled: boolean = false;
  private metronomeClick: Tone.MembraneSynth | null = null;
  private metronomeVolume: Tone.Volume | null = null;

  // Callback to check if a hit should be skipped (e.g., just recorded during this loop)
  private shouldSkipHitCallback: ((trackIndex: number, stepIndex: number) => boolean) | null = null;

  constructor(drumSynth: DrumSynth) {
    this.drumSynth = drumSynth;
    // Configure Transport for reliable looping
    Tone.Transport.loop = false; // We use Sequence's built-in looping

    // Initialize metronome synth
    this.metronomeVolume = new Tone.Volume(-6).toDestination();
    this.metronomeClick = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0,
        release: 0.05,
      },
    }).connect(this.metronomeVolume);
  }

  setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  getMetronome(): boolean {
    return this.metronomeEnabled;
  }

  // Set callback to check if a hit should be skipped during playback
  // Used to prevent double-triggering when recording
  setShouldSkipHitCallback(callback: ((trackIndex: number, stepIndex: number) => boolean) | null) {
    this.shouldSkipHitCallback = callback;
  }

  setPattern(pattern: Pattern) {
    if (this.disposed) return;

    const needsRebuild = !this.pattern || this.pattern.steps !== pattern.steps;

    this.pattern = pattern;
    this.tempo = pattern.tempo;
    Tone.Transport.bpm.value = this.tempo;

    if (needsRebuild) {
      this.rebuild();
    }
  }

  setTempo(tempo: number) {
    this.tempo = tempo;
    Tone.Transport.bpm.value = tempo;
  }

  getTempo(): number {
    return this.tempo;
  }

  setSwing(swing: number) {
    // Swing value from 0-1, where 0 is straight and 1 is maximum swing
    Tone.Transport.swing = swing;
    Tone.Transport.swingSubdivision = '16n'; // Apply swing to 16th notes
  }

  private rebuild() {
    if (this.disposed) return;

    const wasPlaying = this.isPlaying;

    // Stop transport before rebuilding to prevent timing issues
    if (wasPlaying) {
      Tone.Transport.pause();
    }

    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }

    if (!this.pattern) return;

    const steps = this.pattern.steps;
    const stepArray = Array.from({ length: steps }, (_, i) => i);

    this.sequence = new Tone.Sequence(
      (time, step) => {
        if (this.disposed) return;
        this.currentStep = step;
        this.notifyStepCallbacks(step);
        this.playStep(step, time);
      },
      stepArray,
      '16n'
    );

    // Ensure sequence loops properly
    this.sequence.loop = true;
    this.sequence.loopStart = 0;
    this.sequence.loopEnd = steps;

    // Restart if it was playing before rebuild
    if (wasPlaying && this.sequence) {
      this.sequence.start(0);
      Tone.Transport.start();
    }
  }

  private playStep(step: number, time: number) {
    if (!this.pattern || this.disposed) return;

    // Play metronome click on beats (every 4 steps = quarter notes)
    if (this.metronomeEnabled && this.metronomeClick) {
      if (step % 4 === 0) {
        // Downbeat (first beat of bar) gets higher pitch
        const isDownbeat = step % 16 === 0;
        const pitch = isDownbeat ? 'G4' : 'C4';
        try {
          this.metronomeClick.triggerAttackRelease(pitch, '32n', time);
        } catch {
          // Metronome may be disposed
        }
      }
    }

    // Check if any track is soloed
    const hasSoloedTrack = this.pattern.tracks.some(t => t.solo);

    this.pattern.tracks.forEach((track, trackIndex) => {
      // Skip if muted
      if (track.muted) return;
      // If any track is soloed, only play soloed tracks
      if (hasSoloedTrack && !track.solo) return;
      // Skip if step is not active
      if (!track.steps[step]) return;
      // Skip if this hit was just recorded (prevents double-triggering during recording)
      if (this.shouldSkipHitCallback && this.shouldSkipHitCallback(trackIndex, step)) return;

      const velocity = track.velocity[step] || 1;
      const adjustedVelocity = velocity * track.volume;

      try {
        switch (track.soundEngine) {
          case 'kick':
            this.drumSynth.triggerKick(time, adjustedVelocity, track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'snare':
            this.drumSynth.triggerSnare(time, adjustedVelocity, track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'hihat-closed':
            this.drumSynth.triggerHiHat(time, adjustedVelocity, false, track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'hihat-open':
            this.drumSynth.triggerHiHat(time, adjustedVelocity, true, track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'clap':
            this.drumSynth.triggerClap(time, adjustedVelocity, track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'tom-low':
            this.drumSynth.triggerTom(time, adjustedVelocity, 'G2', track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'tom-mid':
            this.drumSynth.triggerTom(time, adjustedVelocity, 'C3', track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'tom-high':
            this.drumSynth.triggerTom(time, adjustedVelocity, 'F3', track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'rimshot':
            this.drumSynth.triggerRimshot(time, adjustedVelocity, track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
          case 'fm':
            this.drumSynth.triggerFM(time, adjustedVelocity, 'C3', track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
            break;
        }
      } catch (error) {
        console.error(`Error triggering ${track.soundEngine}:`, error);
      }
    });
  }

  async play() {
    // Prevent race condition - if already playing or starting, return
    if (this.isPlaying || this.isStarting || this.disposed) return;

    // Set lock before async operation
    this.isStarting = true;

    try {
      await this.drumSynth.init();

      // Check again after async - might have been stopped/disposed
      if (this.disposed) {
        this.isStarting = false;
        return;
      }

      // Check if we're resuming from pause or starting fresh
      const transportState = Tone.Transport.state;

      if (transportState === 'stopped') {
        // Fresh start - reset position
        Tone.Transport.position = 0;

        if (this.sequence) {
          this.sequence.stop();
          this.sequence.start(0);
        }

        // Small delay to ensure sequence is scheduled before Transport starts
        Tone.Transport.start('+0.01');
      } else if (transportState === 'paused') {
        // Resume from pause
        Tone.Transport.start();
      }

      this.isPlaying = true;
    } catch (error) {
      console.error('Failed to start playback:', error);
    } finally {
      this.isStarting = false;
    }
  }

  pause() {
    Tone.Transport.pause();
    this.isPlaying = false;
  }

  stop() {
    if (this.sequence) {
      this.sequence.stop();
    }
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.currentStep = 0;
    this.isPlaying = false;
    this.isStarting = false;
    this.notifyStepCallbacks(0);
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }

  onStep(callback: (step: number) => void) {
    this.stepCallbacks.push(callback);
  }

  // Remove a step callback
  offStep(callback: (step: number) => void) {
    const index = this.stepCallbacks.indexOf(callback);
    if (index !== -1) {
      this.stepCallbacks.splice(index, 1);
    }
  }

  // Clear all step callbacks
  clearStepCallbacks() {
    this.stepCallbacks = [];
  }

  private notifyStepCallbacks(step: number) {
    this.stepCallbacks.forEach(cb => {
      try {
        cb(step);
      } catch (error) {
        console.error('Error in step callback:', error);
      }
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    // Stop playback first
    this.stop();

    // Clear callbacks
    this.stepCallbacks = [];
    this.shouldSkipHitCallback = null;

    // Dispose audio nodes
    if (this.sequence) {
      try {
        this.sequence.stop();
        this.sequence.dispose();
      } catch {
        // May already be disposed
      }
      this.sequence = null;
    }

    if (this.metronomeClick) {
      try {
        this.metronomeClick.dispose();
      } catch {
        // May already be disposed
      }
      this.metronomeClick = null;
    }

    if (this.metronomeVolume) {
      try {
        this.metronomeVolume.dispose();
      } catch {
        // May already be disposed
      }
      this.metronomeVolume = null;
    }

    this.pattern = null;
  }
}
