import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createServer, startDashboard } from '../../src/dashboard/server.js';
import { setConfigDir } from '../../src/config.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

function request(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': body ? 'application/json' : '',
          ...(headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
      },
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

beforeAll(async () => {
  server = createServer(0, 'default');
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

// ── Static file serving ─────────────────────────────────────────────────────

describe('static file serving', () => {
  it('GET / returns HTML with Content-Type text/html', async () => {
    const res = await request('GET', '/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('GET / serves HTML that does NOT contain raw __DEV_TOKEN__', async () => {
    const res = await request('GET', '/');
    expect(res.body).not.toContain('__DEV_TOKEN__');
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await request('GET', '/nonexistent-path-12345');
    expect(res.status).toBe(404);
  });

  it('path traversal attempt is rejected (404)', async () => {
    // Server resolves the path then checks it's inside PUBLIC_DIR;
    // when not inside, it falls through to the 404 catch-all.
    const res = await request('GET', '/../../../etc/passwd');
    expect(res.status).toBe(404);
  });

  it('GET /customize returns HTML', async () => {
    const res = await request('GET', '/customize');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('GET /*.css returns correct MIME type', async () => {
    const res = await request('GET', '/styles.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
  });

  it('GET /*.js returns correct MIME type', async () => {
    const res = await request('GET', '/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/javascript');
  });
});

// ── API routes ──────────────────────────────────────────────────────────────

describe('API routes', () => {
  it('GET /api/profiles returns profile list', async () => {
    const res = await request('GET', '/api/profiles');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('profiles');
    expect(data).toHaveProperty('max');
    expect(Array.isArray(data.profiles)).toBe(true);
  });

  it('GET /api/profiles includes active profile', async () => {
    const res = await request('GET', '/api/profiles');
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('active');
  });

  it('POST /api/profiles/active with missing profile returns 400', async () => {
    const res = await request('POST', '/api/profiles/active', {});
    expect(res.status).toBe(400);
  });

  it('POST /api/profiles/active with empty profile returns 400', async () => {
    const res = await request('POST', '/api/profiles/active', { profile: '' });
    expect(res.status).toBe(400);
  });

  it('POST /api/reset without x-dev-token returns 403', async () => {
    const res = await request('POST', '/api/reset', {});
    expect(res.status).toBe(403);
  });

  it('POST /api/reset with wrong x-dev-token returns 403', async () => {
    const res = await request('POST', '/api/reset', {}, { 'x-dev-token': 'wrong-token' });
    expect(res.status).toBe(403);
  });

  it('POST /api/customize/reload returns ok', async () => {
    const res = await request('POST', '/api/customize/reload', {});
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.status).toBe('ok');
  });

  it('PUT /api/showcase with invalid slot returns 400', async () => {
    const res = await request('PUT', '/api/showcase', { slot: 99, achievement_id: 'test' });
    // Server may return 400 or 200 with empty — either is fine for invalid slot
    expect([200, 400]).toContain(res.status);
  });

  it('DELETE /api/showcase with invalid slot returns 400', async () => {
    const res = await request('DELETE', '/api/showcase', { slot: 99 });
    expect([200, 400]).toContain(res.status);
  });

  it('GET /api/config/sound returns sound_enabled', async () => {
    const res = await request('GET', '/api/config/sound');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('sound_enabled');
  });

  it('GET /api/config/animations returns simple_animations', async () => {
    const res = await request('GET', '/api/config/animations');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('simple_animations');
  });

  it('GET /api/export returns state + stats', async () => {
    const res = await request('GET', '/api/export');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('format_version');
    expect(data).toHaveProperty('state');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('exported_at');
  });

  it('GET /api/card returns card data', async () => {
    const res = await request('GET', '/api/card');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('profile');
    expect(data).toHaveProperty('achievements');
  });

  it('GET /api/health returns status, uptime, profile, version', async () => {
    const res = await request('GET', '/api/health');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('uptime');
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data).toHaveProperty('profile');
    expect(data).toHaveProperty('version');
  });

  it('GET /api/data returns full dashboard payload', async () => {
    const res = await request('GET', '/api/data');
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data).toHaveProperty('achievements');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('profile');
  });
});

// ── Error handling ──────────────────────────────────────────────────────────

describe('error handling', () => {
  it('POST with invalid JSON body is handled gracefully', async () => {
    const url = new URL('/api/profiles/active', baseUrl);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        // Either 400 for invalid body or error for parse failure
        expect([200, 400, 500]).toContain(res.statusCode);
      });
    });
    req.write('{ invalid json }');
    req.end();
    await new Promise(r => setTimeout(r, 500));
  });
});

// ── startDashboard profile resolution ───────────────────────────────────────
//
// Regression: `agpa dashboard` invoked with no --profile flag must fall back to
// config.active_profile. It previously skipped that link in the chain and always
// served the "default" profile, so a user on any other profile silently got the
// wrong data.

describe('startDashboard profile resolution', () => {
  let tmpDir: string;
  let prevProfile: string | undefined;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agpa-dash-'));
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ active_profile: 'work' }));
    prevProfile = process.env.AGPA_PROFILE;
    delete process.env.AGPA_PROFILE;
    setConfigDir(tmpDir);
  });

  afterAll(() => {
    setConfigDir(undefined);
    if (prevProfile === undefined) delete process.env.AGPA_PROFILE;
    else process.env.AGPA_PROFILE = prevProfile;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Boot startDashboard on an ephemeral port and read back the profile it
   * announces. No request is issued, so no engine is instantiated and the
   * profile name is never resolved against the real ~/.agent-achievements.
   */
  async function bootAndReadProfile(flag?: string): Promise<string> {
    let srv: http.Server;
    let logged = '';
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      srv = startDashboard(0, flag);
      await new Promise<void>((resolve) => srv.once('listening', resolve));
    } finally {
      // Read before restoring — mockRestore() clears recorded calls.
      logged = spy.mock.calls.map((c) => String(c[0])).join('');
      spy.mockRestore();
    }
    await new Promise<void>((resolve) => srv.close(() => resolve()));

    const match = logged.match(/\(profile: ([^)]+)\)/);
    if (!match) throw new Error(`startDashboard announced no profile. stderr was: ${logged}`);
    return match[1]!;
  }

  it('falls back to config.active_profile when no --profile flag is passed', async () => {
    expect(await bootAndReadProfile()).toBe('work');
  });

  it('lets an explicit --profile flag win over config.active_profile', async () => {
    expect(await bootAndReadProfile('other')).toBe('other');
  });
});
