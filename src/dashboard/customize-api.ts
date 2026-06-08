/**
 * Self-Customize API — achievement name/description personalization backend.
 *
 * Reads/writes 04-成就定义清单.yaml directly (bypasses engine). The customize
 * page at /customize is intentionally unlinked from the main Dashboard — users
 * find it via documentation, not navigation.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let yamlPath = path.resolve(__dirname, '..', '..', '04-成就定义清单.yaml');
export function setYamlPathForTest(p: string): void { yamlPath = p; }

// ── Types ────────────────────────────────────────────────────────────────

interface RawAchievement {
  id: string;
  index: number;         // position in the YAML array
  name: string;
  name_cn?: string;
  description: string;
  description_cn?: string;
  icon: string;
  category: string;
  rarity: string;
  hidden: boolean;
  set?: string;
  conditions: unknown;
  progress_trackable?: boolean;
  challenge?: boolean;
}

interface CustomizeAchievement extends RawAchievement {
  has_name_cn: boolean;
  description_en?: string;
  suggestions: Suggestion[];
}

interface Suggestion {
  field: 'name' | 'name_cn' | 'description' | 'description_cn';
  current: string;
  suggested: string;
  reason: string;
  severity: 'error' | 'warning' | 'info';
}

interface CustomizeResponse {
  achievements: CustomizeAchievement[];
  stats: {
    total: number;
    with_cn: number;
    without_cn: number;
    suggestions_total: number;
  };
}

// ── YAML Read / Write ────────────────────────────────────────────────────

function loadYamlRaw(): Record<string, unknown> | null {
  const text = fs.readFileSync(yamlPath, 'utf-8');
  return YAML.parse(text) as Record<string, unknown> | null;
}

function loadYamlText(): string {
  return fs.readFileSync(yamlPath, 'utf-8');
}

function saveYamlText(text: string): void {
  fs.writeFileSync(yamlPath, text, 'utf-8');
}

// ── Suggestion Engine ────────────────────────────────────────────────────

/** Generate suggestions for a single achievement */
function generateSuggestions(ach: RawAchievement): Suggestion[] {
  const s: Suggestion[] = [];

  // 1. Missing Chinese name
  if (!ach.name_cn || ach.name_cn.trim() === '') {
    const cn = suggestChineseName(ach);
    s.push({
      field: 'name_cn',
      current: '(missing)',
      suggested: cn,
      reason: '缺少中文名',
      severity: 'error',
    });
  }

  // 2. Chinese name is actually in English
  if (ach.name_cn && /^[A-Za-z0-9\s!?.,'":;()\-–—&]+$/.test(ach.name_cn.trim())) {
    s.push({
      field: 'name_cn',
      current: ach.name_cn,
      suggested: suggestChineseName(ach),
      reason: '中文名是英文，应该用中文',
      severity: 'error',
    });
  }

  // 3. English name looks auto-generated or too generic
  const genericNames = ['achievement', 'untitled', 'new achievement', 'todo'];
  if (genericNames.some(g => ach.name.toLowerCase().includes(g))) {
    s.push({
      field: 'name',
      current: ach.name,
      suggested: ach.name, // keep as-is, just flag
      reason: '英文名可能太泛化',
      severity: 'warning',
    });
  }

  return s;
}

/** Generate a suggested Chinese name based on English name + description */
function suggestChineseName(ach: RawAchievement): string {
  // Category-specific mappings first
  const categoryMap: Record<string, Record<string, string>> = {
    onboarding: {
      double_digits: '两位数',
      century: '世纪',
      millennium: '千禧',
      marathon: '马拉松',
      streak_7: '连续7天',
      streak_30: '连续30天',
      streak_100: '连续100天',
      polyglot: '多语者',
    },
    milestones: {
      double_digits: '两位数',
      century: '世纪',
      millennium: '千禧',
      marathon: '马拉松',
      streak_7: '连续7天',
      streak_30: '连续30天',
      streak_100: '连续100天',
      polyglot: '多语者',
      half_century: '半百',
      streak_3: '帽子戏法',
      file_centurion: '文件百夫长',
    },
    skill: {
      chain_reaction: '连锁反应',
      full_auto: '全自动',
      architect: '建筑师',
      surgeon: '外科医生',
      seeker: '探索者',
      the_debugger: '调试者',
      triple_debugger: '三重调试',
      tool_completist: '工具大全',
      the_switch: '模式切换',
      off_the_grid: '离线模式',
      first_try: '一次过',
      terminal_only: '纯终端',
      cerberus: '地狱三头犬',
      phoenix: '凤凰涅槃',
    },
    style: {
      minimalist: '极简主义',
      novelist: '小说家',
      one_shot: '一发入魂',
      iterative_refiner: '迭代打磨',
      night_owl: '夜猫子',
      weekend_warrior: '周末战士',
      afternoon_tea: '下午茶',
      copy_paste_king: '复制粘贴之王',
    },
    tool_mastery: {
      file_whisperer: '文件低语者',
      git_wizard: 'Git 巫师',
      shell_shocker: '终端震撼',
      web_wanderer: '网络漫游者',
      parallel_universe: '平行宇宙',
      mcp_explorer: 'MCP 探索者',
      image_whisperer: '图片低语者',
      undo_master: '撤回大师',
      git_tenderfoot: 'Git 新兵',
      git_veteran: 'Git 老兵',
      pipemaster: '管道大师',
      command_baby: '命令宝宝',
      command_master: '命令大师',
      mcp_connoisseur: 'MCP 品鉴师',
      mcp_collector: 'MCP 收藏家',
    },
    workflow: {
      pr_champion: 'PR 冠军',
      cicd_pioneer: 'CI/CD 先驱',
      code_reviewer: '代码审查者',
      deep_review: '深度审查',
      plan_mode_user: '战略思考者',
      plan_strategist: '规划战略家',
      auto_committer: '自动提交者',
      changelog_keeper: '变更日志守护者',
      context_conscious: '上下文感知',
      session_veteran: '会话老兵',
      session_centurion: '会话百夫长',
      token_titan: 'Token 巨人',
      token_legend: 'Token 传奇',
      multi_project: '多项目',
      full_cycle: '全流程',
      cycle_master: '循环大师',
      merge_tamer: '合并驯服者',
      subagent_handler: '驯兽师',
      review_regular: '审查常客',
      delegator: '放权大师',
      swat_team: '特种小队',
      fail_forward: '初尝失败',
      bounce_back: '反弹力',
      failure_mother: '失败是成功之母',
    },
    creator: {
      command_crafter: '命令工匠',
      command_library: '命令库',
      skill_creator: '技能创造者',
      skill_publisher: '技能发布者',
      agent_architect: 'Agent 架构师',
      hooks_master: 'Hooks 大师',
      plugin_explorer: '插件探索者',
      template_master: '模板大师',
      slash_commander: '斜杠指挥官',
    },
    hidden: {
      ill_do_it_myself: '我自己来',
      perfectionist: '完美主义者',
      the_all_nighter: '熬夜通宵',
      its_learning: '它在学习',
      agent_collector: 'Agent 收藏家',
      daily_checkin: '每日签到',
      tinkerer: '修修补补',
      hold_my_beer: '看我的',
      execute_order_66: '执行66号令',
      rewriting_history: '改写历史',
      im_root: '我是 Root',
      snake_charmer: '耍蛇人',
      gopher_gang: 'Gopher 帮',
      rustacean: 'Rustacean',
      js_everywhere: 'JS 无处不在',
      true_vibe_coder: '真·Vibe Coder',
      lucky_777: '幸运777',
      im_sorry_dave: '抱歉 Dave',
      early_bird: '早起的鸟',
      midas_touch: '点石成金',
      rubber_duck: '橡皮鸭',
      the_negotiator: '谈判专家',
      u_turn: '推倒重来',
      silent_partner: '幕后搭档',
      time_traveler: '时间旅者',
      regex_sorcerer: '正则巫师',
      friday_deploy: '周五部署',
      infinite_loop: '无限循环',
      undying_curiosity: '不死的好奇心',
    },
    challenge: {
      silent_night: '静夜思',
      polyglot_challenge: '语言马拉松',
      speed_run_bronze: '速通(铜)',
      speed_run_silver: '速通(银)',
      ten_task_no_edit: '十连零编辑',
      multi_model: '多模型',
      short_circuit: '短路',
    },
    community: {
      trophy_case: '奖杯柜',
      completionist_bronze: '完美主义(铜)',
      completionist_silver: '完美主义(银)',
      completionist_gold: '完美主义(金)',
      mythic_completionist: '神话完美主义',
      cross_agent: '跨平台',
      casual_collector: '随缘收集',
    },
  };

  const catMap = categoryMap[ach.category];
  if (catMap && catMap[ach.id]) return catMap[ach.id]!;

  // Fallback: generate from name
  const nameMap: Record<string, string> = {
    'Double Digits': '两位数',
    'Century': '世纪',
    'Millennium': '千禧',
    'Marathon': '马拉松',
    'Streak 7': '连续7天',
    'Streak 30': '连续30天',
    'Streak 100': '连续100天',
    'Polyglot': '多语者',
    'Chain Reaction': '连锁反应',
    'Full Auto': '全自动',
    'Architect': '建筑师',
    'Surgeon': '外科医生',
    'Seeker': '探索者',
    'The Debugger': '调试者',
    'Triple Debugger': '三重调试',
    'Tool Completist': '工具大全',
    'The Switch': '模式切换',
    'Minimalist': '极简主义',
    'Novelist': '小说家',
    'One Shot': '一发入魂',
    'Iterative Refiner': '迭代打磨',
    'Night Owl': '夜猫子',
    'Weekend Warrior': '周末战士',
    'Copy-Paste King': '复制粘贴之王',
    'File Whisperer': '文件低语者',
    'Git Wizard': 'Git 巫师',
    'Shell Shocker': '终端震撼',
    'Web Wanderer': '网络漫游者',
    'Parallel Universe': '平行宇宙',
    'MCP Explorer': 'MCP 探索者',
    'Image Whisperer': '图片低语者',
    'PR Champion': 'PR 冠军',
    'CI/CD Pioneer': 'CI/CD 先驱',
    'Code Reviewer': '代码审查者',
    'Deep Review': '深度审查',
    'Strategic Thinker': '战略思考者',
    'Plan Strategist': '规划战略家',
    'Auto Committer': '自动提交者',
    'Changelog Keeper': '变更日志守护者',
    'Context Conscious': '上下文感知',
    'Session Veteran': '会话老兵',
    'Session Centurion': '会话百夫长',
    'Token Titan': 'Token 巨人',
    'Token Legend': 'Token 传奇',
    'Multi-Project': '多项目',
    'Full Cycle': '全流程',
    'Cycle Master': '循环大师',
    'I\'ll Do It Myself': '我自己来',
    'Perfectionist': '完美主义者',
    'The All-Nighter': '熬夜通宵',
    "It's Learning": '它在学习',
    'Agent Collector': 'Agent 收藏家',
    'Daily Check-In': '每日签到',
    'Tinkerer': '修修补补',
    'Hold My Beer': '看我的',
    'Execute Order 66': '执行66号令',
    'Rewriting History': '改写历史',
    'I Am Root': '我是 Root',
    'Snake Charmer': '耍蛇人',
    'Gopher Gang': 'Gopher 帮',
    'Rustacean': 'Rustacean',
    'JS Everywhere': 'JS 无处不在',
    'True Vibe Coder': '真·Vibe Coder',
    'Lucky 777': '幸运777',
    "I'm Sorry, Dave": '抱歉 Dave',
    'Early Bird': '早起的鸟',
    'Midas Touch': '点石成金',
    'Nothing to See Here': '没什么好看的',
    'Rubber Duck': '橡皮鸭',
    'Trust Fall': '盲目信任',
    'The Negotiator': '谈判专家',
    'Scorched Earth Redux': '推倒重来',
    'Silent Partner': '沉默搭档',
    'Command Crafter': '命令工匠',
    'Command Library': '命令库',
    'Skill Creator': '技能创造者',
    'Skill Publisher': '技能发布者',
    'Agent Architect': 'Agent 架构师',
    'Hooks Master': 'Hooks 大师',
    'Plugin Explorer': '插件探索者',
    'Template Master': '模板大师',
    'Slash Commander': '斜杠指挥官',
    'Speed Run (Bronze)': '速通(铜)',
    'Speed Run (Silver)': '速通(银)',
    'No Edit Challenge': '零编辑挑战',
    'Ten-Task No Edit': '十连零编辑',
    'Multi-Model': '多模型',
    'Short Circuit': '短路',
    'Trophy Case': '奖杯柜',
    'Completionist (Bronze)': '完美主义(铜)',
    'Completionist (Silver)': '完美主义(银)',
    'Completionist (Gold)': '完美主义(金)',
    'Mythic Completionist': '神话完美主义',
    'Cross-Agent': '跨平台',
  };

  if (nameMap[ach.name]) return nameMap[ach.name]!;

  // Last resort: no suggestion
  return '(需要人工翻译)';
}

// ── API Handlers ─────────────────────────────────────────────────────────

/** GET /api/customize/achievements — load all achievements with suggestions */
export function handleGetAchievements(): CustomizeResponse {
  const raw = loadYamlRaw();
  if (!raw?.definitions || !Array.isArray(raw.definitions)) {
    throw new Error('Invalid YAML: missing definitions array');
  }

  const achievements: CustomizeAchievement[] = [];
  let suggestions_total = 0;

  (raw.definitions as Array<Record<string, unknown>>).forEach((entry, index) => {
    const rawAch: RawAchievement = {
      id: String(entry.id ?? ''),
      index,
      name: String(entry.name ?? ''),
      name_cn: typeof entry.name_cn === 'string' ? entry.name_cn : undefined,
      description: String(entry.description ?? ''),
      description_cn: typeof entry.description_cn === 'string' ? entry.description_cn : undefined,
      icon: typeof entry.icon === 'string'
        ? entry.icon
        : (entry.icon && typeof entry.icon === 'object' && (entry.icon as Record<string,unknown>).src
          ? String((entry.icon as Record<string,unknown>).src) : '🏆'),
      category: String(entry.category ?? 'other'),
      rarity: String(entry.rarity ?? 'common'),
      hidden: entry.hidden === true,
      set: typeof entry.set === 'string' ? entry.set : undefined,
      conditions: entry.conditions ?? [],
      progress_trackable: entry.progress_trackable === true || undefined,
      challenge: entry.challenge === true || undefined,
    };

    const suggestions = generateSuggestions(rawAch);
    suggestions_total += suggestions.length;

    achievements.push({
      ...rawAch,
      has_name_cn: !!rawAch.name_cn,
      description_en: typeof entry.description_en === 'string' ? entry.description_en as string : undefined,
      suggestions,
    });
  });

  return {
    achievements,
    stats: {
      total: achievements.length,
      with_cn: achievements.filter(a => a.has_name_cn).length,
      without_cn: achievements.filter(a => !a.has_name_cn).length,
      suggestions_total,
    },
  };
}

/**
 * Safely quote a string value for YAML (plain style, double-quoted, or
 * single-quoted as appropriate). Rejects values containing YAML control
 * characters (newlines, leading special chars) that could break structure.
 */
function yamlQuote(value: string): string {
  // Reject values containing newlines or YAML line-break control characters
  if (/[\n\r\u0085\u2028\u2029]/.test(value)) {
    throw new Error('Field value contains forbidden YAML control characters (newlines)');
  }
  // Plain scalar: no special YAML chars needed, not empty
  const leadingSpecialRE = /[#{}[\]&*!|>'"@`\-?:,]/;
  if (value.length > 0 && !leadingSpecialRE.test(value[0]!) && !/:\s/.test(value) && !/ #/.test(value)) {
    return value;
  }
  // Prefer double-quote; fall back to single-quote with escaped singles
  if (!value.includes('"')) return `"${value}"`;
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Find the YAML block for an achievement by ID and update a field in-place.
 * Uses text-based editing to preserve ALL comments and formatting.
 *
 * Strategy:
 * 1. Find the line `  - id: <achievement_id>`
 * 2. Within that achievement's block (until next `  - id:` or `# ===` section header),
 *    find the field line and replace it
 * 3. If the field doesn't exist (e.g. adding name_cn for the first time),
 *    insert a new line after the `name:` line
 */
function updateFieldInYamlText(text: string, id: string, field: string, value: string): string {
  const lines = text.split('\n');

  // Sanitize value before embedding in YAML
  const safeValue = yamlQuote(value.trim());

  // Find the achievement block start
  const blockStart = lines.findIndex(l => l.match(new RegExp(`^\\s*-\\s*id:\\s*"?${escapeRegex(id)}"?(?:\\s|$)`)));
  if (blockStart === -1) throw new Error(`Achievement "${id}" not found in YAML`);

  // Find the block end (next achievement start or next section header)
  let blockEnd = lines.length;
  for (let i = blockStart + 1; i < lines.length; i++) {
    // Next achievement: `  - id:` (but not the current one)
    if (/^\s+- id:/.test(lines[i]!)) {
      blockEnd = i;
      break;
    }
    // Major section break: `# ====` comment lines
    if (/^#\s*=+/.test(lines[i]!) && i > blockStart + 1) {
      blockEnd = i;
      break;
    }
  }

  // Find the field within the block
  const fieldLineRE = new RegExp(`^\\s+${escapeRegex(field)}:`);
  const fieldIdx = lines.findIndex((l, i) => i >= blockStart && i < blockEnd && fieldLineRE.test(l));

  if (fieldIdx !== -1) {
    // Replace existing field value
    const indent = lines[fieldIdx]!.match(/^(\s*)/)![0];
    lines[fieldIdx] = `${indent}${field}: ${safeValue}`;
  } else {
    // Field doesn't exist — insert after name: line (or after id: if name doesn't exist)
    const nameIdx = lines.findIndex((l, i) =>
      i >= blockStart && i < blockEnd && /^\s+name:/.test(l)
    );
    const insertAfter = nameIdx !== -1 ? nameIdx : blockStart;
    const indent = '    '; // 4-space indent for fields
    lines.splice(insertAfter + 1, 0, `${indent}${field}: ${safeValue}`);
  }

  return lines.join('\n');
}

/** Only these fields are user-editable through the customize API */
const ALLOWED_FIELDS = new Set(['name', 'name_cn', 'description', 'description_en']);

function validateField(field: string): void {
  if (!ALLOWED_FIELDS.has(field)) {
    throw new Error(`Field "${field}" is not editable. Allowed: ${[...ALLOWED_FIELDS].join(', ')}`);
  }
}

/** PUT /api/customize/achievement — update one or more fields on an achievement */
export function handleUpdateAchievement(body: {
  id: string;
  changes: Record<string, string | null>;
}): { status: string; id: string } {
  let text = loadYamlText();

  for (const [field, value] of Object.entries(body.changes)) {
    validateField(field);
    text = updateFieldInYamlText(text, body.id, field, value ?? '');
  }

  saveYamlText(text);
  return { status: 'ok', id: body.id };
}

/** POST /api/customize/batch — apply multiple changes at once */
export function handleBatchUpdate(body: {
  changes: Array<{ id: string; field: string; value: string }>;
}): { status: string; updated: number } {
  let text = loadYamlText();
  let updated = 0;

  for (const change of body.changes) {
    try {
      validateField(change.field);
      text = updateFieldInYamlText(text, change.id, change.field, change.value);
      updated++;
    } catch (err) {
      console.error(`Failed to update ${change.id}:${change.field}:`, err);
    }
  }

  saveYamlText(text);
  return { status: 'ok', updated };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** POST /api/customize/reload — reload YAML from disk (no-op, client refresh) */
export function handleReload(): { status: string; message: string } {
  return { status: 'ok', message: 'YAML reloaded from disk' };
}
