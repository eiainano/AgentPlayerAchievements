/**
 * AGPA Stats Server — lightweight anonymous telemetry collector
 *
 * Zero dependencies beyond Node.js stdlib. No auth, no user tracking.
 * Receives aggregated metric values from opt-in clients, computes
 * percentile thresholds, and returns them for local achievement evaluation.
 *
 * Endpoints:
 *   POST /report      { metric: string, value: number }
 *   GET  /thresholds  → { metric: { p10, p25, p50, p75, p90 } }
 *   GET  /health      → 200
 *
 * Usage:
 *   npx tsx src/server/stats-server.ts [--port 8787]
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = path.join(process.env.HOME || '~', '.agpa-stats-server', 'data.json');

// ── In-memory store ──────────────────────────────────────────

interface DataStore {
  samples: Record<string, number[]>;
}

let store: DataStore = loadStore();

function loadStore(): DataStore {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      return { samples: raw.samples || {} };
    }
  } catch { /* ignore */ }
  return { samples: {} };
}

function saveStore(): void {
  const dir = path.dirname(DATA_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(store));
}

// ── Reservoir sampling ───────────────────────────────────────

const MAX_SAMPLES = 10_000;

function addSample(metric: string, value: number): void {
  const arr = store.samples[metric] || [];
  arr.push(value);
  // Reservoir: keep latest MAX_SAMPLES entries
  if (arr.length > MAX_SAMPLES) {
    // Drop oldest half to stay within bounds
    store.samples[metric] = arr.slice(-MAX_SAMPLES);
  } else {
    store.samples[metric] = arr;
  }
}

// ── Percentile computation ───────────────────────────────────

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.round((p / 100) * (sorted.length - 1));
  return sorted[idx]!;
}

function computeThresholds(): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [metric, samples] of Object.entries(store.samples)) {
    if (samples.length < 10) continue; // need min sample size
    result[metric] = {
      p10: percentile(samples, 10),
      p25: percentile(samples, 25),
      p50: percentile(samples, 50),
      p75: percentile(samples, 75),
      p90: percentile(samples, 90),
    };
  }
  return result;
}

// ── JSON body parser ─────────────────────────────────────────

function parseBody<T>(req: http.IncomingMessage): Promise<T | null> {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve(null); }
    });
  });
}

let saveTimer: NodeJS.Timeout | null = null;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveStore(); saveTimer = null; }, 5000);
}

// ── Server ───────────────────────────────────────────────────

function createServer(): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');

    // POST /report
    if (url.pathname === '/report' && req.method === 'POST') {
      const body = await parseBody<{ metric?: string; value?: number }>(req);
      if (!body || typeof body.metric !== 'string' || typeof body.value !== 'number') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Expected { metric: string, value: number }' }));
        return;
      }
      addSample(body.metric, body.value);
      scheduleSave();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // GET /thresholds
    if (url.pathname === '/thresholds' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(computeThresholds()));
      return;
    }

    // GET /health
    if (url.pathname === '/health' && req.method === 'GET') {
      const totalSamples = Object.values(store.samples).reduce((sum, arr) => sum + arr.length, 0);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', total_samples: totalSamples, metrics: Object.keys(store.samples).length }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

function main(): void {
  const port = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '') || 8787;
  const server = createServer();
  server.listen(port, '0.0.0.0', () => {
    process.stderr.write(`\n  📊 AGPA Stats Server → http://0.0.0.0:${port}\n`);
    process.stderr.write(`     POST /report      (anonymous metric submission)\n`);
    process.stderr.write(`     GET  /thresholds  (percentile thresholds)\n`);
    process.stderr.write(`     GET  /health      (server status)\n\n`);
  });
}

main();
