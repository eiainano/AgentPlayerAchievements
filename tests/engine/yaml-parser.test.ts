import { describe, it, expect } from 'vitest';
import { parseYAML } from '../../src/engine/yaml-parser.js';

describe('parseYAML', () => {
  it('parses a minimal achievement', () => {
    const yaml = `definitions:
  - id: test-1
    name: Test Achievement
    description: A test
    icon: 🧪
    category: testing
    rarity: common
    conditions: []`;
    const result = parseYAML(yaml);
    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]!.id).toBe('test-1');
    expect(result.definitions[0]!.name).toBe('Test Achievement');
    expect(result.definitions[0]!.icon).toBe('🧪');
    expect(result.definitions[0]!.rarity).toBe('common');
  });

  it('parses conditions correctly', () => {
    const yaml = `definitions:
  - id: cond-test
    name: Condition Test
    description: Test conditions
    icon: ✅
    category: testing
    rarity: common
    conditions:
      - type: counter
        event: test.event
        value: 5
        operator: ">="
      - type: event
        event: other.event
        value: 1`;
    const result = parseYAML(yaml);
    expect(result.definitions).toHaveLength(1);
    const def = result.definitions[0]!;
    expect(def.conditions).toHaveLength(2);
    expect(def.conditions[0]!.type).toBe('counter');
    expect(def.conditions[0]!.event).toBe('test.event');
    expect(def.conditions[0]!.value).toBe(5);
    expect(def.conditions[1]!.type).toBe('event');
  });

  it('handles hidden and progress_trackable', () => {
    const yaml = `definitions:
  - id: hidden-test
    name: Hidden Achievement
    description: You should not see this
    icon: 👻
    category: hidden
    rarity: rare
    hidden: true
    progress_trackable: true
    conditions: []`;
    const result = parseYAML(yaml);
    expect(result.definitions[0]!.hidden).toBe(true);
    expect(result.definitions[0]!.progress_trackable).toBe(true);
  });

  it('handles Chinese name and description', () => {
    const yaml = `definitions:
  - id: zh-test
    name: Chinese Test
    name_cn: 中文测试
    description: English desc
    description_cn: 中文描述
    icon: 🌏
    category: testing
    rarity: epic
    conditions: []`;
    const result = parseYAML(yaml);
    const def = result.definitions[0]!;
    expect(def.name_cn).toBe('中文测试');
    expect(def.description_cn).toBe('中文描述');
  });

  it('throws for empty definitions', () => {
    expect(() => parseYAML('definitions:')).toThrow();
  });

  it('skips comments and blank lines', () => {
    const yaml = `# This is a comment
definitions:
  - id: skip-comment
    name: No Comment
    description: Skips comments properly
    icon: 💬
    category: testing
    rarity: common
    conditions: []

# Another comment
`;
    const result = parseYAML(yaml);
    expect(result.definitions).toHaveLength(1);
  });
});
