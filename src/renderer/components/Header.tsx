import React, { useState, useRef, useEffect } from 'react';
import './Header.css';

const THEMES = ['purple', 'blue', 'red', 'orange', 'green', 'cyan', 'pink'] as const;
type Theme = typeof THEMES[number];

// Map hue values to theme names
const HUE_TO_THEME: { hue: number; theme: Theme }[] = [
  { hue: 280, theme: 'purple' },
  { hue: 320, theme: 'pink' },
  { hue: 0, theme: 'red' },
  { hue: 30, theme: 'orange' },
  { hue: 140, theme: 'green' },
  { hue: 190, theme: 'cyan' },
  { hue: 220, theme: 'blue' },
];

// Theme to hue mapping for slider position
const THEME_TO_HUE: Record<Theme, number> = {
  purple: 280,
  pink: 320,
  red: 0,
  orange: 30,
  green: 140,
  cyan: 190,
  blue: 220,
};

function findClosestTheme(hue: number): Theme {
  let closest = HUE_TO_THEME[0];
  let minDist = Infinity;

  for (const entry of HUE_TO_THEME) {
    // Handle circular hue distance
    let dist = Math.abs(entry.hue - hue);
    if (dist > 180) dist = 360 - dist;

    if (dist < minDist) {
      minDist = dist;
      closest = entry;
    }
  }

  return closest.theme;
}

interface PsychedelicSmileyProps {
  onClick: () => void;
}

const PsychedelicSmiley: React.FC<PsychedelicSmileyProps> = ({ onClick }) => (
  <svg
    className="psychedelic-smiley clickable"
    viewBox="0 0 64 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ overflow: 'visible' }}
    onClick={onClick}
  >
    {/* Melting face blob with drips - uses CSS class for fill color */}
    <path
      className="smiley-face"
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
    >
      <animate
        attributeName="d"
        values="M32 4 C14 4 4 16 4 32 C4 44 10 52 14 56 L14 66 C14 70 12 74 12 74 C12 78 16 78 16 74 L16 62 C18 64 22 66 24 68 L24 72 C24 76 22 80 22 80 C22 84 26 84 26 80 L26 70 C28 71 30 71 32 71 C34 71 36 71 38 70 L38 76 C38 80 36 84 36 84 C36 88 40 88 40 80 L40 68 C42 66 46 64 48 62 L48 70 C48 74 46 78 46 78 C46 82 50 82 50 78 L50 58 C54 54 60 46 60 32 C60 16 50 4 32 4Z;
               M32 4 C14 4 4 16 4 32 C4 44 10 52 14 56 L14 68 C14 72 12 76 12 76 C12 80 16 80 16 76 L16 62 C18 64 22 66 24 68 L24 74 C24 78 22 82 22 82 C22 86 26 86 26 82 L26 70 C28 71 30 71 32 71 C34 71 36 71 38 70 L38 74 C38 78 36 82 36 82 C36 86 40 86 40 82 L40 68 C42 66 46 64 48 62 L48 68 C48 72 46 76 46 76 C46 80 50 80 50 76 L50 58 C54 54 60 46 60 32 C60 16 50 4 32 4Z;
               M32 4 C14 4 4 16 4 32 C4 44 10 52 14 56 L14 66 C14 70 12 74 12 74 C12 78 16 78 16 74 L16 62 C18 64 22 66 24 68 L24 72 C24 76 22 80 22 80 C22 84 26 84 26 80 L26 70 C28 71 30 71 32 71 C34 71 36 71 38 70 L38 76 C38 80 36 84 36 84 C36 88 40 88 40 80 L40 68 C42 66 46 64 48 62 L48 70 C48 74 46 78 46 78 C46 82 50 82 50 78 L50 58 C54 54 60 46 60 32 C60 16 50 4 32 4Z"
        dur="3s"
        repeatCount="indefinite"
      />
    </path>

    {/* Left eye - dripping */}
    <ellipse className="smiley-eye" cx="20" cy="28" rx="5" ry="8">
      <animate attributeName="ry" values="8;10;8" dur="2s" repeatCount="indefinite"/>
    </ellipse>

    {/* Right eye - dripping */}
    <ellipse className="smiley-eye" cx="44" cy="28" rx="5" ry="8">
      <animate attributeName="ry" values="8;10;8" dur="2s" repeatCount="indefinite" begin="0.3s"/>
    </ellipse>

    {/* Wavy smile */}
    <path
      className="smiley-mouth"
      d="M16 44 Q24 54, 32 52 Q40 50, 48 44"
      strokeWidth="4"
      fill="none"
      strokeLinecap="round"
    >
      <animate
        attributeName="d"
        values="M16 44 Q24 54, 32 52 Q40 50, 48 44;M16 46 Q24 56, 32 54 Q40 52, 48 46;M16 44 Q24 54, 32 52 Q40 50, 48 44"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

interface ColorPickerPopupProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}

const ColorPickerPopup: React.FC<ColorPickerPopupProps> = ({ currentTheme, onThemeChange, onClose }) => {
  const [hue, setHue] = useState(THEME_TO_HUE[currentTheme]);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHue = parseInt(e.target.value);
    setHue(newHue);
    const theme = findClosestTheme(newHue);
    onThemeChange(theme);
  };

  return (
    <div className="color-picker-popup" ref={popupRef}>
      <div className="color-picker-label">THEME COLOR</div>
      <input
        type="range"
        min="0"
        max="360"
        value={hue}
        onChange={handleHueChange}
        className="hue-slider"
      />
      <div className="color-preview" style={{ background: `hsl(${hue}, 70%, 60%)` }} />
    </div>
  );
};

interface HeaderProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const Header: React.FC<HeaderProps> = ({ theme, onThemeChange }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <div className="smiley-wrapper">
            <PsychedelicSmiley onClick={() => setShowColorPicker(!showColorPicker)} />
            {showColorPicker && (
              <ColorPickerPopup
                currentTheme={theme}
                onThemeChange={onThemeChange}
                onClose={() => setShowColorPicker(false)}
              />
            )}
          </div>
          <div className="logo-text">IZ DRUM MACHINE</div>
        </div>
      </div>
    </header>
  );
};

export default Header;
export { THEMES };
export type { Theme };
