import React, { useRef, useEffect, useCallback } from 'react';
import { MelodicSynth } from '../audio/MelodicSynth';
import './WaveformVisualizer.css';

interface WaveformVisualizerProps {
  synth: MelodicSynth;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ synth }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get the actual displayed size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set canvas resolution to match display size
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    const width = rect.width;
    const height = rect.height;

    // Clear canvas with dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines for oscilloscope look
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (height / 4) * i);
      ctx.lineTo(width, (height / 4) * i);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((width / 8) * i, 0);
      ctx.lineTo((width / 8) * i, height);
      ctx.stroke();
    }

    // Center line (brighter)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Get waveform data from synth
    const waveform = synth.getWaveformData();

    // Get the accent color from CSS variable
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-primary').trim() || '#00ffaa';

    // Draw glow layer (thicker, more transparent)
    ctx.beginPath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.3;

    const sliceWidth = width / waveform.length;
    let x = 0;
    const amplify = 2.5; // Amplify waveform for more pronounced motion

    for (let i = 0; i < waveform.length; i++) {
      const v = Math.max(-1, Math.min(1, waveform[i] * amplify)); // Amplify and clamp
      const y = ((1 - v) / 2) * height * 0.9 + height * 0.05;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.stroke();

    // Draw main waveform line (crisp)
    ctx.beginPath();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 1;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;

    x = 0;
    for (let i = 0; i < waveform.length; i++) {
      const v = Math.max(-1, Math.min(1, waveform[i] * amplify)); // Amplify and clamp
      const y = ((1 - v) / 2) * height * 0.9 + height * 0.05;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Continue animation loop
    animationRef.current = requestAnimationFrame(draw);
  }, [synth]);

  useEffect(() => {
    // Start animation loop
    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <div className="waveform-visualizer">
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
};

export default WaveformVisualizer;
