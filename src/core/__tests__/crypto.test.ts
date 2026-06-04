import { describe, it, expect } from 'vitest';
import {
  initCrypto,
  encryptDatabase,
  decryptDatabase,
  packEncrypted,
} from '../crypto';

describe('crypto', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  function encrypt(data: string, password: string): Uint8Array {
    return packEncrypted(encryptDatabase(data, password));
  }

  it('encrypts and decrypts a simple string', () => {
    const plaintext = JSON.stringify({ hello: 'world', keys: ['sk-abc123'] });
    const password = 'my-secret-password';

    const encrypted = encrypt(plaintext, password);
    const decrypted = decryptDatabase(encrypted, password);

    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for the same input (random salt+nonce)', () => {
    const plaintext = 'same data';
    const password = 'password';

    const enc1 = encrypt(plaintext, password);
    const enc2 = encrypt(plaintext, password);

    // Different ciphertext due to random salt/nonce
    expect(enc1).not.toEqual(enc2);

    // But both decrypt correctly
    expect(decryptDatabase(enc1, password)).toBe(plaintext);
    expect(decryptDatabase(enc2, password)).toBe(plaintext);
  });

  it('throws on wrong password', () => {
    const encrypted = encrypt('sensitive data', 'correct-password');
    expect(() => decryptDatabase(encrypted, 'wrong-password')).toThrow(
      'wrong secret key for the given ciphertext'
    );
  });

  it('throws on corrupted ciphertext', () => {
    const encrypted = encrypt('data', 'password');
    // Corrupt a byte in the ciphertext portion (after salt+nonce = 40 bytes)
    encrypted[41] ^= 0xff;
    expect(() => decryptDatabase(encrypted, 'password')).toThrow(
      'wrong secret key for the given ciphertext'
    );
  });

  it('handles empty plaintext', () => {
    const encrypted = encrypt('', 'password');
    expect(decryptDatabase(encrypted, 'password')).toBe('');
  });

  it('handles Unicode content', () => {
    const plaintext = JSON.stringify({
      name: '测试用户',
      key: '密钥-中文测试🎉',
    });
    const encrypted = encrypt(plaintext, '密码123');
    expect(decryptDatabase(encrypted, '密码123')).toBe(plaintext);
  });

  it('handles large JSON payload (~10KB)', () => {
    const large = JSON.stringify({
      keys: Array.from({ length: 200 }, (_, i) => ({
        id: i,
        name: `Key ${i}`,
        value: `sk-${'x'.repeat(40)}`,
      })),
    });
    const encrypted = encrypt(large, 'password');
    expect(decryptDatabase(encrypted, 'password')).toBe(large);
  });
});
