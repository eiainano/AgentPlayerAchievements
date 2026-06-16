import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as https from 'https';
import { fileURLToPath } from 'url';
import { AchievementEngine } from '../engine/engine.js';
import { saveConfig, loadConfig, isSoundEnabled, setSoundEnabled, isSimpleAnimations, setSimpleAnimations } from '../config.js';
import { formatAchievement, RARITY_RANK, loadShowcase, saveShowcase } from '../helpers.js';
import type { ShowcaseData } from '../helpers.js';
import { buildApiResponse, buildCardResponse } from './api.js';
import type { AchievementItem } from './api.js';
import {
  handleGetAchievements,
  handleUpdateAchievement,
  handleBatchUpdate,
  handleReload,
} from './customize-api.js';
import {
  resolveProfileDir,
  listProfilesWithMeta,
  createProfile,
  validateProfileName,
  profileExists,
  DEFAULT_PROFILE,
  MAX_PROFILES,
  getProfileMeta,
} from '../utils/profile.js';

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

// ── Read version from package.json (once, at module load) ──────────────
const PKG_PATH = path.resolve(__dirname, '../../package.json');
function readVersion(): string {
  try { return JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8')).version || '0.0.0'; }
  catch { return '0.0.0'; }
}
const VERSION = readVersion();

// ── Lazy CDN cache for offline dependency loading ──────────────────────

const HTML2CANVAS_CDN = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
const LOCAL_LIB = path.join(PUBLIC_DIR, 'lib', 'html2canvas.min.js');
let html2canvasBuffer: Buffer | null = null;

async function ensureHtml2canvas(): Promise<Buffer> {
  // Return cached in-memory copy first
  if (html2canvasBuffer) return html2canvasBuffer;
  // Return local file if exists
  try {
    const local = fs.readFileSync(LOCAL_LIB);
    html2canvasBuffer = local;
    return local;
  } catch { /* not on disk */ }
  // Fetch from CDN as last resort
  try {
    const buf = await new Promise<Buffer>((resolve, reject) => {
      https.get(HTML2CANVAS_CDN, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
    html2canvasBuffer = buf;
    // Write to disk for offline use (best-effort)
    try {
      fs.mkdirSync(path.dirname(LOCAL_LIB), { recursive: true });
      fs.writeFileSync(LOCAL_LIB, buf);
    } catch { /* write failed, in-memory fallback is fine */ }
    return buf;
  } catch {
    // Absolute last resort: return a minimal stub that no-ops
    html2canvasBuffer = Buffer.from('(function(){console.warn("AGPA: html2canvas not available (offline)");})();');
    return html2canvasBuffer;
  }
}

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

export function createServer(port: number, defaultProfile: string): http.Server {
  // Cache engine instances per profile — shared across all requests
  const engineCache = new Map<string, AchievementEngine>();
  const serverStartTime = Date.now();
  // Track which profiles have already emitted dashboard.opened this server session
  const openedTracked = new Set<string>();

  function getEngine(profileName: string): AchievementEngine {
    let cached = engineCache.get(profileName);
    if (cached) return cached;
    const stateDir = resolveProfileDir(profileName);
    const eng = new AchievementEngine({ stateDir });
    eng.init();
    engineCache.set(profileName, eng);
    return eng;
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const profileParam = url.searchParams.get('profile');
    const resolvedProfile = profileParam || defaultProfile;

    // Reject path traversal / invalid profile names early
    let engine: AchievementEngine;
    try {
      engine = getEngine(resolvedProfile);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid profile name' }));
      return;
    }

    // ── GET /api/health ──────────────────────────────────────────────────
    if (url.pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime: Math.round((Date.now() - serverStartTime) / 1000),
        profile: resolvedProfile,
        version: VERSION,
      }));
      return;
    }

    // ── GET /api/data ──────────────────────────────────────────────────
    if (url.pathname === '/api/data' && req.method === 'GET') {
      // Compute current session duration: find last session.start with no trailing session.end
      let sessDurationMs = 0;
      const events = engine.events;
      if (events.length > 0) {
        let lastStartIdx = -1;
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i]!.event_type === 'session.start') {
            lastStartIdx = i;
            break;
          }
        }
        if (lastStartIdx >= 0) {
          const lastStartTime = new Date(events[lastStartIdx]!.timestamp).getTime();
          const hasEnd = events.slice(lastStartIdx + 1).some(e => e.event_type === 'session.end');
          if (!hasEnd) {
            sessDurationMs = Date.now() - lastStartTime;
          }
        }
      }
      // Track dashboard.opened only once per server-session per profile,
      // not on every 10s auto-poll request.
      if (!openedTracked.has(resolvedProfile)) {
        openedTracked.add(resolvedProfile);
        engine.track('dashboard.opened', { session_duration_ms: sessDurationMs });
      }
      engine.reload();
      // NOT calling reloadDefinitions() here — YAML only changes when the user
      // explicitly edits it. The /api/customize/reload endpoint handles that.
      // Saving ~5ms of disk I/O per 10s auto-poll across the lifetime of the
      // dashboard session adds up.
      const showcaseData = buildShowcaseResponse(engine);
      const includeRecommend = url.searchParams.get('include_recommend') === 'true';
      const packsData = engine.packs.length > 0
        ? engine.packs.map(p => ({
            id: p.id,
            name: p.name,
            author: p.author,
            version: p.version,
            description: p.description,
            achievement_count: engine.packDefinitions.filter(d => d.pack_id === p.id).length,
            unlocked_count: engine.packDefinitions.filter(d => d.pack_id === p.id && engine.state.unlocked[d.id]).length,
          }))
        : undefined;
      const data = buildApiResponse(
        engine.definitions,
        engine.state,
        engine.events,
        showcaseData,
        engine.stats(),
        engine.setDefinitions,
        engine.questlineDefinitions,
        engine.toolStats(),
        { includeRecommend, packs: packsData },
      );
      data.profile = resolvedProfile;
      data.profile_emoji = getProfileMeta(resolvedProfile).emoji;
      data.is_demo = (resolvedProfile as string) === '_demo';
      data.has_demo = profileExists('_demo');
      data.profiles = listProfilesWithMeta()
        .filter(p => p.name !== '_demo')
        .map(p => ({ name: p.name, emoji: p.emoji, tracked_tools: p.tracked_tools }));
      data.max_profiles = MAX_PROFILES;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // ── POST /api/profiles/active — set active profile (also updates config.json) ──
    if (url.pathname === '/api/profiles/active' && req.method === 'POST') {
      const body = await parseJsonBody<{ profile: string }>(req);
      const profile = body?.profile?.trim();
      if (!profile) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing profile name' }));
        return;
      }
      try {
        // Validate the profile name and check it exists
        const engine = getEngine(profile); // throws if invalid
        // Persist choice to config.json so MCP server can pick it up
        saveConfig({ active_profile: profile });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', profile }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid profile';
        res.writeHead(400);
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    // ── GET /api/profiles ──────────────────────────────────────────────
    if (url.pathname === '/api/profiles' && req.method === 'GET') {
      const profilesMeta = listProfilesWithMeta();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        active: resolvedProfile,
        active_meta: getProfileMeta(resolvedProfile),
        profiles: profilesMeta.filter(p => p.name !== '_demo').map(p => ({ name: p.name, emoji: p.emoji, tracked_tools: p.tracked_tools })),
        max: MAX_PROFILES,
      }));
      return;
    }

    // ── POST /api/profiles ─────────────────────────────────────────────
    if (url.pathname === '/api/profiles' && req.method === 'POST') {
      const body = await parseJsonBody<{ name: string; emoji?: string }>(req);
      const rawName = body?.name?.trim() || 'profile0';
      const emoji = body?.emoji?.trim() || undefined;
      try {
        const stateDir = createProfile(rawName, emoji);
        const name = rawName.toLowerCase();
        // Warm the engine cache for the new profile
        const eng = new AchievementEngine({ stateDir });
        eng.init();
        engineCache.set(name, eng);
        const profilesMeta = listProfilesWithMeta();
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          name,
          emoji: emoji || '🎮',
          profiles: profilesMeta.map(p => ({ name: p.name, emoji: p.emoji, tracked_tools: p.tracked_tools })),
          max: MAX_PROFILES,
        }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        res.writeHead(409);
        res.end(JSON.stringify({ error: msg }));
      }
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
      res.end(JSON.stringify({ status: 'ok', slot: body.slot, achievement_id: body.achievement_id, showcase: buildShowcaseResponse(engine) }));
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
      res.end(JSON.stringify({ status: 'ok', slot: body.slot, showcase: buildShowcaseResponse(engine) }));
      return;
    }

    // ═══════════════════════════════════════════════════════════════════
    // P1-4: Export / Import API
    // ═══════════════════════════════════════════════════════════════════

    // GET /api/export — export achievement data as JSON download
    if (url.pathname === '/api/export' && req.method === 'GET') {
      const full = url.searchParams.get('full') === 'true';
      try {
        const meta = getProfileMeta(resolvedProfile);
        const payload: Record<string, unknown> = {
          format_version: '1.0',
          exported_at: new Date().toISOString(),
          source: { tool: 'agpa', version: VERSION, profile: resolvedProfile, profile_emoji: meta.emoji },
          state: engine.state,
          stats: engine.toolStats(),
          showcase: loadShowcase(engine.stateDir),
        };
        if (full) {
          payload.events = engine.events;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="agpa-${resolvedProfile}-${new Date().toISOString().slice(0, 10)}.json"`,
        });
        res.end(JSON.stringify(payload, null, 2));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Export failed';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
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

    // POST /api/customize/reload — reload YAML from disk for all cached engines
    if (url.pathname === '/api/customize/reload' && req.method === 'POST') {
      // Reload every cached engine's definitions so the dashboard picks up
      // edits to achievement-definitions.yaml without requiring a restart.
      for (const [profileName, cachedEngine] of engineCache) {
        try { cachedEngine.reloadDefinitions(); } catch { /* stale engine, skip */ }
      }
      // Also reload the current request's engine
      try { engine.reloadDefinitions(); } catch { /* ok */ }
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

    // ── POST /api/reset — dev: clear all achievements (default profile only) ──
    if (url.pathname === '/api/reset' && req.method === 'POST') {
      if (resolvedProfile !== DEFAULT_PROFILE) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Reset is only available for the default profile.' }));
        return;
      }
      const csrfToken = req.headers['x-dev-token'];
      if (csrfToken !== devToken) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      engine.resetState();
      engine.init();
      const packsData = engine.packs.length > 0
        ? engine.packs.map(p => ({
            id: p.id,
            name: p.name,
            author: p.author,
            version: p.version,
            description: p.description,
            achievement_count: engine.packDefinitions.filter(d => d.pack_id === p.id).length,
            unlocked_count: engine.packDefinitions.filter(d => d.pack_id === p.id && engine.state.unlocked[d.id]).length,
          }))
        : undefined;
      const data = buildApiResponse(engine.definitions, engine.state, engine.events, [], engine.stats(), engine.setDefinitions, engine.questlineDefinitions, engine.toolStats(), { packs: packsData });
      data.profile = resolvedProfile;
      data.profile_emoji = getProfileMeta(resolvedProfile).emoji;
      data.is_demo = (resolvedProfile as string) === '_demo';
      data.profiles = listProfilesWithMeta()
        .filter(p => p.name !== '_demo')
        .map(p => ({ name: p.name, emoji: p.emoji, tracked_tools: p.tracked_tools }));
      data.max_profiles = MAX_PROFILES;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', data }));
      return;
    }

    // ── GET /api/config/sound — read sound toggle state ────────────────
    if (url.pathname === '/api/config/sound' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sound_enabled: isSoundEnabled() }));
      return;
    }

    // ── POST /api/config/sound — toggle sound on/off ───────────────────
    if (url.pathname === '/api/config/sound' && req.method === 'POST') {
      const body = await parseJsonBody<{ sound_enabled: boolean }>(req);
      if (!body || typeof body.sound_enabled !== 'boolean') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing sound_enabled (boolean)' }));
        return;
      }
      setSoundEnabled(body.sound_enabled);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sound_enabled: body.sound_enabled }));
      return;
    }

    // ── GET /api/config/animations — read animation toggle state ─────
    if (url.pathname === '/api/config/animations' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ simple_animations: isSimpleAnimations() }));
      return;
    }

    // ── POST /api/config/animations — toggle simple animations ─────
    if (url.pathname === '/api/config/animations' && req.method === 'POST') {
      const body = await parseJsonBody<{ simple_animations: boolean }>(req);
      if (!body || typeof body.simple_animations !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing simple_animations (boolean)' }));
        return;
      }
      setSimpleAnimations(body.simple_animations);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ simple_animations: body.simple_animations }));
      return;
    }

    // ── Self-Customize page ─────────────────────────────────────────
    if (url.pathname === '/customize' && req.method === 'GET') {
      serveStaticFile(res, path.join(PUBLIC_DIR, 'customize.html'));
      return;
    }

    // ── GET /api/card — shareable achievement card data ──────────────
    if (url.pathname === '/api/card' && req.method === 'GET') {
      try {
        const cfg = loadConfig();
        const meta = getProfileMeta(resolvedProfile);
        const cardData = buildCardResponse(
          engine.definitions,
          engine.state,
          engine.events,
          engine.setDefinitions,
          cfg,
          resolvedProfile,
          meta.emoji,
          engine.toolStats(),
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cardData));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Card generation failed';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg }));
      }
      return;
    }

    // ── Serve html2canvas (local if possible, lazy CDN fallback) ──
    if (url.pathname === '/lib/html2canvas.min.js') {
      try {
        const buf = await ensureHtml2canvas();
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end(buf);
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        res.end('(function(){console.warn("AGPA: html2canvas unavailable");})();');
      }
      return;
    }

    serveStatic(res, url.pathname);
  });
}

export function startDashboard(port = 3867, profile?: string): http.Server {
  const defaultProfile = profile || process.env.AGPA_PROFILE || DEFAULT_PROFILE;

  const server = createServer(port, defaultProfile);
  server.listen(port, '127.0.0.1', () => {
    process.stderr.write(`\n  🎮 AGPA Dashboard → http://localhost:${port}  (profile: ${defaultProfile})\n`);
    process.stderr.write(`  Health check: curl http://localhost:${port}/api/health\n\n`);
  });

  return server;
}
