/**
 * Simple MIDI parser to extract note patterns from MIDI files
 * Outputs JSON data for embedding in the app
 */

const fs = require('fs');
const path = require('path');

// MIDI constants
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/**
 * Read a variable-length quantity from MIDI data
 */
function readVarLen(data, offset) {
  let value = 0;
  let byte;
  let bytesRead = 0;

  do {
    byte = data[offset + bytesRead];
    value = (value << 7) | (byte & 0x7f);
    bytesRead++;
  } while (byte & 0x80);

  return { value, bytesRead };
}

/**
 * Convert MIDI note number to note name (e.g., 60 -> "C4")
 */
function midiToNoteName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}

/**
 * Parse a MIDI file and extract note events
 */
function parseMidiFile(filePath) {
  const data = fs.readFileSync(filePath);
  const notes = [];

  // Check MIDI header
  if (data.toString('ascii', 0, 4) !== 'MThd') {
    console.error(`Invalid MIDI file: ${filePath}`);
    return null;
  }

  // Read header
  const headerLength = data.readUInt32BE(4);
  const format = data.readUInt16BE(8);
  const numTracks = data.readUInt16BE(10);
  const timeDivision = data.readUInt16BE(12);

  // Parse tracks
  let offset = 8 + headerLength;

  for (let track = 0; track < numTracks; track++) {
    if (data.toString('ascii', offset, offset + 4) !== 'MTrk') {
      break;
    }

    const trackLength = data.readUInt32BE(offset + 4);
    let trackOffset = offset + 8;
    const trackEnd = trackOffset + trackLength;
    let absoluteTime = 0;
    let runningStatus = 0;

    while (trackOffset < trackEnd) {
      // Read delta time
      const delta = readVarLen(data, trackOffset);
      absoluteTime += delta.value;
      trackOffset += delta.bytesRead;

      if (trackOffset >= trackEnd) break;

      // Read event
      let eventType = data[trackOffset];

      // Handle running status
      if (eventType < 0x80) {
        eventType = runningStatus;
      } else {
        trackOffset++;
        if (eventType < 0xf0) {
          runningStatus = eventType;
        }
      }

      const channel = eventType & 0x0f;
      const type = eventType & 0xf0;

      if (type === NOTE_ON || type === NOTE_OFF) {
        const note = data[trackOffset++];
        const velocity = data[trackOffset++];

        // Note on with velocity > 0
        if (type === NOTE_ON && velocity > 0) {
          notes.push({
            time: absoluteTime,
            note: midiToNoteName(note),
            midiNote: note,
            velocity: velocity,
            type: 'on'
          });
        } else {
          // Note off (or note on with velocity 0)
          notes.push({
            time: absoluteTime,
            note: midiToNoteName(note),
            midiNote: note,
            type: 'off'
          });
        }
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) {
        // Aftertouch, Control Change, Pitch Bend - 2 data bytes
        trackOffset += 2;
      } else if (type === 0xc0 || type === 0xd0) {
        // Program Change, Channel Pressure - 1 data byte
        trackOffset += 1;
      } else if (eventType === 0xff) {
        // Meta event
        const metaType = data[trackOffset++];
        const metaLen = readVarLen(data, trackOffset);
        trackOffset += metaLen.bytesRead + metaLen.value;
      } else if (eventType === 0xf0 || eventType === 0xf7) {
        // SysEx
        const sysexLen = readVarLen(data, trackOffset);
        trackOffset += sysexLen.bytesRead + sysexLen.value;
      }
    }

    offset = trackEnd;
  }

  return { notes, timeDivision };
}

/**
 * Convert MIDI notes to sequencer steps (16 steps per bar, 4 bars = 64 steps)
 */
function midiToSteps(midiData, barsToCapture = 4) {
  if (!midiData || !midiData.notes.length) return null;

  const { notes, timeDivision } = midiData;
  const stepsPerBar = 16;
  const totalSteps = barsToCapture * stepsPerBar;
  const ticksPerStep = timeDivision / 4; // 16th notes

  // Initialize empty steps
  const steps = Array(totalSteps).fill(null).map(() => ({ active: false, note: 'C4' }));

  // Get only note-on events
  const noteOns = notes.filter(n => n.type === 'on');

  // Find the time range
  if (noteOns.length === 0) return null;

  const maxTime = ticksPerStep * totalSteps;

  // Place notes into steps
  for (const noteEvent of noteOns) {
    const stepIndex = Math.floor(noteEvent.time / ticksPerStep);
    if (stepIndex >= 0 && stepIndex < totalSteps) {
      steps[stepIndex] = {
        active: true,
        note: noteEvent.note
      };
    }
  }

  return steps;
}

/**
 * Scan directory for MIDI files and parse them all
 */
function scanMidiDirectory(baseDir) {
  const patterns = [];

  // Get all subdirectories (chord progression folders)
  const progressionDirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'));

  for (const dir of progressionDirs) {
    const progressionPath = path.join(baseDir, dir.name);

    // Get all MIDI files in this progression folder
    const midiFiles = fs.readdirSync(progressionPath)
      .filter(f => f.endsWith('.mid'));

    for (const midiFile of midiFiles) {
      const filePath = path.join(progressionPath, midiFile);

      try {
        const midiData = parseMidiFile(filePath);
        const steps = midiToSteps(midiData);

        if (steps && steps.some(s => s.active)) {
          patterns.push({
            name: path.basename(midiFile, '.mid'),
            progression: dir.name,
            steps: steps
          });
        }
      } catch (err) {
        console.error(`Error parsing ${filePath}: ${err.message}`);
      }
    }
  }

  return patterns;
}

// Main execution
const midiDir = '/Users/ianzwing/Documents/Sample Packs /Orchestral Midi/90-115bpm';

console.log('Parsing MIDI files from:', midiDir);
const patterns = scanMidiDirectory(midiDir);
console.log(`Found ${patterns.length} patterns`);

// Output as TypeScript data
const output = `/**
 * Pre-parsed MIDI melodies from Orchestral MIDI library
 * Auto-generated - do not edit
 */

export interface MidiPattern {
  name: string;
  progression: string;
  steps: { active: boolean; note: string }[];
}

export const MIDI_PATTERNS: MidiPattern[] = ${JSON.stringify(patterns, null, 2)};
`;

fs.writeFileSync(
  path.join(__dirname, '../src/renderer/audio/midiPatterns.ts'),
  output
);

console.log('Written to src/renderer/audio/midiPatterns.ts');
