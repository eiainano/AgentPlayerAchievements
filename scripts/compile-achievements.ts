/**
 * Compile YAML achievement definitions → JSON snapshot for Claude command files.
 * Run: npx tsx scripts/compile-achievements.ts [--state-dir <path>|--profile <name>]
 *
 * Claude can't parse YAML directly, so we pre-compile to JSON stored in stateDir.
 * The /achievements command reads this JSON to know achievement metadata.
 *
 * Options:
 *   --state-dir <path>   Write to an explicit directory
 *   --profile <name>     Write to a named profile's state directory
 *   (Default: default profile ~/.agent-achievements/)
 */
import * as fs from 'fs';
import { resolveProfileDir } from '../src/utils/profile.js';
import { parseYAML } from '../src/engine/yaml-parser.js';

let stateDir: string;
if (process.argv.includes('--profile')) {
  const name = process.argv[process.argv.indexOf('--profile') + 1]!;
  stateDir = resolveProfileDir(name);
} else if (process.argv.includes('--state-dir')) {
  stateDir = process.argv[process.argv.indexOf('--state-dir') + 1]!;
} else {
  stateDir = resolveProfileDir('default');
}

const yamlPath = 'achievement-definitions.yaml';

if (!fs.existsSync(yamlPath)) {
  console.error(`❌ YAML file not found: ${yamlPath}`);
  console.error('   Run this script from the AGPA project root.');
  process.exit(1);
}

const yamlText = fs.readFileSync(yamlPath, 'utf8');
const { definitions, sets } = parseYAML(yamlText);

if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}

// Write achievement definitions
const outPath = `${stateDir}/achievements.json`;
const output = {
  total: definitions.length,
  by_category: {} as Record<string, number>,
  by_rarity: {} as Record<string, number>,
  by_set: {} as Record<string, string[]>,
  categories: {} as Record<string, { name: string; name_cn?: string; order: number }>,
  sets: sets.map(s => ({ id: s.id, name: s.name, name_cn: s.name_cn, achievements: s.achievements })),
  achievements: definitions.map(d => ({
    id: d.id,
    name: d.name,
    name_cn: d.name_cn,
    description: d.description,
    description_cn: d.description_cn,
    icon: d.icon,
    category: d.category,
    rarity: d.rarity,
    hidden: d.hidden,
    set_id: d.set_id,
    tip: d.tip,
    tip_cn: d.tip_cn,
    hint: d.hint,
    hint_cn: d.hint_cn,
    future: d.future,
    challenge: d.challenge,
    progress_trackable: d.progress_trackable,
  })),
};

// Build category map
for (const d of definitions) {
  output.by_category[d.category] = (output.by_category[d.category] || 0) + 1;
  output.by_rarity[d.rarity] = (output.by_rarity[d.rarity] || 0) + 1;
  if (d.set_id) {
    output.by_set[d.set_id] = output.by_set[d.set_id] || [];
    output.by_set[d.set_id]!.push(d.id);
  }
}

// Category metadata (derived from YAML categories)
const CATEGORY_META: Record<string, { name: string; name_cn: string; order: number }> = {
  onboarding: { name: 'Getting Started', name_cn: '入门', order: 1 },
  tool_mastery: { name: 'Tool Mastery', name_cn: '工具精通', order: 2 },
  workflow: { name: 'Workflow', name_cn: '工作流', order: 3 },
  milestones: { name: 'Milestones', name_cn: '里程碑', order: 4 },
  skill: { name: 'Skills', name_cn: '技能', order: 5 },
  creator: { name: 'Creator', name_cn: '创造者', order: 6 },
  challenge: { name: 'Challenge', name_cn: '挑战', order: 7 },
  hidden: { name: 'Hidden', name_cn: '隐藏', order: 8 },
  style: { name: 'Style', name_cn: '风格', order: 9 },
  community: { name: 'Community', name_cn: '社区', order: 10 },
};
output.categories = {};
for (const cat of Object.keys(output.by_category)) {
  const meta = CATEGORY_META[cat];
  output.categories[cat] = meta ? { ...meta } : { name: cat, order: 99 };
}

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`✅ Compiled ${definitions.length} achievements → ${outPath}`);
console.log(`   Categories: ${Object.keys(output.by_category).length} | Sets: ${sets.length} | State dir: ${stateDir}`);
