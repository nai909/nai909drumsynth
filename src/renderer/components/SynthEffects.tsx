import React, { useRef } from 'react';
import { SynthParams } from '../audio/MelodicSynth';
import './SynthEffects.css';

interface SynthEffectsProps {
  params: SynthParams;
  onParamsChange: (params: SynthParams) => void;
}

const SynthEffects: React.FC<SynthEffectsProps> = ({ params, onParamsChange }) => {
  const handleParamChange = (param: keyof SynthParams, value: number | boolean) => {
    const newParams = { ...params, [param]: value };
    onParamsChange(newParams);
  };

  return (
    <div className="synth-effects-container">
      <div className="effects-panel">
        {/* Reverb */}
        <div className="effect-section">
          <div className="effect-header">
            <span className="effect-label">REVERB</span>
          </div>
          <div className="effect-description">Adds space and atmosphere</div>
          <div className="knob-row">
            <EffectKnob
              label="MIX"
              value={params.reverbMix}
              onChange={(v) => handleParamChange('reverbMix', v)}
            />
            <EffectKnob
              label="DECAY"
              value={params.reverbDecay}
              onChange={(v) => handleParamChange('reverbDecay', v)}
            />
          </div>
        </div>

        {/* Delay */}
        <div className="effect-section">
          <div className="effect-header">
            <span className="effect-label">DELAY</span>
          </div>
          <div className="effect-description">Echo and rhythmic repeats</div>
          <div className="knob-row">
            <EffectKnob
              label="MIX"
              value={params.delayMix}
              onChange={(v) => handleParamChange('delayMix', v)}
            />
            <EffectKnob
              label="TIME"
              value={params.delayTime}
              onChange={(v) => handleParamChange('delayTime', v)}
            />
            <EffectKnob
              label="FEEDBACK"
              value={params.delayFeedback}
              onChange={(v) => handleParamChange('delayFeedback', v)}
            />
          </div>
        </div>

        {/* LFO (Wobble) */}
        <div className="effect-section">
          <div className="effect-header">
            <span className="effect-label">LFO</span>
            <button
              className={`effect-toggle ${params.lfoEnabled ? 'active' : ''}`}
              onClick={() => handleParamChange('lfoEnabled', !params.lfoEnabled)}
            >
              {params.lfoEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="effect-description">Modulates filter for wobble</div>
          <div className="knob-row">
            <EffectKnob
              label="RATE"
              value={params.lfoRate}
              onChange={(v) => handleParamChange('lfoRate', v)}
            />
            <EffectKnob
              label="DEPTH"
              value={params.lfoDepth}
              onChange={(v) => handleParamChange('lfoDepth', v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Knob component for effects
interface EffectKnobProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const EffectKnob: React.FC<EffectKnobProps> = ({ label, value, onChange, min = 0, max = 1 }) => {
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
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientY);
  };

  const handleMouseUp = () => {
    handleEnd();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  return (
    <div className="effect-knob-container">
      <div
        ref={knobRef}
        className="effect-knob"
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

export default SynthEffects;
