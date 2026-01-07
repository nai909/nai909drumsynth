import React from 'react';
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

      <div className="params-grid">
        <div className="param-row">
          <div className="param-control">
            <label className="param-label">TUNE</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={track.tune}
              onChange={(e) => handleChange('tune', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.tune * 100).toFixed(0)}</div>
          </div>

          <div className="param-control">
            <label className="param-label">DECAY</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.decay}
              onChange={(e) => handleChange('decay', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.decay * 100).toFixed(0)}</div>
          </div>

          <div className="param-control">
            <label className="param-label">ATTACK</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.attack}
              onChange={(e) => handleChange('attack', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.attack * 100).toFixed(0)}</div>
          </div>
        </div>

        <div className="param-row">
          <div className="param-control">
            <label className="param-label">TONE</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.tone}
              onChange={(e) => handleChange('tone', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.tone * 100).toFixed(0)}</div>
          </div>

          <div className="param-control">
            <label className="param-label">SNAP</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.snap}
              onChange={(e) => handleChange('snap', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.snap * 100).toFixed(0)}</div>
          </div>

          <div className="param-control">
            <label className="param-label">LEVEL</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.volume}
              onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.volume * 100).toFixed(0)}</div>
          </div>
        </div>

        <div className="param-row">
          <div className="param-control">
            <label className="param-label">FILTER</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.filterCutoff}
              onChange={(e) => handleChange('filterCutoff', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.filterCutoff * 100).toFixed(0)}</div>
          </div>

          <div className="param-control">
            <label className="param-label">RESO</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.filterResonance}
              onChange={(e) => handleChange('filterResonance', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.filterResonance * 100).toFixed(0)}</div>
          </div>

          <div className="param-control">
            <label className="param-label">DRIVE</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={track.drive}
              onChange={(e) => handleChange('drive', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">{(track.drive * 100).toFixed(0)}</div>
          </div>
        </div>

        <div className="param-row">
          <div className="param-control param-pan">
            <label className="param-label">PAN</label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={track.pan}
              onChange={(e) => handleChange('pan', parseFloat(e.target.value))}
              className="param-slider"
            />
            <div className="param-value">
              {track.pan === 0 ? 'C' : track.pan > 0 ? `R${(track.pan * 100).toFixed(0)}` : `L${Math.abs(track.pan * 100).toFixed(0)}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackParams;
