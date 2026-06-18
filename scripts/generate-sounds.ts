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
const F2 = 87.31, A2 = 110.00, C2 = 65.41, G2 = 98.00;
const C3 = 130.81, C3s = 138.59, D3 = 146.83, Eb3 = 155.56, E3 = 164.81, F3 = 174.61, Fs3 = 185.00, G3 = 196.00, Gs3 = 207.65, A3 = 220.00, Bb3 = 233.08, B3 = 246.94;
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

// ═══════════════════════════════════════════════════════════════════════
// Sound definitions — classical masterpieces, 8-bit chip style
// ═══════════════════════════════════════════════════════════════════════

type SDef = () => Track[];

// ── Common — Vivaldi "Spring" (La Primavera) ───────────────────────
// ~4s — Allegro, the iconic E-major ritornello, bright and birdlike
const commonDef: SDef = () => {
  const q = 0.42; // quarter at ♩≈144
  const e = q / 2;
  return [{
    offset: 0,
    notes: [
      // Birdsong opening — repeated notes, energetic
      { freq: E5,  duration: q,     wave: 'square', vol: 0.55, env: LEG_ENV },
      { freq: E5,  duration: e,     wave: 'square', vol: 0.50, legato: true },
      { freq: E5,  duration: e,     wave: 'square', vol: 0.55, legato: true },
      { freq: Fs5, duration: q,     wave: 'square', vol: 0.55, env: LEG_ENV },
      { freq: Gs5, duration: e,     wave: 'square', vol: 0.55 },
      { freq: Gs5, duration: q,     wave: 'square', vol: 0.58 },
      // Cascading down
      { freq: A5,  duration: e,     wave: 'square', vol: 0.58 },
      { freq: Gs5, duration: e,     wave: 'square', vol: 0.55 },
      { freq: Fs5, duration: q,     wave: 'square', vol: 0.55 },
      { freq: E5,  duration: q,     wave: 'square', vol: 0.52 },
      { freq: Eb5, duration: e,     wave: 'square', vol: 0.48 },
      // Bright resolution
      { freq: E5,  duration: q * 1.2, wave: 'square', vol: 0.55 },
      { freq: Fs5, duration: q * 0.8, wave: 'square', vol: 0.55, legato: true },
      { freq: Gs5, duration: q * 1.5, wave: 'square', vol: 0.58, vibrato: { rate: 5, depth: 2 } },
    ],
  }];
};

// ── Uncommon — Bach Minuet in G (BWV Anh 114) ──────────────────────
// ~3s — graceful, elegant, the quintessential Baroque dance in G major
const uncommonDef: SDef = () => {
  const q = 0.45; // quarter at ♩≈133
  const e = q / 2;
  return [{
    offset: 0,
    notes: [
      // Anacrusis + phrase 1 — the iconic stepwise ascent
      { freq: D5,  duration: e,     wave: 'square', vol: 0.45 },
      { freq: G5,  duration: e,     wave: 'square', vol: 0.50 },
      { freq: A5,  duration: e,     wave: 'square', vol: 0.50, legato: true },
      { freq: B5,  duration: e,     wave: 'square', vol: 0.52, legato: true },
      { freq: C6,  duration: q,     wave: 'square', vol: 0.55 },
      { freq: D6,  duration: q,     wave: 'square', vol: 0.55 },
      { freq: B5,  duration: e,     wave: 'square', vol: 0.52 },
      { freq: G5,  duration: q,     wave: 'square', vol: 0.50 },
      // Phrase 2 — the answering descent
      { freq: D6,  duration: e,     wave: 'square', vol: 0.55 },
      { freq: C6,  duration: e,     wave: 'square', vol: 0.55, legato: true },
      { freq: B5,  duration: e,     wave: 'square', vol: 0.52, legato: true },
      { freq: A5,  duration: e,     wave: 'square', vol: 0.50, legato: true },
      { freq: G5,  duration: q * 0.8, wave: 'square', vol: 0.50 },
      { freq: Fs5, duration: e,     wave: 'square', vol: 0.48 },
      // Perfect cadence
      { freq: G5,  duration: q * 1.6, wave: 'square', vol: 0.50, vibrato: { rate: 3, depth: 2 } },
    ],
  }];
};

// ── Rare — Rossini: William Tell Overture (Finale) ─────────────────
// ~5s — the "Lone Ranger" gallop, trumpet call + thundering horses
const rareDef: SDef = () => {
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.22 };
  const trp: Envelope = { attack: 0.002, decay: 0.12, sustain: 0.4, release: 0.06 }; // trumpet-like
  const e = 0.14; // fast eighth
  const q = e * 2;
  return [
    // ── Opening fanfare — distant trumpet call ──
    {
      offset: 0,
      notes: [
        { freq: E5, duration: e, wave: 'square', vol: 0.50, env: trp },
        { freq: E5, duration: e, wave: 'square', vol: 0.50, legato: true },
        { freq: E5, duration: e, wave: 'square', vol: 0.50, legato: true },
        { freq: 0,   duration: e * 0.4, wave: 'square' }, // breath
        { freq: E5, duration: e, wave: 'square', vol: 0.52, env: trp },
        { freq: E5, duration: e, wave: 'square', vol: 0.52, legato: true },
        { freq: E5, duration: e, wave: 'square', vol: 0.52, legato: true },
        { freq: 0,   duration: e * 0.4, wave: 'square' },
        // Bugle arpeggio — E5→C6→E6→G6
        { freq: E5, duration: e * 0.8, wave: 'square', vol: 0.55, env: trp },
        { freq: C6, duration: e * 0.7, wave: 'square', vol: 0.58, legato: true },
        { freq: E6, duration: e * 0.7, wave: 'square', vol: 0.60, legato: true },
        { freq: G6, duration: q,        wave: 'square', vol: 0.60, vibrato: { rate: 4, depth: 1 } },
      ],
    },
    // ── Gallop enters — "Hi-yo Silver!" ──
    {
      offset: q * 6, // ~1.7s
      notes: [
        // Gallop rhythm: ta-ta-ta-TUM, ta-ta-ta-TUM
        { freq: E5,  duration: e * 0.7, wave: 'square', vol: 0.55 },
        { freq: E5,  duration: e * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: E5,  duration: e * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: G5,  duration: q * 0.8, wave: 'square', vol: 0.58 },
        { freq: E5,  duration: e * 0.7, wave: 'square', vol: 0.55 },
        { freq: E5,  duration: e * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: E5,  duration: e * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: C6,  duration: q * 0.8, wave: 'square', vol: 0.58 },
        // Ascending gallop
        { freq: G5,  duration: e * 0.7, wave: 'square', vol: 0.55 },
        { freq: G5,  duration: e * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: G5,  duration: e * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: Bb5, duration: q * 0.8, wave: 'square', vol: 0.58 },
        { freq: C6,  duration: e * 0.7, wave: 'square', vol: 0.60 },
        { freq: C6,  duration: e * 0.7, wave: 'square', vol: 0.60, legato: true },
        { freq: C6,  duration: e * 0.7, wave: 'square', vol: 0.60, legato: true },
        { freq: E6,  duration: q * 1.2, wave: 'square', vol: 0.62, vibrato: { rate: 5, depth: 2 } },
      ],
    },
    // Final drum hit
    { offset: q * 14.5, notes: [{ ...drum, duration: 0.12 }] },
  ];
};

// ── Epic — Beethoven: Symphony No. 3 "Eroica" — Finale ─────────────
// ~7s — the glorious Prometheus theme, variations in Eb major triumph
const epicDef: SDef = () => {
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.22 };
  const Q = 0.45; // quarter
  const E = Q / 2;
  return [
    // ── Tender opening — pizzicato theme stated softly ──
    {
      offset: 0,
      notes: [
        { freq: Eb4, duration: Q * 0.5, wave: 'triangle', vol: 0.30, env: { attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.02 } },
        { freq: Eb4, duration: Q * 0.5, wave: 'triangle', vol: 0.30 },
        { freq: Eb4, duration: Q * 0.5, wave: 'triangle', vol: 0.30 },
        { freq: F4,  duration: Q * 0.5, wave: 'triangle', vol: 0.32 },
        { freq: G4,  duration: Q * 0.8, wave: 'triangle', vol: 0.35 },
        { freq: G4,  duration: Q * 0.5, wave: 'triangle', vol: 0.35 },
        { freq: F4,  duration: Q * 0.5, wave: 'triangle', vol: 0.32 },
        { freq: Eb4, duration: Q * 0.8, wave: 'triangle', vol: 0.30 },
      ],
    },
    // ── Forte statement — full orchestra blazing the theme ──
    {
      offset: Q * 5,
      notes: [
        { freq: Eb4, duration: Q * 0.7, wave: 'square', vol: 0.50, env: { attack: 0.003, decay: 0.06, sustain: 0.5, release: 0.08 } },
        { freq: Eb4, duration: Q * 0.7, wave: 'square', vol: 0.50, legato: true },
        { freq: Eb5, duration: Q * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: F5,  duration: Q * 0.7, wave: 'square', vol: 0.55 },
        { freq: G5,  duration: Q * 1.2, wave: 'square', vol: 0.58 },
        { freq: Gs5, duration: Q * 0.7, wave: 'square', vol: 0.58 },
        { freq: G5,  duration: Q * 0.7, wave: 'square', vol: 0.55, legato: true },
        { freq: F5,  duration: Q * 0.7, wave: 'square', vol: 0.55 },
        { freq: Eb5, duration: Q * 1.2, wave: 'square', vol: 0.55 },
      ],
    },
    { offset: Q * 6, notes: [{ freq: 0, duration: 0.08, wave: 'square' }] },
    // ── Triumphant peak — ascending proclamation ──
    {
      offset: Q * 11,
      notes: [
        { freq: Eb5, duration: Q * 0.6, wave: 'square', vol: 0.55 },
        { freq: Eb5, duration: Q * 0.6, wave: 'square', vol: 0.55, legato: true },
        { freq: Eb5, duration: Q * 0.6, wave: 'square', vol: 0.55, legato: true },
        { freq: F5,  duration: Q * 0.6, wave: 'square', vol: 0.58 },
        { freq: G5,  duration: Q * 0.8, wave: 'square', vol: 0.60 },
        { freq: Bb5, duration: Q * 0.6, wave: 'square', vol: 0.60, legato: true },
        { freq: Eb6, duration: Q * 1.5, wave: 'square', vol: 0.62, vibrato: { rate: 4, depth: 2 } },
      ],
    },
    // Final hammer blow
    { offset: Q * 15, notes: [{ ...drum, duration: 0.15 }] },
  ];
};

// ── Legendary — Beethoven: Symphony No. 5 — IV. Allegro ─────────────
// ~8s — from darkness into blazing light, the C-major explosion
const legendaryDef: SDef = () => {
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.20 };
  const e = 0.26; // eighth at ♩=115
  const q = e * 2;
  return [
    // ── Part 1: Darkness — timpani heartbeat in C minor ──
    { offset: 0, notes: [{ freq: C3, duration: q * 7, wave: 'triangle', vol: 0.08 }] },
    {
      offset: 0,
      notes: [
        // Timpani: C... C... C... (soft, ominous)
        { freq: C3,  duration: q,     wave: 'noise', vol: 0.15, env: PLUCK_ENV },
        { freq: 0,    duration: q * 1.5, wave: 'square' },
        { freq: C3,  duration: q,     wave: 'noise', vol: 0.15, env: PLUCK_ENV },
        { freq: 0,    duration: q * 1.5, wave: 'square' },
        { freq: C3,  duration: q,     wave: 'noise', vol: 0.18, env: PLUCK_ENV },
      ],
    },
    // ── Part 2: Chromatic creep upward (strings tremolo) ──
    {
      offset: q * 5.5,
      notes: [
        { freq: C3,  duration: e * 0.8, wave: 'triangle', vol: 0.12 },
        { freq: C3s, duration: e * 0.7, wave: 'triangle', vol: 0.14 },
        { freq: D3,  duration: e * 0.7, wave: 'triangle', vol: 0.15 },
        { freq: Eb3, duration: e * 0.7, wave: 'triangle', vol: 0.17 },
        { freq: E3,  duration: e * 0.6, wave: 'triangle', vol: 0.18 },
        { freq: F3,  duration: e * 0.6, wave: 'triangle', vol: 0.20 },
        { freq: Fs3, duration: e * 0.5, wave: 'triangle', vol: 0.22 },
        { freq: G3,  duration: e * 0.5, wave: 'triangle', vol: 0.25 },
        // Held G — tension at maximum
        { freq: G3,  duration: q * 1.0, wave: 'triangle', vol: 0.28 },
      ],
    },
    // ── Part 3: THE EXPLOSION — C major fanfare ──
    {
      offset: q * 10,
      notes: [
        // C-E-G-C — the full brass tutti
        { freq: C4, duration: q * 0.8, wave: 'square', vol: 0.55, env: { attack: 0.002, decay: 0.10, sustain: 0.6, release: 0.10 } },
        { freq: 0,   duration: e * 0.3, wave: 'square' },
        { freq: E4, duration: q * 0.7, wave: 'square', vol: 0.58 },
        { freq: 0,   duration: e * 0.3, wave: 'square' },
        { freq: G4, duration: q * 0.7, wave: 'square', vol: 0.62 },
        { freq: 0,   duration: e * 0.3, wave: 'square' },
        { freq: C5, duration: q * 1.2, wave: 'square', vol: 0.65, vibrato: { rate: 5, depth: 2 } },
      ],
    },
    { offset: q * 10,    notes: [{ freq: C3, duration: q * 4, wave: 'triangle', vol: 0.10 }] },
    { offset: q * 10,    notes: [{ freq: G3, duration: q * 4, wave: 'triangle', vol: 0.07 }] },
    // ── Part 4: Triumphant march theme — the new C-major world ──
    {
      offset: q * 14.5,
      notes: [
        { freq: C5, duration: q * 0.7, wave: 'square', vol: 0.55 },
        { freq: C5, duration: q * 0.6, wave: 'square', vol: 0.55, legato: true },
        { freq: D5, duration: q * 0.7, wave: 'square', vol: 0.58 },
        { freq: E5, duration: q * 0.7, wave: 'square', vol: 0.60 },
        { freq: F5, duration: q * 0.7, wave: 'square', vol: 0.60 },
        { freq: E5, duration: q * 0.6, wave: 'square', vol: 0.60, legato: true },
        { freq: D5, duration: q * 0.7, wave: 'square', vol: 0.58 },
        { freq: C5, duration: q * 1.5, wave: 'square', vol: 0.60, vibrato: { rate: 4, depth: 2 } },
      ],
    },
    // Final drum
    { offset: q * 21, notes: [{ ...drum, duration: 0.12 }] },
  ];
};

// ── Mythic — Beethoven: Symphony No. 9 — IV. Ode to Joy ────────────
// ~14s — the recitative that introduces the theme, then full glory
const mythicDef: SDef = () => {
  const lead: Note = { freq: 0, duration: 0, wave: 'square', env: SOFT_ENV, vol: 0.40 };
  const chord: Note = { freq: 0, duration: 0, wave: 'triangle', env: PAD_ENV, vol: 0.10 };
  const drum: Note = { freq: 0, duration: 0, wave: 'noise', env: PLUCK_ENV, vol: 0.16 };
  const Q = 0.40; // quarter at 𝅗𝅥≈75
  const H = Q * 2;

  return [
    // ── Recitative: "O Freunde, nicht diese Töne!" ──
    // Low cello/bass "speaking" — searching, calling out
    { offset: 0, notes: [{ ...chord, freq: D3,  duration: 14.5, vol: 0.04 }] },
    {
      offset: 0,
      notes: [
        // Low D — the instrument "speaks"
        { freq: D3, duration: Q * 0.7, wave: 'triangle', vol: 0.22 },
        { freq: 0,   duration: Q * 0.2, wave: 'square' },
        { freq: D3, duration: Q * 0.6, wave: 'triangle', vol: 0.24 },
        { freq: 0,   duration: Q * 0.2, wave: 'square' },
        { freq: A2, duration: Q * 0.5, wave: 'triangle', vol: 0.22 },
        { freq: 0,   duration: Q * 0.2, wave: 'square' },
        { freq: F2, duration: Q * 0.5, wave: 'triangle', vol: 0.20 },
        { freq: 0,   duration: Q * 0.2, wave: 'square' },
        // Searching phrase — rising
        { freq: D3, duration: Q * 0.6, wave: 'triangle', vol: 0.25 },
        { freq: F3, duration: Q * 0.5, wave: 'triangle', vol: 0.27, legato: true },
        { freq: A3, duration: Q * 0.5, wave: 'triangle', vol: 0.30, legato: true },
        { freq: D4, duration: Q * 0.8, wave: 'triangle', vol: 0.33 },
        { freq: 0,   duration: Q * 0.3, wave: 'square' },
        // Calling — the D major arpeggio rises
        { freq: Fs3, duration: Q * 0.3, wave: 'triangle', vol: 0.30 },
        { freq: A3,  duration: Q * 0.3, wave: 'triangle', vol: 0.32, legato: true },
        { freq: D4,  duration: Q * 0.3, wave: 'triangle', vol: 0.35, legato: true },
        { freq: Fs4, duration: Q * 0.3, wave: 'triangle', vol: 0.37, legato: true },
        // The transition — a dramatic pause...
        { freq: A4,  duration: Q * 0.8, wave: 'triangle', vol: 0.38 },
        { freq: 0,   duration: Q * 0.4, wave: 'square' },
      ],
    },
    { offset: Q * 8.5, notes: [{ ...drum, duration: 0.08 }] },
    // ── ODE TO JOY — theme bursts forth in D major ──
    // Chord pad
    { offset: Q * 8.5, notes: [{ ...chord, freq: D3,  duration: 6.0, vol: 0.06 }] },
    { offset: Q * 8.5, notes: [{ ...chord, freq: A3,  duration: 6.0, vol: 0.05 }] },
    { offset: Q * 8.5, notes: [{ ...chord, freq: Fs4, duration: 6.0, vol: 0.03 }] },
    // Phrase 1
    {
      offset: Q * 8.5,
      notes: [
        { ...lead, freq: D5,  duration: Q },
        { ...lead, freq: D5,  duration: Q * 0.9, legato: true },
        { ...lead, freq: E5,  duration: Q },
        { ...lead, freq: Fs5, duration: Q },
        { ...lead, freq: Fs5, duration: Q * 0.9, legato: true },
        { ...lead, freq: E5,  duration: Q },
        { ...lead, freq: D5,  duration: Q },
        { ...lead, freq: C5s, duration: Q },
        { ...lead, freq: B4,  duration: Q },
        { ...lead, freq: B4,  duration: Q * 0.9, legato: true },
        { ...lead, freq: C5s, duration: Q },
        { ...lead, freq: D5,  duration: Q },
        { ...lead, freq: D5,  duration: Q * 0.6, legato: true, vibrato: { rate: 3, depth: 1 } },
        { ...lead, freq: C5s, duration: Q * 0.6 },
        { ...lead, freq: C5s, duration: Q, vibrato: { rate: 4, depth: 2 } },
      ],
    },
    // Phrase 2
    {
      offset: Q * 21.5,
      notes: [
        { ...lead, freq: D5,  duration: Q },
        { ...lead, freq: E5,  duration: Q * 0.9, legato: true },
        { ...lead, freq: Fs5, duration: Q },
        { ...lead, freq: G5,  duration: Q },
        { ...lead, freq: A5,  duration: Q },
        { ...lead, freq: G5,  duration: Q },
        { ...lead, freq: Fs5, duration: Q },
        { ...lead, freq: E5,  duration: Q },
        { ...lead, freq: D5,  duration: Q },
        { ...lead, freq: E5,  duration: Q },
        { ...lead, freq: Fs5, duration: Q },
        { ...lead, freq: E5,  duration: Q },
        { ...lead, freq: D5,  duration: H, vibrato: { rate: 3, depth: 2 }, vol: 0.42 },
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
