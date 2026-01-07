import * as Tone from 'tone';
import { DrumSynth } from './DrumSynth';
import { DrumTrack, Pattern } from '../types';

export class Sequencer {
  private drumSynth: DrumSynth;
  private sequence: Tone.Sequence | null = null;
  private currentStep: number = 0;
  private isPlaying: boolean = false;
  private tempo: number = 120;
  private pattern: Pattern | null = null;
  private stepCallbacks: ((step: number) => void)[] = [];

  constructor(drumSynth: DrumSynth) {
    this.drumSynth = drumSynth;
  }

  setPattern(pattern: Pattern) {
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

  private rebuild() {
    const wasPlaying = this.isPlaying;

    if (this.sequence) {
      this.sequence.dispose();
    }

    if (!this.pattern) return;

    const steps = this.pattern.steps;
    const stepArray = Array.from({ length: steps }, (_, i) => i);

    this.sequence = new Tone.Sequence(
      (time, step) => {
        this.currentStep = step;
        this.notifyStepCallbacks(step);
        this.playStep(step, time);
      },
      stepArray,
      '16n'
    );

    // Restart sequence if it was playing before rebuild
    if (wasPlaying && this.sequence) {
      this.sequence.start(0);
    }
  }

  private playStep(step: number, time: number) {
    if (!this.pattern) return;

    this.pattern.tracks.forEach((track) => {
      if (track.muted || !track.steps[step]) return;

      const velocity = track.velocity[step] || 1;
      const adjustedVelocity = velocity * track.volume;

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
        case 'fm':
          this.drumSynth.triggerFM(time, adjustedVelocity, 'C3', track.tune, track.decay, track.filterCutoff, track.pan, track.attack, track.tone, track.snap, track.filterResonance, track.drive);
          break;
      }
    });
  }

  async play() {
    if (this.isPlaying) return;

    await this.drumSynth.init();

    if (this.sequence) {
      this.sequence.start(0);
    }

    Tone.Transport.start();
    this.isPlaying = true;
  }

  pause() {
    Tone.Transport.pause();
    this.isPlaying = false;
  }

  stop() {
    Tone.Transport.stop();
    this.currentStep = 0;
    this.isPlaying = false;
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

  private notifyStepCallbacks(step: number) {
    this.stepCallbacks.forEach(cb => cb(step));
  }

  dispose() {
    if (this.sequence) {
      this.sequence.dispose();
    }
    Tone.Transport.stop();
  }
}
