#!/usr/bin/env -S npx tsx
/**
 * Translate achievement names & descriptions to ES / KO / JA.
 *
 * Reads achievement-definitions.yaml, sends batches to an LLM, and writes
 * back the YAML with newly populated name_es/ko/ja and description_es/ko/ja fields.
 *
 * Usage:
 *   npx tsx scripts/translate-achievements.ts
 *   DRY_RUN=1 npx tsx scripts/translate-achievements.ts   # preview only
 *   BATCH=20 npx tsx scripts/translate-achievements.ts     # control batch size
 *   PROVIDER=openai npx tsx scripts/translate-achievements.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const YAML_PATH = path.join(ROOT, 'achievement-definitions.yaml');
const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_SIZE = Math.min(Number(process.env.BATCH) || 15, 30);
const PROVIDER = (process.env.PROVIDER || 'anthropic') as 'anthropic' | 'openai';

interface AchievementRaw {
  id: string;
  name: string;
  name_cn?: string;
  description: string;
  description_cn?: string;
  [key: string]: unknown;
}

interface TranslationEntry {
  id: string;
  name_es: string;
  name_ko: string;
  name_ja: string;
  description_es: string;
  description_ko: string;
  description_ja: string;
}

// ── 1. Parse YAML manually (avoid heavy deps — just regex to extract blocks) ──
// We use a simple line-by-line parser that understands YAML indent structure.

function parseYamlBlocks(filePath: string): AchievementRaw[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');

  // Find the definitions array
  const defsStart = lines.findIndex(l => l.trim() === 'definitions:');
  if (defsStart === -1) throw new Error('No definitions: section found');

  // Find end of definitions (next top-level key at column 0)
  let defsEnd = lines.length;
  for (let i = defsStart + 1; i < lines.length; i++) {
    if (i > defsStart + 1 && /^[a-z]/.test(lines[i]) && !lines[i].startsWith(' ')) {
      defsEnd = i;
      break;
    }
  }

  const defLines = lines.slice(defsStart, defsEnd);

  // Parse each achievement block (starts with "- id:")
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inBlock = false;

  for (const line of defLines) {
    if (line.trimStart().startsWith('- id:')) {
      if (inBlock && currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
      }
      currentBlock = [line];
      inBlock = true;
    } else if (inBlock) {
      currentBlock.push(line);
    }
  }
  if (inBlock && currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks.map(block => parseBlock(block));
}

function parseBlock(block: string): AchievementRaw {
  const lines = block.split('\n');
  const result: Record<string, unknown> = {};
  let indent = 0;

  // Determine indent from first content line
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    indent = line.length - trimmed.length;
    break;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Simple key: value or key: "value"
    const match = trimmed.match(/^(- )?([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)/);
    if (match) {
      const key = match[2]!;
      let val = (match[3] || '').trim();
      // Remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Skip nested structures (conditions, etc.)
      if (!['conditions', 'pixel_art', 'icon'].includes(key)) {
        result[key] = val || undefined;
      }
    }
  }

  return result as unknown as AchievementRaw;
}

// ── 2. Gather achievements that still need translation ──

function loadExisting(): Map<string, AchievementRaw> {
  try {
    const blocks = parseYamlBlocks(YAML_PATH);
    const map = new Map<string, AchievementRaw>();
    for (const b of blocks) {
      if (b.id) map.set(b.id, b);
    }
    return map;
  } catch {
    return new Map();
  }
}

function needsTranslation(a: AchievementRaw): boolean {
  return !a.description_es || !a.description_ko || !a.description_ja;
}

// ── 3. Build translation prompt batch ──

function buildBatchPrompt(batch: AchievementRaw[]): string {
  const items = batch.map((a, i) => {
    return `[${i + 1}] id: ${a.id}
  name (EN): ${a.name}
  name (ZH): ${a.name_cn || '(same as EN)'}
  description (EN): ${a.description}
  description (ZH): ${a.description_cn || '(none)'}`;
  }).join('\n---\n');

  return `Translate the following ${batch.length} achievements from English into Spanish (es), Korean (ko), and Japanese (ja).

For each achievement, translate BOTH the name and the description.
- name: Keep it concise (1–6 words), capture the pop-culture/Steam-style vibe where applicable
- description: Natural, idiomatic, match the tone (motivational/technical/playful)
- If the achievement has a Chinese name (ZH), use it as a reference for intent but still produce the full translation in all 3 languages
- Avoid literal word-for-word — localize the cultural references when they don't make sense in the target language

Achievements to translate:

${items}

Respond with a JSON array where each element has: { "id", "name_es", "name_ko", "name_ja", "description_es", "description_ko", "description_ja" }`;
}

// ── 4. LLM API call ──

async function callAnthropic(prompt: string): Promise<TranslationEntry[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const model = process.env.MODEL || 'claude-sonnet-4-6';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: 'You are a professional translator specializing in game/software UI localization. Translate names and descriptions with cultural adaptation, not literal word-for-word. Return ONLY valid JSON matching the requested schema — no additional text, no markdown fences.',
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'translate_batch',
        description: `Translate the batch of achievements to ES/KO/JA`,
        input_schema: {
          type: 'object',
          properties: {
            translations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name_es: { type: 'string' },
                  name_ko: { type: 'string' },
                  name_ja: { type: 'string' },
                  description_es: { type: 'string' },
                  description_ko: { type: 'string' },
                  description_ja: { type: 'string' },
                },
                required: ['id', 'name_es', 'name_ko', 'name_ja', 'description_es', 'description_ko', 'description_ja'],
              },
            },
          },
          required: ['translations'],
        },
      }],
      tool_choice: { type: 'tool', name: 'translate_batch' },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; name?: string; input?: { translations: TranslationEntry[] } }>;
  };

  const toolUse = data.content?.find(c => c.type === 'tool_use' && c.name === 'translate_batch');
  if (!toolUse?.input?.translations) {
    throw new Error('Anthropic: no translate_batch tool_use in response');
  }

  return toolUse.input.translations;
}

async function callOpenAI(prompt: string): Promise<TranslationEntry[]> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.MODEL || 'gpt-4o';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator specializing in game/software UI localization. Translate names and descriptions with cultural adaptation. Return valid JSON with a `translations` array.',
        },
        {
          role: 'user',
          content: `${prompt}\n\nRespond with JSON: { "translations": [{ "id": "...", "name_es": "...", "name_ko": "...", "name_ja": "...", "description_es": "...", "description_ko": "...", "description_ja": "..." }] }`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: empty response content');

  const parsed = JSON.parse(content) as { translations: TranslationEntry[] };
  return parsed.translations;
}

// ── 5. Apply translations back to YAML ──

function applyTranslations(yamlText: string, translations: TranslationEntry[]): string {
  let result = yamlText;

  for (const t of translations) {
    // Find the block for this achievement
    const blockRegex = new RegExp(`( {2}id: ${escapeRegex(t.id)}\\n(?:.*\\n)*?)(?=\\n {2}(?:- |[a-z]|$)|\n[a-z]|$)`, 'm');
    const blockMatch = result.match(blockRegex);
    if (!blockMatch) {
      console.warn(`⚠️  Cannot find block for "${t.id}" — skipping`);
      continue;
    }

    const block = blockMatch[1]!;

    // For each language field, insert after the existing field or after description_cn
    const fields: Array<{ key: string; value: string; afterKey: string }> = [
      { key: 'name_es', value: t.name_es, afterKey: 'name_cn' },
      { key: 'name_ko', value: t.name_ko, afterKey: 'name_es' },
      { key: 'name_ja', value: t.name_ja, afterKey: 'name_ko' },
      { key: 'description_es', value: t.description_es, afterKey: 'description_cn' },
      { key: 'description_ko', value: t.description_ko, afterKey: 'description_es' },
      { key: 'description_ja', value: t.description_ja, afterKey: 'description_ko' },
    ];

    let updatedBlock = block;

    for (const f of fields) {
      // Check if field already exists
      const existingRegex = new RegExp(`^( {2})${escapeRegex(f.key)}: .*`, 'm');
      if (existingRegex.test(updatedBlock)) {
        // Update existing
        updatedBlock = updatedBlock.replace(existingRegex, `$1${f.key}: ${escapeYaml(f.value)}`);
      } else {
        // Insert after the afterKey field
        const afterRegex = new RegExp(`^( {2}${escapeRegex(f.afterKey)}: .*)$`, 'm');
        const afterMatch = updatedBlock.match(afterRegex);
        if (afterMatch) {
          const line = afterMatch[1]!;
          const insertLine = `\n    ${f.key}: ${escapeYaml(f.value)}`;
          updatedBlock = updatedBlock.replace(line, line + insertLine);
        } else {
          // Fallback: find the description field and insert after it
          const descMatch = updatedBlock.match(/^( {2}description: .*)$/m);
          if (descMatch) {
            const line = descMatch[1]!;
            const insertLine = `\n    ${f.key}: ${escapeYaml(f.value)}`;
            updatedBlock = updatedBlock.replace(line, line + insertLine);
          }
        }
      }
    }

    result = result.replace(block, updatedBlock);
  }

  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeYaml(s: string): string {
  if (/[:\n#{}[\],&*?!|>`'"%@`]/.test(s) || s.startsWith(' ') || s.endsWith(' ') || s === '' || /^\d/.test(s)) {
    return `"${s.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return s;
}

// ── 6. Main ──

async function main(): Promise<number> {
  console.log('📖 Reading YAML...');
  const yamlText = fs.readFileSync(YAML_PATH, 'utf-8');
  const allAchievements = parseYamlBlocks(YAML_PATH);

  const toTranslate = allAchievements.filter(needsTranslation);
  console.log(`📊 ${allAchievements.length} total achievements, ${toTranslate.length} need translation`);

  if (toTranslate.length === 0) {
    console.log('✅ All achievements already have ES/KO/JA translations.');
    return 0;
  }

  // Check API key
  const apiKey = PROVIDER === 'anthropic'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(`❌ No ${PROVIDER === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} set.`);
    return 1;
  }

  // Batch
  const batches: AchievementRaw[][] = [];
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    batches.push(toTranslate.slice(i, i + BATCH_SIZE));
  }

  console.log(`🔤 Provider: ${PROVIDER}, Batch size: ${BATCH_SIZE}, ${batches.length} batches`);

  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN — showing first batch prompt:\n`);
    console.log(buildBatchPrompt(batches[0]!));
    console.log(`\n📝 Would process ${toTranslate.length} achievements across ${batches.length} batches.`);
    return 0;
  }

  let updatedYaml = yamlText;
  let totalTranslated = 0;

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]!;
    const ids = batch.map(a => a.id).join(', ');
    console.log(`\n🔄 Batch ${b + 1}/${batches.length} (${batch.length} achievements): ${ids.slice(0, 80)}...`);

    try {
      const prompt = buildBatchPrompt(batch);
      const translations = PROVIDER === 'anthropic'
        ? await callAnthropic(prompt)
        : await callOpenAI(prompt);

      if (translations.length !== batch.length) {
        console.warn(`⚠️  Expected ${batch.length} translations, got ${translations.length}`);
      }

      updatedYaml = applyTranslations(updatedYaml, translations);
      totalTranslated += translations.length;

      // Write after each batch for safety
      fs.writeFileSync(YAML_PATH, updatedYaml, 'utf-8');
      console.log(`✅ Batch ${b + 1} done — wrote ${translations.length} translations. Total: ${totalTranslated}`);

    } catch (err) {
      console.error(`❌ Batch ${b + 1} failed:`, err instanceof Error ? err.message : err);
      // Continue with next batch
    }
  }

  // Finally, verify TSC passes
  console.log(`\n🎉 Done! Translated ${totalTranslated}/${toTranslate.length} achievements.`);
  console.log('📝 Run `npx tsc --noEmit` to verify types.');

  return 0;
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
