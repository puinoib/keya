import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLegacySession } from '../session';

afterEach(() => vi.unstubAllGlobals());

describe('legacy session secret removal', () => {
  it('removes recoverable credentials without touching unrelated storage', () => {
    const memory = new Map([
      [
        'keya-session',
        JSON.stringify({ vid: 'public-id', ep: 'ciphertext', n: 'nonce' }),
      ],
      ['unrelated', 'keep'],
    ]);
    vi.stubGlobal('sessionStorage', {
      removeItem: (key: string) => memory.delete(key),
    });
    clearLegacySession();
    clearLegacySession();
    expect(memory.has('keya-session')).toBe(false);
    expect(memory.get('unrelated')).toBe('keep');
  });

  it('does not block startup when storage access is denied', () => {
    vi.stubGlobal('sessionStorage', {
      removeItem: () => {
        throw new Error('Storage unavailable');
      },
    });
    expect(clearLegacySession).not.toThrow();
  });
});
