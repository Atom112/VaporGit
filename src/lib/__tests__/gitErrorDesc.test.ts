import { describe, expect, it } from 'vitest';
import { describeError } from '../gitErrorDesc';

describe('describeError', () => {
  it('annotates HTTP status errors with a friendly status prefix', () => {
    expect(describeError('HTTP 404: not found')).toContain('HTTP 404');
  });

  it('recognizes network failures', () => {
    expect(describeError('connection refused')).not.toBe('connection refused');
  });

  it('falls back to the original message when no pattern matches', () => {
    expect(describeError('custom failure')).toBe('custom failure');
  });
});
