# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, send an email to **[yizhi2026@foxmail.com]** (or the maintainer's email listed on the GitHub profile). Include:

- A clear description of the vulnerability
- Steps to reproduce
- Affected versions (or commit hash)
- Any potential impact you've identified

You'll receive an acknowledgment within 48 hours, and a status update within 7 days.

## Scope

Security issues that qualify for private disclosure include:

- Code execution through crafted event payloads
- Path traversal in file operations (`src/cli/hook.ts`, `src/engine/store.ts`)
- Injection attacks in YAML/JSON parsing or Dashboard rendering
- Privilege escalation between profiles
- Data exfiltration or unintended data exposure

## What's Out of Scope

- The `agpa init` process requiring write access to agent tool config files (this is by design — it's how AGPA integrates)
- The Dashboard HTTP server binding to `localhost` only (intentional, not a bypass)
- Achievements triggered by shell command detection (these use word-boundary regex matching, not actual command execution)

## Supported Versions

| Version | Supported |
|---------|:---------:|
| 0.1.x (latest) | ✅ |

AGPA is pre-1.0. Security fixes are released in the next patch version. There is no backport track.

## Disclosure Policy

- Reporter and maintainer agree on a disclosure timeline (default: 90 days)
- A CVE may be requested for high-severity issues
- Fix is released before public disclosure
- Reporter is credited in the release notes (unless they prefer to remain anonymous)
