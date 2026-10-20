import { describe, expect, it } from 'vitest';
import { loadZxcvbn } from '../zxcvbn';

describe('loadZxcvbn', () => {
  it('loads once and reuses the same promise', () => {
    const first = loadZxcvbn();
    const second = loadZxcvbn();
    expect(second).toBe(first);
  });

  it('returns an estimator that scores a weak password below the threshold', async () => {
    const estimate = await loadZxcvbn();
    expect(typeof estimate).toBe('function');
    const weak = await estimate('password123');
    expect(weak.score).toBeLessThan(2);
  });

  it('scores a long random password high enough to accept', async () => {
    const estimate = await loadZxcvbn();
    const strong = await estimate('7k#Qm2vX!pL9zR4tW8nB');
    expect(strong.score).toBeGreaterThanOrEqual(2);
  });
});
