import { describe, it, expect, beforeAll } from 'vitest'
import { initCrypto } from '../crypto'
import { serializeToFile, deserializeFromFile, parseHeader, createHeader } from '../schema'
import type { KeyaDatabase } from '../types'
import { createEmptyDatabase, Database } from '../database'

describe('schema (.keya file format)', () => {
  const password = 'vault-master-password'

  beforeAll(async () => {
    await initCrypto()
  })

  function makeTestDb(overrides?: Partial<KeyaDatabase>): KeyaDatabase {
    const base = createEmptyDatabase()
    // Add some keys for realism
    const db = new Database(base)
    db.addApiKey({
      name: 'OpenAI Testing',
      key: 'sk-proj-abc123def456',
      description: 'GPT-4 key',
      provider: 'OpenAI',
      service: 'ChatGPT',
      endpoint: 'https://api.openai.com/v1',
      group_id: base.groups[0]?.id ?? null,
      notes: '',
      last_tested: null,
      test_status: null,
      test_latency_ms: null,
      status: 'active',
    })
    db.addApiKey({
      name: 'Anthropic Production',
      key: 'sk-ant-api03-xyz789',
      description: 'Claude 4 Sonnet',
      provider: 'Anthropic',
      service: 'Claude',
      endpoint: 'https://api.anthropic.com',
      group_id: base.groups[0]?.id ?? null,
      notes: 'Main production key',
      last_tested: null,
      test_status: null,
      test_latency_ms: null,
      status: 'active',
    })
    return { ...db.getData(), ...overrides } as KeyaDatabase
  }

  it('serializes and deserializes a complete database', async () => {
    const db = makeTestDb()
    const bytes = await serializeToFile(db, password)
    const restored = await deserializeFromFile(bytes, password)

    expect(restored.version).toBe(db.version)
    expect(restored.vault_id).toBe(db.vault_id)
    expect(restored.api_keys).toHaveLength(db.api_keys.length)
    expect(restored.api_keys[0].name).toBe(db.api_keys[0].name)
    expect(restored.api_keys[0].key).toBe(db.api_keys[0].key)
    expect(restored.api_keys[1].key).toBe(db.api_keys[1].key)
    expect(restored.groups).toHaveLength(db.groups.length)
    // updated_at is set from header.modified, accept close timestamps
    expect(Math.abs(new Date(restored.updated_at).getTime() - new Date(db.updated_at).getTime())).toBeLessThan(5000)
  })

  it('throws on wrong password', async () => {
    const db = makeTestDb()
    const bytes = await serializeToFile(db, password)
    await expect(deserializeFromFile(bytes, 'wrong-password')).rejects.toThrow(
      'wrong secret key for the given ciphertext',
    )
  })

  it('throws on bad magic bytes (not a .keya file)', async () => {
    const bytes = new Uint8Array(256).fill(0x00)
    // Write something non-"KEYA" at start
    bytes.set(new TextEncoder().encode('NOPE'), 0)
    // HMAC check runs first — caught as integrity failure
    await expect(deserializeFromFile(bytes, password)).rejects.toThrow(
      'File integrity check failed',
    )
  })

  it('throws on truncated file', async () => {
    const db = makeTestDb()
    const full = await serializeToFile(db, password)
    const truncated = full.slice(0, 100)
    await expect(deserializeFromFile(truncated, password)).rejects.toThrow()
  })

  it('creates valid header', () => {
    const created = new Date('2026-01-15T12:00:00Z')
    const header = createHeader('550e8400-e29b-41d4-a716-446655440000', created)
    expect(header).toHaveLength(128)
    const meta = parseHeader(header)
    expect(meta.version).toBe(1)
    expect(meta.flags).toBe(0)
    expect(meta.fileId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(meta.created.toISOString()).toBe('2026-01-15T12:00:00.000Z')
  })

  it('serialized file does not contain plaintext keys', async () => {
    const db = makeTestDb()
    const bytes = await serializeToFile(db, password)
    const asText = new TextDecoder().decode(bytes)
    // The actual key values should NOT appear in plaintext
    expect(asText).not.toContain('sk-proj-abc123def456')
    expect(asText).not.toContain('sk-ant-api03-xyz789')
    // But the magic header should be visible
    expect(asText.slice(0, 4)).toBe('KEYA')
  })

  it('reads old files with file_id instead of vault_id', async () => {
    const db = makeTestDb()
    // Simulate old format by using file_id key
    const oldFormat = { ...db, file_id: db.vault_id } as any
    delete oldFormat.vault_id
    const bytes = await serializeToFile(oldFormat as KeyaDatabase, password)
    const restored = await deserializeFromFile(bytes, password)
    expect(restored.vault_id).toBe(db.vault_id)
    expect(restored.name).toBe('')
    expect(restored.icon).toBe('🔐')
  })
})
