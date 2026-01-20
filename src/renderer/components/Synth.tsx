import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { MelodicSynth, SynthParams, WaveformType, ArpMode } from '../audio/MelodicSynth';
import { MelodyGenerator } from '../audio/MelodyGenerator';
import WaveformVisualizer from './WaveformVisualizer';
import CaptureRibbon, { RecordedNote } from './CaptureRibbon';
import { Step as SynthStep } from './SynthSequencer';
import './Synth.css';

interface SynthProps {
  synth: MelodicSynth;
  params: SynthParams;
  onParamsChange: (params: SynthParams) => void;
  // Recording props
  isRecording?: boolean;
  isPlaying?: boolean;
  tempo?: number;
  synthSequence?: SynthStep[];
  onSynthSequenceChange?: (steps: SynthStep[]) => void;
  onPlay?: () => Promise<void>;
  synthLoopBars?: 1 | 2 | 4 | 8 | 16;
  // Loop capture mode - first recording defines the loop length (up to 16 bars)
  isSynthLoopCapture?: boolean;
  // Current step position for capture ribbon visualization
  synthCurrentStep?: number;
  // Clear sequence callback - resets to capture mode
  onClearSequence?: () => void;
  // Set synth loop bars (exits capture mode)
  onSynthLoopBarsChange?: (bars: 1 | 2 | 4 | 8 | 16) => void;
  // Scale props
  scaleEnabled?: boolean;
  onScaleEnabledChange?: (enabled: boolean) => void;
  scaleRoot?: string;
  onScaleRootChange?: (root: string) => void;
  scaleType?: string;
  onScaleTypeChange?: (type: string) => void;
}

// Define keyboard notes
const OCTAVE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DEFAULT_OCTAVE = 3;
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 6;

// Scale definitions (intervals from root) - All Ableton scales
const SCALES: { [key: string]: number[] } = {
  // Basic scales
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic minor': [0, 2, 3, 5, 7, 9, 11],
  // Modes
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'phrygian': [0, 1, 3, 5, 7, 8, 10],
  'lydian': [0, 2, 4, 6, 7, 9, 11],
  'mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'locrian': [0, 1, 3, 5, 6, 8, 10],
  // Pentatonic & Blues
  'major pentatonic': [0, 2, 4, 7, 9],
  'minor pentatonic': [0, 3, 5, 7, 10],
  'blues': [0, 3, 5, 6, 7, 10],
  'major blues': [0, 2, 3, 4, 7, 9],
  // Diminished & Whole Tone
  'whole tone': [0, 2, 4, 6, 8, 10],
  'half-whole dim': [0, 1, 3, 4, 6, 7, 9, 10],
  'whole-half dim': [0, 2, 3, 5, 6, 8, 9, 11],
  // Bebop
  'bebop dominant': [0, 2, 4, 5, 7, 9, 10, 11],
  'bebop major': [0, 2, 4, 5, 7, 8, 9, 11],
  'bebop minor': [0, 2, 3, 5, 7, 8, 9, 10],
  // World scales
  'arabic': [0, 1, 4, 5, 7, 8, 11],
  'hungarian minor': [0, 2, 3, 6, 7, 8, 11],
  'japanese': [0, 1, 5, 7, 8],
  'hirajoshi': [0, 2, 3, 7, 8],
  'gypsy': [0, 2, 3, 6, 7, 8, 10],
  'spanish': [0, 1, 3, 4, 5, 7, 8, 10],
  'phrygian dominant': [0, 1, 4, 5, 7, 8, 10],
  'double harmonic': [0, 1, 4, 5, 7, 8, 11],
  // Other useful scales
  'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  'augmented': [0, 3, 4, 7, 8, 11],
  'prometheus': [0, 2, 4, 6, 9, 10],
  'tritone': [0, 1, 4, 6, 7, 10],
  'super locrian': [0, 1, 3, 4, 6, 8, 10],
};

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Get notes in a scale
const getScaleNotes = (root: string, scale: string): Set<string> => {
  const scaleNotes = new Set<string>();
  const rootIndex = ROOT_NOTES.indexOf(root);
  const intervals = SCALES[scale] || [];

  intervals.forEach(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    scaleNotes.add(ROOT_NOTES[noteIndex]);
  });

  return scaleNotes;
};

const getKeyboardNotes = (numOctaves: number, baseOctave: number) => {
  const notes: { note: string; isBlack: boolean }[] = [];
  for (let octave = baseOctave; octave < baseOctave + numOctaves; octave++) {
    OCTAVE_NOTES.forEach((note) => {
      notes.push({
        note: `${note}${octave}`,
        isBlack: note.includes('#'),
      });
    });
  }
  return notes;
};

// Computer keyboard mapping - returns mapping based on octave
const getKeyMap = (baseOctave: number): { [key: string]: string } => ({
  'a': `C${baseOctave}`, 'w': `C#${baseOctave}`, 's': `D${baseOctave}`, 'e': `D#${baseOctave}`, 'd': `E${baseOctave}`,
  'f': `F${baseOctave}`, 't': `F#${baseOctave}`, 'g': `G${baseOctave}`, 'y': `G#${baseOctave}`, 'h': `A${baseOctave}`,
  'u': `A#${baseOctave}`, 'j': `B${baseOctave}`, 'k': `C${baseOctave + 1}`, 'o': `C#${baseOctave + 1}`, 'l': `D${baseOctave + 1}`,
  'p': `D#${baseOctave + 1}`, ';': `E${baseOctave + 1}`, "'": `F${baseOctave + 1}`,
});

const Synth: React.FC<SynthProps> = ({
  synth,
  params,
  onParamsChange,
  isRecording,
  isPlaying,
  tempo = 120,
  synthSequence,
  onSynthSequenceChange,
  onPlay,
  synthLoopBars = 1,
  isSynthLoopCapture = false,
  synthCurrentStep = -1,
  onClearSequence,
  onSynthLoopBarsChange,
  scaleEnabled = false,
  onScaleEnabledChange,
  scaleRoot = 'C',
  onScaleRootChange,
  scaleType = 'major',
  onScaleTypeChange,
}) => {
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [octave, setOctave] = useState(DEFAULT_OCTAVE);
  const melodyGeneratorRef = useRef<MelodyGenerator>(new MelodyGenerator());
  const keysToNotes = useRef<Map<string, string>>(new Map()); // physical key -> note being played
  const activeTouches = useRef<Map<number, string>>(new Map()); // touchId -> note
  const mouseDownNotes = useRef<Set<string>>(new Set()); // track which notes are held by mouse
  // Track note recording starts: note -> { stepIndex, realTime } using performance.now() for accurate duration
  const recordingNoteStarts = useRef<Map<string, { stepIndex: number; realTime: number }>>(new Map());
  // Ref to track latest synthSequence to avoid stale closures in handleNoteOff
  const synthSequenceRef = useRef(synthSequence);

  // Scale notes derived from props - memoized to avoid recreation on every render
  const scaleNotes = useMemo(
    () => scaleEnabled ? getScaleNotes(scaleRoot, scaleType) : new Set<string>(),
    [scaleEnabled, scaleRoot, scaleType]
  );

  // Extract recorded notes from synthSequence for the capture ribbon
  const recordedNotes: RecordedNote[] = useMemo(() => {
    if (!synthSequence) return [];
    const notes: RecordedNote[] = [];
    synthSequence.forEach((step, index) => {
      if (step.active) {
        notes.push({ step: index, note: step.note, length: step.length });
      }
    });
    return notes;
  }, [synthSequence]);

  // Scale change handlers (call parent if available)
  const setScaleEnabled = (enabled: boolean) => onScaleEnabledChange?.(enabled);
  const setScaleRoot = (root: string) => onScaleRootChange?.(root);
  const setScaleType = (type: string) => onScaleTypeChange?.(type);

  // Keep synthSequenceRef in sync with prop
  useEffect(() => {
    synthSequenceRef.current = synthSequence;
  }, [synthSequence]);

  // Check if a note is in the current scale
  const isInScale = useCallback((note: string): boolean => {
    if (!scaleEnabled) return false;
    const noteName = note.replace(/\d+$/, ''); // Remove octave number
    return scaleNotes.has(noteName);
  }, [scaleEnabled, scaleNotes]);

  // Check if a note can be played (either scale is off, or note is in scale)
  const canPlayNote = useCallback((note: string): boolean => {
    if (!scaleEnabled) return true;
    return isInScale(note);
  }, [scaleEnabled, isInScale]);

  // Responsive octaves - 1 on mobile, 2 on desktop
  const numOctaves = isMobile ? 1 : 2;
  const keyboardNotes = getKeyboardNotes(numOctaves, octave);
  const numWhiteKeys = keyboardNotes.filter(n => !n.isBlack).length;
  const keyMap = getKeyMap(octave);

  // Octave controls
  const octaveUp = () => setOctave(o => Math.min(MAX_OCTAVE, o + 1));
  const octaveDown = () => setOctave(o => Math.max(MIN_OCTAVE, o - 1));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Release all notes - safety function
  const releaseAllNotes = useCallback(() => {
    synth.releaseAll();
    setActiveNotes(new Set());
    activeTouches.current.clear();
    keysToNotes.current.clear();
    mouseDownNotes.current.clear();
    recordingNoteStarts.current.clear();
  }, [synth]);

  const handleNoteOn = useCallback(async (note: string, touchId?: number) => {
    if (touchId !== undefined) {
      activeTouches.current.set(touchId, note);
    }
    await synth.noteOn(note, 0.8);
    setActiveNotes((prev) => new Set([...prev, note]));

    // Auto-start playback when recording is armed but not playing
    let justStartedPlayback = false;
    if (isRecording && !isPlaying && onPlay) {
      // Start playback first, then continue to record this note
      await onPlay();
      justStartedPlayback = true;
    }

    // Record note to synth sequencer if recording and playing, or if we just started
    if (isRecording && (isPlaying || justStartedPlayback) && onSynthSequenceChange && synthSequence) {
      // In capture mode, use full 16 bars (256 steps) to capture the phrase
      // After recording stops, loop length will be auto-set based on where notes landed
      const loopLengthSteps = isSynthLoopCapture ? 256 : synthLoopBars * 16;
      let stepIndex: number;
      let transportSeconds: number;

      if (justStartedPlayback) {
        // Transport just started - position is 0, don't read stale Transport.seconds
        stepIndex = 0;
        transportSeconds = 0;
      } else {
        // Normal recording - calculate from transport position
        transportSeconds = Tone.Transport.seconds;
        const secondsPerStep = 60 / tempo / 4; // 16th note duration
        const loopLengthSeconds = loopLengthSteps * secondsPerStep;
        const positionInLoop = transportSeconds % loopLengthSeconds;
        // Use Math.min to prevent overflow at loop boundary
        stepIndex = Math.min(
          Math.round(positionInLoop / secondsPerStep),
          loopLengthSteps - 1
        );
      }

      // Track the start of this note for length calculation on noteOff
      // Use real time (performance.now) for accurate duration tracking
      recordingNoteStarts.current.set(note, { stepIndex, realTime: performance.now() });

      const newSteps = [...synthSequence];
      newSteps[stepIndex] = { active: true, note, length: 1 }; // Start with length 1, will be updated on noteOff
      // Update ref immediately so handleNoteOff sees the new step (avoids stale closure)
      synthSequenceRef.current = newSteps;
      onSynthSequenceChange(newSteps);
    }
  }, [synth, isRecording, isPlaying, tempo, synthSequence, onSynthSequenceChange, onPlay, synthLoopBars, isSynthLoopCapture]);

  const handleNoteOff = useCallback((note: string, touchId?: number) => {
    if (touchId !== undefined) {
      activeTouches.current.delete(touchId);
    }
    synth.noteOff(note);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });

    // Calculate note length if we were recording this note
    // Note: We check noteStart existence, NOT isRecording/isPlaying states
    // This avoids stale closure issues - if noteStart exists, we were recording when note started
    const noteStart = recordingNoteStarts.current.get(note);
    // Use ref to get latest sequence (avoids stale closure when note released quickly)
    const currentSequence = synthSequenceRef.current;
    if (noteStart && onSynthSequenceChange && currentSequence) {
      const msPerStep = 60000 / tempo / 4; // Duration of one 16th note step in ms
      // In capture mode, use full 16 bars
      const loopLengthSteps = isSynthLoopCapture ? 256 : synthLoopBars * 16;

      // Calculate how many steps the note was held using real elapsed time
      const elapsedMs = performance.now() - noteStart.realTime;
      // Use Math.floor for conservative note lengths - only count fully held steps
      // Cap at 8 steps (half bar) for more musical results
      const elapsedSteps = Math.floor(elapsedMs / msPerStep);
      const maxNoteLength = Math.min(8, loopLengthSteps);
      const noteLength = Math.max(1, Math.min(elapsedSteps, maxNoteLength));

      // Update the step with the calculated length
      const newSteps = [...currentSequence];
      if (newSteps[noteStart.stepIndex]?.active) {
        newSteps[noteStart.stepIndex] = {
          ...newSteps[noteStart.stepIndex],
          length: noteLength
        };
        // Update ref immediately
        synthSequenceRef.current = newSteps;
        onSynthSequenceChange(newSteps);
      }
    }

    // Always clean up the tracking, regardless of recording state
    // This prevents stale entries if recording stops while a note is held
    recordingNoteStarts.current.delete(note);
  }, [synth, tempo, onSynthSequenceChange, synthLoopBars, isSynthLoopCapture]);

  // Refs for stable event handler references (avoid stale closures)
  const handleNoteOffRef = useRef(handleNoteOff);
  const releaseAllNotesRef = useRef(releaseAllNotes);

  // Keep refs updated
  useEffect(() => {
    handleNoteOffRef.current = handleNoteOff;
    releaseAllNotesRef.current = releaseAllNotes;
  }, [handleNoteOff, releaseAllNotes]);

  // Global event handlers - catches any missed releases
  // Using refs to avoid effect re-running on callback changes (which can miss events)
  useEffect(() => {
    const handleGlobalTouchEnd = (e: TouchEvent) => {
      // Use changedTouches to get the touches that ended
      const endedTouchIds = new Set(Array.from(e.changedTouches).map(t => t.identifier));

      // Release any notes associated with ended touches
      endedTouchIds.forEach(touchId => {
        const note = activeTouches.current.get(touchId);
        if (note) {
          handleNoteOffRef.current(note, touchId);
        }
      });

      // Safety: also check for orphaned touches (belt and suspenders)
      const currentTouchIds = new Set(Array.from(e.touches).map(t => t.identifier));
      activeTouches.current.forEach((note, touchId) => {
        if (!currentTouchIds.has(touchId)) {
          handleNoteOffRef.current(note, touchId);
        }
      });
    };

    const handleGlobalMouseUp = () => {
      // Release all notes held by mouse when mouse is released anywhere
      mouseDownNotes.current.forEach((note) => {
        handleNoteOffRef.current(note);
      });
      mouseDownNotes.current.clear();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseAllNotesRef.current();
      }
    };

    const handleWindowBlur = () => {
      releaseAllNotesRef.current();
    };

    // Additional safety: release all on context menu (long press on mobile)
    const handleContextMenu = () => {
      releaseAllNotesRef.current();
    };

    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []); // Empty deps - handlers use refs for stable references

  // Computer keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();

      // Octave controls with z and x keys
      if (key === 'z') {
        octaveDown();
        return;
      }
      if (key === 'x') {
        octaveUp();
        return;
      }

      // Only trigger if this key isn't already playing a note and note is playable
      if (keyMap[key] && !keysToNotes.current.has(key)) {
        const note = keyMap[key];
        if (!canPlayNote(note)) return; // Skip if note is outside scale
        keysToNotes.current.set(key, note); // Remember which note this key triggered
        handleNoteOn(note);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Release the note that was originally triggered by this key
      const note = keysToNotes.current.get(key);
      if (note) {
        keysToNotes.current.delete(key);
        handleNoteOff(note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Release all keyboard-held notes when effect re-runs (e.g., octave change)
      // This prevents notes from getting orphaned when handlers change
      keysToNotes.current.forEach((note) => {
        handleNoteOffRef.current(note);
      });
      keysToNotes.current.clear();
    };
  }, [handleNoteOn, handleNoteOff, keyMap, octaveUp, octaveDown, canPlayNote]);

  const handleParamChange = (param: keyof SynthParams, value: number | WaveformType | ArpMode | boolean) => {
    const newParams = { ...params, [param]: value };
    onParamsChange(newParams);
  };

  // Randomize all parameters (except output and effect settings)
  const randomizeParams = () => {
    // Release all currently playing notes to prevent long release tails
    // when the release parameter changes to a higher value
    synth?.releaseAll();

    const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];
    const newParams: SynthParams = {
      waveform: waveforms[Math.floor(Math.random() * waveforms.length)],
      attack: Math.random() * 0.5,
      decay: 0.05 + Math.random() * 0.5,
      sustain: Math.random(),
      release: 0.05 + Math.random() * 0.8,
      filterCutoff: 0.2 + Math.random() * 0.8,
      filterResonance: Math.random() * 0.7,
      filterEnvAmount: Math.random(),
      detune: params.detune, // Keep current setting
      volume: params.volume, // Keep current output settings
      pan: params.pan, // Keep current output settings
      arpMode: params.arpMode, // Keep current arp mode
      arpRate: params.arpRate, // Keep current arp rate
      mono: params.mono, // Keep current mono setting
      // Keep current effect settings
      reverbMix: params.reverbMix,
      reverbDecay: params.reverbDecay,
      delayMix: params.delayMix,
      delayTime: params.delayTime,
      delayFeedback: params.delayFeedback,
      lfoRate: params.lfoRate,
      lfoDepth: params.lfoDepth,
      lfoEnabled: params.lfoEnabled,
      lfoDestination: params.lfoDestination,
      // Phaser settings
      phaserMix: params.phaserMix,
      phaserFreq: params.phaserFreq,
      phaserDepth: params.phaserDepth,
      // Flanger settings
      flangerMix: params.flangerMix,
      flangerDepth: params.flangerDepth,
      flangerFreq: params.flangerFreq,
    };
    onParamsChange(newParams);
  };

  // Clear sequence - use parent callback to reset to capture mode
  const clearSequence = () => {
    if (onClearSequence) {
      onClearSequence();
    }
  };

  // Get scale notes as array for AI generator
  const getScaleNotesArray = useCallback((): string[] => {
    const ALL_NOTES = [
      'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
      'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
      'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
      'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
    ];

    if (!scaleEnabled) return ALL_NOTES;

    const rootIndex = ROOT_NOTES.indexOf(scaleRoot);
    const intervals = SCALES[scaleType] || SCALES['chromatic'];
    const result: string[] = [];

    ALL_NOTES.forEach(note => {
      const noteName = note.replace(/\d+$/, '');
      const noteIndex = ROOT_NOTES.indexOf(noteName);
      const interval = (noteIndex - rootIndex + 12) % 12;
      if (intervals.includes(interval)) {
        result.push(note);
      }
    });

    return result;
  }, [scaleEnabled, scaleRoot, scaleType]);

  // Generate progression - one click, instant result
  const generateProgression = useCallback(() => {
    if (!onSynthSequenceChange || !synthSequence) return;

    const scaleNotesArray = getScaleNotesArray();
    const bars = 4; // Always 4 bars

    const generatedPattern = melodyGeneratorRef.current.generate(scaleNotesArray, bars);

    const newSteps = [...synthSequence];
    for (let i = 0; i < generatedPattern.length; i++) {
      newSteps[i] = generatedPattern[i];
    }
    onSynthSequenceChange(newSteps);

    // Set the loop length to 4 bars
    if (onSynthLoopBarsChange) {
      onSynthLoopBarsChange(4);
    }
  }, [onSynthSequenceChange, synthSequence, getScaleNotesArray, onSynthLoopBarsChange]);

  const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];
  const arpModes: ArpMode[] = ['off', 'up', 'down', 'updown', 'random'];

  return (
    <div className="synth-container">
      <div className="synth-panel">
        {/* Output */}
        <div className="synth-section">
          <div className="section-label">OUTPUT</div>
          <SynthKnob
            label="VOLUME"
            value={params.volume}
            onChange={(v) => handleParamChange('volume', v)}
          />
        </div>

        {/* Octave control */}
        <div className="synth-section">
          <div className="section-label">OCTAVE</div>
          <div className="octave-controls">
            <button
              className="octave-btn"
              onClick={octaveDown}
              disabled={octave <= MIN_OCTAVE}
            >
              -
            </button>
            <span className="octave-display">{octave}</span>
            <button
              className="octave-btn"
              onClick={octaveUp}
              disabled={octave >= MAX_OCTAVE}
            >
              +
            </button>
          </div>
        </div>

        {/* Mono/Poly toggle */}
        <div className="synth-section">
          <div className="section-label">VOICE</div>
          <button
            className={`mono-poly-btn ${params.mono ? 'mono' : 'poly'}`}
            onClick={() => handleParamChange('mono', !params.mono)}
          >
            {params.mono ? 'MONO' : 'POLY'}
          </button>
        </div>

        {/* Scale */}
        <div className="synth-section">
          <div className="section-label">SCALE</div>
          <div className="scale-controls">
            <button
              className={`scale-toggle ${scaleEnabled ? 'active' : ''}`}
              onClick={() => setScaleEnabled(!scaleEnabled)}
            >
              {scaleEnabled ? 'ON' : 'OFF'}
            </button>
            {scaleEnabled && (
              <>
                <select
                  className="scale-select"
                  value={scaleRoot}
                  onChange={(e) => setScaleRoot(e.target.value)}
                >
                  {ROOT_NOTES.map((note) => (
                    <option key={note} value={note}>{note}</option>
                  ))}
                </select>
                <select
                  className="scale-select"
                  value={scaleType}
                  onChange={(e) => setScaleType(e.target.value)}
                >
                  {Object.keys(SCALES).map((scale) => (
                    <option key={scale} value={scale}>
                      {scale.charAt(0).toUpperCase() + scale.slice(1)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Waveform selector */}
        <div className="synth-section">
          <div className="section-label">WAVEFORM</div>
          <div className="waveform-buttons">
            {waveforms.map((wf) => (
              <button
                key={wf}
                className={`waveform-btn ${params.waveform === wf ? 'active' : ''}`}
                onClick={() => handleParamChange('waveform', wf)}
              >
                <WaveformIcon type={wf} />
              </button>
            ))}
          </div>
        </div>

        {/* ADSR */}
        <div className="synth-section">
          <div className="section-label">ENVELOPE</div>
          <div className="knob-row">
            <SynthKnob
              label="ATK"
              value={params.attack}
              onChange={(v) => handleParamChange('attack', v)}
              min={0.001}
              max={2}
            />
            <SynthKnob
              label="DEC"
              value={params.decay}
              onChange={(v) => handleParamChange('decay', v)}
              min={0.01}
              max={2}
            />
            <SynthKnob
              label="SUS"
              value={params.sustain}
              onChange={(v) => handleParamChange('sustain', v)}
            />
            <SynthKnob
              label="REL"
              value={params.release}
              onChange={(v) => handleParamChange('release', v)}
              min={0.01}
              max={3}
            />
          </div>
        </div>

        {/* Filter */}
        <div className="synth-section">
          <div className="section-label">FILTER</div>
          <div className="knob-row">
            <SynthKnob
              label="CUTOFF"
              value={params.filterCutoff}
              onChange={(v) => handleParamChange('filterCutoff', v)}
            />
            <SynthKnob
              label="RES"
              value={params.filterResonance}
              onChange={(v) => handleParamChange('filterResonance', v)}
            />
            <SynthKnob
              label="ENV"
              value={params.filterEnvAmount}
              onChange={(v) => handleParamChange('filterEnvAmount', v)}
            />
          </div>
        </div>

        {/* Arpeggiator */}
        <div className="synth-section">
          <div className="section-label">ARPEGGIATOR</div>
          <div className="arp-controls">
            <select
              className="arp-select"
              value={params.arpMode}
              onChange={(e) => handleParamChange('arpMode', e.target.value as ArpMode)}
            >
              {arpModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode.toUpperCase()}
                </option>
              ))}
            </select>
            <SynthKnob
              label="RATE"
              value={params.arpRate}
              onChange={(v) => handleParamChange('arpRate', v)}
            />
          </div>
        </div>

        {/* Action buttons - desktop only, mobile version is below keyboard */}
        <div className="synth-section random-section-desktop">
          <button
            className="action-btn generate-btn"
            onClick={generateProgression}
          >
            GENERATE
          </button>
          <button className="action-btn mutate-btn" onClick={randomizeParams}>MUTATE</button>
          <button className="action-btn clear-btn" onClick={clearSequence}>CLEAR</button>
        </div>
      </div>

      {/* Keyboard */}
      <div className={`keyboard-container ${isRecording && isPlaying ? 'recording-active' : ''}`}>
        <div className="keyboard">
          {keyboardNotes.filter((n) => !n.isBlack).map((noteObj) => {
            const playable = canPlayNote(noteObj.note);
            return (
              <div
                key={noteObj.note}
                className={`key white-key ${activeNotes.has(noteObj.note) ? 'active' : ''} ${isInScale(noteObj.note) ? 'in-scale' : ''} ${scaleEnabled && !playable ? 'disabled' : ''}`}
                onMouseDown={() => {
                  if (!playable) return;
                  mouseDownNotes.current.add(noteObj.note);
                  handleNoteOn(noteObj.note);
                }}
                onMouseUp={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onMouseLeave={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (!playable) return;
                  const touch = e.changedTouches[0];
                  if (touch) handleNoteOn(noteObj.note, touch.identifier);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
              >
                <span className="key-label">{noteObj.note}</span>
              </div>
            );
          })}
          {keyboardNotes.filter((n) => n.isBlack).map((noteObj) => {
            const baseNote = noteObj.note.replace('#', '').replace(/\d/, '');
            const noteOctave = noteObj.note.slice(-1);
            const whiteIndex = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(baseNote);
            const octaveOffset = (parseInt(noteOctave) - octave) * 7;
            const position = whiteIndex + octaveOffset;
            const keyWidth = 100 / numWhiteKeys;
            const playable = canPlayNote(noteObj.note);

            // Position black key exactly on the boundary between white keys
            // The boundary is at (position + 1) * keyWidth, centered with half black key width
            return (
              <div
                key={noteObj.note}
                className={`key black-key ${activeNotes.has(noteObj.note) ? 'active' : ''} ${isInScale(noteObj.note) ? 'in-scale' : ''} ${scaleEnabled && !playable ? 'disabled' : ''}`}
                style={{ left: `calc(${(position + 1) * keyWidth}% - 15px)` }}
                onMouseDown={() => {
                  if (!playable) return;
                  mouseDownNotes.current.add(noteObj.note);
                  handleNoteOn(noteObj.note);
                }}
                onMouseUp={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onMouseLeave={() => {
                  if (mouseDownNotes.current.has(noteObj.note)) {
                    mouseDownNotes.current.delete(noteObj.note);
                    handleNoteOff(noteObj.note);
                  }
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (!playable) return;
                  const touch = e.changedTouches[0];
                  if (touch) handleNoteOn(noteObj.note, touch.identifier);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
                onTouchCancel={(e) => {
                  e.preventDefault();
                  const touch = e.changedTouches[0];
                  if (touch && activeTouches.current.get(touch.identifier) === noteObj.note) {
                    handleNoteOff(noteObj.note, touch.identifier);
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Capture Ribbon - Visual timeline for recording */}
      {(isSynthLoopCapture || recordedNotes.length > 0) && (
        <CaptureRibbon
          currentStep={synthCurrentStep >= 0 ? synthCurrentStep : 0}
          isRecording={isRecording || false}
          isPlaying={isPlaying || false}
          isCaptureMode={isSynthLoopCapture}
          recordedNotes={recordedNotes}
          capturedBars={!isSynthLoopCapture ? synthLoopBars : undefined}
          maxBars={isSynthLoopCapture ? 16 : synthLoopBars}
        />
      )}

      {/* Waveform Visualizer */}
      <WaveformVisualizer synth={synth} />

      {/* Action buttons - mobile only, below keyboard */}
      <div className="synth-mobile-actions">
        <button
          className="action-btn-mobile generate-btn"
          onClick={generateProgression}
        >
          GENERATE
        </button>
        <button className="action-btn-mobile mutate-btn" onClick={randomizeParams}>MUTATE</button>
        <button className="action-btn-mobile clear-btn" onClick={clearSequence}>CLEAR</button>
      </div>
    </div>
  );
};

// Knob component
interface SynthKnobProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const SynthKnob: React.FC<SynthKnobProps> = ({ label, value, onChange, min = 0, max = 1 }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  // Store refs to onChange and value to avoid stale closures
  const onChangeRef = useRef(onChange);
  const minRef = useRef(min);
  const maxRef = useRef(max);

  // Keep refs updated
  useEffect(() => {
    onChangeRef.current = onChange;
    minRef.current = min;
    maxRef.current = max;
  }, [onChange, min, max]);

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135;

  // Stable handler refs to avoid listener leak
  const handleMouseMoveRef = useRef<(e: MouseEvent) => void>();
  const handleMouseUpRef = useRef<() => void>();
  const handleTouchMoveRef = useRef<(e: TouchEvent) => void>();
  const handleTouchEndRef = useRef<() => void>();

  // Initialize stable handlers once
  useEffect(() => {
    handleMouseMoveRef.current = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = startY.current - e.clientY;
      const deltaValue = (deltaY / 100) * (maxRef.current - minRef.current);
      const newValue = Math.max(minRef.current, Math.min(maxRef.current, startValue.current + deltaValue));
      onChangeRef.current(newValue);
    };

    handleMouseUpRef.current = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMoveRef.current!);
      document.removeEventListener('mouseup', handleMouseUpRef.current!);
    };

    handleTouchMoveRef.current = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDragging.current) return;
      const deltaY = startY.current - e.touches[0].clientY;
      const deltaValue = (deltaY / 100) * (maxRef.current - minRef.current);
      const newValue = Math.max(minRef.current, Math.min(maxRef.current, startValue.current + deltaValue));
      onChangeRef.current(newValue);
    };

    handleTouchEndRef.current = () => {
      isDragging.current = false;
      document.removeEventListener('touchmove', handleTouchMoveRef.current!);
      document.removeEventListener('touchend', handleTouchEndRef.current!);
    };

    // Cleanup on unmount - remove any lingering listeners
    return () => {
      if (handleMouseMoveRef.current) {
        document.removeEventListener('mousemove', handleMouseMoveRef.current);
      }
      if (handleMouseUpRef.current) {
        document.removeEventListener('mouseup', handleMouseUpRef.current);
      }
      if (handleTouchMoveRef.current) {
        document.removeEventListener('touchmove', handleTouchMoveRef.current);
      }
      if (handleTouchEndRef.current) {
        document.removeEventListener('touchend', handleTouchEndRef.current);
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    document.addEventListener('mousemove', handleMouseMoveRef.current!);
    document.addEventListener('mouseup', handleMouseUpRef.current!);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startValue.current = value;
    document.addEventListener('touchmove', handleTouchMoveRef.current!, { passive: false });
    document.addEventListener('touchend', handleTouchEndRef.current!);
  };

  return (
    <div className="synth-knob-container">
      <div
        ref={knobRef}
        className="synth-knob"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="knob-body" style={{ transform: `rotate(${rotation}deg)` }}>
          <div className="knob-indicator" />
        </div>
      </div>
      <div className="knob-label">{label}</div>
    </div>
  );
};

// Waveform icons
const WaveformIcon: React.FC<{ type: WaveformType }> = ({ type }) => {
  const paths: { [key: string]: string } = {
    sine: 'M2 12 Q8 2, 14 12 Q20 22, 26 12',
    triangle: 'M2 12 L8 2 L20 22 L26 12',
    sawtooth: 'M2 12 L14 2 L14 22 L26 12',
    square: 'M2 12 L2 2 L14 2 L14 22 L26 22 L26 12',
  };

  return (
    <svg viewBox="0 0 28 24" className="waveform-icon">
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

export default Synth;
