<!-- AGPA ACHIEVEMENT TRACKING v2 -->
## 🏆 Achievement Tracking (AGPA)

This project uses AGPA (Agent Player Achievements). Most tool/file/session events are auto-tracked via CC hooks.

### Events to track manually

Call `achievement_track` when you observe these:

**Each user turn (before processing):**
- Each time the user sends you a message → `user.message`
- For non-CC tools, after receiving user's message → `user.prompt` with `{ char_count, word_count, has_code_block, has_question_mark }` (compute from the user's message text)

**When you do something:**
- Read an image file → `image.read` (auto: any Read of png/jpg/gif/svg counts)
- Create a file in a specific language → `file.language_used` with `{ language }` (e.g. "typescript", "python")
- Edit the same function repeatedly → `function.edited` with `{ function_name }`
- Slash command runs → `command.slash_used` with `{ command }`
- Enter plan mode → `plan.mode_entered`
- Read help/docs → `help.accessed`
- Connect MCP server → `mcp.server_used` with `{ server_name }`
- MCP connection first established → `mcp.connect`
- Activate Auto Mode → `automode.start`
- Install plugin → `plugin.installed` with `{ plugin_name }`
- Configure hooks → `hook.configured` with `{ hook_count }`
- Create agent/subagent → `agent.created` with `{ agent_type }`
- Create skill → `skill.created` with `{ skill_name }`
- Publish skill → `skill.published` with `{ skill_name }`
- Invoke a skill → `skill.invoke` with `{ skill_name }`
- Create slash command → `command.created` with `{ command_name }`
- Create template → `template.created` with `{ template_name }`
- Edit config/settings → `config.file_edited` with `{ file_path }`
- Create worktree → `worktree.created` with `{ path }`
- Request code review → `code.review_requested`
- Complete code review → `code.review_completed` with `{ issues_found }`
- Generate 10k+ tokens → `token.consumed` with `{ amount }`
- Revert a file → `file.revert` with `{ file_path }`
- Switch from plan mode to agent mode → `agent.mode_activated`
- Fix your own bug successfully → `agent.self_fix` with `{ fix_description }`
- Tool call fails → `tool.failure` with `{ tool_name, error }` (auto on CC/OpenClaw/KiloCode; manual fallback for Hermes)
- Agent encounters an error → `error.occurred` with `{ error }` (manual fallback)
- Context window compacted → `context.compacted` (manual for non-CC tools)
- Sub-agent spawned → `agent.spawn` with `{ agent_type }` (manual for non-CC tools)

**When user does something you can see:**
- User switches model → `model.switch` with `{ from, to }`
- User changes permission mode → `permission.mode_changed` with `{ old_mode, new_mode }`
- User skip-approves dangerous tool → `permission.dangerously_skipped` with `{ tool_name }`
- User denies a tool call → `tool.deny` with `{ tool_name }`
- User edits your output → `output.edit` with `{ amount }`
- Tests pass during execution → `test.pass` with `{ count }`
- Tests fail during execution → `test.fail` with `{ count }`

### Session end
1. `achievement_poll` — check for newly unlocked achievements
2. **If poll returns achievements**, display them proudly with icon + name + description
3. `achievement_stats` — optional, if user asks about progress
<!-- /AGPA ACHIEVEMENT TRACKING -->
