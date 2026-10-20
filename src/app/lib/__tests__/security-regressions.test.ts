import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, hasSession, loadSession, saveSession } from '../session';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
});

describe('session secret removal', () => {
  it('never persists a password', async () => {
    await saveSession('test.keya', 'test-only-password', 'public-id');
    expect(memory.size).toBe(0);
    expect(await loadSession()).toBeNull();
  });
  it('purges legacy recoverable records', () => {
    memory.set(
      'keya-session',
      JSON.stringify({ vid: 'public-id', ep: 'ciphertext', n: 'nonce' })
    );
    expect(hasSession()).toBe(false);
    expect(memory.size).toBe(0);
    clearSession();
  });
});
