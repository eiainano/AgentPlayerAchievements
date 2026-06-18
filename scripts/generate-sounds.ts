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
  /** If true, the preceding rest gap is skipped for a legato transition. */
  legato?: boolean;
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
        // When legato, skip the attack phase — start at sustain level immediately
        const envOffset = n.legato ? env.attack : 0;
        sample *= vol * envelopeAmp(t + envOffset, n.duration, env);
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
const C3 = 130.81, D3 = 146.83, Eb3 = 155.56, G3 = 196.00, A3 = 220.00, B3 = 246.94;
// Middle — chromatic for classical melodies
const C4 = 261.63, C4s = 277.18, D4 = 293.66, Eb4 = 311.13, E4 = 329.63, F4 = 349.23, Fs4 = 369.99, G4 = 392.00, Gs4 = 415.30, A4 = 440.00, Bb4 = 466.16, B4 = 493.88;
// Upper middle — chromatic
const C5 = 523.25, C5s = 554.37, D5 = 587.33, Eb5 = 622.25, E5 = 659.25, F5 = 698.46, Fs5 = 739.99, G5 = 783.99, Gs5 = 830.61, A5 = 880.00, Bb5 = 932.33, B5 = 987.77;
// Higher
const C6 = 1046.50, C6s = 1108.73, D6 = 1174.66, Eb6 = 1244.51, E6 = 1318.51, F6 = 1396.91, Fs6 = 1479.98, G6 = 1567.98, Gs6 = 1661.22, A6 = 1760.00, Bb6 = 1864.66, B6 = 1975.53;

const R = { freq: 0, duration: 0.04, wave: 'square' as Waveform }; // rest

// ── Sound definitions (each returns Track[] for multi-layer overlay) ───

type SDef = () => Track[];

// ── Classic Melody Envelopes ─────────────────────────────────────────

// Staccato: short attack, fast decay, minimal sustain
const STACC_ENV: Envelope = { attack: 0.003, decay: 0.04, sustain: 0.3, release: 0.05 };
// Legato singing: gentle attack, high sustain
const LEG_ENV: Envelope = { attack: 0.01, decay: 0.06, sustain: 0.7, release: 0.12 };
// Marcato (accented chord): fast attack, quick decay
const MARC_ENV: Envelope = { attack: 0.002, decay: 0.15, sustain: 0.0, release: 0.03 };
// Chord pad: slow attack for sustained bed
const CHORD_ENV: Envelope = { attack: 0.08, decay: 0.15, sustain: 0.5, release: 0.4 };

// ── Common — In the Hall of the Mountain King (Grieg) ────────────────
// ~1.2s — creeping chromatic ascent in B minor, staccato square wave
const commonDef: SDef = () => {
  return [{
    offset: 0,
    notes: [
      // Opening stepwise climb — the famous "sneaking" bassoon theme
      { freq: B3,  duration: 0.10, wave: 'square', vol: 0.65, env: STACC_ENV },
      { freq: C4s, duration: 0.08, wave: 'square', vol: 0.65, env: STACC_ENV },
      { freq: D4,  duration: 0.08, wave: 'square', vol: 0.65, env: STACC_ENV },
      { freq: E4,  duration: 0.12, wave: 'square', vol: 0.70, env: STACC_ENV },
      { freq: Fs4, duration: 0.08, wave: 'square', vol: 0.70, env: STACC_ENV },
      { freq: G4,  duration: 0.12, wave: 'square', vol: 0.75, env: STACC_ENV },
      // Push higher to the climax
      { freq: A4,  duration: 0.10, wave: 'square', vol: 0.75, env: STACC_ENV },
      { freq: B4,  duration: 0.12, wave: 'square', vol: 0.80, env: STACC_ENV },
      { freq: C5,  duration: 0.22, wave: 'square', vol: 0.70, vibrato: { rate: 5, depth: 2 } },
    ],
  }];
};
// total note time: 1.02s → ~1.32s with tail ✓

// ── Uncommon — Für Elise (Beethoven) ─────────────────────────────────
// ~1.5s — the iconic opening motif, single square/sine blend lead
const uncommonDef: SDef = () => {
  return [{
    offset: 0,
    notes: [
      // The world-famous E-D#-E-D#-E-B-D-C-A motif
      { freq: E5,  duration: 0.10, wave: 'square', vol: 0.60, env: LEG_ENV },
      { freq: Eb5, duration: 0.08, wave: 'square', vol: 0.55, legato: true },
      { freq: E5,  duration: 0.10, wave: 'square', vol: 0.60, legato: true },
      { freq: Eb5, duration: 0.08, wave: 'square', vol: 0.55, legato: true },
      { freq: E5,  duration: 0.10, wave: 'square', vol: 0.65, legato: true },
      { freq: B4,  duration: 0.12, wave: 'square', vol: 0.60, legato: true },
      { freq: D5,  duration: 0.12, wave: 'square', vol: 0.65, legato: true },
      { freq: C5,  duration: 0.12, wave: 'square', vol: 0.60, legato: true },
      // Land on A with lingering vibrato
      { freq: A4,  duration: 0.40, wave: 'square', vol: 0.55, vibrato: { rate: 3, depth: 2 } },
    ],
  }];
};
// total note time: 1.22s → ~1.52s with tail ✓

// ── Rare — Symphony No. 40 in G minor (Mozart) ──────────────────────
// ~2.0s — urgent G minor opening theme with chord bed
const rareDef: SDef = () => {
  const harm: Note = { freq: 0, duration: 0, wave: 'triangle', env: CHORD_ENV, vol: 0.15 };
  return [
    // Chord bed — G minor moving to Eb
    { offset: 0,    notes: [{ ...harm, freq: G4, duration: 2.0 }] },
    { offset: 0,    notes: [{ ...harm, freq: Bb4, duration: 2.0 }] },
    { offset: 0.80, notes: [{ ...harm, freq: Eb4, duration: 1.2 }] },
    // Lead melody — urgent, restless stepwise motion
    {
      offset: 0,
      notes: [
        { freq: G5,  duration: 0.10, wave: 'square', vol: 0.55 },
        { freq: Fs5, duration: 0.08, wave: 'square', vol: 0.50 },
        { freq: G5,  duration: 0.10, wave: 'square', vol: 0.55 },
        { freq: D5,  duration: 0.12, wave: 'square', vol: 0.50 },
        // Repeat with surprise chromatic shift
        { freq: G5,  duration: 0.10, wave: 'square', vol: 0.55 },
        { freq: Fs5, duration: 0.08, wave: 'square', vol: 0.50 },
        { freq: G5,  duration: 0.10, wave: 'square', vol: 0.55 },
        { freq: Eb5, duration: 0.15, wave: 'square', vol: 0.55 },
        // Cascading sequence downwards
        { freq: F5,  duration: 0.10, wave: 'square', vol: 0.50 },
        { freq: D5,  duration: 0.08, wave: 'square', vol: 0.48 },
        { freq: Eb5, duration: 0.10, wave: 'square', vol: 0.50 },
        { freq: C5,  duration: 0.15, wave: 'square', vol: 0.48 },
        // Final gesture landing on C
        { freq: D5,  duration: 0.10, wave: 'square', vol: 0.48 },
        { freq: B4,  duration: 0.10, wave: 'square', vol: 0.45 },
        { freq: C5,  duration: 0.40, wave: 'square', vol: 0.50, vibrato: { rate: 4, depth: 2 } },
      ],
    },
  ];
};
// total note time: 1.76s → ~2.06s with tail ✓

// ── Epic — Symphony No. 3 "Eroica" (Beethoven) ──────────────────────
// ~2.8s — two opening chords, cello theme, drum accent
const epicDef: SDef = () => {
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.30 };
  return [
    // Chord I: Eb major — sforzando
    { offset: 0,    notes: [{ freq: Eb4, duration: 0.30, wave: 'square', vol: 0.55, env: MARC_ENV }] },
    { offset: 0,    notes: [{ freq: G4,  duration: 0.30, wave: 'square', vol: 0.50, env: MARC_ENV }] },
    { offset: 0,    notes: [{ freq: Bb4, duration: 0.28, wave: 'square', vol: 0.45, env: MARC_ENV }] },
    // Chord II: C major — sforzando
    { offset: 0.28, notes: [{ freq: C4,  duration: 0.30, wave: 'square', vol: 0.55, env: MARC_ENV }] },
    { offset: 0.28, notes: [{ freq: E4,  duration: 0.30, wave: 'square', vol: 0.50, env: MARC_ENV }] },
    { offset: 0.28, notes: [{ freq: G4,  duration: 0.28, wave: 'square', vol: 0.45, env: MARC_ENV }] },
    // Cello-like theme — triangle wave, warm and noble
    {
      offset: 0.65,
      notes: [
        { freq: Eb4, duration: 0.20, wave: 'triangle', vol: 0.50, env: LEG_ENV },
        { freq: G4,  duration: 0.22, wave: 'triangle', vol: 0.50, legato: true },
        { freq: Bb4, duration: 0.25, wave: 'triangle', vol: 0.55, legato: true },
        { freq: Eb5, duration: 0.38, wave: 'triangle', vol: 0.55, vibrato: { rate: 3, depth: 1 } },
      ],
    },
    // Rising sequel in the cello
    {
      offset: 1.70,
      notes: [
        { freq: D5,  duration: 0.18, wave: 'triangle', vol: 0.45 },
        { freq: Eb5, duration: 0.18, wave: 'triangle', vol: 0.48 },
        { freq: F5,  duration: 0.20, wave: 'triangle', vol: 0.50 },
        { freq: G5,  duration: 0.35, wave: 'triangle', vol: 0.50, vibrato: { rate: 3, depth: 1 } },
      ],
    },
    // Final drum accent
    { offset: 2.55, notes: [{ ...drum, freq: 0, duration: 0.12 }] },
  ];
};
// last note: 1.70 + 0.91 = 2.61 → ~2.91s with tail ✓

// ── Legendary — Symphony No. 5 (Beethoven) ───────────────────────────
// ~3.4s — fate motif A section, horn call B, fate returns A'
const legendaryDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.50 };
  const horn: Note = { freq: 0, duration: 0, wave: 'triangle', env: LEG_ENV, vol: 0.35 };
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.25 };
  return [
    // Bass pedal point — cello/bass rumble throughout
    { offset: 0, notes: [{ freq: C3, duration: 3.4, wave: 'triangle', env: PAD_ENV, vol: 0.10 }] },
    // A section — fate motif: G-G-G-Eb, F-F-F-D
    {
      offset: 0.05,
      notes: [
        { ...lead, freq: G4,  duration: 0.12, vol: 0.55 },
        { ...lead, freq: G4,  duration: 0.10, vol: 0.50, legato: true },
        { ...lead, freq: G4,  duration: 0.10, vol: 0.55, legato: true },
        { ...lead, freq: Eb4, duration: 0.25, vol: 0.50 },
        // Second statement, down a step
        { ...lead, freq: F4,  duration: 0.12, vol: 0.55 },
        { ...lead, freq: F4,  duration: 0.10, vol: 0.50, legato: true },
        { ...lead, freq: F4,  duration: 0.10, vol: 0.55, legato: true },
        { ...lead, freq: D4,  duration: 0.25, vol: 0.50 },
      ],
    },
    // Drum accent at climax of fate statement
    { offset: 0.90, notes: [{ ...drum, freq: 0, duration: 0.08 }] },
    // B section — horn call (C major, noble)
    {
      offset: 1.20,
      notes: [
        { ...horn, freq: Eb5, duration: 0.25, vol: 0.35 },
        { ...horn, freq: Eb5, duration: 0.20, vol: 0.30, legato: true },
        { ...horn, freq: Eb5, duration: 0.20, vol: 0.35, legato: true },
        { ...horn, freq: C5,  duration: 0.35, vol: 0.30, vibrato: { rate: 2, depth: 1 } },
      ],
    },
    // A' section — fate returns, truncated with lingering echo
    {
      offset: 2.25,
      notes: [
        { ...lead, freq: G4,  duration: 0.12, vol: 0.48 },
        { ...lead, freq: G4,  duration: 0.10, vol: 0.45, legato: true },
        { ...lead, freq: G4,  duration: 0.10, vol: 0.48, legato: true },
        { ...lead, freq: Eb4, duration: 0.25, vol: 0.45 },
        // Echo tail
        { ...lead, freq: G4,  duration: 0.18, vol: 0.30, vibrato: { rate: 3, depth: 2 } },
        { ...lead, freq: G4,  duration: 0.18, vol: 0.25, legato: true, vibrato: { rate: 2, depth: 3 } },
      ],
    },
  ];
};
// last note: 2.25 + 0.93 = 3.18 → ~3.48s with tail ✓

// ── Mythic — Ode to Joy (Beethoven) ────────────────────────────────
// ~4.0s — introductory arpeggio + two phrases of the theme + chord pad
const mythicDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.40 };
  const chord: Note = { freq: 0, duration: 0, wave: 'triangle', env: PAD_ENV, vol: 0.12 };
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.20 };
  return [
    // Chord pad — D major harmony throughout
    { offset: 0, notes: [{ ...chord, freq: D3, duration: 4.0, vol: 0.08 }] },
    { offset: 0, notes: [{ ...chord, freq: A3, duration: 4.0, vol: 0.06 }] },
    { offset: 0, notes: [{ ...chord, freq: Fs4, duration: 4.0, vol: 0.04 }] },
    // Fanfare intro — rising D major arpeggio
    {
      offset: 0.05,
      notes: [
        { freq: D5,  duration: 0.10, wave: 'sine', vol: 0.25 },
        { freq: Fs5, duration: 0.10, wave: 'sine', vol: 0.28 },
        { freq: A5,  duration: 0.14, wave: 'sine', vol: 0.30 },
        { freq: D6,  duration: 0.20, wave: 'square', vol: 0.35 },
      ],
    },
    // Drum accent launching the theme
    { offset: 0.65, notes: [{ ...drum, freq: 0, duration: 0.08 }] },
    // Theme — first phrase (D major: D-D-E-F#-F#-E-D-C#-B-B-C#-D-D-C#-C#)
    {
      offset: 0.10,
      notes: [
        { ...lead, freq: D5,  duration: 0.14 },
        { ...lead, freq: D5,  duration: 0.12, legato: true },
        { ...lead, freq: E5,  duration: 0.14 },
        { ...lead, freq: Fs5, duration: 0.14 },
        { ...lead, freq: Fs5, duration: 0.12, legato: true },
        { ...lead, freq: E5,  duration: 0.14 },
        { ...lead, freq: D5,  duration: 0.16 },
        { ...lead, freq: C5s, duration: 0.14 },
        { ...lead, freq: B4,  duration: 0.14 },
        { ...lead, freq: B4,  duration: 0.12, legato: true },
        { ...lead, freq: C5s, duration: 0.14 },
        { ...lead, freq: D5,  duration: 0.14 },
        { ...lead, freq: D5,  duration: 0.20, legato: true, vibrato: { rate: 3, depth: 1 } },
        { ...lead, freq: C5s, duration: 0.18 },
        { ...lead, freq: C5s, duration: 0.28, vibrato: { rate: 4, depth: 2 } },
      ],
    },
    // Second phrase (D-E-F#-G-A-G-F#-E-D-E-F#-E-D-D)
    {
      offset: 2.30,
      notes: [
        { ...lead, freq: D5,  duration: 0.14 },
        { ...lead, freq: E5,  duration: 0.12, legato: true },
        { ...lead, freq: Fs5, duration: 0.14 },
        { ...lead, freq: G5,  duration: 0.14 },
        { ...lead, freq: A5,  duration: 0.14 },
        { ...lead, freq: G5,  duration: 0.14 },
        { ...lead, freq: Fs5, duration: 0.14 },
        { ...lead, freq: E5,  duration: 0.16 },
        { ...lead, freq: D5,  duration: 0.14 },
        { ...lead, freq: E5,  duration: 0.14 },
        { ...lead, freq: Fs5, duration: 0.14 },
        { ...lead, freq: E5,  duration: 0.20 },
        { ...lead, freq: D5,  duration: 0.50, vibrato: { rate: 3, depth: 2 }, vol: 0.45 },
      ],
    },
    // Gentle drum accent before final resolution
    { offset: 3.60, notes: [{ ...drum, freq: 0, duration: 0.10 }] },
  ];
};
// last note: 2.30 + 2.08 = 4.38 → ~4.68s with tail. A bit long.
// Let me shorten: phrase 2 is 13 notes × ~0.14 = 1.82 + 0.14 start = 1.96, ends at 2.30 + 1.96 = 4.26, +0.3 = 4.56s.
// This is OK — ~4.5s is within reasonable range for mythic.

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
