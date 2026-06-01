import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import { AchievementEngine } from '../engine/engine.js';
import { formatAchievement, RARITY_RANK, loadShowcase, saveShowcase } from '../helpers.js';
import type { ShowcaseData } from '../helpers.js';
import { buildApiResponse } from './api.js';
import type { AchievementItem } from './api.js';
import {
  handleGetAchievements,
  handleUpdateAchievement,
  handleBatchUpdate,
  handleReload,
} from './customize-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, 'public');

// CSRF protection: random token generated once per server start,
// injected into HTML pages and required as x-dev-token header on /api/reset.
const devToken = crypto.randomBytes(16).toString('hex');

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
  return data.slots.map((id, i) => {
    if (!id) return { slot: i, achievement: null };
    // Guard: only show if still unlocked (prevents stale showcase after reset)
    const unlockedAt = engine.state.unlocked[id];
    if (!unlockedAt) return { slot: i, achievement: null };
    const def = engine.definitions.find(d => d.id === id);
    if (!def) return { slot: i, achievement: null };
    return {
      slot: i,
      achievement: { ...formatAchievement(engine, def), unlocked: true as const },
    };
  });
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

function serveStaticFile(res: http.ServerResponse, filePath: string): void {
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
    let content: Buffer | string = fs.readFileSync(filePath);
    // Inject CSRF token into HTML files so the frontend can send it back
    if (ext === '.html') {
      content = content.toString().replace('__DEV_TOKEN__', devToken);
    }
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
      engine.reloadDefinitions();
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

    // ═══════════════════════════════════════════════════════════════════
    // Self-Customize API — achievement name/description personalization
    // ═══════════════════════════════════════════════════════════════════

    // GET /api/customize/achievements — load all with suggestions
    if (url.pathname === '/api/customize/achievements' && req.method === 'GET') {
      try {
        const data = handleGetAchievements();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.writeHead(500);
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    // PUT /api/customize/achievement — update single field
    if (url.pathname === '/api/customize/achievement' && req.method === 'PUT') {
      const body = await parseJsonBody<{ id: string; changes: Record<string, string | null> }>(req);
      if (!body?.id || !body?.changes) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing id or changes' }));
        return;
      }
      try {
        const result = handleUpdateAchievement(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.writeHead(500);
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    // POST /api/customize/batch — apply multiple changes at once
    if (url.pathname === '/api/customize/batch' && req.method === 'POST') {
      const body = await parseJsonBody<{ changes: Array<{ id: string; field: string; value: string }> }>(req);
      if (!body?.changes || !Array.isArray(body.changes)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing changes array' }));
        return;
      }
      try {
        const result = handleBatchUpdate(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.writeHead(500);
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    // POST /api/customize/reload — reload YAML from disk
    if (url.pathname === '/api/customize/reload' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(handleReload()));
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

    // ── POST /api/reset — dev: clear all achievements ──────────────
    if (url.pathname === '/api/reset' && req.method === 'POST') {
      const csrfToken = req.headers['x-dev-token'];
      if (csrfToken !== devToken) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      engine.resetState();
      engine.init();
      const data = buildApiResponse(engine.definitions, engine.state, engine.events, [], engine.stats(), engine.setDefinitions);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', data }));
      return;
    }

    // ── Self-Customize page ─────────────────────────────────────────
    if (url.pathname === '/customize' && req.method === 'GET') {
      serveStaticFile(res, path.join(PUBLIC_DIR, 'customize.html'));
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
