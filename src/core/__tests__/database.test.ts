import { describe, it, expect } from 'vitest'
import { Database, createEmptyDatabase } from '../database'
import type { ApiKey, Group } from '../types'

const sampleGroup: Omit<Group, 'id'> = { name: 'Production', icon: '🚀', order: 1 }

function makeKey(overrides?: Partial<Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>>): Omit<ApiKey, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: 'Test Key',
    key: 'sk-test123',
    description: 'A test key',
    provider: 'OpenAI',
    service: 'ChatGPT',
    endpoint: 'https://api.openai.com/v1',
    status: 'active',
    group_id: null,
    notes: '',
    last_tested: null,
    test_status: null,
    test_latency_ms: null,
    ...overrides,
  }
}

describe('Database', () => {
  /* ──── Initialization ──── */

  it('creates empty database with defaults', () => {
    const db = new Database()
    const data = db.getData()
    expect(data.version).toBe('1.0')
    expect(data.vault_id).toBeTruthy()
    expect(data.name).toBe('')
    expect(data.icon).toBe('')
    expect(data.color).toBe('#3b82f6')
    expect(data.api_keys).toEqual([])
    expect(data.groups.length).toBeGreaterThanOrEqual(3)
    expect(data.settings.theme).toBe('system')
  })

  it('accepts existing data', () => {
    const existing = createEmptyDatabase()
    const db = new Database(existing)
    expect(db.getData().vault_id).toBe(existing.vault_id)
  })

  /* ──── API Keys CRUD ──── */

  it('adds and retrieves an API key', () => {
    const db = new Database()
    const key = db.addApiKey(makeKey({ name: 'OpenAI Key' }))

    expect(key.id).toBeTruthy()
    expect(key.name).toBe('OpenAI Key')
    expect(key.created_at).toBeTruthy()

    const all = db.getApiKeys()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('OpenAI Key')
  })

  it('adds multiple keys', () => {
    const db = new Database()
    db.addApiKey(makeKey({ name: 'Key A' }))
    db.addApiKey(makeKey({ name: 'Key B' }))
    db.addApiKey(makeKey({ name: 'Key C' }))
    expect(db.getApiKeys()).toHaveLength(3)
  })

  it('gets a key by ID', () => {
    const db = new Database()
    const created = db.addApiKey(makeKey({ name: 'Target' }))
    expect(db.getApiKey(created.id)).toBeTruthy()
    expect(db.getApiKey('non-existent-id')).toBeUndefined()
  })

  it('updates a key', () => {
    const db = new Database()
    const created = db.addApiKey(makeKey({ name: 'Original' }))
    const updated = db.updateApiKey(created.id, { name: 'Updated', key: 'sk-new' })
    expect(updated?.name).toBe('Updated')
    expect(updated?.key).toBe('sk-new')
    expect(db.getApiKey(created.id)?.name).toBe('Updated')
  })

  it('does not change key ID on update', () => {
    const db = new Database()
    const created = db.addApiKey(makeKey())
    db.updateApiKey(created.id, { name: 'Changed' })
    expect(db.getApiKey(created.id)?.id).toBe(created.id)
  })

  it('returns null when updating non-existent key', () => {
    const db = new Database()
    expect(db.updateApiKey('nope', { name: 'X' })).toBeNull()
  })

  it('deletes a key', () => {
    const db = new Database()
    const created = db.addApiKey(makeKey())
    expect(db.getApiKeys()).toHaveLength(1)
    expect(db.deleteApiKey(created.id)).toBe(true)
    expect(db.getApiKeys()).toHaveLength(0)
  })

  it('returns false on delete of non-existent key', () => {
    const db = new Database()
    expect(db.deleteApiKey('nope')).toBe(false)
  })

  it('bumps updated_at on mutations', async () => {
    const db = new Database()
    const initial = db.getData().updated_at
    await new Promise((r) => setTimeout(r, 10))
    const created = db.addApiKey(makeKey())
    expect(new Date(db.getData().updated_at).getTime()).toBeGreaterThan(new Date(initial).getTime())
    const afterAdd = db.getData().updated_at
    await new Promise((r) => setTimeout(r, 10))
    db.updateApiKey(created.id, { name: 'X' })
    expect(new Date(db.getData().updated_at).getTime()).toBeGreaterThan(new Date(afterAdd).getTime())
    const afterUpdate = db.getData().updated_at
    await new Promise((r) => setTimeout(r, 10))
    db.deleteApiKey(created.id)
    expect(new Date(db.getData().updated_at).getTime()).toBeGreaterThan(new Date(afterUpdate).getTime())
  })

  /* ──── Search ──── */

  it('searches keys by name', () => {
    const db = new Database()
    db.addApiKey(makeKey({ name: 'Production OpenAI', provider: 'OpenAI' }))
    db.addApiKey(makeKey({ name: 'Staging Anthropic', provider: 'Anthropic' }))
    db.addApiKey(makeKey({ name: 'Dev Groq', provider: 'Groq' }))
    expect(db.searchKeys('openai')).toHaveLength(1)
    expect(db.searchKeys('anthropic')).toHaveLength(1)
    expect(db.searchKeys('production')).toHaveLength(1)
    expect(db.searchKeys('nonexistent')).toHaveLength(0)
  })

  it('searches by description and provider', () => {
    const db = new Database()
    db.addApiKey(makeKey({ name: 'K1', description: 'Main key for production', provider: 'OpenAI' }))
    db.addApiKey(makeKey({ name: 'K2', description: 'Backup key', provider: 'Anthropic' }))
    expect(db.searchKeys('production')).toHaveLength(1)
    expect(db.searchKeys('backup')).toHaveLength(1)
    expect(db.searchKeys('openai')).toHaveLength(1)
  })

  it('search is case-insensitive', () => {
    const db = new Database()
    db.addApiKey(makeKey({ name: 'OpenAI Key' }))
    expect(db.searchKeys('openai')).toHaveLength(1)
    expect(db.searchKeys('OPENAI')).toHaveLength(1)
    expect(db.searchKeys('OpenAi')).toHaveLength(1)
  })

  /* ──── Groups ──── */

  it('adds and retrieves groups', () => {
    const db = new Database()
    const count = db.getGroups().length
    const group = db.addGroup(sampleGroup)
    expect(group.id).toBeTruthy()
    expect(db.getGroups()).toHaveLength(count + 1)
  })

  it('updates a group', () => {
    const db = new Database()
    const group = db.addGroup(sampleGroup)
    db.updateGroup(group.id, { name: 'Renamed' })
    const groups = db.getGroups()
    const renamed = groups.find((g) => g.id === group.id)
    expect(renamed?.name).toBe('Renamed')
  })

  it('deletes a group and unassigns keys', () => {
    const db = new Database()
    const group = db.addGroup(sampleGroup)
    const key = db.addApiKey(makeKey({ group_id: group.id }))
    db.deleteGroup(group.id)
    expect(db.getGroups().find((g) => g.id === group.id)).toBeUndefined()
    expect(db.getApiKey(key.id)?.group_id).toBeNull()
  })

  /* ──── Settings ──── */

  it('gets and updates settings', () => {
    const db = new Database()
    expect(db.getSettings().theme).toBe('system')
    db.updateSettings({ theme: 'dark', auto_lock_minutes: 10 })
    expect(db.getSettings().theme).toBe('dark')
    expect(db.getSettings().auto_lock_minutes).toBe(10)
  })
})
