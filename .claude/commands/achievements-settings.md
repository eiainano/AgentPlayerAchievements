---
description: Configure AGPA achievement settings — language, notifications, and reset
argument-hint: "[language <code>|notifications <on|off>|reset]"
allowed-tools: Read Bash
disable-model-invocation: true
---

## /achievements-settings — AGPA Settings

Configure AGPA achievement settings in chat. Uses `AskUserQuestion` for interactive mode, or direct arguments for quick changes.

### Step 1: Determine state directory

Same logic as /achievements:
Read `~/.agent-achievements/config.json`. If `active_profile` is set (not "default"), stateDir = `~/.agent-achievements/profiles/<active_profile>/`. Otherwise stateDir = `~/.agent-achievements/`. If `AGPA_PROFILE` env is set, use `~/.agent-achievements/profiles/<AGPA_PROFILE>/`.

Then read `{stateDir}/state.json`.

### Step 2: Handle $ARGUMENTS

#### If no arguments

Use AskUserQuestion to show settings menu:
- Question: "What would you like to configure?"
- Header: "Settings"
- Options:
  - Language → sub-question with choices: English, 中文
  - Notifications → sub-question: On / Off
  - Reset Progress → confirm first, then reset

#### Direct arguments

| Argument | Action |
|----------|--------|
| `language en` | Set language to English |
| `language zh` | Set language to 中文 |
| `notifications on` | Enable unlock notifications |
| `notifications off` | Disable unlock notifications |
| `reset` | Reset all achievement progress (requires confirmation) |

### Step 3: Apply changes

For language/notifications, use Bash to write to state.json:
```bash
tmp=$(mktemp) && jq '.settings.language = "en"' {stateDir}/state.json > "$tmp" && mv "$tmp" {stateDir}/state.json
```

For reset, first ask confirmation, then:
```bash
tmp=$(mktemp) && jq '.achievements = {} | .counters = {} | .session = {files_read_set: []}' {stateDir}/state.json > "$tmp" && mv "$tmp" {stateDir}/state.json
```

### Step 4: Confirm

✓ Language changed to English
✓ Notifications turned off
✓ Achievement progress reset — 160 achievements await!
