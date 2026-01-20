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
 * Extract key/category from filename
 * e.g., "Cymatics - Essential MIDI 1 - C Min.mid" -> "C Min"
 */
function extractKeyFromFilename(filename) {
  // Match patterns like "C Min", "D# Min", "F Maj", etc.
  const match = filename.match(/([A-G]#?\s*(?:Min|Maj|min|maj))/i);
  if (match) return match[1];

  // Fallback to parent folder name or "Unknown"
  return "Unknown";
}

/**
 * Recursively find all MIDI files in a directory
 */
function findMidiFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findMidiFiles(fullPath, results);
    } else if (entry.name.endsWith('.mid')) {
      results.push({
        path: fullPath,
        filename: entry.name,
        parentDir: path.basename(dir)
      });
    }
  }

  return results;
}

/**
 * Scan multiple directories for MIDI files
 */
function scanMidiDirectories(baseDirs) {
  const patterns = [];
  let totalFiles = 0;
  let successCount = 0;

  for (const baseDir of baseDirs) {
    console.log(`\nScanning: ${baseDir}`);
    const collectionName = path.basename(baseDir);

    const midiFiles = findMidiFiles(baseDir);
    totalFiles += midiFiles.length;
    console.log(`  Found ${midiFiles.length} MIDI files`);

    for (const file of midiFiles) {
      try {
        const midiData = parseMidiFile(file.path);
        const steps = midiToSteps(midiData);

        if (steps && steps.some(s => s.active)) {
          // Extract key from filename, or use parent folder for genre-based collections
          let category = extractKeyFromFilename(file.filename);
          if (category === "Unknown" && file.parentDir !== path.basename(baseDir)) {
            category = file.parentDir; // Use genre folder (Trap, RnB, etc.)
          }

          patterns.push({
            name: path.basename(file.filename, '.mid'),
            progression: category,
            steps: steps
          });
          successCount++;
        }
      } catch (err) {
        console.error(`  Error parsing ${file.filename}: ${err.message}`);
      }
    }
  }

  console.log(`\nTotal: ${totalFiles} files, ${successCount} patterns extracted`);
  return patterns;
}

// Main execution - Cymatics MIDI Collections
const midiDirs = [
  '/Users/ianzwing/Downloads/ORGANIZED/Music_Production/Cymatics - Essential MIDI Collection Vol. 1-7',
  '/Users/ianzwing/Downloads/ORGANIZED/Music_Production/Cymatics - GOLD MIDI Collection',
  '/Users/ianzwing/Downloads/ORGANIZED/Music_Production/Cymatics - Waves MIDI Collection'
];

console.log('Parsing MIDI files from Cymatics collections...');
const patterns = scanMidiDirectories(midiDirs);
console.log(`\nExtracted ${patterns.length} total patterns`);

// Output as TypeScript data
const output = `/**
 * Pre-parsed MIDI melodies from Cymatics MIDI Collections
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
