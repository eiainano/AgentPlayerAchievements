/**
 * AGPA Telemetry — optional anonymous metric reporting
 *
 * When enabled, computes local metrics from event history and reports them
 * to the stats server. Fetches percentile thresholds for local evaluation.
 *
 * Default: OFF. Users opt in via `agpa config set telemetry true`.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TrackedEvent } from './engine/types.js';
import { loadConfig } from './config.js';

// ── Cached thresholds ────────────────────────────────────────

interface ThresholdCache {
  fetched_at: string;
  thresholds: Record<string, Record<string, number>>;
}

function cachePath(stateDir: string): string {
  return path.join(stateDir, 'thresholds.json');
}

export function getCachedThreshold(stateDir: string, metric: string, percentileKey: string): number | null {
  try {
    const p = cachePath(stateDir);
    if (!fs.existsSync(p)) return null;
    const cache: ThresholdCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return cache.thresholds[metric]?.[percentileKey] ?? null;
  } catch {
    return null;
  }
}

// ── Local metric computation ─────────────────────────────────

export interface MetricReport {
  metric: string;
  value: number;
}

export function computeLocalMetrics(events: TrackedEvent[]): MetricReport[] {
  const results: MetricReport[] = [];

  // avg_prompt_length: from conversation.message events with a length field
  const msgEvents = events.filter(e => e.event_type === 'conversation.message');
  const msgLengths = msgEvents
    .map(e => Number(e.payload?.length))
    .filter(n => n > 0);
  if (msgLengths.length > 0) {
    const avg = msgLengths.reduce((a, b) => a + b, 0) / msgLengths.length;
    results.push({ metric: 'avg_prompt_length', value: Math.round(avg * 10) / 10 });
  }

  // avg_prompt_length: also from UserPromptSubmit hook data (prompt length)
  const promptEvents = events.filter(e => e.event_type === 'user.prompt');
  const promptLengths = promptEvents
    .map(e => Number(e.payload?.length))
    .filter(n => n > 0);
  if (promptLengths.length > 0) {
    const avg = promptLengths.reduce((a, b) => a + b, 0) / promptLengths.length;
    results.push({ metric: 'avg_prompt_length', value: Math.round(avg * 10) / 10 });
  }

  return results;
}

// ── Network ──────────────────────────────────────────────────

export async function reportMetrics(metrics: MetricReport[], serverUrl: string): Promise<boolean> {
  let ok = true;
  for (const m of metrics) {
    try {
      const res = await fetch(`${serverUrl}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: m.metric, value: m.value }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) ok = false;
    } catch {
      ok = false;
    }
  }
  return ok;
}

export async function fetchThresholds(serverUrl: string): Promise<Record<string, Record<string, number>> | null> {
  try {
    const res = await fetch(`${serverUrl}/thresholds`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json() as Record<string, Record<string, number>>;
  } catch {
    return null;
  }
}

export function saveThresholdCache(stateDir: string, thresholds: Record<string, Record<string, number>>): void {
  const p = cachePath(stateDir);
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const cache: ThresholdCache = {
    fetched_at: new Date().toISOString(),
    thresholds,
  };
  fs.writeFileSync(p, JSON.stringify(cache, null, 2));
}

// ── Main entry point ─────────────────────────────────────────

export async function runTelemetry(
  stateDir: string,
  events: TrackedEvent[],
): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.telemetry) return;

  const serverUrl = cfg.telemetry_server || 'https://agpa-telemetry.example.com';
  const metrics = computeLocalMetrics(events);
  if (metrics.length === 0) return;

  // Report local metrics
  await reportMetrics(metrics, serverUrl);

  // Fetch latest thresholds and cache
  const thresholds = await fetchThresholds(serverUrl);
  if (thresholds && Object.keys(thresholds).length > 0) {
    saveThresholdCache(stateDir, thresholds);
  }
}
