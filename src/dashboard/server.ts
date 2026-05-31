import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AchievementEngine } from '../engine/engine.js';
import { formatAchievement, RARITY_RANK, loadShowcase, saveShowcase } from '../helpers.js';
import type { ShowcaseData } from '../helpers.js';
import { buildApiResponse } from './api.js';
import type { AchievementItem } from './api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

interface ShowcaseSlot {
  slot: number;
  achievement: Record<string, unknown> | null;
}

function buildShowcaseResponse(engine: AchievementEngine): Array<{ slot: number; achievement: AchievementItem | null }> {
  const data = loadShowcase(engine.stateDir);
  return data.slots.map((id, i) => ({
    slot: i,
    achievement: id
      ? (() => {
          const def = engine.definitions.find(d => d.id === id);
          return def ? { ...formatAchievement(engine, def), unlocked: true as const } : null;
        })()
      : null,
  }));
}

function parseJsonBody<T>(req: http.IncomingMessage): Promise<T | null> {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(null); }
    });
  });
}

function serveStatic(res: http.ServerResponse, urlPath: string): void {
  const reqPath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(PUBLIC_DIR, reqPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

export function createServer(engine: AchievementEngine, port = 3867): http.Server {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    // ── GET /api/data ──────────────────────────────────────────────────
    if (url.pathname === '/api/data' && req.method === 'GET') {
      engine.track('dashboard.opened', {});
      engine.reload();
      const showcaseData = buildShowcaseResponse(engine);
      const data = buildApiResponse(engine.definitions, engine.state, engine.events, showcaseData, engine.stats(), engine.setDefinitions);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // ── PUT /api/showcase — set slot ───────────────────────────────────
    if (url.pathname === '/api/showcase' && req.method === 'PUT') {
      const body = await parseJsonBody<{ slot: number; achievement_id: string }>(req);
      if (!body || typeof body.slot !== 'number' || typeof body.achievement_id !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing slot or achievement_id' }));
        return;
      }
      const sc = loadShowcase(engine.stateDir);
      if (body.slot < 0 || body.slot >= sc.slots.length) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: `slot must be 0–${sc.slots.length - 1}` }));
        return;
      }
      if (!engine.state.unlocked[body.achievement_id]) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'achievement not yet unlocked' }));
        return;
      }
      sc.slots[body.slot] = body.achievement_id;
      saveShowcase(engine.stateDir, sc);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', slot: body.slot, achievement_id: body.achievement_id }));
      return;
    }

    // ── DELETE /api/showcase — clear slot ──────────────────────────────
    if (url.pathname === '/api/showcase' && req.method === 'DELETE') {
      const body = await parseJsonBody<{ slot: number }>(req);
      if (!body || typeof body.slot !== 'number') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing slot' }));
        return;
      }
      const sc = loadShowcase(engine.stateDir);
      if (body.slot < 0 || body.slot >= sc.slots.length) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: `slot must be 0–${sc.slots.length - 1}` }));
        return;
      }
      sc.slots[body.slot] = null;
      saveShowcase(engine.stateDir, sc);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', slot: body.slot }));
      return;
    }

    // ── POST /api/showcase/auto ────────────────────────────────────────
    if (url.pathname === '/api/showcase/auto' && req.method === 'POST') {
      const unlocked = engine.definitions
        .filter(d => engine.state.unlocked[d.id])
        .sort((a, b) => (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0));
      const sc = loadShowcase(engine.stateDir);
      for (let i = 0; i < Math.min(sc.slots.length, unlocked.length); i++) {
        sc.slots[i] = unlocked[i]!.id;
      }
      saveShowcase(engine.stateDir, sc);
      const result = buildShowcaseResponse(engine);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', showcase: result }));
      return;
    }

    serveStatic(res, url.pathname);
  });
}

export function startDashboard(port = 3867): http.Server {
  const engine = new AchievementEngine();
  engine.init();

  const server = createServer(engine, port);
  server.listen(port, '127.0.0.1', () => {
    process.stderr.write(`\n  🎮 AGPA Dashboard → http://localhost:${port}\n\n`);
  });

  return server;
}
