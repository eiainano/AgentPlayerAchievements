#!/usr/bin/env -S npx tsx
/**
 * Generate common.wav — "do re so mi" piano-style 2s sound
 */

import * as fs from 'fs';
import * as path from 'path';

const SAMPLE_RATE = 44100;
const DURATION = 1.5; // total seconds
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION);

// "do re so mi" — C5 D5 G5 E5 (高八度)
const NOTE_LEN = DURATION / 4; // 0.375s per note
const notes = [
  { name: 'do', freq: 523.25, start: 0 * NOTE_LEN },
  { name: 're', freq: 587.33, start: 1 * NOTE_LEN },
  { name: 'so', freq: 783.99, start: 2 * NOTE_LEN },
  { name: 'mi', freq: 659.25, start: 3 * NOTE_LEN },
];

/**
 * Harp-like waveform: bright pluck with fast decay,
 * subtle harmonics, and slight metallic resonance.
 */
function harpSample(t: number, freq: number, elapsed: number): number {
  const noteLen = NOTE_LEN;

  // Bright pluck — instant attack, rapid exponential decay
  const decay = Math.exp(-elapsed * 7.0);

  // Harp has fewer prominent harmonics — cleaner, brighter sound
  const fundamental = Math.sin(2 * Math.PI * freq * t);
  const h2 = 0.18 * Math.sin(2 * Math.PI * freq * 2 * t);
  const h3 = 0.06 * Math.sin(2 * Math.PI * freq * 3 * t);

  // Metallic "twang" — a very fast transient at the start
  const twang = elapsed < 0.015
    ? Math.sin(2 * Math.PI * freq * 3.7 * t) * Math.exp(-elapsed * 180) * 0.15
    : 0;

  // Soft release tail
  let env = 1.0;
  if (elapsed > noteLen - 0.06) {
    env = (noteLen - elapsed) / 0.06;
  }

  return (fundamental + h2 + h3 + twang) * decay * env * 0.45;
}

function writeWav(filePath: string, samples: Float64Array): void {
  const buf = Buffer.alloc(44 + samples.length * 2);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);

  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buf);
}

// ── Generate ──────────────────────────────────────────────────────

const samples = new Float64Array(NUM_SAMPLES);

for (let i = 0; i < NUM_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;

  for (const note of notes) {
    const elapsed = t - note.start;
    if (elapsed >= 0 && elapsed < NOTE_LEN) {
      samples[i] += harpSample(t, note.freq, elapsed);
    }
  }
}

const output = path.resolve(import.meta.dirname, '../assets/sounds/common.wav');
writeWav(output, samples);

// Also copy to state dir
const stateDir = path.join(process.env.HOME || '~', '.agent-achievements', 'sounds');
fs.mkdirSync(stateDir, { recursive: true });
const stateFile = path.join(stateDir, 'common.wav');
fs.copyFileSync(output, stateFile);

console.log(`✅ Generated ${output} (${NUM_SAMPLES} samples, ${DURATION}s)`);
console.log(`📋 Copied to ${stateFile}`);
