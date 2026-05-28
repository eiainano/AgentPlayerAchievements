# AGPA Achievement Tracking

This project uses AGPA (Agent Player Achievements) to gamify AI coding. Most events are tracked automatically via Claude Code hooks — you don't need to manually call `achievement_track` for tool usage.

## Auto-tracked events (via CC hooks)
- `tool.complete` / `tool.failure` — every tool call (Read, Write, Edit, Bash, etc.)
- `file.read` / `file.create` / `file.edit` — file operations
- `command.run` — Bash executions
- `agent.spawn` / `agent.complete` — subagent lifecycle
- `session.start` / `session.end` — session lifecycle

## Manual tracking (events hooks can't detect)
Call `achievement_track` for these:
- `task.complete` — when you finish a task/subtask (with `{ task_name }` payload)
- Any achievement-specific events referenced in conditions

## Session end
At the end of every session, call `achievement_poll` to check for newly unlocked achievements. If any unlock, display them proudly with their icon and description!

## On-demand
Use `achievement_stats` when the user asks about progress.
Use `achievement_showcase` to manage the display cabinet.
