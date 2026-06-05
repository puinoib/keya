import { describe, it, expect, beforeAll } from 'vitest';
import { initCrypto } from '../crypto';
import {
  serializeToFile,
  deserializeFromFile,
  parseHeader,
  createHeader,
} from '../schema';
import type { KeyaDatabase } from '../types';
import { createEmptyDatabase, Database } from '../database';

describe('schema (.keya file format)', () => {
  const password = 'vault-master-password';

  beforeAll(async () => {
    await initCrypto();
  });

  function makeTestDb(overrides?: Partial<KeyaDatabase>): KeyaDatabase {
    const base = createEmptyDatabase();
    const db = new Database(base);
    db.addApiKey({
      name: 'OpenAI Testing',
      key: 'sk-proj-abc123def456',
      description: 'GPT-4 key',
      provider: 'OpenAI',
      endpoint: 'https://api.openai.com/v1',
      group_id: base.groups[0]?.id ?? null,
      expires_at: null,
      connection_check: {
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
      },
    });
    db.addApiKey({
      name: 'Anthropic Production',
      key: 'sk-ant-api03-xyz789',
      description: 'Claude 4 Sonnet',
      provider: 'Anthropic',
      endpoint: 'https://api.anthropic.com',
      group_id: base.groups[0]?.id ?? null,
      expires_at: null,
      connection_check: {
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
      },
    });
    return { ...db.getData(), ...overrides } as KeyaDatabase;
  }

  it('serializes and deserializes a complete database', async () => {
    const db = makeTestDb();
    const bytes = await serializeToFile(db, password);
    const restored = await deserializeFromFile(bytes, password);

    expect(restored.vault_id).toBe(db.vault_id);
    expect(restored.api_keys).toHaveLength(db.api_keys.length);
    expect(restored.api_keys[0].name).toBe(db.api_keys[0].name);
    expect(restored.api_keys[0].key).toBe(db.api_keys[0].key);
    expect(restored.api_keys[1].key).toBe(db.api_keys[1].key);
    expect(restored.groups).toHaveLength(db.groups.length);
    expect(restored.updated_at).toBe(db.updated_at);
  });

  it('throws on wrong password', async () => {
    const db = makeTestDb();
    const bytes = await serializeToFile(db, password);
    await expect(deserializeFromFile(bytes, 'wrong-password')).rejects.toThrow(
      'ciphertext cannot be decrypted using that key'
    );
  });

  it('throws on bad magic bytes (not a .keya file)', async () => {
    const bytes = new Uint8Array(256).fill(0x00);
    bytes.set(new TextEncoder().encode('NOPE'), 0);
    await expect(deserializeFromFile(bytes, password)).rejects.toThrow(
      'Not a valid .keya file'
    );
  });

  it('throws on truncated file', async () => {
    const db = makeTestDb();
    const full = await serializeToFile(db, password);
    const truncated = full.slice(0, 100);
    await expect(deserializeFromFile(truncated, password)).rejects.toThrow();
  });

  it('creates valid header with masterSeed', () => {
    const created = new Date('2026-01-15T12:00:00Z');
    const modified = new Date('2026-06-05T09:00:00Z');
    const masterSeed = new Uint8Array(32);
    crypto.getRandomValues(masterSeed);
    const header = createHeader(
      '550e8400-e29b-41d4-a716-446655440000',
      masterSeed,
      created,
      modified
    );
    expect(header).toHaveLength(128);
    const meta = parseHeader(header);
    expect(meta.fileId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(meta.masterSeed).toHaveLength(32);
    expect(meta.created.toISOString()).toBe('2026-01-15T12:00:00.000Z');
    expect(meta.modified.toISOString()).toBe('2026-06-05T09:00:00.000Z');
  });

  it('serialized file does not contain plaintext keys', async () => {
    const db = makeTestDb();
    const bytes = await serializeToFile(db, password);
    const asText = new TextDecoder().decode(bytes);
    expect(asText).not.toContain('sk-proj-abc123def456');
    expect(asText).not.toContain('sk-ant-api03-xyz789');
    expect(asText.slice(0, 4)).toBe('KEYA');
  });

  it('includes header hash', async () => {
    const db = makeTestDb();
    const bytes = await serializeToFile(db, password);
    // HeaderHash at offset 128, EncParams at 160
    expect(bytes.length).toBeGreaterThan(128 + 32 + 96);
  });

  it('detects corrupted header', async () => {
    const db = makeTestDb();
    const bytes = await serializeToFile(db, password);

    // Corrupt a byte in the header (not magic, so it passes the magic check)
    bytes[10] ^= 0xff;

    await expect(deserializeFromFile(bytes, password)).rejects.toThrow(
      'Header integrity check failed'
    );
  });
});
