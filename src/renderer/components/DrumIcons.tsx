import React from 'react';

// SVG icons for each drum type
export const DrumIcons: Record<string, React.FC<{ className?: string }>> = {
  'kick': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Drum shell - front view */}
      <ellipse cx="32" cy="32" rx="28" ry="26" stroke="currentColor" strokeWidth="3"/>
      {/* Drum head */}
      <ellipse cx="32" cy="32" rx="22" ry="20" stroke="currentColor" strokeWidth="2"/>
      {/* Center port hole */}
      <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="2"/>
      {/* Lugs on sides */}
      <rect x="2" y="26" width="6" height="12" rx="2" fill="currentColor"/>
      <rect x="56" y="26" width="6" height="12" rx="2" fill="currentColor"/>
      {/* Legs */}
      <path d="M18 56L14 62M46 56L50 62" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  'snare': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="20" rx="26" ry="10" stroke="currentColor" strokeWidth="3"/>
      <path d="M6 20V44C6 50 18 56 32 56C46 56 58 50 58 44V20" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="32" cy="44" rx="26" ry="10" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2"/>
      <line x1="14" y1="22" x2="14" y2="42" stroke="currentColor" strokeWidth="2"/>
      <line x1="50" y1="22" x2="50" y2="42" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  'hihat-closed': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="30" rx="28" ry="8" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="32" cy="34" rx="28" ry="8" stroke="currentColor" strokeWidth="3"/>
      <circle cx="32" cy="32" r="6" fill="currentColor"/>
      <line x1="32" y1="42" x2="32" y2="60" stroke="currentColor" strokeWidth="3"/>
      <line x1="24" y1="58" x2="40" y2="58" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  'hihat-open': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="24" rx="28" ry="8" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="32" cy="40" rx="28" ry="8" stroke="currentColor" strokeWidth="3"/>
      <circle cx="32" cy="24" r="5" fill="currentColor"/>
      <circle cx="32" cy="40" r="5" fill="currentColor"/>
      <line x1="32" y1="48" x2="32" y2="60" stroke="currentColor" strokeWidth="3"/>
      <path d="M10 28L10 36M54 28L54 36" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2"/>
    </svg>
  ),
  'clap': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Thumb */}
      <path d="M14 38C10 36 8 32 10 28C12 24 16 24 18 26L22 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      {/* Index finger */}
      <path d="M22 32V12C22 10 24 8 26 8C28 8 30 10 30 12V30" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      {/* Middle finger */}
      <path d="M30 30V8C30 6 32 4 34 4C36 4 38 6 38 8V30" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      {/* Ring finger */}
      <path d="M38 30V10C38 8 40 6 42 6C44 6 46 8 46 10V32" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      {/* Pinky finger */}
      <path d="M46 32V16C46 14 48 12 50 12C52 12 54 14 54 16V34" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      {/* Palm */}
      <path d="M22 32C20 38 18 44 20 50C22 56 30 60 38 58C46 56 54 48 54 40V34" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  'tom-low': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="14" rx="26" ry="10" stroke="currentColor" strokeWidth="3"/>
      <path d="M6 14V50C6 56 18 62 32 62C46 62 58 56 58 50V14" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="32" cy="14" rx="16" ry="6" stroke="currentColor" strokeWidth="2"/>
      <text x="32" y="42" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">L</text>
    </svg>
  ),
  'tom-mid': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="16" rx="24" ry="10" stroke="currentColor" strokeWidth="3"/>
      <path d="M8 16V46C8 52 18 58 32 58C46 58 56 52 56 46V16" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="32" cy="16" rx="14" ry="6" stroke="currentColor" strokeWidth="2"/>
      <text x="32" y="40" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">M</text>
    </svg>
  ),
  'tom-high': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="18" rx="22" ry="10" stroke="currentColor" strokeWidth="3"/>
      <path d="M10 18V44C10 50 20 54 32 54C44 54 54 50 54 44V18" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="32" cy="18" rx="12" ry="5" stroke="currentColor" strokeWidth="2"/>
      <text x="32" y="40" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight="bold">H</text>
    </svg>
  ),
  'rimshot': ({ className }) => (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Drum rim - top view */}
      <ellipse cx="32" cy="32" rx="26" ry="20" stroke="currentColor" strokeWidth="3"/>
      <ellipse cx="32" cy="32" rx="20" ry="14" stroke="currentColor" strokeWidth="2"/>
      {/* Stick hitting the rim */}
      <line x1="50" y1="8" x2="38" y2="24" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
      {/* Impact lines */}
      <path d="M44 20L52 16M46 26L54 24M40 18L46 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};
