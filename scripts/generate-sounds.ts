#!/usr/bin/env npx tsx
/**
 * Generate 8-bit style achievement unlock sounds.
 *
 * Zero dependencies — writes 16-bit mono PCM WAV files directly via Buffer ops.
 * Output: assets/sounds/{common,uncommon,uncommon-c,rare,epic,legendary,mythic}.wav
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
  legato?: boolean;
}

interface Track { offset: number; notes: Note[]; }

// ── Rendering (multi-track overlay) ──────────────────────────────────

function render(tracks: Track[]): Float64Array {
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
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize - 8, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
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

// ── Pitch constants (chromatic, three octaves) ──────────────────────

const C2 = 65.41, F2 = 87.31, G2 = 98.00, A2 = 110.00, Bb2 = 116.54, B2f = 123.47;
const C3 = 130.81, C3s = 138.59, D3 = 146.83, Eb3 = 155.56, E3 = 164.81;
const F3 = 174.61, Fs3 = 185.00, G3 = 196.00, Gs3 = 207.65, A3 = 220.00;
const Bb3 = 233.08, B3 = 246.94, B3s = 261.63; // B#3 = C4 enharmonic
const C4 = 261.63, C4s = 277.18, D4 = 293.66, Eb4 = 311.13, E4 = 329.63;
const F4 = 349.23, Fs4 = 369.99, G4 = 392.00, Gs4 = 415.30, A4 = 440.00;
const Bb4 = 466.16, B4 = 493.88;
const C5 = 523.25, C5s = 554.37, D5 = 587.33, Eb5 = 622.25, E5 = 659.25;
const F5 = 698.46, Fs5 = 739.99, G5 = 783.99, Gs5 = 830.61, A5 = 880.00;
const Bb5 = 932.33, B5 = 987.77;
const C6 = 1046.50, D6 = 1174.66, Eb6 = 1244.51, E6 = 1318.51;
const F6 = 1396.91, Fs6 = 1479.98, G6 = 1567.98, A6 = 1760.00, B6 = 1975.53;

// ── Envelope presets ─────────────────────────────────────────────────

const STACC_ENV: Envelope = { attack: 0.003, decay: 0.04, sustain: 0.3, release: 0.05 };
const LEG_ENV: Envelope = { attack: 0.01, decay: 0.06, sustain: 0.7, release: 0.12 };
const PLUCK_FAST: Envelope = { attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.01 };
const BRASS_ENV: Envelope = { attack: 0.008, decay: 0.10, sustain: 0.55, release: 0.08 };
const SOFT_PAD: Envelope = { attack: 0.06, decay: 0.12, sustain: 0.45, release: 0.25 };

// ═══════════════════════════════════════════════════════════════════════
// Sound definitions — classical masterpieces, 8-bit chip style
//
// Common:     Beethoven — Moonlight Sonata (Op.27 No.2, I. Adagio sostenuto)
// Uncommon-A: Vivaldi — Winter I (RV 297, I. Allegro non molto)
// Uncommon-C: Vivaldi — Winter III (RV 297, III. Allegro)
// Rare:       Shostakovich — Waltz No.2 (Suite for Variety Orchestra)
// Epic:       Beethoven — Symphony No.3 "Eroica" IV. Finale
// Legendary:  Beethoven — Symphony No.5 IV. Allegro
// Mythic:     Beethoven — Symphony No.9 IV. Ode to Joy
// ═══════════════════════════════════════════════════════════════════════

type SDef = () => Track[];

// ── Common ── Beethoven: Moonlight Sonata, mm.1-10 ────────────────────
// C# minor. KEY IDENTITY: continuous triplet arpeggios + haunting top voice.
// mm.1-4: G#-C#-E triplets, top voice floating on E4
// mm.5-7: top voice descends C#5→B4→A4→G#4 (the lament)
// mm.8-10: answering phrase D#4→E4→D#4→C#4→B3→A3→G#3
const commonDef: SDef = () => {
  const Q = 0.44; // ♩ ≈ 136 (sped up, original Adagio is ♩=~54)
  const T = Q / 3;
  // Triplet accompaniment: C#m(i) → D/F# → C#m → G#7 → C#m
  // Each triplet group is 3 notes lasting Q total
  const tripAccomp = (bass: number, mid: number, high: number, reps: number): Note[] => {
    const notes: Note[] = [];
    for (let i = 0; i < reps; i++) {
      notes.push({ freq: bass, duration: T, wave: 'triangle', vol: 0.12, env: SOFT_ENV });
      notes.push({ freq: mid,  duration: T, wave: 'triangle', vol: 0.10, legato: true });
      notes.push({ freq: high, duration: T, wave: 'triangle', vol: 0.10, legato: true });
    }
    return notes;
  };
  return [
    // Accompaniment: bars 1-8 of triplets
    {
      offset: 0,
      notes: [
        // mm.1-2: i (C#m: G#3-C#4-E4) ×8 triplets
        ...tripAccomp(Gs3, C4s, E4, 8),
        // mm.3-4: D/F# → C#m: A3-D4-F#4 ×2 then back to C#m ×2
        // Actually mm.3-4: IV (F#m): A3-C#4-F#4 or ii° (D#dim): A3-D4-F#4
        // Measure 3 in Beethoven: A3-D4-F#4 → A3-C#4-F#4 → G#3-B#3-F#4 → G#3-B#3-F#4
        ...tripAccomp(A3, D4, Fs4, 2),   // A-D-F#
        ...tripAccomp(A3, C4s, Fs4, 2),  // A-C#-F#
        ...tripAccomp(Gs3, B3s, Fs4, 2), // G#-B#-F# (B#=C)
        // mm.5-6: i → V → i → V⁷ (top voice descends)
        ...tripAccomp(Gs3, C4s, E4, 2),  // G#-C#-E (top E4)
        ...tripAccomp(Gs3, B3, D4s, 2),  // G#-B-D# (V7, top D#4)
        ...tripAccomp(Gs3, C4s, E4, 2),  // i
        ...tripAccomp(Gs3, B3, D4s, 2),  // V7
      ],
    },
    // Melody (top voice extracted from triplets)
    {
      offset: 0,
      notes: [
        // mm.1-2: E4 floating (each note Q duration = 3 triplets)
        { freq: E4,  duration: Q * 4, wave: 'square', vol: 0.38, env: LEG_ENV },
        // m.3: F#4 floating (2 beats)
        { freq: Fs4, duration: Q * 2, wave: 'square', vol: 0.40, env: LEG_ENV },
        // m.3 beat 3-4: F#4
        { freq: Fs4, duration: Q * 2, wave: 'square', vol: 0.40 },
        // m.4: E4 floating again (4 beats)
        { freq: E4,  duration: Q * 4, wave: 'square', vol: 0.40, env: LEG_ENV },
        // mm.5-6: THE DESCENDING LAMENT — the most recognizable melody
        // Actually in the real score, the top voice of the triplets in bars 5-6 goes:
        // C#5 (over C#m) → C#5 → C#5 → C#5...
        // Then B4 B4 over D#dim...
        // The top voice DESCENDS stepwise. For the 8-bit snippet, extract as:
        { freq: C5s, duration: Q * 2, wave: 'square', vol: 0.44, env: LEG_ENV },
        { freq: B4,  duration: Q * 2, wave: 'square', vol: 0.42 },
        { freq: A4,  duration: Q * 2, wave: 'square', vol: 0.40 },
        { freq: Gs4, duration: Q * 4, wave: 'square', vol: 0.38, vibrato: { rate: 3, depth: 2 } },
      ],
    },
  ];
};

// ── Uncommon-A ── Vivaldi: Winter I, mm.1-8 ─────────────────────────
// F minor. Strings: staccato "shivering" F-F-F-F | rest | F-F-F-F | rest
// Then Ab-Ab-Ab-Ab. Solo violin: descending lament: C5-Bb4-Ab4-G4-F4-Eb4
const uncommonDef: SDef = () => {
  const e = 0.17; // ♪ at ♩≈176
  const q = e * 2;
  return [
    // Track 1 ── orchestral staccato (the "snow stomping") ──
    {
      offset: 0,
      notes: [
        // Bar 1: F-F-F-F
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.42, env: STACC_ENV },
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.42, env: STACC_ENV },
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.42, env: STACC_ENV },
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.42, env: STACC_ENV },
        { freq: 0,  duration: e * 1.6, wave: 'square' },
        // Bar 2: F-F-F-F (louder)
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.46, env: STACC_ENV },
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.46, env: STACC_ENV },
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.46, env: STACC_ENV },
        { freq: F4, duration: e * 0.65, wave: 'square', vol: 0.46, env: STACC_ENV },
        { freq: 0,  duration: e * 1.6, wave: 'square' },
        // Bar 3: Ab-Ab-Ab-Ab
        { freq: Gs4, duration: e * 0.65, wave: 'square', vol: 0.48, env: STACC_ENV }, // Ab
        { freq: Gs4, duration: e * 0.65, wave: 'square', vol: 0.48, env: STACC_ENV },
        { freq: Gs4, duration: e * 0.65, wave: 'square', vol: 0.48, env: STACC_ENV },
        { freq: Gs4, duration: e * 0.65, wave: 'square', vol: 0.48, env: STACC_ENV },
      ],
    },
    // Track 2 ── solo violin: the "howling wind" descent ──
    {
      offset: q * 6.5, // entry after the third staccato group
      notes: [
        { freq: C5,  duration: e,      wave: 'square', vol: 0.52, env: LEG_ENV },
        { freq: Bb4, duration: e,      wave: 'square', vol: 0.50, legato: true },
        { freq: Gs4, duration: e,      wave: 'square', vol: 0.50, legato: true },
        { freq: G4,  duration: e,      wave: 'square', vol: 0.48, legato: true },
        { freq: F4,  duration: e,      wave: 'square', vol: 0.48, legato: true },
        { freq: Eb4, duration: q * 0.8, wave: 'square', vol: 0.48, vibrato: { rate: 5, depth: 3 } },
        { freq: F4,  duration: q * 1.3, wave: 'square', vol: 0.48, vibrato: { rate: 4, depth: 2 } },
      ],
    },
  ];
};

// ── Uncommon-C ── Vivaldi: Winter III, mm.1-6 ──────────────────────
// F minor, Allegro. Solo violin: rapid "ice running" — ascending scale
// then cascading descent like slipping on ice.
const uncommonCDef: SDef = () => {
  const s = 0.08; // sixteenth at Allegro
  const e = s * 2;
  return [
    // Track 1 ── bass pulse ──
    {
      offset: 0,
      notes: [
        { freq: F3, duration: e, wave: 'triangle', vol: 0.18, env: PLUCK_FAST },
        { freq: 0,  duration: e, wave: 'triangle' },
        { freq: F3, duration: e, wave: 'triangle', vol: 0.18, env: PLUCK_FAST },
        { freq: 0,  duration: e, wave: 'triangle' },
        { freq: F3, duration: e, wave: 'triangle', vol: 0.20, env: PLUCK_FAST },
        { freq: 0,  duration: e, wave: 'triangle' },
        { freq: F3, duration: e, wave: 'triangle', vol: 0.20, env: PLUCK_FAST },
        { freq: 0,  duration: e, wave: 'triangle' },
      ],
    },
    // Track 2 ── ascending run: F4-G4-Ab4-Bb4-C5-Db5-Eb5-F5 ──
    {
      offset: 0,
      notes: [
        { freq: F4,  duration: s, wave: 'square', vol: 0.48, env: STACC_ENV },
        { freq: G4,  duration: s, wave: 'square', vol: 0.48, legato: true },
        { freq: Gs4, duration: s, wave: 'square', vol: 0.50, legato: true },
        { freq: Bb4, duration: s, wave: 'square', vol: 0.50, legato: true },
        { freq: C5,  duration: s, wave: 'square', vol: 0.52, legato: true },
        { freq: C5s, duration: s, wave: 'square', vol: 0.52, legato: true }, // Db
        { freq: Eb5, duration: s, wave: 'square', vol: 0.54, legato: true },
        { freq: F5,  duration: s, wave: 'square', vol: 0.55 },
        // Cascading down
        { freq: Eb5, duration: s, wave: 'square', vol: 0.54, legato: true },
        { freq: C5s, duration: s, wave: 'square', vol: 0.52, legato: true },
        { freq: C5,  duration: s, wave: 'square', vol: 0.52, legato: true },
        { freq: Bb4, duration: s, wave: 'square', vol: 0.50, legato: true },
        { freq: Gs4, duration: s, wave: 'square', vol: 0.50, legato: true },
        { freq: G4,  duration: s, wave: 'square', vol: 0.48, legato: true },
        { freq: F4,  duration: s, wave: 'square', vol: 0.48, legato: true },
        { freq: E4,  duration: e, wave: 'square', vol: 0.46 }, // leading tone
        // Turn figure
        { freq: F4,  duration: e * 0.7, wave: 'square', vol: 0.50, env: LEG_ENV },
        { freq: Gs4, duration: e * 0.7, wave: 'square', vol: 0.52, legato: true },
        { freq: C5,  duration: e * 0.7, wave: 'square', vol: 0.54, legato: true },
        { freq: F5,  duration: e * 1.8, wave: 'square', vol: 0.55, vibrato: { rate: 5, depth: 1 } },
      ],
    },
  ];
};

// ── Rare ── Shostakovich: Waltz No.2, A section ─────────────────────
// Eb major to C minor. 3/4 time. The iconic saxophone melody that
// everyone knows: Eb-Eb-Eb | F-G-(held G) | F-Eb-D | Eb-(held)
const rareDef: SDef = () => {
  const Q = 0.36; // ♩≈166 (fast waltz for 8-bit)
  return [
    // Track 1 ── waltz accompaniment (oom-pah-pah) ──
    {
      offset: 0,
      notes: (() => {
        const notes: Note[] = [];
        // Alternating Eb and Bb7 harmony in 3/4
        const bars: Array<[number, number[]]> = [
          [Eb3, [G3, Bb3]],  // Eb major
          [Eb3, [G3, Bb3]],  // Eb major
          [Bb2, [F3, Gs3]],  // Bb7 (dominant)
          [Eb3, [G3, Bb3]],  // Eb major
          [C3, [Eb3, G3]],   // C minor
          [F2, [F3, Gs3]],   // F minor
          [Bb2, [F3, Gs3]],  // Bb7
          [Eb3, [G3, Bb3]],  // Eb major
        ];
        for (const [bass, chord] of bars) {
          notes.push({ freq: bass, duration: Q, wave: 'triangle', vol: 0.14, env: PLUCK_FAST });
          notes.push({ freq: chord[0]!, duration: Q * 0.5, wave: 'triangle', vol: 0.08, env: SOFT_PAD });
          notes.push({ freq: chord[1]!, duration: Q * 0.5, wave: 'triangle', vol: 0.08, legato: true });
          notes.push({ freq: chord[0]!, duration: Q * 0.5, wave: 'triangle', vol: 0.08 });
          notes.push({ freq: chord[1]!, duration: Q * 0.5, wave: 'triangle', vol: 0.08, legato: true });
        }
        return notes;
      })(),
    },
    // Track 2 ── "saxophone" melody ──
    {
      offset: 0,
      notes: [
        // Phrase 1 — rising (Eb major): Eb-Eb-Eb | F-G--- | F-Eb-D | Eb---
        { freq: Eb5, duration: Q * 2.8, wave: 'square', vol: 0.42, env: LEG_ENV },
        { freq: Eb5, duration: Q,        wave: 'square', vol: 0.42, legato: true },
        { freq: Eb5, duration: Q,        wave: 'square', vol: 0.42, legato: true },
        { freq: F5,  duration: Q,        wave: 'square', vol: 0.44 },
        { freq: G5,  duration: Q * 2.0,  wave: 'square', vol: 0.46 },
        { freq: F5,  duration: Q,        wave: 'square', vol: 0.44 },
        { freq: Eb5, duration: Q,        wave: 'square', vol: 0.42, legato: true },
        { freq: D5,  duration: Q,        wave: 'square', vol: 0.40 },
        { freq: Eb5, duration: Q * 3.0,  wave: 'square', vol: 0.44, vibrato: { rate: 3, depth: 2 } },
        // Phrase 2 — the turn (C minor tinge): Eb-D-C | D---
        { freq: Eb5, duration: Q,        wave: 'square', vol: 0.42, env: LEG_ENV },
        { freq: D5,  duration: Q,        wave: 'square', vol: 0.40, legato: true },
        { freq: C5,  duration: Q,        wave: 'square', vol: 0.38, legato: true },
        { freq: D5,  duration: Q * 2.5,  wave: 'square', vol: 0.42 },
        // Suspension → resolution
        { freq: Eb5, duration: Q * 0.5,  wave: 'square', vol: 0.42 },
        { freq: D5,  duration: Q * 0.5,  wave: 'square', vol: 0.40, legato: true },
        { freq: Eb5, duration: Q * 3.5,  wave: 'square', vol: 0.44, vibrato: { rate: 4, depth: 2 } },
      ],
    },
  ];
};

// ── Epic ── Beethoven: Symphony No.3 "Eroica" — Finale ───────────────
// Eb major. The Prometheus theme stated three times, each more glorious:
// pizzicato strings → full orchestra → triumphant proclamation.
// Theme: Eb-Eb-Eb-F-G | G-F-Eb | (variations)
const epicDef: SDef = () => {
  const Q = 0.38; // ♩≈158
  const E = Q / 2;
  return [
    // Statement 1 ── pizzicato (triangle = plucked strings) ──
    {
      offset: 0,
      notes: (() => {
        const pluck = (f: number) => ({ freq: f, duration: Q * 0.45, wave: 'triangle' as Waveform, vol: 0.30, env: { attack: 0.001, decay: 0.06, sustain: 0.0, release: 0.01 } });
        return [
          pluck(Eb4), pluck(Eb4), pluck(Eb4), pluck(F4),
          pluck(G4),  pluck(G4),  pluck(F4),  pluck(Eb4),
        ];
      })(),
    },
    // Statement 2 ── forte: full orchestra, octave higher ──
    {
      offset: Q * 5.0,
      notes: [
        { freq: Eb4, duration: Q * 0.7, wave: 'square', vol: 0.48, env: BRASS_ENV },
        { freq: Eb4, duration: Q * 0.6, wave: 'square', vol: 0.48, legato: true },
        { freq: Eb5, duration: Q * 0.7, wave: 'square', vol: 0.52, legato: true },
        { freq: F5,  duration: Q * 0.7, wave: 'square', vol: 0.55 },
        { freq: G5,  duration: Q * 1.1, wave: 'square', vol: 0.56 },
        { freq: Gs5, duration: Q * 0.7, wave: 'square', vol: 0.56 }, // chromatic twist
        { freq: G5,  duration: Q * 0.6, wave: 'square', vol: 0.55, legato: true },
        { freq: F5,  duration: Q * 0.7, wave: 'square', vol: 0.52 },
        { freq: Eb5, duration: Q * 1.2, wave: 'square', vol: 0.52 },
      ],
    },
    { offset: Q * 5.0, notes: [{ freq: Eb3, duration: Q * 6.5, wave: 'triangle', vol: 0.06 }] },
    // Statement 3 ── triumphant peak, ascending proclamation ──
    {
      offset: Q * 12.0,
      notes: [
        { freq: Eb5, duration: Q * 0.6, wave: 'square', vol: 0.55, env: BRASS_ENV },
        { freq: Eb5, duration: Q * 0.5, wave: 'square', vol: 0.55, legato: true },
        { freq: Eb5, duration: Q * 0.6, wave: 'square', vol: 0.55, legato: true },
        { freq: F5,  duration: Q * 0.6, wave: 'square', vol: 0.58 },
        { freq: G5,  duration: Q * 0.8, wave: 'square', vol: 0.60 },
        { freq: Bb5, duration: Q * 0.6, wave: 'square', vol: 0.60, legato: true },
        { freq: Eb6, duration: Q * 2.0, wave: 'square', vol: 0.62, vibrato: { rate: 5, depth: 2 } },
      ],
    },
    { offset: Q * 12.0, notes: [{ freq: Eb3, duration: Q * 4.0, wave: 'triangle', vol: 0.07 }] },
    // Final timpani flourish
    {
      offset: Q * 15.5,
      notes: [
        { freq: Eb3, duration: Q * 0.2, wave: 'noise', vol: 0.20, env: PLUCK_FAST },
        { freq: Eb3, duration: Q * 0.2, wave: 'noise', vol: 0.22 },
        { freq: Eb3, duration: Q * 0.3, wave: 'noise', vol: 0.24 },
      ],
    },
  ];
};

// ── Legendary ── Beethoven: Symphony No.5 — IV. Allegro ──────────────
// The most dramatic key-change in music: C minor → C major.
// mm.1-8 (transition): timpani heartbeat, chromatic creep, then BLAZING
// C major fanfare (C-E-G-C). Then the march theme: C-C-D-E-F-E-D-C.
const legendaryDef: SDef = () => {
  const e = 0.22; // ♪ at ♩≈136
  const q = e * 2;
  return [
    // ── Part 1: C minor — timpani heartbeat ──
    { offset: 0, notes: [{ freq: C3, duration: q * 6, wave: 'triangle', vol: 0.06 }] },
    {
      offset: 0,
      notes: [
        { freq: C3, duration: e * 0.8, wave: 'noise', vol: 0.14, env: PLUCK_FAST },
        { freq: 0,  duration: q * 1.2, wave: 'square' },
        { freq: C3, duration: e * 0.8, wave: 'noise', vol: 0.16, env: PLUCK_FAST },
        { freq: 0,  duration: q * 1.2, wave: 'square' },
        { freq: C3, duration: e * 0.8, wave: 'noise', vol: 0.18, env: PLUCK_FAST },
      ],
    },
    // ── Part 2: chromatic ascent (C→G) — "something is coming" ──
    {
      offset: q * 5,
      notes: [
        { freq: C3,  duration: e * 0.7, wave: 'triangle', vol: 0.14 },
        { freq: C3s, duration: e * 0.6, wave: 'triangle', vol: 0.16, legato: true },
        { freq: D3,  duration: e * 0.6, wave: 'triangle', vol: 0.18, legato: true },
        { freq: Eb3, duration: e * 0.5, wave: 'triangle', vol: 0.20, legato: true },
        { freq: E3,  duration: e * 0.5, wave: 'triangle', vol: 0.22, legato: true },
        { freq: F3,  duration: e * 0.5, wave: 'triangle', vol: 0.24, legato: true },
        { freq: Fs3, duration: e * 0.4, wave: 'triangle', vol: 0.26, legato: true },
        { freq: G3,  duration: q * 0.8, wave: 'triangle', vol: 0.28 },
      ],
    },
    // ── Part 3: C MAJOR EXPLOSION ──
    {
      offset: q * 8.5,
      notes: [
        { freq: C4, duration: q * 0.7, wave: 'square', vol: 0.55, env: BRASS_ENV },
        { freq: 0,  duration: e * 0.3, wave: 'square' },
        { freq: E4, duration: q * 0.6, wave: 'square', vol: 0.58 },
        { freq: 0,  duration: e * 0.3, wave: 'square' },
        { freq: G4, duration: q * 0.6, wave: 'square', vol: 0.62 },
        { freq: 0,  duration: e * 0.3, wave: 'square' },
        { freq: C5, duration: q * 1.5, wave: 'square', vol: 0.65, vibrato: { rate: 5, depth: 2 } },
      ],
    },
    { offset: q * 8.5, notes: [{ freq: C3, duration: q * 4, wave: 'triangle', vol: 0.07 }] },
    { offset: q * 8.5, notes: [{ freq: G3, duration: q * 4, wave: 'triangle', vol: 0.05 }] },
    // ── Part 4: the iconic march theme in C major ──
    {
      offset: q * 13,
      notes: [
        { freq: C5, duration: q * 0.7, wave: 'square', vol: 0.55 },
        { freq: C5, duration: q * 0.5, wave: 'square', vol: 0.55, legato: true },
        { freq: D5, duration: q * 0.7, wave: 'square', vol: 0.58 },
        { freq: E5, duration: q * 0.7, wave: 'square', vol: 0.60 },
        { freq: F5, duration: q * 0.7, wave: 'square', vol: 0.60 },
        { freq: E5, duration: q * 0.5, wave: 'square', vol: 0.58, legato: true },
        { freq: D5, duration: q * 0.7, wave: 'square', vol: 0.55 },
        { freq: C5, duration: q * 2.0, wave: 'square', vol: 0.60, vibrato: { rate: 4, depth: 2 } },
      ],
    },
    // Final hammer blow
    { offset: q * 20, notes: [{ freq: C4, duration: q * 0.13, wave: 'noise', vol: 0.22 }] },
  ];
};

// ── Mythic ── Beethoven: Symphony No.9 — IV. Ode to Joy ──────────────
// D major. The full emotional arc:
// 1. Cello recitative — low, searching ("O Freunde, nicht diese Töne!")
// 2. Ode to Joy theme — bar 92, the melody heard 'round the world
// 3. Second phrase — reaching higher, then the majestic descent home
const mythicDef: SDef = () => {
  const Q = 0.38; // ♩≈158 (majestic but brisk for 8-bit)
  const H = Q * 2;
  const lead = (f: number, d: number, v = 0.40) =>
    ({ freq: f, duration: d, wave: 'square' as Waveform, vol: v, env: LEG_ENV });

  return [
    // Drone
    { offset: 0, notes: [{ freq: D3, duration: 15, wave: 'triangle', vol: 0.04 }] },
    // ── Recitative (cello): "Not these sounds, but something more joyful!" ──
    {
      offset: 0,
      notes: [
        // Low D — the instrument speaks, gravely
        { freq: D3, duration: Q * 0.6, wave: 'triangle', vol: 0.22 },
        { freq: 0,  duration: Q * 0.2, wave: 'square' },
        { freq: D3, duration: Q * 0.5, wave: 'triangle', vol: 0.24 },
        { freq: 0,  duration: Q * 0.2, wave: 'square' },
        { freq: A2, duration: Q * 0.5, wave: 'triangle', vol: 0.22 },
        { freq: 0,  duration: Q * 0.2, wave: 'square' },
        { freq: F2, duration: Q * 0.5, wave: 'triangle', vol: 0.20 },
        { freq: 0,  duration: Q * 0.2, wave: 'square' },
        // Searching figure — rising D major arpeggio
        { freq: D3,  duration: Q * 0.5, wave: 'triangle', vol: 0.26 },
        { freq: Fs3, duration: Q * 0.5, wave: 'triangle', vol: 0.28, legato: true },
        { freq: A3,  duration: Q * 0.5, wave: 'triangle', vol: 0.30, legato: true },
        { freq: D4,  duration: Q * 0.7, wave: 'triangle', vol: 0.32 },
        { freq: 0,   duration: Q * 0.3, wave: 'square' },
        // The call — D major arpeggio reaching higher
        { freq: Fs3, duration: Q * 0.3, wave: 'triangle', vol: 0.30 },
        { freq: A3,  duration: Q * 0.3, wave: 'triangle', vol: 0.32, legato: true },
        { freq: D4,  duration: Q * 0.3, wave: 'triangle', vol: 0.34, legato: true },
        { freq: Fs4, duration: Q * 0.3, wave: 'triangle', vol: 0.36, legato: true },
        // A dramatic pause...
        { freq: A4,  duration: Q * 0.8, wave: 'triangle', vol: 0.38 },
        { freq: 0,   duration: Q * 0.4, wave: 'square' },
      ],
    },
    // ── THE THEME ── bar 92, D major ──
    { offset: Q * 8.5, notes: [{ freq: D3,  duration: 7, wave: 'triangle', vol: 0.05 }] },
    { offset: Q * 8.5, notes: [{ freq: Fs3, duration: 7, wave: 'triangle', vol: 0.04 }] },
    // Phrase 1: "Freude, schöner Götterfunken" (bars 92-100)
    {
      offset: Q * 8.5,
      notes: [
        // D D E F# | F# E D C# | B B C# D | D (long) C# (long)
        lead(D5,  Q),
        lead(D5,  Q, 0.38), // legato
        lead(E5,  Q),
        lead(Fs5, Q),
        lead(Fs5, Q, 0.38), // legato
        lead(E5,  Q),
        lead(D5,  Q),
        lead(C5s, Q),
        lead(B4,  Q),
        lead(B4,  Q, 0.38), // legato
        lead(C5s, Q),
        lead(D5,  Q),
        lead(D5,  Q * 0.6, 0.36), // legato, slight rit.
        lead(C5s, Q * 0.6),
        { ...lead(C5s, Q, 0.38), vibrato: { rate: 4, depth: 2 } },
      ],
    },
    // Phrase 2: "Deine Zauber binden wieder" (bars 100-108)
    {
      offset: Q * 22,
      notes: [
        // D E F# G | A G F# E | D E F# E | D (long)
        lead(D5,  Q),
        lead(E5,  Q, 0.38),
        lead(Fs5, Q),
        lead(G5,  Q, 0.42),
        lead(A5,  Q, 0.44),
        lead(G5,  Q, 0.42),
        lead(Fs5, Q),
        lead(E5,  Q, 0.40),
        lead(D5,  Q),
        lead(E5,  Q, 0.40),
        lead(Fs5, Q, 0.42),
        lead(E5,  Q, 0.40),
        { ...lead(D5, H, 0.42), vibrato: { rate: 3, depth: 2 } },
      ],
    },
  ];
};

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sounds: Array<{ name: string; tracks: Track[] }> = [
    { name: 'common',     tracks: commonDef() },
    { name: 'uncommon',   tracks: uncommonDef() },
    { name: 'uncommon-c', tracks: uncommonCDef() },
    { name: 'rare',       tracks: rareDef() },
    { name: 'epic',       tracks: epicDef() },
    { name: 'legendary',  tracks: legendaryDef() },
    { name: 'mythic',     tracks: mythicDef() },
  ];

  for (const { name, tracks } of sounds) {
    const samples = render(tracks);
    const outPath = path.join(OUT_DIR, `${name}.wav`);
    writeWav(outPath, samples);
    const duration = (samples.length / SAMPLE_RATE).toFixed(1);
    const sizeKB = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`  ✅ ${name.padEnd(12)} ${duration}s  ${sizeKB} KB  → ${outPath}`);
  }

  console.log(`\n🎵 Generated ${sounds.length} achievement sounds in ${OUT_DIR}`);
}

main();
