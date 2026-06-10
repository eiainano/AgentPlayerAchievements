import { describe, it, expect } from 'vitest';
import { recommendDiscovery } from '../../src/utils/recommend.js';
import type {
  AchievementDefinition,
  AchievementState,
  TrackedEvent,
} from '../../src/engine/types.js';

function makeEvent(overrides: Partial<TrackedEvent> = {}): TrackedEvent {
  return {
    protocol_version: '1.0',
    event_id: 'evt-test',
    timestamp: new Date().toISOString(),
    tool_source: 'test',
    event_type: 'tool.complete',
    payload: {},
    context: { session_id: 's1', model: 'test' },
    ...overrides,
  };
}

function makeDef(overrides: Partial<AchievementDefinition> = {}): AchievementDefinition {
  return {
    id: 'test_ach',
    name: 'Test Achievement',
    description: 'A test achievement',
    icon: '🧪',
    category: 'test',
    rarity: 'common',
    conditions: [{ type: 'counter', event: 'tool.complete', value: 10 }],
    ...overrides,
  };
}

function makeState(overrides: Partial<AchievementState> = {}): AchievementState {
  return {
    unlocked: {},
    stats: { total_unlocked: 0 },
    ...overrides,
  };
}

describe('recommendDiscovery', () => {
  it('returns achievement whose event type has never been triggered', () => {
    const defs = [
      makeDef({
        id: 'agent_first',
        name: 'Agent First',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        rarity: 'common',
      }),
      makeDef({
        id: 'tool_first',
        name: 'Tool First',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 1 }],
        rarity: 'common',
      }),
    ];
    const events = [makeEvent({ event_type: 'tool.complete' })];

    const result = recommendDiscovery(defs, events, makeState());
    expect(result).not.toBeNull();
    expect(result!.achievement_id).toBe('agent_first');
    expect(result!.category).toBe('discovery');
    expect(result!.discovery_event).toBe('agent.spawn');
  });

  it('returns null when all event types have been triggered', () => {
    const defs = [
      makeDef({
        id: 'tool_first',
        conditions: [{ type: 'counter', event: 'tool.complete', value: 1 }],
      }),
    ];
    const events = [makeEvent({ event_type: 'tool.complete' })];

    const result = recommendDiscovery(defs, events, makeState());
    expect(result).toBeNull();
  });

  it('filters out hidden achievements', () => {
    const defs = [
      makeDef({
        id: 'secret_thing',
        name: 'Secret',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        hidden: true,
      }),
    ];
    const result = recommendDiscovery(defs, [], makeState());
    expect(result).toBeNull();
  });

  it('filters out already-unlocked achievements', () => {
    const defs = [
      makeDef({
        id: 'already_got',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
      }),
    ];
    const state = makeState({ unlocked: { already_got: '2026-01-01T00:00:00Z' } });
    const result = recommendDiscovery(defs, [], state);
    expect(result).toBeNull();
  });

  it('prefers lower rarity (Common before Rare)', () => {
    const defs = [
      makeDef({
        id: 'rare_feature',
        conditions: [{ type: 'counter', event: 'agent.spawn', value: 1 }],
        rarity: 'rare',
      }),
      makeDef({
        id: 'common_feature',
        conditions: [{ type: 'counter', event: 'mcp.connect', value: 1 }],
        rarity: 'common',
      }),
    ];
    const result = recommendDiscovery(defs, [], makeState());
    expect(result).not.toBeNull();
    expect(result!.achievement_id).toBe('common_feature');
  });
});
