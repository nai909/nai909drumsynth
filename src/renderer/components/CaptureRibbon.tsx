import React, { useMemo, useState, useEffect, useRef } from 'react';
import './CaptureRibbon.css';

export interface RecordedNote {
  step: number;
  note: string;
  length?: number;
}

interface CaptureRibbonProps {
  currentStep: number; // 0-63 during capture
  isRecording: boolean;
  isPlaying: boolean;
  isCaptureMode: boolean;
  recordedNotes: RecordedNote[];
  capturedBars?: 1 | 2 | 3 | 4; // Set when capture completes
  maxBars?: number; // 4 during capture
  onTap?: () => void; // Navigate to MELODY view when tapped
}

// Convert note to a height percentage (for visual pitch representation)
const noteToHeight = (note: string): number => {
  const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = note.replace(/\d+$/, '');
  const octave = parseInt(note.match(/\d+$/)?.[0] || '3');
  const noteIndex = noteOrder.indexOf(noteName);
  // Map to 20-90% range (leaving room at top and bottom)
  const totalRange = (octave - 2) * 12 + noteIndex; // C2 = 0, C5 = 36
  return 20 + (totalRange / 36) * 70;
};

const CaptureRibbon: React.FC<CaptureRibbonProps> = ({
  currentStep,
  isRecording,
  isPlaying,
  isCaptureMode,
  recordedNotes,
  capturedBars,
  maxBars = 4,
  onTap,
}) => {
  // Idle fade state - fade out after 10 seconds of inactivity
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Reset idle timer on activity
  useEffect(() => {
    if (isPlaying || isRecording || isCaptureMode) {
      setIsIdle(false);
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    } else if (recordedNotes.length > 0) {
      // Start idle timer when stopped but notes exist
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 10000); // 10 seconds
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isPlaying, isRecording, isCaptureMode, recordedNotes.length]);

  // Total steps in the capture window
  const totalSteps = maxBars * 16;

  // Calculate which bar we're in (1-indexed for display)
  const currentBar = Math.floor(currentStep / 16) + 1;

  // Detect beat 1 of any bar (step 0, 16, 32, 48 within the loop)
  const isOnBeatOne = isPlaying && (currentStep % 16 === 0);

  // Playhead position as percentage
  const playheadPosition = (currentStep / totalSteps) * 100;

  // Determine display state
  const isActive = isPlaying && (isRecording || isCaptureMode);
  const showPlayhead = isPlaying;

  // Group notes by their bar for rendering
  const noteMarkers = useMemo(() => {
    return recordedNotes.map((note, index) => {
      const leftPercent = (note.step / totalSteps) * 100;
      const widthPercent = ((note.length || 1) / totalSteps) * 100;
      const heightPercent = noteToHeight(note.note);

      return (
        <div
          key={`${note.step}-${note.note}-${index}`}
          className="ribbon-note"
          style={{
            left: `${leftPercent}%`,
            width: `${Math.max(widthPercent, 0.5)}%`,
            bottom: `${heightPercent}%`,
          }}
        />
      );
    });
  }, [recordedNotes, totalSteps]);

  // Don't render if not in capture mode and no recorded notes
  if (!isCaptureMode && recordedNotes.length === 0) {
    return null;
  }

  // Handle tap - wake from idle and/or navigate
  const handleTap = () => {
    if (isIdle) {
      setIsIdle(false);
      lastActivityRef.current = Date.now();
    }
    if (onTap && recordedNotes.length > 0 && !isRecording) {
      onTap();
    }
  };

  return (
    <div
      className={`capture-ribbon ${isActive ? 'active' : ''} ${isRecording ? 'recording' : ''} ${isIdle ? 'idle' : ''} ${isOnBeatOne ? 'beat-one' : ''} ${onTap && recordedNotes.length > 0 && !isRecording ? 'tappable' : ''}`}
      onClick={handleTap}
    >
      {/* Bar indicator */}
      <div className="ribbon-bar-indicator">
        {isRecording && isPlaying ? (
          <span className="bar-text">Bar {currentBar} of {maxBars}</span>
        ) : isCaptureMode ? (
          <span className="bar-text ready">Ready to capture</span>
        ) : capturedBars ? (
          <span className="bar-text captured">
            {capturedBars} bar{capturedBars > 1 ? 's' : ''}
            {onTap && !isPlaying && <span className="tap-hint"> · tap to edit</span>}
          </span>
        ) : null}
      </div>

      {/* The ribbon timeline */}
      <div className="ribbon-timeline">
        {/* Bar divisions */}
        {Array.from({ length: maxBars }, (_, i) => (
          <div key={i} className="ribbon-bar">
            <span className="bar-number">{i + 1}</span>
            {/* Beat markers within each bar */}
            <div className="beat-markers">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="beat-marker" />
              ))}
            </div>
          </div>
        ))}

        {/* Note markers */}
        <div className="ribbon-notes">
          {noteMarkers}
        </div>

        {/* Playhead */}
        {showPlayhead && (
          <div
            className="ribbon-playhead"
            style={{ left: `${playheadPosition}%` }}
          />
        )}
      </div>

      {/* Progress fill (subtle background showing how far through the loop) */}
      {isPlaying && (
        <div
          className="ribbon-progress"
          style={{ width: `${playheadPosition}%` }}
        />
      )}
    </div>
  );
};

export default CaptureRibbon;
