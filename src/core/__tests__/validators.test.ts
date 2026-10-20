import { describe, expect, it } from 'vitest';
import { createEmptyDatabase } from '../database';
import { KeyaDatabaseSchema, validateDatabase } from '../validators';

describe('database validation compatibility', () => {
  it('applies defaults for fields added after the original format', () => {
    const base = createEmptyDatabase();
    const legacy = {
      vault_id: base.vault_id,
      created_at: base.created_at,
      updated_at: base.updated_at,
      name: 'Legacy vault',
      api_keys: [],
      groups: [],
    };

    const parsed = validateDatabase(legacy);

    expect(parsed.icon).toBe('');
    expect(parsed.inbox).toEqual([]);
    expect(parsed.settings.auto_lock_minutes).toBe(5);
    expect(parsed.settings.auto_test_daily).toBe(false);
    expect(parsed.settings.clipboard_detection_on_add).toBe(true);
  });

  it('keeps unknown fields in nested objects for forward compatibility', () => {
    const base = createEmptyDatabase();
    const future = {
      ...base,
      future_vault_field: 'keep',
      settings: {
        ...base.settings,
        future_setting: 'keep',
      },
      api_keys: [
        {
          id: 'key-1',
          name: 'Future key',
          description: '',
          provider: 'OpenAI',
          endpoint: 'https://api.openai.com/v1',
          key: 'sk-test',
          group_id: null,
          expires_at: null,
          connection_check: {
            status: 'untested',
            checked_at: null,
            latency_ms: null,
            error_message: null,
            future_check: true,
          },
          created_at: base.created_at,
          updated_at: base.updated_at,
          future_key_field: 42,
        },
      ],
    };

    const parsed = KeyaDatabaseSchema.parse(future) as Record<string, unknown>;

    expect(parsed.future_vault_field).toBe('keep');
    expect((parsed.settings as Record<string, unknown>).future_setting).toBe(
      'keep'
    );
    const key = (parsed.api_keys as Record<string, unknown>[])[0];
    expect(key.future_key_field).toBe(42);
    expect((key.connection_check as Record<string, unknown>).future_check).toBe(
      true
    );
  });
});
