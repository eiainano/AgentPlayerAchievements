#!/usr/bin/env npx tsx
/**
 * Generate 8-bit style achievement unlock sounds.
 *
 * Zero dependencies — writes 16-bit mono PCM WAV files directly via Buffer ops.
 * Output: assets/sounds/{common,uncommon,rare,epic,legendary,mythic}.wav
 *
 * Usage: npx tsx scripts/generate-sounds.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const SAMPLE_RATE = 44100;
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'assets', 'sounds');

// ── Waveform generators ──────────────────────────────────────────────

function square(t: number, freq: number): number {
  const v = (t * freq) % 1;
  return v < 0.5 ? 1 : -1;
}

function triangle(t: number, freq: number): number {
  const v = ((t * freq) % 1 + 0.25) % 1;
  return 4 * Math.abs(v - 0.5) - 1;
}

function saw(t: number, freq: number): number {
  return 2 * ((t * freq) % 1) - 1;
}

function noise(): number {
  return Math.random() * 2 - 1;
}

type Waveform = 'square' | 'triangle' | 'saw' | 'noise' | 'sine';

function genWave(t: number, freq: number, wave: Waveform): number {
  switch (wave) {
    case 'square': return square(t, freq);
    case 'triangle': return triangle(t, freq);
    case 'saw': return saw(t, freq);
    case 'noise': return noise();
    case 'sine': return Math.sin(2 * Math.PI * freq * t);
  }
}

// ── Envelope ─────────────────────────────────────────────────────────

interface Envelope {
  attack: number;   // seconds
  decay: number;    // seconds
  sustain: number;  // 0–1 amplitude
  release: number;  // seconds (from end of note)
}

function envelopeAmp(t: number, duration: number, env: Envelope): number {
  const { attack, decay, sustain, release } = env;
  if (t < attack) return t / attack;
  if (t < attack + decay) {
    const d = (t - attack) / decay;
    return 1 - (1 - sustain) * d;
  }
  const releaseStart = duration - release;
  if (t >= releaseStart) {
    const r = (t - releaseStart) / release;
    return sustain * (1 - r);
  }
  return sustain;
}

const DEFAULT_ENV: Envelope = { attack: 0.005, decay: 0.05, sustain: 0.7, release: 0.1 };
const SOFT_ENV: Envelope = { attack: 0.01, decay: 0.08, sustain: 0.6, release: 0.15 };
const PAD_ENV: Envelope = { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 };
const PLUCK_ENV: Envelope = { attack: 0.001, decay: 0.3, sustain: 0.0, release: 0.02 };

// ── Note definition ──────────────────────────────────────────────────

interface Note {
  freq: number;        // Hz (0 = rest)
  duration: number;    // seconds
  wave: Waveform;
  env?: Envelope;
  vol?: number;        // 0–1
  vibrato?: { rate: number; depth: number };
}

interface Track { offset: number; notes: Note[]; }

// ── Rendering (multi-track overlay) ──────────────────────────────────

function render(tracks: Track[]): Float64Array {
  // Compute total duration from the latest-ending track
  let totalDuration = 0;
  for (const tk of tracks) {
    const len = tk.notes.reduce((sum, n) => sum + n.duration, 0);
    const end = tk.offset + len;
    if (end > totalDuration) totalDuration = end;
  }
  totalDuration += 0.3; // reverb tail

  const numSamples = Math.ceil(totalDuration * SAMPLE_RATE);
  const buf = new Float64Array(numSamples);

  for (const tk of tracks) {
    let sampleIdx = Math.ceil(tk.offset * SAMPLE_RATE);
    for (const n of tk.notes) {
      const vol = n.vol ?? 1.0;
      const env = n.env || DEFAULT_ENV;
      const numNoteSamples = Math.ceil(n.duration * SAMPLE_RATE);

      for (let i = 0; i < numNoteSamples; i++) {
        const t = i / SAMPLE_RATE;
        let freq = n.freq;
        if (n.vibrato && freq > 0) {
          freq += n.vibrato.depth * Math.sin(2 * Math.PI * n.vibrato.rate * t);
        }
        let sample = n.freq === 0 ? 0 : genWave(t, freq, n.wave);
        sample *= vol * envelopeAmp(t, n.duration, env);
        buf[sampleIdx + i] += sample;
      }
      sampleIdx += numNoteSamples;
    }
  }

  // Soft clip
  for (let i = 0; i < numSamples; i++) {
    const v = buf[i]!;
    if (v > 1) buf[i] = 1;
    else if (v < -1) buf[i] = -1;
    if (v > 0.7 || v < -0.7) buf[i] = Math.tanh(v);
  }

  return buf;
}

// ── WAV writer ───────────────────────────────────────────────────────

function writeWav(filePath: string, samples: Float64Array): void {
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit
  const fileSize = 44 + dataSize;

  const header = Buffer.alloc(44);
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);
  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);        // PCM
  header.writeUInt16LE(1, 20);         // format = 1 (PCM)
  header.writeUInt16LE(1, 22);         // channels = 1 (mono)
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32);         // block align
  header.writeUInt16LE(16, 34);        // bits per sample
  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize);
  for (let i = 0; i < numSamples; i++) {
    let v = Math.round(samples[i]! * 32767);
    if (v > 32767) v = 32767;
    if (v < -32768) v = -32768;
    data.writeInt16LE(v, i * 2);
  }

  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

// ── Pitch helpers ────────────────────────────────────────────────────

// Lower octaves
const C2 = 65.41, G2 = 98.00;
const C3 = 130.81, G3 = 196.00;
// Middle
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23;
const G4 = 392.00, A4 = 440.00, B4 = 493.88;
// Higher
const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46;
const G5 = 783.99, A5 = 880.00, B5 = 987.77;
const C6 = 1046.50, D6 = 1174.66, E6 = 1318.51, G6 = 1567.98;

const R = { freq: 0, duration: 0.04, wave: 'square' as Waveform }; // rest

// ── Sound definitions (each returns Track[] for multi-layer overlay) ───

type SDef = () => Track[];

// Common — ~1.0s — triple ascending with slide tail
const commonDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV };
  return [{
    offset: 0,
    notes: [
      { ...lead, freq: E5, duration: 0.2, wave: 'square', vol: 0.7 },
      { ...lead, freq: G5, duration: 0.25, wave: 'square', vol: 0.75 },
      { ...lead, freq: C6, duration: 0.4, wave: 'square', vol: 0.8, vibrato: { rate: 5, depth: 3 } },
    ],
  }];
};

// Uncommon — ~1.5s — 5-note arpeggio with triangle bass pad underneath
const uncommonDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.6 };
  const pad: Note = { freq: 0, duration: 0, wave: 'triangle', env: PAD_ENV, vol: 0.25 };
  return [
    { // Bass pad — spans the full duration underneath
      offset: 0,
      notes: [
        { ...pad, freq: C4, duration: 1.5, wave: 'triangle' },
      ],
    },
    { // Lead melody
      offset: 0.05,
      notes: [
        { ...lead, freq: C5, duration: 0.2, wave: 'square' },
        { ...lead, freq: E5, duration: 0.2, wave: 'square' },
        { ...lead, freq: G5, duration: 0.25, wave: 'square' },
        { ...lead, freq: C6, duration: 0.3, wave: 'square' },
        { ...lead, freq: E6, duration: 0.4, wave: 'square', vol: 0.5, vibrato: { rate: 4, depth: 2 } },
      ],
    },
  ];
};

// Rare — ~2.0s — 7-note melody with triangle harmony + vibrato
const rareDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.55 };
  const harm: Note = { freq: 0, duration: 0, wave: 'triangle', env: PAD_ENV, vol: 0.2 };
  return [
    { // Harmony pad — two notes layered
      offset: 0,
      notes: [
        { ...harm, freq: C4, duration: 2.0 },
      ],
    },
    {
      offset: 0,
      notes: [
        { ...harm, freq: E4, duration: 2.0 },
      ],
    },
    { // Lead melody
      offset: 0.1,
      notes: [
        { ...lead, freq: C5, duration: 0.2 },
        { ...lead, freq: D5, duration: 0.2 },
        { ...lead, freq: E5, duration: 0.25 },
        { ...lead, freq: G5, duration: 0.25 },
        { ...lead, freq: A5, duration: 0.3 },
        { ...lead, freq: C6, duration: 0.4, vibrato: { rate: 4, depth: 2 } },
        { ...lead, freq: D6, duration: 0.5, vibrato: { rate: 3, depth: 3 }, vol: 0.5 },
      ],
    },
  ];
};

// Epic — ~2.8s — 10-note ascending with noise drums + crash
const epicDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.5 };
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.35 };
  return [
    { // Lead melody
      offset: 0.1,
      notes: [
        { ...lead, freq: C4, duration: 0.18 },
        { ...lead, freq: E4, duration: 0.18 },
        { ...lead, freq: G4, duration: 0.2 },
        { ...lead, freq: C5, duration: 0.2 },
        { ...lead, freq: E5, duration: 0.2 },
        { ...lead, freq: G5, duration: 0.25 },
        { ...lead, freq: C6, duration: 0.3 },
        { ...lead, freq: E6, duration: 0.35 },
        { ...lead, freq: G6, duration: 0.4, vibrato: { rate: 4, depth: 2 } },
      ],
    },
    { // Drum hits interspersed
      offset: 0.05, notes: [{ ...drum, freq: 0, duration: 0.08 }],
    },
    { offset: 0.45, notes: [{ ...drum, freq: 0, duration: 0.08 }],
    },
    { offset: 0.85, notes: [{ ...drum, freq: 0, duration: 0.08 }],
    },
    // Crash cymbal at end
    {
      offset: 2.2,
      notes: [{ freq: 0, duration: 0.5, wave: 'noise', env: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.45 }, vol: 0.3 }],
    },
  ];
};

// Legendary — ~3.4s — A-B-A' structure with bass drum + echo
const legendaryDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.45 };
  const bass: Note = { freq: 0, duration: 0, wave: 'triangle', env: PAD_ENV, vol: 0.18 };
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.3 };
  return [
    { // Bass pad throughout
      offset: 0, notes: [{ ...bass, freq: C3, duration: 3.4 }],
    },
    { // A section
      offset: 0.1,
      notes: [
        { ...lead, freq: C5, duration: 0.3 },
        { ...lead, freq: E5, duration: 0.3 },
        { ...lead, freq: G5, duration: 0.4 },
      ],
    },
    { offset: 0.08, notes: [{ ...drum, freq: 0, duration: 0.08 }] },
    // B section
    {
      offset: 1.1,
      notes: [
        { ...lead, freq: A5, duration: 0.3 },
        { ...lead, freq: C6, duration: 0.3 },
        { ...lead, freq: D6, duration: 0.35 },
        { ...lead, freq: E6, duration: 0.4, vibrato: { rate: 4, depth: 2 } },
      ],
    },
    { offset: 1.08, notes: [{ ...drum, freq: 0, duration: 0.08 }] },
    // A' section — resolution echo
    {
      offset: 2.4,
      notes: [
        { ...lead, freq: C6, duration: 0.4, vol: 0.3, vibrato: { rate: 3, depth: 2 } },
        { ...lead, freq: G5, duration: 0.5, vol: 0.25, vibrato: { rate: 2, depth: 3 } },
      ],
    },
  ];
};

// Mythic — ~4.0s — majestic fanfare with layered chords, reverb-like decay
const mythicDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.4 };
  const chord: Note = { freq: 0, duration: 0, wave: 'triangle', env: PAD_ENV, vol: 0.12 };
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.3 };
  return [
    { // Underlying chord bed — entire span
      offset: 0, notes: [{ ...chord, freq: C3, duration: 4.0, vol: 0.08 }],
    },
    { offset: 0, notes: [{ ...chord, freq: G3, duration: 4.0, vol: 0.06 }],
    },
    { // Drum intro
      offset: 0.05, notes: [{ ...drum, freq: 0, duration: 0.1 }],
    },
    // Fanfare ascending
    {
      offset: 0.2,
      notes: [
        { ...lead, freq: C4, duration: 0.3 },
        { ...lead, freq: E4, duration: 0.25 },
        { ...lead, freq: G4, duration: 0.25 },
      ],
    },
    { offset: 0.8, notes: [{ ...drum, freq: 0, duration: 0.1 }],
    },
    {
      offset: 1.0,
      notes: [
        { ...lead, freq: C5, duration: 0.3 },
        { ...lead, freq: E5, duration: 0.3 },
        { ...lead, freq: G5, duration: 0.35 },
      ],
    },
    { offset: 1.7, notes: [{ ...drum, freq: 0, duration: 0.1 }],
    },
    // Peak
    {
      offset: 1.9,
      notes: [
        { ...lead, freq: C6, duration: 0.4, vol: 0.5, vibrato: { rate: 5, depth: 2 } },
        { ...lead, freq: E6, duration: 0.45, vol: 0.45, vibrato: { rate: 4, depth: 3 } },
      ],
    },
    { offset: 2.4, notes: [{ ...drum, freq: 0, duration: 0.12 }],
    },
    // Resolution — layered chord decay
    {
      offset: 2.6,
      notes: [
        { freq: C6, duration: 1.4, wave: 'triangle', env: { attack: 0.05, decay: 0.1, sustain: 0.4, release: 1.3 }, vol: 0.2, vibrato: { rate: 2, depth: 4 } },
      ],
    },
    {
      offset: 2.6,
      notes: [
        { freq: G5, duration: 1.4, wave: 'triangle', env: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 1.3 }, vol: 0.15 },
      ],
    },
    {
      offset: 2.6,
      notes: [
        { freq: E5, duration: 1.4, wave: 'sine', env: { attack: 0.08, decay: 0.1, sustain: 0.2, release: 1.3 }, vol: 0.1 },
      ],
    },
  ];
};

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sounds: Array<{ name: string; tracks: Track[] }> = [
    { name: 'common', tracks: commonDef() },
    { name: 'uncommon', tracks: uncommonDef() },
    { name: 'rare', tracks: rareDef() },
    { name: 'epic', tracks: epicDef() },
    { name: 'legendary', tracks: legendaryDef() },
    { name: 'mythic', tracks: mythicDef() },
  ];

  for (const { name, tracks } of sounds) {
    const samples = render(tracks);
    const outPath = path.join(OUT_DIR, `${name}.wav`);
    writeWav(outPath, samples);
    const duration = (samples.length / SAMPLE_RATE).toFixed(1);
    const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`  ✅ ${name.padEnd(12)} ${duration}s  ${sizeKB} KB  → ${outPath}`);
  }

  console.log(`\n🎵 Generated 6 achievement sounds in ${OUT_DIR}`);
}

main();
