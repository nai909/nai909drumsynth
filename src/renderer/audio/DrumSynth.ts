import * as Tone from 'tone';

export class DrumSynth {
  private synths: Map<string, any> = new Map();
  private masterGain: Tone.Gain;
  private outputGain: Tone.Gain;
  private limiter: Tone.Limiter;
  private initialized: boolean = false;

  constructor() {
    // Master gain for internal mixing - keep at unity to prevent clipping
    this.masterGain = new Tone.Gain(0.85);
    // Output gain - slight boost but not excessive
    this.outputGain = new Tone.Gain(1.0);
    // Limiter prevents clipping/distortion at high volumes
    this.limiter = new Tone.Limiter(-1);

    this.masterGain.chain(this.outputGain, this.limiter, Tone.getDestination());
  }

  async init() {
    // Always try to start/resume audio context on mobile
    // Mobile browsers can suspend audio context even after initial start
    try {
      await Tone.start();

      // Also explicitly resume the audio context if suspended
      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
      }

      if (!this.initialized) {
        this.initialized = true;
        console.log('Audio engine initialized');

        // Listen for audio context state changes (e.g., tab switch on mobile)
        Tone.context.rawContext.addEventListener('statechange', () => {
          if (Tone.context.state === 'suspended') {
            // Attempt to resume when context gets suspended
            Tone.context.resume().catch(err => {
              console.warn('Could not auto-resume audio context:', err);
            });
          }
        });
      }
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  triggerKick(time: number, velocity: number = 1, tune: number = 0, decay: number = 0.4, filterCutoff: number = 1, pan: number = 0, attack: number = 0.001, tone: number = 0.5, snap: number = 0.3, filterResonance: number = 0.2, drive: number = 0) {
    try {
      // 808-style kick: deep sub bass with pitch sweep
      // decay controls length: low = tight punch, high = long 808 boom
      const kickDecay = Math.max(0.15, decay * 1.5);
      const pitchSweepTime = 0.04 + (snap * 0.03);

      // Main 808 body - pure sine sub bass
      // Attack controls the punch - low attack = punchy, high attack = softer
      const attackTime = Math.max(0.001, attack * 0.05);
      const clickLevel = Math.max(0, 1 - attack * 0.8);
      const kick = new Tone.MembraneSynth({
        pitchDecay: pitchSweepTime,
        octaves: 4 + (tone * 2),
        oscillator: { type: 'sine' },
        envelope: {
          attack: attackTime,
          decay: kickDecay,
          sustain: decay > 0.5 ? 0.1 : 0, // Long 808s have slight sustain
          release: Math.max(0.05, decay * 0.3),
        },
      });

      // Click/transient layer for attack - reduced by attack param (more attack = less click)
      const click = new Tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 8,
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.001,
          decay: 0.03 + (snap * 0.02),
          sustain: 0,
          release: 0.01,
        },
      });

      // Low pass filter to keep it subby
      const filter = new Tone.Filter({
        frequency: Math.max(60, Math.min(200, filterCutoff * 120 + 50)),
        type: 'lowpass',
        Q: Math.max(0.5, Math.min(4, 1 + filterResonance * 2)),
      });

      // Separate filter for click (allows more high end through)
      const clickFilter = new Tone.Filter({
        frequency: Math.max(500, Math.min(4000, filterCutoff * 2000 + 500)),
        type: 'lowpass',
        Q: 1,
      });

      // Warm saturation for that analog 808 character
      const distortion = new Tone.Distortion(Math.max(0.02, Math.min(0.5, 0.05 + drive * 0.4)));
      const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));
      const merger = new Tone.Gain(0.9);

      kick.chain(filter, merger);
      click.chain(clickFilter, merger);
      merger.chain(distortion, panner, this.masterGain);

      // 808 kick pitch - around 45-60Hz base
      const basePitch = 48 + (tune * 20);
      const clickPitch = 150 + (tune * 30);

      kick.triggerAttackRelease(basePitch, kickDecay + 0.1, time, Math.max(0.4, Math.min(1, velocity)));
      click.triggerAttackRelease(clickPitch, 0.05, time, Math.max(0.2, Math.min(0.6, velocity * snap * clickLevel)));

      setTimeout(() => {
        kick.dispose();
        click.dispose();
        filter.dispose();
        clickFilter.dispose();
        distortion.dispose();
        panner.dispose();
        merger.dispose();
      }, Math.max(2000, kickDecay * 1000 + 500));
    } catch (error) {
      console.error('Kick error:', error);
    }
  }

  triggerSnare(time: number, velocity: number = 1, tune: number = 0, decay: number = 0.2, filterCutoff: number = 1, pan: number = 0, attack: number = 0.001, tone: number = 0.5, snap: number = 0.3, filterResonance: number = 0.2, drive: number = 0) {
    try {
      // Trap-style snare (Metro Boomin influence): hard-hitting, bright crack
      const snareDecay = Math.max(0.08, decay * 0.35);
      const attackTime = Math.max(0.0005, attack * 0.03);

      const disposables: any[] = [];

      // Layer 1: Punchy body - tight pitched hit
      const body = new Tone.MembraneSynth({
        pitchDecay: 0.015 + (snap * 0.01),
        octaves: 3,
        oscillator: { type: 'sine' },
        envelope: {
          attack: attackTime,
          decay: Math.max(0.04, decay * 0.15),
          sustain: 0,
          release: 0.01,
        },
      });

      // Layer 2: Cracking noise - bright and aggressive
      const crack = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: attackTime,
          decay: snareDecay,
          sustain: 0,
          release: 0.015,
        },
      });

      // Layer 3: High-end sizzle for that trap brightness
      const sizzle = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.001,
          decay: snareDecay * 0.6,
          sustain: 0,
          release: 0.01,
        },
      });

      // Highpass for crack - removes mud, keeps the snap
      const crackFilter = new Tone.Filter({
        frequency: Math.max(1500, Math.min(6000, filterCutoff * 3000 + 1500)),
        type: 'highpass',
        Q: Math.max(0.5, Math.min(2, 1 + filterResonance)),
      });

      // Very high pass for sizzle layer
      const sizzleFilter = new Tone.Filter({
        frequency: Math.max(6000, Math.min(12000, 8000 + (tone * 3000))),
        type: 'highpass',
        Q: 1,
      });

      // Bandpass on body for focused punch
      const bodyFilter = new Tone.Filter({
        frequency: Math.max(150, Math.min(400, 200 + (tune * 50))),
        type: 'bandpass',
        Q: 2,
      });

      // Saturation for that aggressive trap character
      const distortion = new Tone.Distortion(Math.max(0.1, Math.min(0.6, 0.15 + drive * 0.4)));
      const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));
      const merger = new Tone.Gain(0.85);

      body.chain(bodyFilter, merger);
      crack.chain(crackFilter, merger);
      sizzle.chain(sizzleFilter, merger);
      merger.chain(distortion, panner, this.masterGain);

      disposables.push(body, crack, sizzle, bodyFilter, crackFilter, sizzleFilter, distortion, panner, merger);

      // Trigger all layers
      const bodyPitch = 200 + (tune * 40);
      body.triggerAttackRelease(bodyPitch, '64n', time, Math.max(0.5, Math.min(1, velocity)));
      crack.triggerAttackRelease(snareDecay, time, Math.max(0.4, Math.min(1, velocity * 0.9)));
      sizzle.triggerAttackRelease(snareDecay * 0.5, time, Math.max(0.2, Math.min(0.5, velocity * tone * 0.6)));

      setTimeout(() => {
        disposables.forEach(d => d.dispose());
      }, 1000);
    } catch (error) {
      console.error('Snare error:', error);
    }
  }

  triggerHiHat(time: number, velocity: number = 1, open: boolean = false, tune: number = 0, decay: number = 0.1, filterCutoff: number = 1, pan: number = 0, attack: number = 0.001, tone: number = 0.5, snap: number = 0.3, filterResonance: number = 0.2, drive: number = 0) {
    try {
      if (open) {
        // Classic 909 open hi-hat: metallic shimmer with long sustain
        const openDecay = Math.max(0.3, decay * 2.5);
        const tuneMultiplier = 1 + (tune * 0.2);
        const attackTime = Math.max(0.001, attack * 0.05);
        // Snap controls the metallic vs noise balance
        const metallicLevel = 0.1 + (snap * 0.15);
        const noiseLevel = 0.4 - (snap * 0.15);

        const disposables: any[] = [];

        // 909 uses 6 square wave oscillators at specific frequencies for metallic tone
        const frequencies = [
          263.6 * tuneMultiplier,
          400 * tuneMultiplier,
          523.3 * tuneMultiplier,
          587.3 * tuneMultiplier,
          845 * tuneMultiplier,
          1127 * tuneMultiplier,
        ];

        const oscGain = new Tone.Gain(metallicLevel);
        const noiseGain = new Tone.Gain(noiseLevel);
        const merger = new Tone.Gain(0.5);

        // Metallic oscillator envelope - longer for open hat
        const oscEnv = new Tone.AmplitudeEnvelope({
          attack: attackTime,
          decay: openDecay,
          sustain: 0.05,
          release: openDecay * 0.5,
        });

        // Create the 6 metallic oscillators
        frequencies.forEach((freq) => {
          const osc = new Tone.Oscillator({
            frequency: freq,
            type: 'square',
          });
          osc.connect(oscEnv);
          osc.start(time);
          disposables.push(osc);
        });

        oscEnv.connect(oscGain);
        oscGain.connect(merger);
        disposables.push(oscEnv, oscGain);

        // Noise layer for body
        const noise = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: {
            attack: attackTime,
            decay: openDecay * 0.8,
            sustain: 0.02,
            release: openDecay * 0.3,
          },
        });
        noise.connect(noiseGain);
        noiseGain.connect(merger);
        disposables.push(noise, noiseGain);

        // 909 characteristic highpass around 8-10kHz
        const highpass = new Tone.Filter({
          frequency: Math.max(7000, Math.min(12000, filterCutoff * 4000 + 7000)),
          type: 'highpass',
          Q: Math.max(0.5, Math.min(2, 0.8 + filterResonance)),
        });

        // Bandpass for that 909 character
        const bandpass = new Tone.Filter({
          frequency: Math.max(8000, Math.min(14000, 10000 + (tone * 3000))),
          type: 'bandpass',
          Q: 0.6,
        });

        const distortion = new Tone.Distortion(Math.max(0.02, Math.min(0.3, 0.05 + drive * 0.25)));
        const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));

        merger.chain(highpass, bandpass, distortion, panner, this.masterGain);
        disposables.push(merger, highpass, bandpass, distortion, panner);

        oscEnv.triggerAttackRelease(openDecay, time, Math.max(0.3, Math.min(1, velocity * 0.5)));
        noise.triggerAttackRelease(openDecay, time, Math.max(0.3, Math.min(1, velocity)));

        setTimeout(() => {
          disposables.forEach(d => {
            if (d.stop) d.stop();
            d.dispose();
          });
        }, Math.max(800, openDecay * 1000 + 300));

      } else {
        // Closed hi-hat: tight and crispy
        const closedDecay = Math.max(0.02, decay * 0.25);
        const tuneMultiplier = 1 + (tune * 0.3);
        const attackTime = Math.max(0.0005, attack * 0.02);
        // Snap controls metallic vs noise balance
        const metallicLevel = 0.15 + (snap * 0.2);
        const noiseLevel = 0.5 - (snap * 0.15);

        const disposables: any[] = [];

        // Noise component
        const noise = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: {
            attack: attackTime,
            decay: closedDecay,
            sustain: 0,
            release: 0.005,
          },
        });

        // High-pitched oscillators for metallic shimmer
        const oscFreqs = [6000 * tuneMultiplier, 7500 * tuneMultiplier, 9000 * tuneMultiplier];
        const oscEnv = new Tone.AmplitudeEnvelope({
          attack: attackTime,
          decay: closedDecay * 0.8,
          sustain: 0,
          release: 0.003,
        });

        const oscGain = new Tone.Gain(metallicLevel);
        oscFreqs.forEach((freq) => {
          const osc = new Tone.Oscillator({ frequency: freq, type: 'square' });
          osc.connect(oscEnv);
          osc.start(time);
          disposables.push(osc);
        });

        oscEnv.connect(oscGain);
        disposables.push(oscEnv, oscGain);

        const noiseGain = new Tone.Gain(noiseLevel);
        const merger = new Tone.Gain(0.45);
        noise.connect(noiseGain);
        noiseGain.connect(merger);
        oscGain.connect(merger);
        disposables.push(noise, noiseGain, merger);

        const highpass = new Tone.Filter({
          frequency: Math.max(8000, Math.min(16000, filterCutoff * 6000 + 8000)),
          type: 'highpass',
          Q: Math.max(0.5, Math.min(3, 1 + filterResonance)),
        });

        const bandpass = new Tone.Filter({
          frequency: Math.max(10000, Math.min(18000, 12000 + (tone * 4000))),
          type: 'bandpass',
          Q: 0.8,
        });

        const distortion = new Tone.Distortion(Math.max(0.05, Math.min(0.4, 0.1 + drive * 0.3)));
        const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));

        merger.chain(highpass, bandpass, distortion, panner, this.masterGain);
        disposables.push(highpass, bandpass, distortion, panner);

        oscEnv.triggerAttackRelease(closedDecay, time, Math.max(0.2, Math.min(1, velocity * 0.4)));
        noise.triggerAttackRelease(closedDecay, time, Math.max(0.3, Math.min(1, velocity)));

        setTimeout(() => {
          disposables.forEach(d => {
            if (d.stop) d.stop();
            d.dispose();
          });
        }, 300);
      }
    } catch (error) {
      console.error('HiHat error:', error);
    }
  }

  triggerClap(time: number, velocity: number = 1, tune: number = 0, decay: number = 0.15, filterCutoff: number = 1, pan: number = 0, attack: number = 0.001, tone: number = 0.5, snap: number = 0.3, filterResonance: number = 0.2, drive: number = 0) {
    try {
      // 909-style clap: multiple layered noise bursts
      const burstCount = 4;
      // Snap controls the tightness of the clap - high snap = tighter bursts
      const burstSpacing = 0.018 - (snap * 0.012); // 6-18ms between each burst
      const tailDecay = Math.max(0.12, decay * 0.8);
      const attackTime = Math.max(0.001, attack * 0.02);

      const disposables: any[] = [];

      // Bandpass filter for 909 character (centered around 1-2kHz)
      const filter = new Tone.Filter({
        frequency: Math.max(800, Math.min(3000, filterCutoff * 1500 + 1000 + (tune * 300))),
        type: 'bandpass',
        Q: Math.max(0.8, Math.min(4, 1.2 + filterResonance * 2)),
      });

      // Highpass to remove low end
      const highpass = new Tone.Filter({
        frequency: 400 + (tone * 200),
        type: 'highpass',
        Q: 0.5,
      });

      const distortion = new Tone.Distortion(Math.max(0, Math.min(0.6, drive * 0.4)));
      const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));
      const merger = new Tone.Gain(0.85);

      merger.chain(highpass, filter, distortion, panner, this.masterGain);
      disposables.push(filter, highpass, distortion, panner, merger);

      // Create multiple noise bursts for the classic 909 clap sound
      for (let i = 0; i < burstCount; i++) {
        const burst = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: {
            attack: attackTime,
            decay: 0.008 + (i * 0.002), // Each burst slightly longer
            sustain: 0,
            release: 0.005,
          },
        });
        burst.connect(merger);
        burst.triggerAttackRelease(0.01, time + (i * burstSpacing), Math.max(0.3, Math.min(1, velocity * (1 - i * 0.1))));
        disposables.push(burst);
      }

      // Reverb-like tail (final longer noise burst)
      const tail = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: attackTime,
          decay: tailDecay,
          sustain: 0,
          release: 0.05,
        },
      });
      tail.connect(merger);
      tail.triggerAttackRelease(tailDecay, time + (burstCount * burstSpacing), Math.max(0.15, Math.min(0.5, velocity * 0.4)));
      disposables.push(tail);

      setTimeout(() => {
        disposables.forEach(d => d.dispose());
      }, Math.max(1500, tailDecay * 1000 + 500));
    } catch (error) {
      console.error('Clap error:', error);
    }
  }

  triggerRimshot(time: number, velocity: number = 1, tune: number = 0, decay: number = 0.1, filterCutoff: number = 1, pan: number = 0, attack: number = 0.001, tone: number = 0.5, snap: number = 0.3, filterResonance: number = 0.2, drive: number = 0) {
    try {
      // Classic 808 rimshot: tight "tic" with woody resonance
      // The 808 uses a bridged-T oscillator creating a damped sine around 200Hz
      const rimshotDecay = Math.max(0.015, 0.02 + decay * 0.03); // Very tight: 15-50ms
      const attackTime = Math.max(0.0003, attack * 0.01);

      const disposables: any[] = [];

      // Fundamental tone - pure sine at ~200Hz (classic 808 frequency)
      const baseFreq = 200 + (tune * 60);
      const fundamental = new Tone.Oscillator({
        frequency: baseFreq,
        type: 'sine',
      });

      // Second harmonic for that woody 808 character
      const harmonic = new Tone.Oscillator({
        frequency: baseFreq * 2.4, // Slightly detuned harmonic adds character
        type: 'sine',
      });

      // Sharp amplitude envelope - instant attack, fast decay
      const fundEnv = new Tone.AmplitudeEnvelope({
        attack: attackTime,
        decay: rimshotDecay,
        sustain: 0,
        release: 0.008,
      });

      const harmEnv = new Tone.AmplitudeEnvelope({
        attack: attackTime,
        decay: rimshotDecay * 0.7, // Harmonic decays faster
        sustain: 0,
        release: 0.005,
      });

      // Transient click - very short noise burst for stick attack
      const click = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.0001,
          decay: 0.004 + (snap * 0.004), // 4-8ms click
          sustain: 0,
          release: 0.002,
        },
      });

      // Bandpass on click for that focused "tick" sound (not too hissy)
      const clickFilter = new Tone.Filter({
        frequency: Math.max(2500, Math.min(5000, filterCutoff * 2000 + 2500)),
        type: 'bandpass',
        Q: 1.5,
      });

      // Resonant bandpass on body for 808 ring
      const bodyFilter = new Tone.Filter({
        frequency: Math.max(180, Math.min(400, baseFreq + (tone * 100))),
        type: 'bandpass',
        Q: Math.max(3, Math.min(8, 4 + filterResonance * 4)), // Resonant!
      });

      // Mix the oscillators
      const oscMix = new Tone.Gain(0.6);
      const harmGain = new Tone.Gain(0.25); // Harmonic is quieter
      const clickGain = new Tone.Gain(0.5 + snap * 0.3);
      const merger = new Tone.Gain(0.9);

      // Light saturation for analog warmth
      const distortion = new Tone.Distortion(Math.max(0.02, Math.min(0.2, 0.05 + drive * 0.15)));
      const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));

      // Signal routing
      fundamental.connect(fundEnv);
      fundEnv.connect(oscMix);
      harmonic.connect(harmEnv);
      harmEnv.connect(harmGain);
      harmGain.connect(oscMix);
      oscMix.connect(bodyFilter);
      bodyFilter.connect(merger);
      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(merger);
      merger.chain(distortion, panner, this.masterGain);

      disposables.push(fundamental, harmonic, fundEnv, harmEnv, click, clickFilter, clickGain, bodyFilter, oscMix, harmGain, merger, distortion, panner);

      // Trigger everything
      fundamental.start(time);
      harmonic.start(time);
      fundEnv.triggerAttackRelease(rimshotDecay, time, Math.max(0.5, Math.min(1, velocity)));
      harmEnv.triggerAttackRelease(rimshotDecay * 0.7, time, Math.max(0.3, Math.min(0.8, velocity * 0.7)));
      click.triggerAttackRelease(0.006, time, Math.max(0.4, Math.min(1, velocity)));

      setTimeout(() => {
        fundamental.stop();
        harmonic.stop();
        disposables.forEach(d => d.dispose());
      }, 300);
    } catch (error) {
      console.error('Rimshot error:', error);
    }
  }

  triggerTom(time: number, velocity: number = 1, basePitch: string = 'G2', tune: number = 0, decay: number = 0.3, filterCutoff: number = 1, pan: number = 0, attack: number = 0.001, tone: number = 0.5, snap: number = 0.3, filterResonance: number = 0.2, drive: number = 0) {
    try {
      const attackTime = Math.max(0.001, attack * 0.03);
      // Snap controls the pitch sweep amount - more snap = more pitch drop
      const pitchDecayTime = Math.max(0.01, decay * 0.15) + (snap * 0.05);
      const octaveRange = Math.max(1, 3 + (tone * 3) + (snap * 2));

      const tom = new Tone.MembraneSynth({
        pitchDecay: pitchDecayTime,
        octaves: octaveRange,
        oscillator: { type: 'sine' },
        envelope: {
          attack: attackTime,
          decay: Math.max(0.1, decay),
          sustain: 0,
          release: 0.01,
        },
      });

      const filter = new Tone.Filter({
        frequency: Math.max(100, Math.min(20000, filterCutoff * 6000 + 100)),
        type: 'lowpass',
        Q: Math.max(0, Math.min(20, filterResonance * 10)),
      });

      const distortion = new Tone.Distortion(Math.max(0, Math.min(1, drive)));
      const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));

      tom.chain(distortion, filter, panner, this.masterGain);

      const pitch = Tone.Frequency(basePitch).transpose(tune * 24).toFrequency();
      const tomDecay = Math.max(0.1, decay);
      tom.triggerAttackRelease(pitch, '8n', time, Math.max(0, Math.min(1, velocity)));

      setTimeout(() => {
        tom.dispose();
        filter.dispose();
        distortion.dispose();
        panner.dispose();
      }, Math.max(1500, tomDecay * 1000 + 500));
    } catch (error) {
      console.error('Tom error:', error);
    }
  }

  triggerFM(time: number, velocity: number = 1, basePitch: string = 'C3', tune: number = 0, decay: number = 0.2, filterCutoff: number = 1, pan: number = 0, attack: number = 0.001, tone: number = 0.5, snap: number = 0.3, filterResonance: number = 0.2, drive: number = 0) {
    try {
      const attackTime = Math.max(0.001, attack * 0.05);
      const fm = new Tone.FMSynth({
        harmonicity: Math.max(0.5, 3 + (tone * 5)),
        modulationIndex: Math.max(1, 10 + (snap * 15)),
        envelope: {
          attack: attackTime,
          decay: Math.max(0.05, decay),
          sustain: 0,
          release: 0.01,
        },
        modulation: {
          type: 'square',
        },
        modulationEnvelope: {
          attack: attackTime * 2,
          decay: Math.max(0.05, decay * 0.5),
          sustain: 0,
          release: 0.01,
        },
      });

      const filter = new Tone.Filter({
        frequency: Math.max(100, Math.min(20000, filterCutoff * 8000 + 100)),
        type: 'lowpass',
        Q: Math.max(0, Math.min(20, filterResonance * 15)),
      });

      const distortion = new Tone.Distortion(Math.max(0, Math.min(1, drive)));
      const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));

      fm.chain(distortion, filter, panner, this.masterGain);

      const pitch = Tone.Frequency(basePitch).transpose(tune * 24).toFrequency();
      const fmDecay = Math.max(0.05, decay);
      fm.triggerAttackRelease(pitch, '16n', time, Math.max(0, Math.min(1, velocity)));

      setTimeout(() => {
        fm.dispose();
        filter.dispose();
        distortion.dispose();
        panner.dispose();
      }, Math.max(1000, fmDecay * 1000 + 500));
    } catch (error) {
      console.error('FM error:', error);
    }
  }

  setMasterVolume(volume: number) {
    this.masterGain.gain.value = volume;
  }

  // Set output gain (0-2 range, 1 = unity, 2 = +6dB boost)
  // Limiter prevents distortion even at high levels
  setOutputGain(gain: number) {
    this.outputGain.gain.value = Math.max(0, Math.min(2, gain));
  }

  getOutputGain(): number {
    return this.outputGain.gain.value;
  }

  dispose() {
    this.synths.forEach(synth => synth.dispose());
    this.synths.clear();
    this.masterGain.dispose();
    this.outputGain.dispose();
    this.limiter.dispose();
  }
}
