import { describe, it, expect } from 'vitest';
import { Database, createEmptyDatabase } from '../database';
import type { Group, NewApiKey } from '../types';

const sampleGroup: Omit<Group, 'id'> = {
  name: 'Production',
  icon: '🚀',
  order: 1,
};

function makeKey(overrides?: Partial<NewApiKey>): NewApiKey {
  return {
    name: 'Test Key',
    key: 'sk-test123',
    description: 'A test key',
    provider: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    group_id: null,
    expires_at: null,
    connection_check: {
      status: 'untested',
      checked_at: null,
      latency_ms: null,
      error_message: null,
    },
    ...overrides,
  };
}

describe('Database', () => {
  /* ──── Initialization ──── */

  it('creates empty database with defaults', () => {
    const db = new Database();
    const data = db.getData();
    expect(data.vault_id).toBeTruthy();
    expect(data.name).toBe('');
    expect(data.icon).toBe('');
    expect(data.api_keys).toEqual([]);
    expect(data.groups.length).toBeGreaterThanOrEqual(2);
    expect(data.settings.auto_lock_minutes).toBe(5);
    expect(data.settings.auto_test_daily).toBe(false);
  });

  it('accepts existing data', () => {
    const existing = createEmptyDatabase();
    const db = new Database(existing);
    expect(db.getData().vault_id).toBe(existing.vault_id);
  });

  /* ──── API Keys CRUD ──── */

  it('adds and retrieves an API key', () => {
    const db = new Database();
    const key = db.addApiKey(makeKey({ name: 'OpenAI Key' }));

    expect(key.id).toBeTruthy();
    expect(key.name).toBe('OpenAI Key');
    expect(key.created_at).toBeTruthy();

    const all = db.getApiKeys();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('OpenAI Key');
  });

  it('adds multiple keys', () => {
    const db = new Database();
    db.addApiKey(makeKey({ name: 'Key A', key: 'sk-key-a' }));
    db.addApiKey(makeKey({ name: 'Key B', key: 'sk-key-b' }));
    db.addApiKey(makeKey({ name: 'Key C', key: 'sk-key-c' }));
    expect(db.getApiKeys()).toHaveLength(3);
  });

  it('rejects adding a duplicate API key value', () => {
    const db = new Database();
    db.addApiKey(makeKey({ key: 'sk-duplicate' }));
    expect(() => db.addApiKey(makeKey({ key: 'sk-duplicate' }))).toThrow(
      'DUPLICATE_API_KEY'
    );
  });

  it('gets a key by ID', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey({ name: 'Target' }));
    expect(db.getApiKey(created.id)).toBeTruthy();
    expect(db.getApiKey('non-existent-id')).toBeUndefined();
  });

  it('updates a key', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey({ name: 'Original' }));
    const updated = db.updateApiKey(created.id, {
      name: 'Updated',
      key: 'sk-new',
    });
    expect(updated?.name).toBe('Updated');
    expect(updated?.key).toBe('sk-new');
    expect(db.getApiKey(created.id)?.name).toBe('Updated');
  });

  it('does not change key ID on update', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey());
    db.updateApiKey(created.id, { name: 'Changed' });
    expect(db.getApiKey(created.id)?.id).toBe(created.id);
  });

  it('rejects updating a key to a duplicate API key value', () => {
    const db = new Database();
    const first = db.addApiKey(makeKey({ key: 'sk-first' }));
    const second = db.addApiKey(makeKey({ key: 'sk-second' }));
    expect(() => db.updateApiKey(second.id, { key: first.key })).toThrow(
      'DUPLICATE_API_KEY'
    );
  });

  it('allows updating a key without changing its own API key value', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey({ key: 'sk-stable' }));
    const updated = db.updateApiKey(created.id, { name: 'Renamed' });
    expect(updated?.name).toBe('Renamed');
    expect(updated?.key).toBe('sk-stable');
  });

  it('returns null when updating non-existent key', () => {
    const db = new Database();
    expect(db.updateApiKey('nope', { name: 'X' })).toBeNull();
  });

  it('deletes a key', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey());
    expect(db.getApiKeys()).toHaveLength(1);
    expect(db.deleteApiKey(created.id)).toBe(true);
    expect(db.getApiKeys()).toHaveLength(0);
  });

  it('returns false on delete of non-existent key', () => {
    const db = new Database();
    expect(db.deleteApiKey('nope')).toBe(false);
  });

  it('defaults new keys to active', () => {
    const db = new Database();
    const key = db.addApiKey(makeKey());
    expect(key.archived_at).toBeNull();
  });

  it('archives and restores a key', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey({ name: 'Old Key' }));
    const archivedAt = new Date('2026-06-01T10:00:00.000Z');

    const archived = db.archiveApiKey(created.id, archivedAt);
    expect(archived?.archived_at).toBe(archivedAt.toISOString());
    expect(archived?.updated_at).toBe(archivedAt.toISOString());
    expect(db.getActiveApiKeys()).toHaveLength(0);
    expect(db.getArchivedApiKeys()).toHaveLength(1);

    const restored = db.restoreApiKey(created.id);
    expect(restored?.archived_at).toBeNull();
    expect(db.getActiveApiKeys()).toHaveLength(1);
    expect(db.getArchivedApiKeys()).toHaveLength(0);
  });

  it('archives idempotently and returns null for missing keys', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey());
    const first = db.archiveApiKey(
      created.id,
      new Date('2026-06-01T10:00:00.000Z')
    );
    const second = db.archiveApiKey(
      created.id,
      new Date('2026-06-02T10:00:00.000Z')
    );
    expect(second?.archived_at).toBe(first?.archived_at);
    expect(db.archiveApiKey('missing')).toBeNull();
    expect(db.restoreApiKey('missing')).toBeNull();
  });

  it('restores idempotently', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey());
    const restored = db.restoreApiKey(created.id);
    expect(restored?.archived_at).toBeNull();
    expect(restored?.id).toBe(created.id);
  });

  it('returns active and archived keys sorted by archive time', () => {
    const db = new Database();
    const earlier = db.addApiKey(makeKey({ key: 'sk-earlier' }));
    const later = db.addApiKey(makeKey({ key: 'sk-later' }));
    db.addApiKey(makeKey({ key: 'sk-active' }));
    db.archiveApiKey(earlier.id, new Date('2026-06-01T10:00:00.000Z'));
    db.archiveApiKey(later.id, new Date('2026-06-03T10:00:00.000Z'));

    expect(db.getActiveApiKeys().map((key) => key.key)).toEqual(['sk-active']);
    expect(db.getArchivedApiKeys().map((key) => key.key)).toEqual([
      'sk-later',
      'sk-earlier',
    ]);
  });

  it('does not update archived keys', () => {
    const db = new Database();
    const created = db.addApiKey(makeKey({ name: 'Frozen' }));
    db.archiveApiKey(created.id);

    expect(db.updateApiKey(created.id, { name: 'Changed' })).toBeNull();
    expect(db.getApiKey(created.id)?.name).toBe('Frozen');
  });

  it('ignores archived keys for duplicate detection', () => {
    const db = new Database();
    const archived = db.addApiKey(makeKey({ key: 'sk-reused' }));
    db.archiveApiKey(archived.id);

    expect(db.hasDuplicateApiKeyValue('sk-reused')).toBe(false);
    const active = db.addApiKey(makeKey({ key: 'sk-reused' }));
    expect(active.archived_at).toBeNull();

    const other = db.addApiKey(makeKey({ key: 'sk-other' }));
    expect(() => db.updateApiKey(other.id, { key: 'sk-reused' })).toThrow(
      'DUPLICATE_API_KEY'
    );
  });

  it('searches within a provided key subset', () => {
    const db = new Database();
    db.addApiKey(makeKey({ name: 'OpenAI Active', key: 'sk-a' }));
    const archived = db.addApiKey(
      makeKey({ name: 'OpenAI Archived', key: 'sk-b' })
    );
    db.archiveApiKey(archived.id);

    expect(db.searchKeys('openai')).toHaveLength(2);
    expect(db.searchKeys('openai', db.getActiveApiKeys())).toHaveLength(1);
  });

  it('removes inbox items for one entity only', () => {
    const db = new Database();
    const first = db.addApiKey(makeKey({ key: 'sk-inbox-a' }));
    const second = db.addApiKey(makeKey({ key: 'sk-inbox-b' }));
    const now = new Date().toISOString();
    db.getData().inbox = [first, second].map((key) => ({
      id: crypto.randomUUID(),
      type: 'never_tested',
      entity_id: key.id,
      status: 'open',
      archive_reason: null,
      created_at: now,
      updated_at: now,
      archived_at: null,
      metadata: { key_name: key.name, provider: key.provider },
    }));

    expect(db.removeInboxItemsForEntity(first.id)).toBe(1);
    expect(db.getData().inbox).toHaveLength(1);
    expect(db.getData().inbox[0].entity_id).toBe(second.id);
  });

  it('bumps updated_at on mutations', async () => {
    const db = new Database();
    const initial = db.getData().updated_at;
    await new Promise((r) => setTimeout(r, 10));
    const created = db.addApiKey(makeKey());
    expect(new Date(db.getData().updated_at).getTime()).toBeGreaterThan(
      new Date(initial).getTime()
    );
    const afterAdd = db.getData().updated_at;
    await new Promise((r) => setTimeout(r, 10));
    db.updateApiKey(created.id, { name: 'X' });
    expect(new Date(db.getData().updated_at).getTime()).toBeGreaterThan(
      new Date(afterAdd).getTime()
    );
    const afterUpdate = db.getData().updated_at;
    await new Promise((r) => setTimeout(r, 10));
    db.deleteApiKey(created.id);
    expect(new Date(db.getData().updated_at).getTime()).toBeGreaterThan(
      new Date(afterUpdate).getTime()
    );
  });

  /* ──── Search ──── */

  it('searches keys by name', () => {
    const db = new Database();
    db.addApiKey(
      makeKey({
        name: 'Production OpenAI',
        provider: 'OpenAI',
        key: 'sk-search-openai',
      })
    );
    db.addApiKey(
      makeKey({
        name: 'Staging Anthropic',
        provider: 'Anthropic',
        key: 'sk-search-anthropic',
      })
    );
    db.addApiKey(
      makeKey({
        name: 'Dev Groq',
        provider: 'Groq',
        key: 'sk-search-groq',
      })
    );
    expect(db.searchKeys('openai')).toHaveLength(1);
    expect(db.searchKeys('anthropic')).toHaveLength(1);
    expect(db.searchKeys('production')).toHaveLength(1);
    expect(db.searchKeys('nonexistent')).toHaveLength(0);
  });

  it('searches by description and provider', () => {
    const db = new Database();
    db.addApiKey(
      makeKey({
        name: 'K1',
        description: 'Main key for production',
        provider: 'OpenAI',
        key: 'sk-desc-openai',
      })
    );
    db.addApiKey(
      makeKey({
        name: 'K2',
        description: 'Backup key',
        provider: 'Anthropic',
        key: 'sk-desc-anthropic',
      })
    );
    expect(db.searchKeys('production')).toHaveLength(1);
    expect(db.searchKeys('backup')).toHaveLength(1);
    expect(db.searchKeys('openai')).toHaveLength(1);
  });

  it('search is case-insensitive', () => {
    const db = new Database();
    db.addApiKey(makeKey({ name: 'OpenAI Key' }));
    expect(db.searchKeys('openai')).toHaveLength(1);
    expect(db.searchKeys('OPENAI')).toHaveLength(1);
    expect(db.searchKeys('OpenAi')).toHaveLength(1);
  });

  /* ──── Groups ──── */

  it('adds and retrieves groups', () => {
    const db = new Database();
    const count = db.getGroups().length;
    const group = db.addGroup(sampleGroup);
    expect(group.id).toBeTruthy();
    expect(db.getGroups()).toHaveLength(count + 1);
  });

  it('updates a group', () => {
    const db = new Database();
    const group = db.addGroup(sampleGroup);
    db.updateGroup(group.id, { name: 'Renamed' });
    const groups = db.getGroups();
    const renamed = groups.find((g) => g.id === group.id);
    expect(renamed?.name).toBe('Renamed');
  });

  it('deletes a group and unassigns keys', () => {
    const db = new Database();
    const group = db.addGroup(sampleGroup);
    const key = db.addApiKey(makeKey({ group_id: group.id }));
    db.deleteGroup(group.id);
    expect(db.getGroups().find((g) => g.id === group.id)).toBeUndefined();
    expect(db.getApiKey(key.id)?.group_id).toBeNull();
  });

  /* ──── Settings ──── */

  it('gets and updates settings', () => {
    const db = new Database();
    db.updateSettings({
      auto_lock_minutes: 10,
      auto_test_daily: true,
    });
    expect(db.getSettings().auto_lock_minutes).toBe(10);
    expect(db.getSettings().auto_test_daily).toBe(true);
  });
});
