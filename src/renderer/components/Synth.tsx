import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MelodicSynth, SynthParams, WaveformType, DEFAULT_SYNTH_PARAMS } from '../audio/MelodicSynth';
import './Synth.css';

interface SynthProps {
  synth: MelodicSynth;
}

// Define keyboard notes - 2 octaves
const OCTAVE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BASE_OCTAVE = 3;

const getKeyboardNotes = () => {
  const notes: { note: string; isBlack: boolean }[] = [];
  for (let octave = BASE_OCTAVE; octave <= BASE_OCTAVE + 1; octave++) {
    OCTAVE_NOTES.forEach((note) => {
      notes.push({
        note: `${note}${octave}`,
        isBlack: note.includes('#'),
      });
    });
  }
  return notes;
};

const KEYBOARD_NOTES = getKeyboardNotes();

// Computer keyboard mapping
const KEY_MAP: { [key: string]: string } = {
  'a': 'C3', 'w': 'C#3', 's': 'D3', 'e': 'D#3', 'd': 'E3',
  'f': 'F3', 't': 'F#3', 'g': 'G3', 'y': 'G#3', 'h': 'A3',
  'u': 'A#3', 'j': 'B3', 'k': 'C4', 'o': 'C#4', 'l': 'D4',
  'p': 'D#4', ';': 'E4', "'": 'F4',
};

const Synth: React.FC<SynthProps> = ({ synth }) => {
  const [params, setParams] = useState<SynthParams>(DEFAULT_SYNTH_PARAMS);
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set());
  const keysPressed = useRef<Set<string>>(new Set());

  const handleNoteOn = useCallback(async (note: string) => {
    await synth.noteOn(note, 0.8);
    setActiveNotes((prev) => new Set([...prev, note]));
  }, [synth]);

  const handleNoteOff = useCallback((note: string) => {
    synth.noteOff(note);
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });
  }, [synth]);

  // Computer keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (KEY_MAP[key] && !keysPressed.current.has(key)) {
        keysPressed.current.add(key);
        handleNoteOn(KEY_MAP[key]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (KEY_MAP[key]) {
        keysPressed.current.delete(key);
        handleNoteOff(KEY_MAP[key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleNoteOn, handleNoteOff]);

  const handleParamChange = (param: keyof SynthParams, value: number | WaveformType) => {
    const newParams = { ...params, [param]: value };
    setParams(newParams);
    synth.updateParams({ [param]: value });
  };

  const waveforms: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  return (
    <div className="synth-container">
      <div className="synth-panel">
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

        {/* Other params */}
        <div className="synth-section">
          <div className="section-label">OUTPUT</div>
          <div className="knob-row">
            <SynthKnob
              label="DETUNE"
              value={params.detune}
              onChange={(v) => handleParamChange('detune', v)}
              min={-1}
              max={1}
            />
            <SynthKnob
              label="VOLUME"
              value={params.volume}
              onChange={(v) => handleParamChange('volume', v)}
            />
          </div>
        </div>
      </div>

      {/* Keyboard */}
      <div className="keyboard-container">
        <div className="keyboard">
          {KEYBOARD_NOTES.filter((n) => !n.isBlack).map((noteObj, index) => (
            <div
              key={noteObj.note}
              className={`key white-key ${activeNotes.has(noteObj.note) ? 'active' : ''}`}
              onMouseDown={() => handleNoteOn(noteObj.note)}
              onMouseUp={() => handleNoteOff(noteObj.note)}
              onMouseLeave={() => activeNotes.has(noteObj.note) && handleNoteOff(noteObj.note)}
              onTouchStart={(e) => {
                e.preventDefault();
                handleNoteOn(noteObj.note);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleNoteOff(noteObj.note);
              }}
            >
              <span className="key-label">{noteObj.note}</span>
            </div>
          ))}
          {KEYBOARD_NOTES.filter((n) => n.isBlack).map((noteObj) => {
            const baseNote = noteObj.note.replace('#', '').replace(/\d/, '');
            const octave = noteObj.note.slice(-1);
            const whiteIndex = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(baseNote);
            const octaveOffset = (parseInt(octave) - BASE_OCTAVE) * 7;
            const position = whiteIndex + octaveOffset;

            return (
              <div
                key={noteObj.note}
                className={`key black-key ${activeNotes.has(noteObj.note) ? 'active' : ''}`}
                style={{ left: `calc(${position * (100 / 14)}% + ${100 / 14 / 2}% - 15px)` }}
                onMouseDown={() => handleNoteOn(noteObj.note)}
                onMouseUp={() => handleNoteOff(noteObj.note)}
                onMouseLeave={() => activeNotes.has(noteObj.note) && handleNoteOff(noteObj.note)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleNoteOn(noteObj.note);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleNoteOff(noteObj.note);
                }}
              />
            );
          })}
        </div>
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

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135;

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    const deltaValue = (deltaY / 150) * (max - min);
    const newValue = Math.max(min, Math.min(max, startValue.current + deltaValue));
    onChange(newValue);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="synth-knob-container">
      <div
        ref={knobRef}
        className="synth-knob"
        onMouseDown={handleMouseDown}
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
