<!-- AGPA ACHIEVEMENT TRACKING -->
# AGPA Achievement Tracking

This project uses AGPA (Agent Player Achievements) to gamify AI coding.

## Auto-tracked events (via CC hooks — no action needed)

All tool calls, file operations, git commits/PRs, subagents, sessions, task completion, and context compaction are tracked automatically through 9 CC hooks. You don't need to manually call `achievement_track` for these.

## Manual tracking — call `achievement_track` when you observe these

### Behavior events (when YOU do something)

| Trigger | Event to track | Payload |
|---------|---------------|---------|
| Read an image file (png/jpg/gif/svg) | `image.read` | (auto — hook detects file type) |
| Upload an image for Claude to read | `image.upload` | `{}` (auto — hook detects image read via file extension) |
| **Each time the user sends you a message** | `user.message` | (auto — hook emits via UserPromptSubmit) |
| Send a prompt/message (track length for brevity) | `conversation.message` | `{ length }` (auto — hook emits with role) |
| Create a file in a specific language | `file.language_used` | `{ language }` e.g. "typescript" |
| Edit the same function repeatedly | `function.edited` | `{ function_name }` |
| After any slash command runs | `command.slash_used` | `{ command }` |
| Entering plan mode | `plan.mode_entered` | `{}` |
| Reading help/docs | `help.accessed` | `{}` |
| Connecting to an MCP server | `mcp.server_used` | `{ server_name }` |
| MCP connection first established | `mcp.connect` | `{}` |
| Activating Auto Mode | `automode.start` | `{}` |
| Installing a plugin | `plugin.installed` | `{ plugin_name }` |
| Configuring hooks | `hook.configured` | `{ hook_count }` |
| Creating an Agent/subagent | `agent.created` | `{ agent_type }` |
| Creating a skill | `skill.created` | `{ skill_name }` |
| Publishing a skill | `skill.published` | `{ skill_name }` |
| Creating a slash command | `command.created` | `{ command_name }` |
| Creating a template | `template.created` | `{ template_name }` |
| Editing config/settings files | `config.file_edited` | `{ file_path }` |
| Creating a worktree | `worktree.created` | `{ path }` |
| Requesting code review | `code.review_requested` | `{}` |
| Reviewing code (done) | `code.review_completed` | `{ issues_found }` |
| Generating significant tokens (~10k+) | `token.consumed` | (auto — hook parses JSONL transcript) |
| Reverting a file to previous version | `file.revert` | `{ file_path }` |
| Switching from plan mode to agent mode | `agent.mode_activated` | `{}` |
| Fixing your own bug successfully | `agent.self_fix` | `{ fix_description }` |
| An error occurs during execution | `error.occurred` | (auto — hook emits on PostToolUseFailure) |
| A file is deleted (rm / unlink) | `file.delete` | (auto — hook detects rm in Bash commands) |
| Creating a new task (e.g. via TaskCreate) | `task.create` | `{}` (auto — hook detects TaskCreate tool calls) |
| Updating task status | `task.update` | `{ new_status }` (auto — hook detects TaskUpdate tool calls) |
| Opening the AGPA Dashboard | `dashboard.opened` | `{}` (auto — dashboard server tracks on page load) |
| Using a DeepSeek model | `deepseek.conversation` | `{}` (auto — engine detects when currentModel contains "deepseek") |

### User-action events (when the USER does something you can see)

| Trigger | Event to track | Payload |
|---------|---------------|---------|
| User switches model (`/model` or equivalent) | `model.switch` | `{ from, to }` |
| User changes permission mode | `permission.mode_changed` | `{ old_mode, new_mode }` |
| User skips a dangerous tool (approve-skip) | `permission.dangerously_skipped` | `{ tool_name }` |
| User denies a tool call | `tool.deny` | `{ tool_name }` |
| User edits your output | `output.edit` | `{ amount }` |
| Tests pass during your execution | `test.pass` | `{ count }` |
| Tests fail during your execution | `test.fail` | `{ count }` |

## Session end checklist

At the end of every session:

1. Call `achievement_track` with `"session.end"` (hook may also do this)
2. Call `achievement_poll` to check for newly unlocked achievements
3. **If poll returns achievements**, display them proudly with icon + name + description
4. Consider calling `achievement_stats` if the user seems interested in progress
