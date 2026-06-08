# Dashboard Process Resilience

> 2026-06-08 | OS-level daemon (opt-in) + health endpoint + Agent awareness

## Problem

Dashboard has no process resilience:
- Must be manually started (`npm run dashboard`)
- No crash recovery — silently gone
- No startup auto-recovery
- MCP server and Dashboard are independent, neither knows the other's state

## Design Principle

**Use the OS for what it is best at — process supervision.** No custom JS watchdog. No MCP server spawning child processes.

Three lightweight layers, each handling a distinct failure mode:

| Layer | Failure mode | Mechanism |
|-------|-------------|-----------|
| 1 | Crash / reboot | OS daemon (launchd/systemd), **opt-in, default off** |
| 2 | Observation | `GET /api/health` — 5-line endpoint, anyone can check |
| 3 | User notification | `achievement_stats` returns `dashboard_running`, Agent prompts user |

## Non-goals

- Auto-start without user consent — opt-in only
- Process monitoring dashboard — use Activity Monitor / htop
- Cross-platform daemon abstraction layer — one template per OS
- Daemon for MCP server — it's already auto-managed by Agent tools

---

## Layer 1: OS Daemon (opt-in)

### UX flow

```
agpa init
  ├── Language selection
  ├── Profile creation
  ├── Tool selection (multi-select)
  └── NEW: "Auto-start Dashboard on login?" [y/N]
       ├── y → writes plist, launchctl bootstrap
       └── N (default) → skip

agpa web --daemon    → install daemon manually
agpa web --no-daemon → uninstall daemon
agpa uninstall       → cleans up daemon config
```

### macOS launchd plist

Template at `~/Library/LaunchAgents/com.agpa.dashboard.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.agpa.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/node</string>          <!-- resolved at install time -->
    <string>/path/to/agpa</string>          <!-- agpa CLI or npx tsx -->
    <string>web</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>~/.agent-achievements/dashboard.log</string>
  <key>StandardErrorPath</key>
  <string>~/.agent-achievements/dashboard.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
```

### Linux systemd user unit

Template at `~/.config/systemd/user/agpa-dashboard.service`:

```
[Unit]
Description=AGPA Achievement Dashboard
After=network.target

[Service]
ExecStart=/usr/bin/node /path/to/agpa web
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

### Windows

Not implemented in this phase. `agpa init` on Windows skips daemon setup and shows a note recommending the user pin `agpa web` to startup folder.

### Install/uninstall helpers

| Function | Behavior |
|----------|----------|
| `installDaemon(os, agpaPath)` | Detects OS → writes plist/unit file → launches |
| `uninstallDaemon(os)` | Detects OS → stops daemon → deletes config file |
| `isDaemonInstalled(os)` | Checks if config file exists (for idempotency) |

All three are pure functions (no daemon state kept in memory), tested via fs mock.

---

## Layer 2: Health Endpoint

**File**: `src/dashboard/server.ts`

```
GET /api/health
  → 200 { status: "ok", uptime: 12345, profile: "default", version: "0.1.7" }
```

- `uptime`: `Date.now() - serverStartTime` in seconds
- Used by Layer 3 and by users for `curl localhost:3867/api/health`

### Dashboard startup output

When dashboard starts successfully, print a health-check hint:

```
🎮 AGPA Dashboard → http://localhost:3867  (profile: default)
   Health check: curl http://localhost:3867/api/health
   [daemon] active  ← only shown if OS daemon is installed
```

---

## Layer 3: Agent Awareness

### `achievement_stats` response extension

```json
{
  "total_unlocked": 42,
  "total_achievements": 183,
  // ... existing fields ...
  "dashboard_running": true  ← NEW
}
```

Computed by `try { GET http://127.0.0.1:3867/api/health, timeout 500ms } catch { false }`.

### AGENTS.md update

After "Session end checklist":

```
### Dashboard health

If `achievement_stats` returns `dashboard_running: false`, tell the user:
"Your Achievement Dashboard isn't running. Run `agpa web` to start it, or `agpa web --daemon` to auto-start on login."
```

---

## Files

| File | Action | Lines |
|------|--------|-------|
| `src/dashboard/server.ts` | EDIT — `/api/health` endpoint + startup output | +25 |
| `src/tools/stats.ts` | EDIT — `dashboard_running` field via health check | +15 |
| `src/cli/daemon.ts` | NEW — `installDaemon()` / `uninstallDaemon()` / `isDaemonInstalled()` | ~80 |
| `src/cli/dashboard.ts` | EDIT — `--daemon` / `--no-daemon` flags | +20 |
| `src/cli/init.ts` | EDIT — opt-in prompt in interactive flow | +25 |
| `src/cli/uninstall.ts` | EDIT — clean up daemon config | +10 |
| `AGENTS.md` | EDIT — dashboard_running guidance | +5 |
| `tests/tools/stats.test.ts` | EDIT — verify dashboard_running field | +20 |
| `tests/dashboard/server.test.ts` | EDIT — `/api/health` endpoint test | +15 |
| `tests/cli/daemon.test.ts` | NEW — install/uninstall/isInstalled unit tests | ~60 |

---

## Edge Cases

- **Port 3867 in use by another process** — Dashboard fails to bind, daemon's KeepAlive will keep retrying. Health endpoint returns 503 from the bad server, but our `startDashboard` won't produce that. Net result: daemon restarts, fails again. User sees "dashboard_running: false".
- **User manually kills Dashboard** — launchd `KeepAlive` restarts it within seconds
- **User runs `agpa web` while daemon already running** — port conflict, should detect and print "Dashboard is already running (managed by system daemon)"
- **User has both npm-link and local git install** — daemon uses the path resolved at install time (absolute path to node + agpa CLI)
- **Uninstall while daemon is running** — `uninstallDaemon()` stops before deleting config
- **Stats call with no network** — fetch to localhost always works if dashboard is up; timeout 500ms covers edge case
