import { describe, expect, it } from 'vitest';
import { describeAge } from '../presentation';

const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('describeAge', () => {
  it('reads a fresh timestamp as "just now"', () => {
    expect(describeAge('2026-03-01T11:59:40.000Z', NOW)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(describeAge('2026-03-01T11:57:00.000Z', NOW)).toBe('3 minutes ago');
    expect(describeAge('2026-03-01T09:00:00.000Z', NOW)).toBe('3 hours ago');
    expect(describeAge('2026-02-27T12:00:00.000Z', NOW)).toBe('2 days ago');
  });

  it('coarsens weeks and months instead of counting days forever', () => {
    expect(describeAge('2026-02-15T12:00:00.000Z', NOW)).toBe('2 weeks ago');
    expect(describeAge('2025-12-01T12:00:00.000Z', NOW)).toBe('3 months ago');
  });

  it('says so when the timestamp cannot be read', () => {
    expect(describeAge('not a timestamp', NOW)).toBe('at an unknown time');
  });
});
