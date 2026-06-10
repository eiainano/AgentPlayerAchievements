/**
 * Generate tip/hint content for achievements missing them.
 *
 * Rules:
 * - tip: only for Common + Uncommon non-hidden (educational, actionable)
 * - hint: all non-hidden (directional, no exact values)
 * - Hidden achievements: no tip, no hint
 *
 * Run: npx tsx scripts/generate-tip-hint-content.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';

const YAML_PATH = path.resolve(import.meta.dirname, '../achievement-definitions.yaml');

// ── Condition/Event → Hint template mapping ────────────────────────────

interface ConditionSummary {
  type: string;
  event?: string;
  field?: string;
  metric?: string;
}

function summarizeConditions(raw: unknown): ConditionSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c: Record<string, unknown>) => ({
    type: String(c.type || ''),
    event: c.event ? String(c.event) : undefined,
    field: c.field ? String(c.field) : undefined,
    metric: c.metric ? String(c.metric) : undefined,
  }));
}

/** Generate a directional hint from achievement metadata. No exact values, no condition internals. */
function genHint(id: string, entry: Record<string, unknown>, conditions: ConditionSummary[]): string | null {
  if (entry.hidden === true) return null;
  if (entry.tip && entry.hint && (entry.hint.length > 10)) return null; // already has meaningful content

  const name = String(entry.name || '');
  const cat = String(entry.category || '');

  // Special case: challenge achievements get hint from description
  if (entry.challenge === true) return null; // challenges intentionally abstract

  const cond = conditions[0];
  if (!cond) return 'Keep exploring to discover what this achievement requires.';

  // ── By condition type + event ──
  switch (cond.type) {
    case 'counter': {
      switch (cond.event) {
        case 'task.complete':     return 'Complete tasks to make progress on your project.';
        case 'task.create':       return 'Create tasks to organize your work into manageable pieces.';
        case 'task.update':       return 'Keep your task statuses up to date as you make progress.';
        case 'file.create':       return 'Let Claude create new files for your project.';
        case 'file.edit':         return 'Editing files is how projects take shape — keep at it.';
        case 'file.read':         return 'Read code to understand it — Claude can help analyze.';
        case 'file.delete':       return 'Clean up unused files — sometimes less is more.';
        case 'file.write':        return 'Write files from scratch — every masterpiece starts with a blank page.';
        case 'tool.complete':     return 'Let your agent use various tools to get work done.';
        case 'session.start':     return 'Start sessions regularly to build momentum.';
        case 'git.commit':        return 'Version control your work with git commits.';
        case 'git.push':          return 'Push your code — code not shipped is just a dream.';
        case 'git.pr_created':    return 'Create pull requests to share your work.';
        case 'conversation.message': return 'Keep the conversation going with your agent.';
        case 'command.run':       return 'Use the terminal — run commands through your agent.';
        case 'error.occurred':    return 'Errors happen — what matters is how you recover.';
        case 'tool.failure':      return 'When things fail, try a different approach.';
        case 'tool.deny':         return 'You\'re in control — approve or deny tool calls as you see fit.';
        case 'agent.spawn':       return 'Spawn sub-agents to parallelize your work.';
        case 'achievement.unlocked': return 'Keep unlocking achievements — there\'s always more to discover.';
        case 'plan.enter':        return 'Plan mode helps you think before you code.';
        case 'plan.exit':         return 'Time to execute — exit plan mode and start building.';
        case 'automode.start':    return 'Let your agent work autonomously on multi-step tasks.';
        case 'model.switch':      return 'Different models have different strengths — switch to match the task.';
        case 'user.prompt':       return 'The quality of your prompts shapes the quality of output.';
        case 'mcp.tool_call':     return 'Explore MCP tools to extend your agent\'s capabilities.';
        case 'skill.invoke':      return 'Skills are your agent\'s superpowers — try different ones.';
        default:                  return `Keep using ${cond.event || 'this feature'} to progress.`;
      }
    }
    case 'threshold': {
      if (cond.metric === 'duration') return 'Try a longer, focused session — great work takes time.';
      if (cond.metric === 'length')  return 'Vary your message length — both concise and detailed have their place.';
      return 'Push your limits — the achievement tracks how far you go.';
    }
    case 'streak': {
      return 'Show up consistently — habits are built one day at a time.';
    }
    case 'distinct_count': {
      if (cond.field === 'tool_name')   return 'Try as many different tools as you can — variety builds mastery.';
      if (cond.field === 'agent_type')  return 'Try different agent types — each has unique strengths.';
      if (cond.field === 'skill_name')  return 'Skills are your agent\'s extensions — discover them all.';
      if (cond.field === 'server_name') return 'Connect to different MCP servers to expand your toolchain.';
      if (cond.field === 'language')    return 'Work in different programming languages to broaden your horizons.';
      return 'Try different varieties of this to unlock progress.';
    }
    case 'sequence': {
      return 'Chain multiple actions together in the right order.';
    }
    case 'event': {
      return 'Wait for the right moment — this unlocks when conditions align.';
    }
    case 'sequence_count': {
      return 'Chain actions together repeatedly to master this pattern.';
    }
    case 'mode': {
      return 'Time matters — try working at different times or in different modes.';
    }
    case 'ratio': {
      return 'Find the right balance between two approaches.';
    }
    case 'pattern_match': {
      return 'Keep trying — this unlocks through natural interaction patterns.';
    }
    case 'set_completion': {
      return 'Complete all achievements in the related set.';
    }
    default:
      return null;
  }
}

/** Generate a Chinese hint translation. Mirrors genHint logic. */
function genHintCn(id: string, entry: Record<string, unknown>, conditions: ConditionSummary[]): string | null {
  if (entry.hidden === true) return null;

  const cond = conditions[0];
  if (!cond) return '继续探索，看看会解锁什么。';

  switch (cond.type) {
    case 'counter': {
      switch (cond.event) {
        case 'task.complete':     return '完成任务来推进你的项目。';
        case 'file.create':       return '让 Claude 为你创建新文件。';
        case 'file.edit':         return '编辑文件是项目成型的过程——持续下去。';
        case 'file.read':         return '读代码是理解代码的第一步——让 Claude 帮你分析。';
        case 'file.delete':       return '清理不需要的文件——少即是多。';
        case 'file.write':        return '从零开始写文件——每部杰作都始于一张白纸。';
        case 'tool.complete':     return '让 agent 使用各种工具来完成任务。';
        case 'session.start':     return '经常开启新的 session，保持势头。';
        case 'git.commit':        return '用 git 提交来管理你的版本历史。';
        case 'git.push':          return '推送你的代码——不推上去的代码只是白日梦。';
        case 'git.pr_created':    return '发起 Pull Request 来分享你的工作。';
        case 'conversation.message': return '继续和 agent 对话。';
        case 'command.run':       return '使用终端——通过 agent 来运行命令。';
        case 'error.occurred':    return '错误总是会发生的——重要的是如何恢复。';
        case 'tool.failure':      return '事情失败时，换个方法试试。';
        case 'tool.deny':         return '你说了算——根据情况批准或拒绝工具调用。';
        case 'agent.spawn':       return '派出子 agent 来并行处理任务。';
        case 'achievement.unlocked': return '继续解锁成就——总有新的等着你。';
        case 'plan.enter':        return 'Plan mode 帮你先想清楚再写代码。';
        case 'plan.exit':         return '退出 Plan mode——开始执行计划。';
        case 'automode.start':    return '让 agent 自主执行多步骤任务。';
        case 'model.switch':      return '不同模型各有所长——根据任务切换。';
        case 'user.prompt':       return '你的 prompt 质量直接影响输出质量。';
        case 'mcp.tool_call':     return '探索不同 MCP 工具来扩展 agent 的能力。';
        case 'skill.invoke':      return 'Skill 是 agent 的超能力——试试不同的技能。';
        default:                  return `继续使用 ${cond.event || '此功能'} 来推进进度。`;
      }
    }
    case 'threshold': {
      if (cond.metric === 'duration') return '试试更长、更专注的 session——好工作需要时间。';
      if (cond.metric === 'length')  return '长短结合，粗精搭配——不同长度的消息各有用途。';
      return '挑战自己的极限——成就在你走多远。';
    }
    case 'streak': {
      return '每天坚持来——习惯是靠一天天积累的。';
    }
    case 'distinct_count': {
      if (cond.field === 'tool_name')   return '试试尽可能多的不同工具——多样性带来精通。';
      if (cond.field === 'agent_type')  return '试试不同类型的 agent——各有专长。';
      if (cond.field === 'skill_name')  return 'Skill 是 agent 功能的延伸——全都发现一遍。';
      if (cond.field === 'server_name') return '连接不同的 MCP 服务器，扩展你的工具链。';
      if (cond.field === 'language')    return '尝试不同的编程语言，拓宽你的视野。';
      return '试试不同的类别来积累进度。';
    }
    case 'sequence': {
      return '按正确的顺序串联多个操作。';
    }
    case 'event': {
      return '等待合适的时机——条件具备时自然解锁。';
    }
    case 'sequence_count': {
      return '反复串联特定操作来熟练掌握。';
    }
    case 'mode': {
      return '时间很重要——试试在不同的时间或模式下工作。';
    }
    case 'ratio': {
      return '在两种方法之间找到最佳平衡。';
    }
    case 'pattern_match': {
      return '继续尝试——在日常交互中自然解锁。';
    }
    case 'set_completion': {
      return '完成所属套装的全部成就。';
    }
    default:
      return null;
  }
}

/** Generate an educational tip for Common/Uncommon non-hidden achievements. */
function genTip(id: string, entry: Record<string, unknown>, conditions: ConditionSummary[]): string | null {
  const rarity = String(entry.rarity || '');
  const hidden = entry.hidden === true;
  if (hidden || (rarity !== 'common' && rarity !== 'uncommon')) return null;

  const cond = conditions[0];
  if (!cond) return null;

  switch (cond.type) {
    case 'counter': {
      switch (cond.event) {
        case 'task.complete':
          return 'Tasks are the atomic unit of work in Claude Code. Break each feature into small, focused tasks (one file change, one test, one commit). Claude tracks progress and reports completion — use this to structure your workflow.';
        case 'file.create':
          return 'Starting from scratch is often the cleanest approach. When you need a new module, component, or config file, just describe what you need — Claude handles boilerplate, imports, and structure so you can focus on the logic.';
        case 'file.edit':
          return 'Editing is where the real work happens. The most effective workflow is: read the current code, plan the change, then edit precisely. Use /compact to manage context when editing multiple files.';
        case 'file.read':
          return 'Reading code is the fastest way to understand a codebase. Claude can summarize entire files, trace data flow, and identify patterns. Pro tip: use Read on unfamiliar files before asking Claude to edit them.';
        case 'file.delete':
          return 'Dead code is technical debt. Periodically clean up unused files — it reduces cognitive load and makes the codebase more maintainable. Claude can help identify files that are no longer referenced.';
        case 'file.write':
          return 'Creating files from scratch gives you full control over the structure. Describe the purpose, not just the content — Claude will scaffold imports, types, and exports that integrate with your existing patterns.';
        case 'tool.complete':
          return 'Chaining tools is the key to productivity. A typical flow: Read (understand) → Plan (think) → Edit (change) → Bash (test). The fewer turns per task, the faster you ship.';
        case 'session.start':
          return 'Claude Code retains context between sessions — pick up where you left off. Each session starts with the full file tree and recent history. Use descriptive first messages to re-establish context quickly.';
        case 'git.commit':
          return 'Commit early, commit often. Each commit is a checkpoint you can return to. Claude follows conventional commit format — descriptive messages that explain WHY, not just WHAT changed.';
        case 'git.push':
          return 'Code that isn\'t pushed might as well not exist. Regular pushes enable CI/CD, collaboration, and backups. Claude can push for you — but always review before pushing to shared branches.';
        case 'git.pr_created':
          return 'Pull Requests are the gateway to collaboration. A good PR description should explain the problem, the approach, and any trade-offs. Claude can draft descriptions based on the commit history.';
        case 'conversation.message':
          return 'Conversation is bidirectional. The more specific your requests, the better Claude\'s output. Include error messages, expected behavior, and constraints — it saves rounds of clarification.';
        case 'command.run':
          return 'The terminal is your agent\'s superpower. Claude can run tests, install packages, lint code, and deploy. Pro tip: for complex commands, ask Claude to build the command step by step — it\'s safer and more educational.';
        case 'error.occurred':
          return 'Errors are learning opportunities. When a tool fails, Claude sees the error message and can self-correct. The best developers read error messages carefully — Claude can explain what went wrong and why.';
        case 'tool.failure':
          return 'Not every tool call succeeds. When tools fail, Claude adapts — trying different approaches, fixing arguments, or falling back to alternatives. This resilience is what makes agentic coding powerful.';
        case 'tool.deny':
          return 'Permission modes give you fine-grained control. Default mode requires approval for sensitive operations; relaxed mode trusts Claude for autonomous work. Find the balance that fits your risk tolerance.';
        case 'agent.spawn':
          return 'Sub-agents let you parallelize work. Each agent works independently on its task — one can refactor while another writes tests. Great for large migrations, multi-file changes, and code review.';
        case 'achievement.unlocked':
          return 'Each unlocked achievement represents a skill or habit you\'ve developed. The rarer the achievement, the more it reflects mastery — Legendary and Mythic achievements are true marks of expertise.';
        case 'plan.enter':
          return 'Plan mode is for design before execution. Think twice, code once — a good plan catches edge cases, identifies dependencies, and saves rework. Use it for features with multiple files or complex logic.';
        case 'mcp.tool_call':
          return 'MCP (Model Context Protocol) connects Claude to external services — databases, APIs, cloud platforms. Each MCP tool is a new capability. Configure them in .mcp.json and Claude auto-discovers them.';
        case 'skill.invoke':
          return 'Skills are reusable instruction packages. They teach Claude how to handle specific tasks — from code review to deployment. You can create your own skills to encode team best practices.';
        default:
          return `Master this feature through consistent use. The more you use it, the more natural it becomes.`;
      }
    }
    case 'threshold': {
      if (cond.metric === 'duration')
        return 'Deep work requires uninterrupted time. A 3+ hour session lets Claude build and maintain complex context — ideal for architecture, large refactors, or multi-step feature implementation.';
      if (cond.metric === 'length')
        return 'Brevity forces clarity. Challenge yourself to express requirements in fewer words — Claude handles ambiguity best when constraints are precise and focused.';
      return 'Pushing past your usual limits often leads to the most learning. Try going a little further than you normally would.';
    }
    case 'streak': {
      return 'Consistency compounds. Using Claude daily builds familiarity with both the tool and your codebase. Even short sessions maintain momentum — the streak matters more than the session length.';
    }
    case 'distinct_count': {
      if (cond.field === 'tool_name')
        return 'Each tool has a specific strength: Read for analysis, Write for creation, Edit for modification, Bash for execution, Search for discovery. The pro knows which tool fits which job.';
      if (cond.field === 'agent_type')
        return 'Different agent types excel at different tasks: Plan for architecture, code-review for quality, explore for research. Choosing the right agent type for each task is a skill in itself.';
      if (cond.field === 'skill_name')
        return 'Skills are task-specific expertise packages. The community has created skills for everything from code review to deployment. Each skill you try adds a new capability to your toolkit.';
      if (cond.field === 'language')
        return 'Different languages have different strengths. TypeScript for type safety, Python for data work, Rust for performance. The polyglot developer picks the right tool for each job.';
      return 'Variety is the spice of mastery. The broader your experience across different options, the better your intuition for choosing the right one.';
    }
    case 'sequence': {
      return 'Some achievements require a specific sequence of actions. Think of it as a recipe — the order matters as much as the ingredients. Plan your approach before diving in.';
    }
    case 'pattern_match': {
      return 'Some achievements trigger on natural conversation patterns. The key is organic interaction — trying too hard to trigger them often backfires. Just work naturally and they\'ll appear.';
    }
    case 'mode': {
      return 'Your working style matters. Different times of day, different tools, different models — each combination creates unique opportunities for discovery. Variety reveals what consistency hides.';
    }
    default:
      return null;
  }
}

function genTipCn(id: string, entry: Record<string, unknown>, conditions: ConditionSummary[]): string | null {
  const rarity = String(entry.rarity || '');
  const hidden = entry.hidden === true;
  if (hidden || (rarity !== 'common' && rarity !== 'uncommon')) return null;

  const cond = conditions[0];
  if (!cond) return null;

  switch (cond.type) {
    case 'counter': {
      switch (cond.event) {
        case 'task.complete':
          return 'Task 是 Claude Code 中的基本工作单元。把每个功能拆成小而专注的 task（一个文件改动、一个测试、一个提交）。Claude 会自动追踪进度并报告完成状态——用这个来组织你的工作流。';
        case 'file.create':
          return '从零开始往往是最干净的做法。当你需要新模块、组件或配置文件时，直接描述你的需求——Claude 会帮你处理样板代码、导入和结构，让你专注于业务逻辑。';
        case 'file.edit':
          return '编辑动作就是实际发生工作的地方。最高效的工作流是：先读代码理解现状 → 规划改动 → 精准编辑。编辑多个文件时使用 /compact 管理上下文。';
        case 'file.read':
          return '读代码是理解一个代码库最快的方式。Claude 能帮你总结整个文件、追踪数据流向、识别代码模式。建议：在让 Claude 编辑不熟悉的文件之前，先用 Read 理解它。';
        case 'file.delete':
          return '死代码就是技术债。定期清理无用文件能降低认知负担、提高可维护性。Claude 能帮你识别不再被引用的文件。';
        case 'file.write':
          return '从零创建文件让你完全掌控结构。描述用途而非仅仅内容——Claude 会搭建好导入、类型和导出，使其与你现有的代码模式集成。';
        case 'tool.complete':
          return '串联工具是提升效率的关键。典型工作流：Read（理解）→ Plan（思考）→ Edit（修改）→ Bash（测试）。每个 task 的交互轮数越少，你交付得越快。';
        case 'session.start':
          return 'Claude Code 在 session 之间保留上下文——你可以从上次停下的地方继续。每个 session 开始时都有完整的文件树和最近历史。用描述性的初始消息快速重建上下文。';
        case 'git.commit':
          return '早提交，勤提交。每次提交都是一个可回退的检查点。Claude 遵循 conventional commit 格式——描述性信息要说明 WHY 而非仅仅 WHAT。';
        case 'git.push':
          return '不推送的代码和不写没区别。定期推送让 CI/CD、协作和备份成为可能。Claude 可以帮你推送——但在推送到共享分支前务必 review。';
        case 'git.pr_created':
          return 'Pull Request 是协作的入口。好的 PR 描述应说明问题、方案和权衡取舍。Claude 能基于提交历史帮你起草描述。';
        case 'conversation.message':
          return '对话是双向的。你的诉求越具体，Claude 的输出质量越高。附上错误信息、预期行为、约束条件——这能省去多轮澄清交互。';
        case 'command.run':
          return '终端是 agent 的超能力。Claude 可以运行测试、安装包、检查代码、部署上线。建议：对于复杂命令，让 Claude 逐步构建——更安全也更有教育意义。';
        case 'error.occurred':
          return '错误是学习的机会。当工具调用失败时，Claude 能看到错误信息并自我修正。最好的开发者会仔细阅读错误信息——Claude 能解释错误原因和根源。';
        case 'tool.failure':
          return '不是每次工具调用都会成功。失败时 Claude 会调整——换方法、改参数、或用备选方案。这种韧性正是 agent 编程的强大之处。';
        case 'tool.deny':
          return '权限模式让你精确控制安全级别。默认模式需要你批准敏感操作；宽松模式让 Claude 自主执行。找到适合你风险偏好的平衡点。';
        case 'agent.spawn':
          return '子 agent 让你并行工作。每个 agent 独立处理自己的任务——一个重构代码，另一个写测试。适合大规模迁移、多文件修改和代码审查。';
        case 'achievement.unlocked':
          return '每一个已解锁的成就都代表你已掌握的一项技能或习惯。稀有度越高越体现专业水平——Legendary 和 Mythic 成就是真正的专业标志。';
        case 'plan.enter':
          return 'Plan mode 是为了在执行之前先设计。三思而后 code——好的计划能覆盖边界情况、识别依赖关系、减少返工。适合多文件或复杂逻辑的功能。';
        case 'mcp.tool_call':
          return 'MCP（模型上下文协议）让 Claude 连接外部服务——数据库、API、云平台。每个 MCP 工具都是一项新能力。在 .mcp.json 中配置后 Claude 会自动发现。';
        case 'skill.invoke':
          return 'Skill 是可复用的指令包。它们教 Claude 如何处理特定任务——从代码审查到部署部署。你可以创建自己的 skill 来编码团队最佳实践。';
        default:
          return '通过持续使用来掌握这个功能。用得越多越自然。';
      }
    }
    case 'threshold': {
      if (cond.metric === 'duration')
        return '深度工作需要不被中断的时间。3 小时以上的 session 让 Claude 建立和维持复杂上下文——适合架构设计、大规模重构、多步骤功能实现。';
      if (cond.metric === 'length')
        return '简洁催生清晰。试着用更少的词表达需求——Claude 在约束明确、重点突出时处理歧义的能力最强。';
      return '突破常规限制往往带来最多的学习。试试比你平常做得更多一点。';
    }
    case 'streak': {
      return '积累效应。每天使用 Claude 能建立对工具和代码库的熟悉度。即使是短 session 也能保持 momentum——连续天数比单次时长更重要。';
    }
    case 'distinct_count': {
      if (cond.field === 'tool_name')
        return '每个工具有独特的优势：Read 用于分析，Write 用于创建，Edit 用于修改，Bash 用于执行，Search 用于发现。高手知道哪个工具适合哪项工作。';
      if (cond.field === 'agent_type')
        return '不同类型的 agent 擅长不同任务：Plan 适合架构设计，code-review 适合质量审查，explore 适合研究。为任务选对 agent 本身就是一项技能。';
      if (cond.field === 'skill_name')
        return 'Skill 是任务特定的专业知识包。社区已经创建了从代码审查到部署的各种 skill。每多尝试一个 skill 就为你的工具箱增加一项能力。';
      if (cond.field === 'language')
        return '不同语言有不同优势。TypeScript 强类型安全、Python 数据处理、Rust 高性能。多语言开发者能为每项工作选对工具。';
      return '多样性是精通的关键。你在不同选项上的经验越广，你对"选哪个"的直觉就越好。';
    }
    case 'sequence': {
      return '有些成就需要特定的操作序列。把它想象成一个菜谱——顺序和配料同样重要。开始之前先规划好方法。';
    }
    case 'pattern_match': {
      return '有些成就触发于自然的对话模式。关键在于自然的互动——刻意去触发往往适得其反。像平时一样工作，它们自然会来。';
    }
    case 'mode': {
      return '你的工作风格很重要。不同的时间、不同的工具、不同的模型——每种组合都创造了独特的发现机会。多样性揭示了一致性所隐藏的东西。';
    }
    default:
      return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const yamlText = fs.readFileSync(YAML_PATH, 'utf-8');
  const doc = YAML.parse(yamlText);
  const defs = doc.definitions as Array<Record<string, unknown>>;

  let tipAdded = 0;
  let hintAdded = 0;

  for (const entry of defs) {
    const id = String(entry.id || '');
    const conditions = summarizeConditions(entry.conditions);

    // Add hint if missing and applicable
    if (!entry.hint) {
      const hint = genHint(id, entry, conditions);
      if (hint) {
        entry.hint = hint;
        const hintCn = genHintCn(id, entry, conditions);
        if (hintCn) entry.hint_cn = hintCn;
        hintAdded++;
      }
    }

    // Add tip if missing and applicable
    if (!entry.tip) {
      const tip = genTip(id, entry, conditions);
      if (tip) {
        entry.tip = tip;
        const tipCn = genTipCn(id, entry, conditions);
        if (tipCn) entry.tip_cn = tipCn;
        tipAdded++;
      }
    }
  }

  // Write back
  const output = YAML.stringify(doc, { lineWidth: 120, indent: 2 });
  fs.writeFileSync(YAML_PATH, output, 'utf-8');

  console.log(`✅ Tips added: ${tipAdded}`);
  console.log(`✅ Hints added: ${hintAdded}`);
  console.log(`📁 Wrote: ${YAML_PATH}`);
}

main();
