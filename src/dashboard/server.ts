import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AchievementEngine } from '../engine/engine.js';
import { formatAchievement } from '../helpers.js';
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

function loadShowcase(stateDir: string): ShowcaseSlot[] {
  const p = path.join(stateDir, 'showcase.json');
  try {
    if (fs.existsSync(p)) {
      const data: { slots: (string | null)[] } = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return data.slots.map((id, i) => ({ slot: i, achievement: id ? ({ id } as any) : null }));
    }
  } catch { /* ignore */ }
  return Array.from({ length: 6 }, (_, i) => ({ slot: i, achievement: null }));
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
  return http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (url.pathname === '/api/data') {
      const showcase = loadShowcase(engine.stateDir);
      const showcaseData = showcase.map(s => ({
        slot: s.slot,
        achievement: s.achievement?.id
          ? (() => {
              const def = engine.definitions.find(d => d.id === s.achievement!.id);
              return def
                ? { ...formatAchievement(engine, def), unlocked: true as const }
                : null;
            })()
          : null,
      }));

      const data = buildApiResponse(
        engine.definitions,
        engine.state,
        engine.events,
        showcaseData,
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
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
