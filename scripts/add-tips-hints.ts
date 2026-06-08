/**
 * Add tip/hint fields to onboarding and Common/Uncommon achievements in the YAML.
 * Run: npx tsx scripts/add-tips-hints.ts
 */
import * as fs from 'fs';
import * as YAML from 'yaml';

const YAML_PATH = 'achievement-definitions.yaml';

// ── Onboarding: tip (educational) + hint (unlock clue) ──
const ONBOARDING: Record<string, { tip_cn: string; tip: string; hint_cn: string; hint: string }> = {
  first_contact: {
    tip_cn: '跟 Claude 像同事一样对话。诉求越具体，输出质量越高。“写一个 React 登录组件”比“写个登录页”好十倍。',
    tip: 'Talk to Claude like a colleague. The more specific your request, the better the output. "Write a React login component with form validation" beats "make a login page" every time.',
    hint_cn: '打个招呼，开启你的第一次对话',
    hint: 'Say hello and start your first conversation',
  },
  three_company: {
    tip_cn: '把复杂工作拆成 task。Claude 会根据 task 追踪进度，还能自动标记完成状态。大的重构？先列 task 清单。',
    tip: 'Break complex work into tasks. Claude tracks progress per task and marks completion automatically. Big refactor? Start with a task list.',
    hint_cn: '完成几个 task，看看会发生什么',
    hint: 'Complete a few tasks and see what happens',
  },
  tool_time: {
    tip_cn: 'Agent 能调用 Read、Write、Bash、Search、WebFetch 等工具。真正的高手善于组合工具——读取代码→分析问题→编辑修复→运行测试，一气呵成。',
    tip: 'Agents use tools like Read, Write, Bash, Search, WebFetch. The pros chain them: read code → analyze → edit → run tests — all in one flow.',
    hint_cn: '让 Claude 帮你读一个文件或写一段代码',
    hint: 'Ask Claude to read a file or write some code for you',
  },
  permission_granted: {
    tip_cn: '权限模式控制 Claude 何时需要你确认。默认模式适合监督，宽松模式适合信任流程。找到安全与效率的平衡点。',
    tip: 'Permission modes control when Claude asks for approval. Default mode for supervision, relaxed for trusted flows. Find your safety-efficiency sweet spot.',
    hint_cn: '掌控 Claude 的权限行为——调整一下权限模式',
    hint: 'Take control — adjust how Claude asks for your permission',
  },
  read_manual: {
    tip_cn: '/help 是内置快速参考，比 Google 快。想看所有 slash command、了解 plan mode、查配置？都在 help 里。',
    tip: '/help is your built-in quick reference, faster than Googling. All slash commands, plan mode docs, config reference — it\'s all there.',
    hint_cn: '内置手册就在手边，找到它',
    hint: 'There\'s a built-in manual. Type /help to find it.',
  },
  first_sunrise: {
    tip_cn: 'Claude Code 在 session 之间保留上下文。隔天回来继续工作，Claude 还记得你们在做什么。善用 session 连续性。',
    tip: 'Claude Code retains context between sessions. Come back tomorrow and Claude remembers what you were doing. Leverage session continuity.',
    hint_cn: '24 小时内再开一次 session，和老朋友重逢',
    hint: 'Come back for another session within a day — your agent misses you',
  },
  first_shot: {
    tip_cn: 'slash command 是常用操作的快捷方式。输入 / 然后 tab 查看所有可用命令。/help、/compact、/model 都是日常必备。',
    tip: 'Slash commands are shortcuts for common actions. Type / then Tab to see all available commands. /help, /compact, /model are daily essentials.',
    hint_cn: '输入一个斜杠命令——就像控制台里的秘籍',
    hint: 'Type a slash command — like a cheat code in your terminal',
  },
  model_hopper: {
    tip_cn: '不同模型各有所长。Opus 适合复杂推理和架构设计，Sonnet 适合快速迭代，Haiku 适合简单任务。用 /model 随时切换。',
    tip: 'Different models, different strengths. Opus for complex reasoning and architecture, Sonnet for rapid iteration, Haiku for simple tasks. /model to switch anytime.',
    hint_cn: '换一个 AI 模型试试，总有一款适合你',
    hint: 'Try a different AI model — variety is the spice of coding',
  },
  worktree_trial: {
    tip_cn: 'Worktree 隔离文件修改在沙盒中，不影响原代码。适合大范围重构、实验性改动。安全第一。',
    tip: 'Worktrees isolate changes in a sandbox — your original code stays untouched. Perfect for risky refactors and experiments.',
    hint_cn: '把你的代码带到隔离区去工作',
    hint: 'Take your code to an isolated workspace for safe experimentation',
  },
  mcp_first_contact: {
    tip_cn: 'MCP 让 Claude 连接外部工具和 API——数据库、云服务、自定义接口。在 .mcp.json 中配置，Claude 自动发现。',
    tip: 'MCP connects Claude to external tools — databases, cloud services, custom APIs. Configure in .mcp.json and Claude auto-discovers them.',
    hint_cn: '给 Claude 接通外部工具——让它不再局限于本地',
    hint: 'Connect Claude to an external service — expand its reach',
  },
  visual_prompt: {
    tip_cn: 'Claude 能读取截图、架构图、PDF、UI mockup。遇到复杂的 UI 问题？直接截图给 Claude，比描述文字准确。',
    tip: 'Claude reads screenshots, diagrams, PDFs, UI mockups. Debugging a UI issue? Share a screenshot — it\'s more precise than describing it.',
    hint_cn: '分享一张图片给 Claude——一图胜千言',
    hint: 'Share an image with Claude — a picture is worth a thousand words',
  },
  dashboard_visitor: {
    tip_cn: 'Dashboard 追踪你的成就进度、XP、稀有度统计、套装收集。在项目目录运行 npm run dashboard 打开。',
    tip: 'The Dashboard tracks your achievement progress, XP, rarity stats, and set collections. Run `npm run dashboard` from the project directory.',
    hint_cn: '成就系统有一个 Web 面板——打开看看',
    hint: 'There\'s an achievement dashboard. Can you find it?',
  },
  automode_first: {
    tip_cn: 'Automode 让 Claude 自主执行长任务，无需逐个确认。适合批量重构、多文件修改。定期 review 进度即可。',
    tip: 'Automode lets Claude work autonomously on long tasks without per-step approval. Great for batch refactors and multi-file changes. Review periodically.',
    hint_cn: '让 Claude 自己开一会儿——激活自动驾驶模式',
    hint: 'Let Claude drive autonomously for a while',
  },
  mcp_first_connect: {
    tip_cn: 'MCP 连接建立后，Claude 可以调用远程服务。从数据库查询到自动化部署，MCP 把你的工具链带入对话中。',
    tip: 'Once an MCP connection is established, Claude can call remote services. From database queries to automated deploys — MCP brings your toolchain into the conversation.',
    hint_cn: '建立一条通往外部服务器的连接',
    hint: 'Establish a connection to an external server',
  },
};

// ── Other Common/Uncommon: hint only ──
const HINTS: Record<string, { hint_cn: string; hint: string }> = {
  task_creator: { hint_cn: '多创建几个 task——规划是一种超能力', hint: 'Create several tasks — organization is a superpower' },
  task_updater: { hint_cn: '持续更新 task 状态，跟踪项目进度', hint: 'Keep updating task statuses as you make progress' },
  error_resilient: { hint_cn: '错误是学习的机会。让 Claude 从错误中继续。', hint: 'Errors are learning opportunities. Keep going despite them.' },
  file_purger: { hint_cn: '清理一些不需要的文件——少即是多', hint: 'Clean up some unused files — sometimes less is more' },
  dual_wielder: { hint_cn: '在同一个 task 里多用几种不同工具', hint: 'Use multiple different tools within a single task' },
  double_digits: { hint_cn: '完成任务是一个积累的过程。继续努力。', hint: 'Keep completing tasks — you\'ll hit a milestone soon' },
  marathon: { hint_cn: '持久的 session 能产出更多。来一次深度工作。', hint: 'A long, focused session produces more. Go deep.' },
  streak_7: { hint_cn: '每天来干一点，连续一周，习惯就养成了', hint: 'Show up every day for a week — build the habit' },
  polyglot: { hint_cn: '在不同的编程语言之间切换', hint: 'Switch between different programming languages' },
  streak_3: { hint_cn: '连续三天来和 Claude 一起工作', hint: 'Come work with Claude three days in a row' },
  file_centurion: { hint_cn: '创建足够多的文件来留下你的印记', hint: 'Create enough files to leave your mark' },
  multi_image_day: { hint_cn: '一天内分享多张图片给 Claude', hint: 'Share multiple images with Claude in a single day' },
  chain_reaction: { hint_cn: '让工具调用触发更多工具调用——链式反应', hint: 'Let tool calls trigger more tool calls — a chain reaction' },
  seeker: { hint_cn: '在代码库里搜索和探索', hint: 'Search and explore within your codebase' },
  the_debugger: { hint_cn: '找到并修复一些 bug', hint: 'Find and fix some bugs' },
  the_switch: { hint_cn: '在 session 中多次切换模型', hint: 'Switch models several times within a session' },
  off_the_grid: { hint_cn: '在某个时间段保持低调——深夜或凌晨', hint: 'Work during off-peak hours — late night or early morning' },
  minimalist: { hint_cn: '用最少的代码说清楚一件事', hint: 'Say it with the fewest lines possible' },
  novelist: { hint_cn: '写一份详细的文档或规格说明', hint: 'Write a detailed document or specification' },
  copy_paste_king: { hint_cn: '复制、粘贴……你懂的', hint: 'Copy and paste — you know the drill' },
  shell_shocker: { hint_cn: '让 Claude 帮你跑一些 shell 命令', hint: 'Let Claude run some shell commands for you' },
  web_wanderer: { hint_cn: '在网络上搜索和探索信息', hint: 'Search and explore the web for information' },
  image_whisperer: { hint_cn: '让 Claude 仔细分析图片中的细节', hint: 'Let Claude analyze the details in your images' },
  undo_master: { hint_cn: '有时候最好的代码是删掉的代码', hint: 'Sometimes the best code is deleted code' },
  git_tenderfoot: { hint_cn: '开始用 Claude 做版本控制——提交你的第一个 commit', hint: 'Start version controlling with Claude — make your first commit' },
  pr_champion: { hint_cn: '发起一次 Pull Request', hint: 'Create a Pull Request' },
  code_reviewer: { hint_cn: '让 Claude 帮你 review 代码', hint: 'Let Claude review your code' },
  deep_review: { hint_cn: '做一次深度的代码审查——不只是表面问题', hint: 'Do a deep code review — beyond surface-level issues' },
  plan_mode_user: { hint_cn: '用 Plan mode 来规划复杂任务', hint: 'Use Plan mode for complex task planning' },
  plan_strategist: { hint_cn: 'Plan mode 不只是玩具——多用它几次', hint: 'Plan mode isn\'t just a toy — use it more' },
  auto_committer: { hint_cn: '每次 push 后记录变更到 CHANGELOG', hint: 'Log your changes to the CHANGELOG after each push' },
  changelog_keeper: { hint_cn: '维护一份 CHANGELOG 来追踪项目变化', hint: 'Maintain a CHANGELOG to track your project\'s evolution' },
  context_conscious: { hint_cn: '关注 Claude 的上下文窗口——善用 compact', hint: 'Be aware of Claude\'s context window — use compact wisely' },
  session_veteran: { hint_cn: '积累足够多的 session 经验', hint: 'Accumulate enough sessions to be called a veteran' },
  review_regular: { hint_cn: '养成代码审查的习惯', hint: 'Make code review a regular habit' },
  command_crafter: { hint_cn: '创建你自己的 slash command', hint: 'Create your own custom slash command' },
  skill_creator: { hint_cn: '创建一个自定义 skill 来扩展 Claude', hint: 'Create a custom skill to extend Claude\'s capabilities' },
  skill_adept: { hint_cn: '熟练使用多种不同的 skill', hint: 'Master several different skills' },
  hooks_master: { hint_cn: '配置一个 hook 来自动化你的工作流', hint: 'Configure a hook to automate your workflow' },
  plugin_explorer: { hint_cn: '探索并从市场中安装一个插件', hint: 'Explore and install a plugin from the marketplace' },
  template_master: { hint_cn: '创建并使用项目模板', hint: 'Create and use project templates' },
  deepseek_dabbler: { hint_cn: '尝试某个特定的模型', hint: 'Try a particular model' },
  clockwork_orange: { hint_cn: '在特定的时间和 Claude 一起工作', hint: 'Work with Claude at specific times' },
  whale_song: { hint_cn: '使用 DeepSeek 模型完成一些工作', hint: 'Use a DeepSeek model for some work' },
  mathematical_theory_of_communication: { hint_cn: '使用 Claude 模型完成一些工作', hint: 'Use a Claude model for some work' },
  blossom: { hint_cn: '使用 GPT 模型完成一些工作', hint: 'Use a GPT model for some work' },
  alien: { hint_cn: '使用一个非主流的模型', hint: 'Use a less common model' },
  silent_night: { hint_cn: '夜深人静时和 Claude 聊聊工作', hint: 'Some of your best ideas come after midnight' },
  polyglot_challenge: { hint_cn: '跨越多种语言去工作', hint: 'Work across multiple languages' },
  multi_model: { hint_cn: '在不同的模型之间切换和尝试', hint: 'Switch between and try different models' },
  trophy_case: { hint_cn: '收集一定数量的成就来填充你的展示柜', hint: 'Collect enough achievements to fill your trophy case' },
  completionist_bronze: { hint_cn: '解锁一部分成就——这只是开始', hint: 'Unlock a chunk of all achievements — this is just the beginning' },
  casual_collector: { hint_cn: '慢慢收集成就，不着急', hint: 'Take your time collecting achievements' },
  pipemaster: { hint_cn: '把工具串联起来——像管道一样', hint: 'Chain tools together — like a pipeline' },
  cerberus: { hint_cn: '同一件事连做三次', hint: 'Do the same thing three times in a row' },
  fail_forward: { hint_cn: '失败是成功之母——让 Claude 从失败中学习', hint: 'Failure is the mother of success — learn from it' },
  bounce_back: { hint_cn: '从多次失败中恢复并继续前进', hint: 'Recover from multiple failures and keep moving forward' },
  delegator: { hint_cn: '把任务委派给子 agent 去处理', hint: 'Delegate tasks to sub-agents' },
  swat_team: { hint_cn: '一次性召集多个 agent 来协作', hint: 'Assemble multiple agents to collaborate at once' },
};

// ── Apply to YAML ──
const raw = fs.readFileSync(YAML_PATH, 'utf8');
const doc = YAML.parseDocument(raw);
const defs = doc.get('definitions') as YAML.YAMLSeq;

if (!defs || !YAML.isSeq(defs)) {
  console.error('Invalid YAML: missing definitions sequence');
  process.exit(1);
}

let tipsAdded = 0;
let hintsAdded = 0;

for (const item of defs.items) {
  if (!YAML.isMap(item)) continue;
  const id = item.get('id') as string | undefined;
  if (!id) continue;

  // Add onboarding tip + hint
  const ob = ONBOARDING[id];
  if (ob) {
    const hiddenIdx = item.items.findIndex((kv: YAML.Pair) => kv.key instanceof YAML.Scalar && kv.key.value === 'hidden');
    const insertAfter = hiddenIdx >= 0 ? hiddenIdx : item.items.length - 1;

    // Remove existing tip/hint fields if any (to avoid duplicates)
    const fieldsToRemove = ['tip', 'tip_cn', 'hint', 'hint_cn'];
    fieldsToRemove.forEach(f => {
      const idx = item.items.findIndex((kv: YAML.Pair) => kv.key instanceof YAML.Scalar && kv.key.value === f);
      if (idx >= 0) item.items.splice(idx, 1);
    });

    const newFields = [
      doc.createPair('tip', ob.tip),
      doc.createPair('tip_cn', ob.tip_cn),
      doc.createPair('hint', ob.hint),
      doc.createPair('hint_cn', ob.hint_cn),
    ];

    // Insert after hidden field
    for (let i = newFields.length - 1; i >= 0; i--) {
      item.items.splice(insertAfter + 1, 0, newFields[i]!);
    }
    tipsAdded++;
    hintsAdded++;
  }

  // Add hint only for other Common/Uncommon
  const h = HINTS[id];
  if (h) {
    // Check if hint already added above (onboarding)
    const hasHint = item.items.some((kv: YAML.Pair) => kv.key instanceof YAML.Scalar && kv.key.value === 'hint');
    if (!hasHint) {
      const hiddenIdx = item.items.findIndex((kv: YAML.Pair) => kv.key instanceof YAML.Scalar && kv.key.value === 'hidden');
      const insertAfter = hiddenIdx >= 0 ? hiddenIdx : Math.max(0, item.items.length - 1);

      // Remove existing hint fields if any
      ['hint', 'hint_cn'].forEach(f => {
        const idx = item.items.findIndex((kv: YAML.Pair) => kv.key instanceof YAML.Scalar && kv.key.value === f);
        if (idx >= 0) item.items.splice(idx, 1);
      });

      item.items.splice(insertAfter + 1, 0, doc.createPair('hint', h.hint));
      item.items.splice(insertAfter + 2, 0, doc.createPair('hint_cn', h.hint_cn));
      hintsAdded++;
    }
  }
}

// Write back
fs.writeFileSync(YAML_PATH, doc.toString(), 'utf8');
console.log(`✅ Added ${tipsAdded} tip entries and ${hintsAdded} hint entries to ${YAML_PATH}`);
