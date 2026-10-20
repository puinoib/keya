import { describe, expect, it } from 'vitest';
import { Database } from '../../../core/database';
import type { NewApiKey } from '../../../core/types';
import { mergeImportedData } from '../import-merge';

function makeKey(value: string, groupId: string | null = null): NewApiKey {
  return {
    name: `Key ${value}`,
    key: value,
    provider: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    description: '',
    group_id: groupId,
    expires_at: null,
    connection_check: {
      status: 'untested',
      checked_at: null,
      latency_ms: null,
      error_message: null,
    },
  };
}

describe('mergeImportedData', () => {
  it('preserves grouping by matching or creating groups', () => {
    const db = new Database();
    const production = db
      .getGroups()
      .find((group) => group.name === 'Production')!;
    const existing = db.addApiKey(makeKey('sk-existing', production.id));

    const beforeGroups = db.getGroups().length;
    const result = mergeImportedData(db, {
      groups: [
        { id: 'imported-production', name: 'Production', icon: '🚀' },
        { id: 'imported-client', name: 'Client', icon: '🏢' },
        { id: 'unused', name: 'Unused', icon: '📦' },
      ],
      api_keys: [
        makeKey('sk-in-production', 'imported-production'),
        makeKey('sk-in-client', 'imported-client'),
        makeKey('sk-ungrouped'),
        makeKey('sk-existing', 'imported-client'),
        { name: 'invalid' },
      ],
    });

    expect(result.addedKeys).toBe(3);
    expect(result.skippedDuplicateKeys).toBe(1);
    expect(result.invalidKeys).toBe(1);
    expect(result.createdGroups).toBe(2);
    expect(db.getGroups()).toHaveLength(beforeGroups + 2);

    const keys = db.getApiKeys();
    expect(keys.find((key) => key.key === 'sk-in-production')?.group_id).toBe(
      production.id
    );
    const client = db.getGroups().find((group) => group.name === 'Client')!;
    expect(keys.find((key) => key.key === 'sk-in-client')?.group_id).toBe(
      client.id
    );
    expect(keys.find((key) => key.key === 'sk-ungrouped')?.group_id).toBe(null);
    expect(keys.find((key) => key.key === 'sk-existing')?.id).toBe(existing.id);
  });

  it('preserves archived status when importing keys', () => {
    const db = new Database();
    const result = mergeImportedData(db, {
      api_keys: [
        {
          ...makeKey('sk-imported-archived'),
          archived_at: '2026-06-01T10:00:00.000Z',
        },
        makeKey('sk-imported-active'),
      ],
    });

    expect(result.addedKeys).toBe(2);
    expect(db.getActiveApiKeys().map((key) => key.key)).toEqual([
      'sk-imported-active',
    ]);
    expect(db.getArchivedApiKeys().map((key) => key.key)).toEqual([
      'sk-imported-archived',
    ]);
  });

  it('allows importing a value that only exists in the archive', () => {
    const db = new Database();
    const archived = db.addApiKey(makeKey('sk-archive-only'));
    db.archiveApiKey(archived.id);

    const result = mergeImportedData(db, {
      api_keys: [makeKey('sk-archive-only')],
    });

    expect(result.addedKeys).toBe(1);
    expect(result.skippedDuplicateKeys).toBe(0);
    expect(db.getActiveApiKeys().map((key) => key.key)).toEqual([
      'sk-archive-only',
    ]);
    expect(db.getArchivedApiKeys()).toHaveLength(1);
  });

  it('does not mutate the vault when the payload has no keys array', () => {
    const db = new Database();
    const before = JSON.stringify(db.getData());

    const result = mergeImportedData(db, { api_keys: 'not-an-array' });

    expect(result.addedKeys).toBe(0);
    expect(JSON.stringify(db.getData())).toBe(before);
  });
});
