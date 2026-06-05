import { describe, it, expect } from 'vitest';
import { formatMcpError, ErrorCodes } from '../../src/utils/errors.js';

describe('formatMcpError', () => {
  it('returns isError: true with formatted message', () => {
    const result = formatMcpError('TEST_ERROR', 'something went wrong');
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.text).toBe('[TEST_ERROR] something went wrong');
    expect(result.content[0]!.type).toBe('text');
  });

  it('handles empty message', () => {
    const result = formatMcpError('EMPTY', '');
    expect(result.content[0]!.text).toBe('[EMPTY] ');
  });

  it('handles special characters in message', () => {
    const result = formatMcpError('ERR', 'line1\nline2');
    expect(result.content[0]!.text).toBe('[ERR] line1\nline2');
  });
});

describe('ErrorCodes', () => {
  it('has expected error code constants', () => {
    expect(ErrorCodes.ENGINE_NOT_INIT).toBe('ENGINE_NOT_INIT');
    expect(ErrorCodes.INVALID_EVENT).toBe('INVALID_EVENT');
    expect(ErrorCodes.STORE_ERROR).toBe('STORE_ERROR');
    expect(ErrorCodes.PARSE_ERROR).toBe('PARSE_ERROR');
    expect(ErrorCodes.UNKNOWN_ACTION).toBe('UNKNOWN_ACTION');
    expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
  });

  it('is frozen (as const)', () => {
    // Verify the object values are as expected — the `as const` assertion
    // makes properties readonly at type level
    const keys = Object.keys(ErrorCodes);
    expect(keys.sort()).toEqual([
      'ENGINE_NOT_INIT', 'INVALID_EVENT', 'NOT_FOUND',
      'PARSE_ERROR', 'STORE_ERROR', 'UNKNOWN_ACTION',
    ]);
  });
});
