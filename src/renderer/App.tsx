import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { DrumSynth } from './audio/DrumSynth';
import { Sequencer } from './audio/Sequencer';
import { MelodicSynth, SynthParams, DEFAULT_SYNTH_PARAMS } from './audio/MelodicSynth';
import { Pattern, DrumTrack } from './types';
import StepSequencer from './components/StepSequencer';
import Transport from './components/Transport';
import TrackParams from './components/TrackParams';
import Synth from './components/Synth';
import SynthEffects from './components/SynthEffects';
import SynthSequencer, { Step as SynthStep } from './components/SynthSequencer';
import PsychedelicBackground from './components/PsychedelicBackground';
import './styles/App.css';

const THEMES = ['purple', 'blue', 'red', 'orange', 'green', 'cyan', 'pink'] as const;
type Theme = typeof THEMES[number];

// Clickable theme smiley component
const ThemeSmiley: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button className="theme-smiley-btn" onClick={onClick} aria-label="Change color theme">
    <svg viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        className="theme-smiley-face"
        d="M32 4
           C14 4 4 16 4 32
           C4 44 10 52 14 56
           L14 66 C14 70 12 74 12 74 C12 78 16 78 16 74 L16 62
           C18 64 22 66 24 68
           L24 72 C24 76 22 80 22 80 C22 84 26 84 26 80 L26 70
           C28 71 30 71 32 71
           C34 71 36 71 38 70
           L38 76 C38 80 36 84 36 84 C36 88 40 88 40 80 L40 68
           C42 66 46 64 48 62
           L48 70 C48 74 46 78 46 78 C46 82 50 82 50 78 L50 58
           C54 54 60 46 60 32
           C60 16 50 4 32 4Z"
      />
      <ellipse className="theme-smiley-eye" cx="20" cy="28" rx="5" ry="8" />
      <ellipse className="theme-smiley-eye" cx="44" cy="28" rx="5" ry="8" />
      <path
        className="theme-smiley-mouth"
        d="M16 44 Q24 54, 32 52 Q40 50, 48 44"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  </button>
);

const createInitialPattern = (): Pattern => {
  const tracks: DrumTrack[] = [
    {
      id: '1',
      name: 'Kick',
      type: 'analog',
      soundEngine: 'kick',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
      volume: 0.8,
      pan: 0,
      tune: 0,
      decay: 0,
      attack: 0.001,
      tone: 0.5,
      snap: 0.3,
      filterCutoff: 0.8,
      filterResonance: 0.2,
      drive: 0,
    },
    {
      id: '2',
      name: 'Snare',
      type: 'analog',
      soundEngine: 'snare',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
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
    {
      id: '3',
      name: 'Closed HH',
      type: 'analog',
      soundEngine: 'hihat-closed',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
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
    {
      id: '4',
      name: 'Open HH',
      type: 'analog',
      soundEngine: 'hihat-open',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
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
    {
      id: '5',
      name: 'Clap',
      type: 'analog',
      soundEngine: 'clap',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
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
    {
      id: '6',
      name: 'Tom Low',
      type: 'analog',
      soundEngine: 'tom-low',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
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
    {
      id: '7',
      name: 'Tom Mid',
      type: 'analog',
      soundEngine: 'tom-mid',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
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
    {
      id: '8',
      name: 'Rimshot',
      type: 'analog',
      soundEngine: 'rimshot',
      steps: new Array(16).fill(false),
      velocity: new Array(16).fill(1),
      muted: false,
      solo: false,
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
  ];

  return {
    id: '1',
    name: 'Pattern 1',
    tracks,
    tempo: 140,
    steps: 16,
  };
};

const createInitialSynthSequence = (): SynthStep[] =>
  Array.from({ length: 16 }, () => ({ active: false, note: 'C4' }));

const App: React.FC = () => {
  const [pattern, setPattern] = useState<Pattern>(createInitialPattern());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [mode, setMode] = useState<'sequencer' | 'pad' | 'params' | 'synth' | 'effects'>('pad');
  const [noteRepeat, setNoteRepeat] = useState<'off' | '1/2' | '1/4' | '1/8' | '1/16'>('off');
  const [noteRepeatModifier, setNoteRepeatModifier] = useState<'normal' | 'dotted' | 'triplet'>('normal');
  const [synthMode, setSynthMode] = useState<'keys' | 'seq'>('keys');
  const [synthSequence, setSynthSequence] = useState<SynthStep[]>(createInitialSynthSequence);
  const [synthParams, setSynthParams] = useState<SynthParams>(DEFAULT_SYNTH_PARAMS);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('drumsynth-theme');
    return (saved as Theme) || 'purple';
  });

  const drumSynthRef = useRef<DrumSynth | null>(null);
  const sequencerRef = useRef<Sequencer | null>(null);
  const melodicSynthRef = useRef<MelodicSynth | null>(null);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'purple') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('drumsynth-theme', theme);
  }, [theme]);

  useEffect(() => {
    drumSynthRef.current = new DrumSynth();
    sequencerRef.current = new Sequencer(drumSynthRef.current);
    melodicSynthRef.current = new MelodicSynth();

    sequencerRef.current.onStep((step) => {
      setCurrentStep(step);
    });

    sequencerRef.current.setPattern(pattern);

    // Initialize audio on first user interaction (required for mobile)
    const initAudioOnInteraction = async () => {
      if (drumSynthRef.current) {
        await drumSynthRef.current.init();
      }
    };

    // Listen for first touch/click to init audio
    document.addEventListener('touchstart', initAudioOnInteraction, { once: true });
    document.addEventListener('click', initAudioOnInteraction, { once: true });

    return () => {
      document.removeEventListener('touchstart', initAudioOnInteraction);
      document.removeEventListener('click', initAudioOnInteraction);
      sequencerRef.current?.dispose();
      drumSynthRef.current?.dispose();
      melodicSynthRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (sequencerRef.current) {
      sequencerRef.current.setPattern(pattern);
    }
  }, [pattern]);

  const handlePlay = async () => {
    if (sequencerRef.current) {
      await sequencerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePause = () => {
    if (sequencerRef.current) {
      sequencerRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (sequencerRef.current) {
      sequencerRef.current.stop();
      setIsPlaying(false);
      setCurrentStep(0);
    }
  };

  const handleTempoChange = (tempo: number) => {
    setPattern({ ...pattern, tempo });
    if (sequencerRef.current) {
      sequencerRef.current.setTempo(tempo);
    }
  };

  const handleStepToggle = (trackIndex: number, stepIndex: number) => {
    const newPattern = { ...pattern };
    newPattern.tracks[trackIndex].steps[stepIndex] = !newPattern.tracks[trackIndex].steps[stepIndex];
    setPattern(newPattern);
  };

  const handleParamChange = (param: keyof DrumTrack, value: number) => {
    const newPattern = { ...pattern };
    (newPattern.tracks[selectedTrack] as any)[param] = value;
    setPattern(newPattern);
  };

  const handleClearSequence = () => {
    const newPattern = { ...pattern };
    newPattern.tracks = newPattern.tracks.map(track => ({
      ...track,
      steps: new Array(16).fill(false),
    }));
    setPattern(newPattern);
  };

  const handlePadTrigger = async (trackIndex: number, velocity: number = 0.8, scheduledTime?: number) => {
    if (!drumSynthRef.current) return;
    await drumSynthRef.current.init();

    const track = pattern.tracks[trackIndex];
    // Use scheduled time if provided (for note repeat), otherwise use current time
    const time = scheduledTime ?? Tone.now();
    const { volume, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive } = track;

    // Combine track volume with touch velocity
    const finalVelocity = volume * velocity;

    switch (track.soundEngine) {
      case 'kick':
        drumSynthRef.current.triggerKick(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'snare':
        drumSynthRef.current.triggerSnare(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'hihat-closed':
        drumSynthRef.current.triggerHiHat(time, finalVelocity, false, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'hihat-open':
        drumSynthRef.current.triggerHiHat(time, finalVelocity, true, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'clap':
        drumSynthRef.current.triggerClap(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'tom-low':
        drumSynthRef.current.triggerTom(time, finalVelocity, 'G2', tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'tom-mid':
        drumSynthRef.current.triggerTom(time, finalVelocity, 'C3', tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'tom-high':
        drumSynthRef.current.triggerTom(time, finalVelocity, 'F3', tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
      case 'rimshot':
        drumSynthRef.current.triggerRimshot(time, finalVelocity, tune, decay, filterCutoff, pan, attack, tone, snap, filterResonance, drive);
        break;
    }
  };

  // Handle synth params change (shared between Synth and SynthSequencer)
  const handleSynthParamsChange = (newParams: SynthParams) => {
    setSynthParams(newParams);
    if (melodicSynthRef.current) {
      melodicSynthRef.current.updateParams(newParams);
    }
  };

  // Randomly change to a different theme
  const handleThemeChange = () => {
    const otherThemes = THEMES.filter(t => t !== theme);
    const randomTheme = otherThemes[Math.floor(Math.random() * otherThemes.length)];
    setTheme(randomTheme);
  };

  return (
    <div className="app">
      <PsychedelicBackground />
      {/* Clickable theme smiley */}
      <ThemeSmiley onClick={handleThemeChange} />
      <div className="main-content">
        <div className="center-section">
          <div className="sequencer-container">
            <div className="mode-toggle-wrapper">
              <div className="mode-toggle-container">
                <button
                  className={`mode-toggle ${mode === 'pad' ? 'active' : ''}`}
                  onClick={() => setMode('pad')}
                >
                  PAD
                </button>
                <button
                  className={`mode-toggle ${mode === 'params' ? 'active' : ''}`}
                  onClick={() => setMode('params')}
                >
                  EDIT
                </button>
                <button
                  className={`mode-toggle ${mode === 'sequencer' ? 'active' : ''}`}
                  onClick={() => setMode('sequencer')}
                >
                  SEQUENCE
                </button>
              </div>
              <div className="synth-toggle-group">
                <button
                  className={`mode-toggle synth-toggle ${mode === 'synth' ? 'active' : ''}`}
                  onClick={() => { setMode('synth'); setSynthMode('keys'); }}
                >
                  SYNTH
                </button>
                <button
                  className={`mode-toggle synth-toggle ${mode === 'effects' ? 'active' : ''}`}
                  onClick={() => setMode('effects')}
                >
                  EFFECTS
                </button>
              </div>
            </div>
            {mode === 'synth' ? (
              melodicSynthRef.current && (
                synthMode === 'seq' ? (
                  <SynthSequencer
                    synth={melodicSynthRef.current}
                    isPlaying={isPlaying}
                    tempo={pattern.tempo}
                    steps={synthSequence}
                    onStepsChange={setSynthSequence}
                    params={synthParams}
                    onParamsChange={handleSynthParamsChange}
                  />
                ) : (
                  <Synth
                    synth={melodicSynthRef.current}
                    params={synthParams}
                    onParamsChange={handleSynthParamsChange}
                  />
                )
              )
            ) : mode === 'effects' ? (
              melodicSynthRef.current && (
                <SynthEffects
                  synth={melodicSynthRef.current}
                  params={synthParams}
                  onParamsChange={handleSynthParamsChange}
                />
              )
            ) : mode === 'params' ? (
              <TrackParams
                track={pattern.tracks[selectedTrack]}
                trackIndex={selectedTrack}
                onParamChange={handleParamChange}
                onTrigger={handlePadTrigger}
              />
            ) : (
              <StepSequencer
                tracks={pattern.tracks}
                currentStep={currentStep}
                selectedTrack={selectedTrack}
                onStepToggle={handleStepToggle}
                onSelectTrack={setSelectedTrack}
                mode={mode === 'pad' ? 'pad' : 'sequencer'}
                onPadTrigger={handlePadTrigger}
                noteRepeat={noteRepeat}
                onNoteRepeatChange={setNoteRepeat}
                noteRepeatModifier={noteRepeatModifier}
                onNoteRepeatModifierChange={setNoteRepeatModifier}
                tempo={pattern.tempo}
                onClearSequence={handleClearSequence}
              />
            )}
          </div>
        </div>
      </div>
      <Transport
        isPlaying={isPlaying}
        tempo={pattern.tempo}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onTempoChange={handleTempoChange}
      />
    </div>
  );
};

export default App;
