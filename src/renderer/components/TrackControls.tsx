import React from 'react';
import { DrumTrack } from '../types';
import './TrackControls.css';

interface TrackControlsProps {
  tracks: DrumTrack[];
  selectedTrack: number;
  onSelectTrack: (index: number) => void;
  onMute: (index: number) => void;
  onSolo: (index: number) => void;
}

const TrackControls: React.FC<TrackControlsProps> = ({
  tracks,
  selectedTrack,
  onSelectTrack,
  onMute,
  onSolo,
}) => {
  return (
    <div className="track-controls">
      <div className="track-controls-header">TRACKS</div>
      <div className="tracks-list">
        {tracks.map((track, index) => (
          <div
            key={track.id}
            className={`track-item ${index === selectedTrack ? 'selected' : ''}`}
            onClick={() => onSelectTrack(index)}
          >
            <div className="track-name">{track.name}</div>
            <div className="track-buttons">
              <button
                className={`track-btn mute-btn ${track.muted ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onMute(index);
                }}
              >
                M
              </button>
              <button
                className={`track-btn solo-btn ${track.solo ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSolo(index);
                }}
              >
                S
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrackControls;
