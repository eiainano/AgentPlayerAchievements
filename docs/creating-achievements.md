# Creating Community Achievement Packs

> Learn how to create, test, and share achievement packs for AGPA.

## What Are Achievement Packs?

A **community achievement pack** is a YAML file containing one or more achievements. Anyone can create a pack, drop it into `~/.agent-achievements/packs/`, and immediately see those achievements appear in the Dashboard alongside the core ones.

Achievement packs define **new achievements only** — they cannot define sets, questlines, or modify core behavior.

## Quick Start

```yaml
# ~/.agent-achievements/packs/my-first-pack.yaml
pack:
  id: my_first_pack
  name: My First Pack
  author: your_name
  version: 1.0.0
  description: A short description of what this pack adds

definitions:
  - id: my_first_achievement
    name: Achievement Name
    name_cn: 成就名称        # optional Chinese name
    description: What the user needs to do
    description_cn: 用户需要完成什么  # optional Chinese description
    icon: 🏆
    category: my_category
    rarity: common
    conditions:
      - type: counter
        event: task.complete
        operator: ">="
        value: 1
```

Drop this file in `~/.agent-achievements/packs/`, restart your dashboard or run `agpa pack list`, and the achievement will appear.

## Pack File Format

### `pack:` Metadata Block

| Field        | Required | Description                                               | Constraints                              |
|--------------|----------|-----------------------------------------------------------|------------------------------------------|
| `id`         | ✅       | Unique identifier for the pack                            | Lowercase alphanumeric, starts with letter. `[a-z][a-z0-9_-]*` |
| `name`       | ✅       | Human-readable pack name                                  | Any string                               |
| `author`     | ✅       | Creator's name or GitHub handle                           | Any string                               |
| `version`    | ❌       | Semantic version (defaults to `0.0.0`)                    | String like `1.0.0`, `0.3.2`             |
| `description`| ❌       | Brief summary of the pack's theme or content              | Any string                               |

### `definitions:` Array

Each definition in the array follows the same schema as core achievements. See the [Achievement Definition Fields](#achievement-definition-fields) section below.

### Constraints

- **No `sets:` or `questlines:`** — Packs may only define `definitions`. Including `sets:` or `questlines:` will cause the pack to be rejected with an error.
- **No ID collisions** — Pack achievement IDs must not conflict with core achievements or other installed packs. Conflicts cause the offending pack to be skipped with a warning.
- **Future achievements** — Use `future: true` if your achievement references a custom event that has no emitter yet. The achievement will be hidden from the system until it becomes reachable.

---

## Event Type Catalog

This is the complete list of event types your achievements can reference. Each event has one or more **emitter sources**:

| Source | Meaning |
|--------|---------|
| **hook_auto** | Automatically emitted by tool hooks — no action needed |
| **engine_auto** | Emitted by the AGPA engine itself |
| **dashboard** | Emitted when Dashboard is opened |
| **manual** | Requires the agent to call `achievement_track` (listed in CLAUDE.md instructions) |

### Session Lifecycle

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `session.start` | hook_auto | Agent session begins | `hour`, `day_of_week`, `on_battery`, `battery_pct` |
| `session.end` | hook_auto | Agent session ends | `elapsed_ms` |
| `user.message` | hook_auto | User sends a message | `char_count`, `word_count`, `has_code_block`, `has_question_mark`, `on_battery`, `battery_pct` |
| `user.message.batch` | engine_auto | Batched user messages | — |
| `user.prompt` | hook_auto + manual | User prompt submitted | `char_count`, `word_count`, `has_code_block`, `has_question_mark` |
| `token.consumed` | engine_auto | Token usage tracked | `amount`, `input_tokens`, `output_tokens` |

### Task Lifecycle

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `task.create` | hook_auto | Task created | — |
| `task.update` | hook_auto | Task updated | — |
| `task.complete` | hook_auto | Task completed | `elapsed_ms` |

### Tool Usage

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `tool.complete` | hook_auto | Tool call completed | `tool_name`, `duration_ms` |
| `tool.failure` | hook_auto + manual | Tool call failed | `tool_name`, `error` |
| `tool.requested` | hook_auto | Tool call requested (pre-approval) | `tool_name` |
| `tool.deny` | manual | User denied a tool call | `tool_name` |

### File Operations

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `file.read` | hook_auto | File read | `file_path`, `file_type`, `lines` |
| `file.create` | hook_auto | File created | `file_path`, `file_type` |
| `file.write` | hook_auto | File written | `file_path`, `file_type`, `lines` |
| `file.edit` | hook_auto | File edited | `file_path`, `file_type`, `edit_lines`, `total_file_lines` |
| `file.delete` | hook_auto | File deleted | `file_path` |
| `file.revert` | manual | File reverted | `file_path` |
| `file.language_used` | hook_auto | Specific language file created/edited | `language` |

### Git Operations

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `git.commit` | hook_auto | Git commit made | — |
| `git.add` | hook_auto | File staged | — |
| `git.push` | hook_auto | Push to remote | — |
| `git.pr_created` | hook_auto | Pull request opened | — |
| `git.bisect` | hook_auto | Git bisect started | — |
| `merge.conflict_resolved` | hook_auto | Merge conflict resolved | — |

### Agent Operations

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `agent.spawn` | hook_auto + manual | Sub-agent spawned | `agent_type` |
| `agent.end` | hook_auto | Sub-agent ended | — |
| `agent.self_fix` | manual | Agent fixed its own bug | `fix_description` |
| `agent.created` | manual | Custom agent created | `agent_type` |
| `agent.mode_activated` | manual | Switched from plan to agent mode | — |

### MCP Operations

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `mcp.connect` | manual | MCP server connected | `server_name` |
| `mcp.server_used` | manual | MCP server used | `server_name` |
| `mcp.tool_call` | hook_auto | MCP tool called | `server_name`, `tool_name` |

### Communication

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `conversation.message` | hook_auto | Agent message response | `content`, `role` |

### Error & Validation

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `error.occurred` | hook_auto + manual | Error encountered | `error`, `tool_name` |
| `validation.fail` | engine_auto | Validation failure | — |

### Configuration & Model

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `model.switch` | manual | Model switched | `from`, `to` |
| `config.file_edited` | manual | Config file edited | `file_path` |

### Plan Mode

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `plan.mode_entered` | manual | Plan mode entered | — |
| `plan.mode_exited` | manual | Plan mode exited | — |

### Automation

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `automode.start` | manual | Auto mode activated | — |
| `automode.end` | manual | Auto mode ended | — |

### Skills & Plugins

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `skill.invoke` | manual | Skill invoked | `skill_name` |
| `skill.created` | manual | Skill created | `skill_name` |
| `skill.published` | manual | Skill published | `skill_name` |
| `plugin.installed` | manual | Plugin installed | `plugin_name` |
| `hook.configured` | manual | Hook configured | `hook_count` |

### Commands

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `command.run` | hook_auto | Bash command run | `command` |
| `command.slash_used` | manual | Slash command used | `command` |
| `command.created` | manual | Slash command created | `command_name` |

### Review & Testing

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `code.review_requested` | manual | Code review requested | — |
| `code.review_completed` | manual | Code review completed | `issues_found` |
| `test.pass` | manual | Tests passed | `count` |
| `test.fail` | manual | Tests failed | `count` |

### Achievement System

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `achievement.unlocked` | engine_auto | Achievement unlocked | `achievement_id`, `rarity` |
| `dashboard.opened` | dashboard | Dashboard opened | — |

### Other

| Event | Emitter | Description | Payload Fields |
|-------|---------|-------------|----------------|
| `help.accessed` | manual | Help/documentation accessed | — |
| `context.compacted` | hook_auto + manual | Context window compacted | — |
| `state.reset` | engine_auto | Achievement data reset | — |
| `permission.mode_changed` | manual | Permission mode changed | `old_mode`, `new_mode` |
| `permission.dangerously_skipped` | manual | Dangerous permission skip | `tool_name` |
| `template.created` | manual | Template created | `template_name` |
| `worktree.created` | manual | Git worktree created | `path` |
| `function.edited` | manual | Function edited repeatedly | `function_name` |
| `output.edit` | manual | User edited agent output | `amount` |

### Auto-injected Payload Fields

These fields are automatically added to every event — you can use them in filter expressions without any special setup:

| Field | Type | Description |
|-------|------|-------------|
| `hour` | number | Hour of day (0-23) |
| `day_of_week` | number | Day of week (0=Sunday, 6=Saturday) |
| `tool_source` | string | Agent software (claude-code, kilocode, hermes, opencode, openclaw) |
| `on_battery` | boolean | Whether device is on battery (only for `user.message`) |
| `battery_pct` | number | Battery percentage (only for `user.message`) |

### DeepSeek-specific Events

These are automatically emitted when using DeepSeek models:

| Event | Emitter | Description |
|-------|---------|-------------|
| `deepseek.conversation` | engine_auto | First message in DeepSeek session |
| `deepseek.tool_use` | engine_auto | DeepSeek tool call tracked |
| `deepseek.session_start` | engine_auto | DeepSeek session started |

---

## Condition Types — Complete Reference

### 1. `counter` — Count Events

Counts the number of events matching a filter. When it reaches the target value, the condition is met.

```yaml
# Common: count tool calls
conditions:
  - type: counter
    event: tool.complete
    operator: ">="
    value: 50

# Filtered: count only Write tool calls
conditions:
  - type: counter
    event: tool.complete
    operator: ">="
    value: 10
    filter: "tool_name == 'Write'"

# With same_target: count events with the SAME field value
conditions:
  - type: counter
    event: task.complete
    operator: ">="
    value: 5
    same_target: true
    field: session_id

# Per-day limit: max 3 per day
conditions:
  - type: counter
    event: tool.complete
    operator: ">="
    value: 5
    max_per_day: 3
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `counter` |
| `event` | ❌ | Event type to count (defaults to `tool.complete`) |
| `operator` | ❌ | `>=`, `<=`, `==`, `>`, `<` (default `>=`) |
| `value` | ✅ | Target count |
| `filter` | ❌ | Filter expression to narrow events |
| `same_target` | ❌ | If true, all counted events must have the same value for `field` |
| `field` | ❌ | Field for `same_target` check |
| `window` | ❌ | Time window (default 24h) |
| `max_per_day` | ❌ | Maximum events per day |

---

### 2. `threshold` — Sum a Field

Sums a numeric field across matching events, or evaluates a metric expression.

```yaml
# Sum field values across events
conditions:
  - type: threshold
    event: file.edit
    field: edit_lines
    operator: ">="
    value: 100

# Check each event individually (not summed)
conditions:
  - type: threshold
    event: task.complete
    field: elapsed_ms
    operator: ">="
    value: 3600000   # 1 hour
    per_event: true  # check each event, don't sum across events

# Metric expression: ratio of two fields (num_lines / total_lines)
conditions:
  - type: threshold
    event: file.edit
    metric: edit_lines / total_file_lines
    operator: ">="
    value: 0.1   # 10%
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `threshold` |
| `event` | ❌ | Event type |
| `field` | ❌ | Numeric field to sum (omit to count events like counter) |
| `metric` | ❌ | Metric expression: `field_a / field_b` |
| `operator` | ❌ | `>=`, `<=`, `==`, `>`, `<` |
| `value` | ✅ | Target sum/value |
| `per_event` | ❌ | If true, check each event individually |
| `window` | ❌ | Time window |
| `filter` | ❌ | Filter expression |

---

### 3. `streak` — Consecutive Days or Events

Tracks consecutive days (default) or consecutive events of a certain type.

```yaml
# Streak of consecutive calendar days
conditions:
  - type: streak
    event: session.start
    operator: ">="
    value: 7

# Streak of consecutive events (not days)
conditions:
  - type: streak
    event: session.start
    operator: ">="
    value: 5
    event_level: true   # consecutive events, not days
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `streak` |
| `event` | ❌ | Event type (default `session.start`) |
| `value` | ✅ | Target streak length |
| `event_level` | ❌ | If true, streak = consecutive events; false = consecutive calendar days |

Streak achievements typically use `window: all` to accumulate across sessions:

```yaml
conditions:
  - type: streak
    event: session.start
    operator: ">="
    value: 7
    window: all    # ← critical for day-based streaks
```

---

### 4. `sequence` — Ordered Event Sequence

Requires events to appear in a specific order.

```yaml
# Standard ordered sequence
conditions:
  - type: sequence
    event: session.start
    sequence:
      - plan.mode_entered
      - plan.mode_exited
      - tool.complete

# Consecutive sequence with count
conditions:
  - type: sequence
    event: tool.complete
    consecutive: true       # must be CONSECUTIVE (no gaps)
    sequence: [tool.complete]
    count:
      operator: ">="
      value: 5              # 5 consecutive tool.complete events
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `sequence` |
| `event` | ❌ | Event type for consecutive counting |
| `sequence` | ❌ | Ordered list of event types to match |
| `consecutive` | ❌ | If true, events must be back-to-back |
| `count` | ❌ | `{ operator, value }` — target for consecutive count |

---

### 5. `distinct_count` — Unique Field Values

Counts how many distinct values of a field have been observed.

```yaml
# Distinct tool names used
conditions:
  - type: distinct_count
    event: tool.complete
    field: tool_name
    operator: ">="
    value: 10

# With whitelist of valid values
conditions:
  - type: distinct_count
    event: skill.invoke
    field: skill_name
    operator: ">="
    value: 5
    values: [review, debug, test]
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `distinct_count` |
| `event` | ❌ | Event type |
| `field` | ✅ | Field to count distinct values of |
| `values` | ❌ | Whitelist — only count values in this list |
| `window` | ❌ | Time window |

---

### 6. `event` — Single Event Occurrence

Requires a single event of a given type to occur.

```yaml
# Simple event occurrence
conditions:
  - type: event
    event: mcp.connect

# With filter
conditions:
  - type: event
    event: tool.complete
    filter: "tool_name == 'WebFetch'"
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `event` |
| `event` | ❌ | Event type to detect |
| `filter` | ❌ | Filter expression |

---

### 7. `set_completion` — Complete Achievement Subsets

Requires completing a set of other achievements. This is the only condition where the `value` field is derived from other definitions.

```yaml
# Complete all achievements in the same category
conditions:
  - type: set_completion
    all: true               # all achievements in this achievement's category

# Complete all non-hidden achievements
conditions:
  - type: set_completion
    exclude_hidden: true

# Complete all achievements of a specific rarity or above
conditions:
  - type: set_completion
    rarity: epic
    include_above: true     # epic + legendary + mythic

# Complete all achievements of exactly this rarity
conditions:
  - type: set_completion
    rarity: rare
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `set_completion` |
| `rarity` | ❌ | Target rarity level |
| `include_above` | ❌ | Include rarities above `rarity` |
| `all` | ❌ | Include all achievements in the same category |
| `exclude_hidden` | ❌ | Exclude hidden achievements from the count |

---

### 8. `ratio` — Ratio of Two Fields

Evaluates a ratio expressed as two field values within the same event.

```yaml
# Self-edits ratio: edit_lines / total_file_lines
conditions:
  - type: ratio
    event: file.edit
    numerator: edit_lines
    denominator: total_file_lines
    operator: ">="
    value: 0.5     # 50%

# With group_by: deduplicate events by file before computing ratio
conditions:
  - type: ratio
    event: file.edit
    numerator: edit_lines
    denominator: total_file_lines
    operator: ">="
    value: 0.8
    group_by: file_path
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `ratio` |
| `event` | ❌ | Event type |
| `numerator` | ✅ | Field name for numerator |
| `denominator` | ✅ | Field name for denominator |
| `group_by` | ❌ | Deduplicate events by this field before computing ratio |

---

### 9. `pattern_match` — Regex Match on Content

Tests whether an event's payload matches a regex pattern.

```yaml
# Match a pattern in conversation content
conditions:
  - type: pattern_match
    event: conversation.message
    pattern: "I'm sorry|I can't do that"
    role: assistant

# Match specific phrase — first occurrence in session
conditions:
  - type: pattern_match
    event: conversation.message
    pattern: "interesting approach"
    first_in_session: true

# Match against the conversation message content field
conditions:
  - type: pattern_match
    event: conversation.message
    pattern: humor
    role: assistant
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `pattern_match` |
| `event` | ❌ | Event type (typically `conversation.message`) |
| `pattern` | ✅ | Regex pattern to match (string or string array) |
| `role` | ❌ | Filter by message role (`assistant`, `user`) |
| `first_in_session` | ❌ | Only match the first occurrence in a session |

---

### 10. `mode` — Most Common Field Value

Finds the most common value of a field within a time window.

```yaml
# Most common hour of activity
conditions:
  - type: mode
    event: session.start
    field: hour
    operator: ">="
    value: 5               # at least 5 events in the most common hour
    in_range: [9, 17]      # only consider hours between 9 and 17

# Most common day of week
conditions:
  - type: mode
    event: session.start
    field: day_of_week
    operator: ">="
    value: 3
    in_range: [0, 6]
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `mode` |
| `event` | ❌ | Event type |
| `field` | ❌ | Field to analyze |
| `in_range` | ❌ | Range of values to consider `[min, max]` |
| `operator` | ❌ | Comparison operator for the count |
| `value` | ✅ | Minimum count in the most common bucket |

---

### 11. `sequence_count` — Repeated Pattern Count

Counts how many times a pattern of events repeats.

```yaml
# Repeated pattern: plan.enter → plan.exit → tool.complete, 5 times
conditions:
  - type: sequence_count
    event: session.start
    value: 5
    pattern:
      - plan.mode_entered
      - plan.mode_exited
      - tool.complete
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `sequence_count` |
| `event` | ❌ | Event type |
| `value` | ✅ | Number of pattern repetitions |
| `pattern` | ✅ | Array of event types forming the pattern |

---

### 12. `time_gap` — Time Between Events

Measures the time elapsed between two events.

```yaml
# Time between user messages (e.g. thinking time)
conditions:
  - type: time_gap
    event: user.message
    operator: ">="
    value: 1        # 1 hour gap
    unit: h         # hours (default)

# Cross-day gap: messages on different calendar days
conditions:
  - type: time_gap
    event: user.message
    operator: ">="
    value: 1
    cross_day: true    # must span different days
    from_filter: "hour >= 21"   # first message after 9pm
    to_filter: "hour >= 7"      # second message after 7am
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | ✅ | `time_gap` |
| `event` | ❌ | Event type |
| `value` | ✅ | Gap length |
| `unit` | ❌ | `h` for hours, `m` for minutes, `s` for seconds (default `h`) |
| `operator` | ❌ | Compare operator (`>=`, `<=`, `>`, `<`) |
| `cross_day` | ❌ | Events must be on different calendar days |
| `from_filter` | ❌ | Filter for the *first* event in the pair |
| `to_filter` | ❌ | Filter for the *second* event in the pair |

---

## Filter Expression Syntax

Filters narrow down which events count toward a condition. They are expressed as boolean expressions on event payload fields.

### Available Context Fields

These fields are available in filter expressions:

| Field | Type | Source |
|-------|------|--------|
| `tool_name` | string | Payload |
| `file_path` | string | Payload |
| `file_type` | string | Payload |
| `command` | string | Payload |
| `language` | string | Payload |
| `agent_type` | string | Payload |
| `skill_name` | string | Payload |
| `server_name` | string | Payload |
| `model` | string | Context metadata |
| `role` | string | Payload (`assistant`, `user`) |
| `hour` | number | Auto-injected |
| `day_of_week` | number | Auto-injected |
| `month` | number | Derived from timestamp (1-12) |
| `day` | number | Derived from timestamp (1-31) |
| `date_str` | string | Date in `MM-DD` format |
| `on_battery` | boolean | Auto-injected (user.message only) |
| `char_count` | number | Payload (user.prompt only) |
| `word_count` | number | Payload (user.prompt only) |
| `has_code_block` | boolean | Payload (user.prompt only) |
| `has_question_mark` | boolean | Payload (user.prompt only) |

### Operators

| Syntax | Operator | Example |
|--------|----------|---------|
| `field == 'value'` | String equality | `tool_name == 'Write'` |
| `field != 'value'` | String inequality | `tool_name != 'Bash'` |
| `field == number` | Numeric equality | `day_of_week == 0` |
| `field > value` | Greater than | `hour > 17` |
| `field >= value` | Greater or equal | `char_count >= 100` |
| `field < value` | Less than | `hour < 9` |
| `field <= value` | Less or equal | `word_count <= 10` |
| `field == true/false` | Boolean equality | `on_battery == true` |
| `field in [a, b]` | One of | `month in [12, 1, 2]` |
| `field matches 'glob'` | Glob pattern | `file_path matches '**.ts'` |
| `field contains 'text'` | Substring | `command contains 'git'` |
| `model contains 'text'` | Model substring | `model contains 'deepseek'` |
| Contains bare text | Payload event_type | `contains 'achievement'` |

### Composition

Use `&&` for AND, `||` for OR:

```yaml
# Tool completed AND hour is nighttime
filter: "tool_name == 'Read' && hour >= 21"

# Multiple conditions: nighttime OR weekend
filter: "hour >= 21 || day_of_week == 0"

# Complex: matching files AND not a specific tool
filter: "file_path matches '**.ts' && tool_name != 'Edit'"
```

---

## Window Types

Windows control the time range over which events are counted.

| Window | Description |
|--------|-------------|
| *(none)* | Default 24-hour window |
| `all` or `lifetime` | No window — count across all time |
| `single_session` | Only events within a single session |
| `same_session` | Same as single_session (alias) |
| `single_task` | Only events within a single task |
| `same_task` | Same as single_task (alias) |
| `24h` | Last 24 hours |
| `Nh` | Last N hours (e.g. `1h`, `12h`) |
| `Nd` | Last N days (e.g. `7d`, `30d`) |

**Important:** Many achievements that track cumulative progress (streaks, lifetime counts) should use `window: all`. Without it, the default 24-hour window resets daily.

```yaml
conditions:
  - type: counter
    event: session.start
    operator: ">="
    value: 100
    window: all    # ← cumulative, not daily
```

---

## Achievement Definition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Unique identifier (lowercase, no spaces) |
| `name` | ✅ | Display name (English) |
| `name_cn` | ❌ | Display name (Chinese) |
| `description` | ✅ | What the user needs to do (English) |
| `description_cn` | ❌ | Description in Chinese |
| `icon` | ✅ | Emoji icon |
| `category` | ✅ | Category grouping (can be anything for pack achievements) |
| `rarity` | ✅ | One of: `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic` |
| `hidden` | ❌ | If true, achievement is hidden until unlocked |
| `future` | ❌ | If true, achievement is disabled until event support is added |
| `progress_trackable` | ❌ | Show progress bar in Dashboard |
| `tip` | ❌ | Educational tip shown after unlock (English) |
| `tip_cn` | ❌ | Educational tip (Chinese) |
| `hint` | ❌ | Locked clue shown to users before unlock (English) |
| `hint_cn` | ❌ | Locked clue (Chinese) |
| `challenge` | ❌ | Opt-in challenge — requires explicit user effort |
| `conditions` | ✅ | Array of condition objects (see above) |

### Complete Example

```yaml
- id: night_reader
  name: Night Reader
  name_cn: 夜读人
  description: Read 50 files after midnight
  description_cn: 在午夜后阅读 50 个文件
  icon: 🌙
  category: productivity
  rarity: uncommon
  hidden: false
  progress_trackable: true
  tip: Late-night coding sessions are surprisingly productive for reading code you wrote earlier.
  tip_cn: 深夜写代码其实很适合复盘白天写的逻辑。
  hint: Wait until midnight and start reading
  hint_cn: 等午夜过后开始读文件
  conditions:
    - type: counter
      event: file.read
      operator: ">="
      value: 50
      filter: "hour >= 0 && hour < 6"
```

---

## Rarity Guidelines

Choosing the right rarity is important for pack quality and user satisfaction:

| Rarity | XP | When to Use |
|--------|----|-------------|
| `common` | 50 | Basic usage patterns (3-10 events, single actions) |
| `uncommon` | 100 | Moderate effort (10-50 events, some dedication) |
| `rare` | 200 | Significant achievement (50-200 events, multi-session) |
| `epic` | 300 | Impressive milestone (200-500 events, long-term) |
| `legendary` | 500 | Extraordinary achievement (500-1000+ events) |
| `mythic` | 1000 | Once-in-a-lifetime (1000+ events, extreme dedication) |

---

## Best Practices

### Naming Conventions

- **Achievement IDs**: lowercase with underscores. Prefix with your pack's initials to avoid collisions: `ba_git_lover`, `mt_magic_find`.
- **Pack IDs**: lowercase, start with a letter, use underscores or hyphens: `battleaxe`, `my-awesome-pack`.
- **Achievement names**: Short, punchy, evocative. Steam-style names work best: "Like a Bat Out of Hell", "The Thinker", "Full Spectrum".
- **Categories**: Use existing categories (onboarding, exploration, coding, git, mcp, file, etc.) or create your own.

### Writing Good Hints

Hints are shown to users before they unlock an achievement. They should be **suggestive but not explicit**:

```yaml
# Good hint — gives direction without revealing the exact condition
hint: Try working late at night when the code speaks to you
hint_cn: 试试深夜编码，代码会跟你说话

# Bad hint — reveals the exact condition
hint: Read 50 files between midnight and 6am
```

### Writing Good Tips

Tips are shown after unlock and should be **educational**:

```yaml
tip: The `Read` tool is cheaper than calling an API. Use it to review your own previous work — Claude remembers context better than you think.
tip_cn: Read 工具比调 API 便宜。用它回顾自己之前写的代码——Claude 的上下文比你想象的更全。
```

### Category Names

You can use any category name for your pack achievements. If they overlap with core achievement categories, they will be grouped together in the Dashboard filter. Common categories include:

```
onboarding, exploration, coding, git, mcp, file, skill, agent,
automation, security, collaboration, productivity, language, learning,
hidden, seasonal, challenge, humor
```

### Multiple Conditions

Achievements can have multiple conditions — all must be met for the achievement to unlock:

```yaml
conditions:
  - type: counter
    event: tool.complete
    operator: ">="
    value: 100
  - type: counter
    event: task.complete
    operator: ">="
    value: 5
    window: single_session
```

### Hidden Achievements

Use `hidden: true` for achievements that should be a surprise. Hidden achievements show as `🔒 ???` in the Dashboard. Their hints are shown in the suggest/recommendation system, but descriptions and condition details are hidden until unlocked.

```yaml
- id: easter_egg
  name: 🥚 Found It!
  description: Discover the secret achievement
  icon: 🐰
  category: hidden
  rarity: mythic
  hidden: true
  conditions:
    - type: pattern_match
      event: conversation.message
      pattern: "the answer is 42"
```

### Progress Trackable

Use `progress_trackable: true` for achievements where showing partial progress is motivating:

```yaml
- id: bookworm
  name: Bookworm
  description: Read 1000 files
  icon: 📚
  category: file
  rarity: epic
  progress_trackable: true    # ← users see "342/1000"
  conditions:
    - type: counter
      event: file.read
      operator: ">="
      value: 1000
      window: all
```

---

## Testing Your Pack

### 1. Syntax Check

Drop your pack file into `~/.agent-achievements/packs/` and run:

```bash
agpa pack list
```

If your pack has YAML errors or missing fields, the engine will print a warning and skip it.

### 2. View Pack Details

```bash
agpa pack info my_pack_id
```

This shows all achievements in the pack, their status (locked/unlocked), and basic statistics.

### 3. Quality Check

Run the auditor to check for description-condition consistency:

```bash
agpa doctor
```

The doctor runs the 3-layer auditor (numeric, semantic, event reachability) on all loaded achievements, including your pack.

### 4. Trigger Simulation

Create a minimal test environment:

1. Create a new profile: `agpa profile create test`
2. Copy your pack to `~/.agent-achievements/packs/`
3. Switch to the test profile: `agpa profile switch test`
4. Reset: `agpa reset` (only affects the test profile)
5. Open dashboard: `agpa dashboard --profile test`

Then manually trigger the events your achievement needs to verify it unlocks correctly.

---

## Submitting Your Pack to the Community

To share your pack with the AGPA community:

1. **Create a GitHub Gist** or **add to your AGPA fork** under a new directory
2. Open an **Issue** with the "pack submission" template:
   - Pack ID, name, description
   - Number of achievements
   - Which events/conditions are used
   - Screenshots from Dashboard (optional)

The community reserves the right to reject packs that:
- Contain offensive content
- Duplicate existing core achievements in gameplay
- Reference nonexistent event types
- Are unreachable (no emitter for any condition)

---

## Troubleshooting

| Problem | Likely Cause |
|---------|--------------|
| `agpa pack list` shows nothing | Pack file has YAML syntax errors. Check spacing. |
| "ID conflict" warning | Your achievement `id` matches a core achievement or another pack. Rename it. |
| "unknown event type" warning | Your achievement uses an event that doesn't exist. Check the [Event Catalog](#event-type-catalog). |
| "may not define sets" error | Your pack includes `sets:` or `questlines:`. Remove them. |
| Achievement never unlocks | The event type or filter is too specific. Test with a simpler condition first. |
| Progress bar stuck at 0 | `progress_trackable: true` is set but the condition field doesn't match. |
| Icon shows as 🏆 | Invalid icon format. Use a single emoji character. |
