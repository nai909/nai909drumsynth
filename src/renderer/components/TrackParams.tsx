import React, { useRef } from 'react';
import { DrumTrack } from '../types';
import { INSTRUMENT_DEFAULTS, generateRandomParams } from '../constants/instrumentDefaults';
import { DrumIcons } from './DrumIcons';
import './TrackParams.css';

interface TrackParamsProps {
  track: DrumTrack;
  trackIndex: number;
  onParamChange: (param: keyof DrumTrack, value: number) => void;
  onTrigger?: (trackIndex: number) => void;
}

// Knob component for parameters
interface ParamKnobProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  displayValue?: string;
}

const ParamKnob: React.FC<ParamKnobProps> = ({ label, value, onChange, min = 0, max = 1, displayValue }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const normalizedValue = (value - min) / (max - min);
  const rotation = normalizedValue * 270 - 135;

  const handleStart = (clientY: number) => {
    isDragging.current = true;
    startY.current = clientY;
    startValue.current = value;
  };

  const handleMove = (clientY: number) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - clientY;
    const deltaValue = (deltaY / 100) * (max - min);
    const newValue = Math.max(min, Math.min(max, startValue.current + deltaValue));
    onChange(newValue);
  };

  const handleEnd = () => {
    isDragging.current = false;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientY);
    const moveHandler = (e: MouseEvent) => handleMove(e.clientY);
    const upHandler = () => {
      handleEnd();
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
    };
    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
    const moveHandler = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientY);
    };
    const endHandler = () => {
      handleEnd();
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', endHandler);
    };
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', endHandler);
  };

  const display = displayValue !== undefined ? displayValue : (value * 100).toFixed(0);

  return (
    <div className="param-knob-container">
      <div className="param-knob-label">{label}</div>
      <div
        ref={knobRef}
        className="param-knob"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="param-knob-body" style={{ transform: `rotate(${rotation}deg)` }}>
          <div className="param-knob-indicator" />
        </div>
      </div>
      <div className="param-knob-value">{display}</div>
    </div>
  );
};

const TrackParams: React.FC<TrackParamsProps> = ({ track, trackIndex, onParamChange, onTrigger }) => {
  const handleChange = (param: keyof DrumTrack, value: number) => {
    onParamChange(param, value);
  };

  const handleRandomize = () => {
    const randomParams = generateRandomParams();
    Object.entries(randomParams).forEach(([param, value]) => {
      onParamChange(param as keyof DrumTrack, value);
    });
  };

  const handleReset = () => {
    const defaults = INSTRUMENT_DEFAULTS[track.soundEngine];
    if (defaults) {
      Object.entries(defaults).forEach(([param, value]) => {
        onParamChange(param as keyof DrumTrack, value);
      });
    }
  };

  const getPanDisplay = (pan: number) => {
    if (pan === 0) return 'C';
    return pan > 0 ? `R${(pan * 100).toFixed(0)}` : `L${Math.abs(pan * 100).toFixed(0)}`;
  };

  return (
    <div className="track-params">
      <div className="track-params-header">
        <div className="track-params-title-section">
          {DrumIcons[track.soundEngine] && (
            <button
              className="track-params-icon-btn"
              onClick={() => onTrigger?.(trackIndex)}
              title={`Play ${track.name}`}
            >
              {React.createElement(DrumIcons[track.soundEngine], { className: 'params-icon-svg' })}
            </button>
          )}
          <h3 className="track-params-title">{track.name}</h3>
        </div>
        <div className="track-params-header-right">
          <button className="param-action-btn randomize-btn" onClick={handleRandomize} title="Randomize parameters">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
            </svg>
            RANDOM
          </button>
          <button className="param-action-btn reset-btn" onClick={handleReset} title="Reset to defaults">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            RESET
          </button>
        </div>
      </div>

      <div className="params-knob-grid">
        <ParamKnob
          label="TUNE"
          value={track.tune}
          onChange={(v) => handleChange('tune', v)}
          min={-1}
          max={1}
          displayValue={(track.tune * 100).toFixed(0)}
        />
        <ParamKnob
          label="DECAY"
          value={track.decay}
          onChange={(v) => handleChange('decay', v)}
        />
        <ParamKnob
          label="ATTACK"
          value={track.attack}
          onChange={(v) => handleChange('attack', v)}
        />
        <ParamKnob
          label="TONE"
          value={track.tone}
          onChange={(v) => handleChange('tone', v)}
        />
        <ParamKnob
          label="SNAP"
          value={track.snap}
          onChange={(v) => handleChange('snap', v)}
        />
        <ParamKnob
          label="LEVEL"
          value={track.volume}
          onChange={(v) => handleChange('volume', v)}
        />
        <ParamKnob
          label="FILTER"
          value={track.filterCutoff}
          onChange={(v) => handleChange('filterCutoff', v)}
        />
        <ParamKnob
          label="RESO"
          value={track.filterResonance}
          onChange={(v) => handleChange('filterResonance', v)}
        />
        <ParamKnob
          label="DRIVE"
          value={track.drive}
          onChange={(v) => handleChange('drive', v)}
        />
        <ParamKnob
          label="PAN"
          value={track.pan}
          onChange={(v) => handleChange('pan', v)}
          min={-1}
          max={1}
          displayValue={getPanDisplay(track.pan)}
        />
      </div>
    </div>
  );
};

export default TrackParams;
