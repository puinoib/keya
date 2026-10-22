import { describe, expect, it } from 'vitest';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import {
  buildJsonExport,
  JSON_EXPORT_FORMAT,
  JSON_EXPORT_VERSION,
  jsonExportFileName,
} from '../export-json';

describe('JSON export', () => {
  it('writes the payload in its own shape', () => {
    const file = cloneFile();
    const exported = buildJsonExport(
      file,
      new Date('2026-03-02T09:00:00.000Z')
    );

    expect(exported.format).toBe(JSON_EXPORT_FORMAT);
    expect(exported.version).toBe(JSON_EXPORT_VERSION);
    expect(exported.exported_at).toBe('2026-03-02T09:00:00.000Z');
    expect(exported.vault).toEqual({
      id: IDS.vault,
      name: 'Work',
      icon: '🔑',
      created_at: file.vault.created_at,
      content_updated_at: file.vault.content_updated_at,
    });
    expect(exported.keys).toHaveLength(1);
    expect(exported.providers).toHaveLength(1);
    expect(exported.groups).toHaveLength(1);
  });

  it('keeps the v2 field names, including the tagged expiry', () => {
    const exported = buildJsonExport(cloneFile());
    const key = exported.keys[0];

    expect(key.secret).toBe('sk-synthetic');
    expect(key.provider_id).toBe(IDS.providerId);
    expect(key.expiry).toEqual({ kind: 'date', value: '2026-12-01' });
    expect(key.content_updated_at).toBe('2026-03-01T10:00:00.000Z');
    expect(key).not.toHaveProperty('key');
    expect(key).not.toHaveProperty('expires_at');
    expect(key).not.toHaveProperty('connection_check');
    expect(exported).not.toHaveProperty('api_keys');
    expect(exported).not.toHaveProperty('settings');
    expect(exported).not.toHaveProperty('inbox');
  });

  it('does not leak device-local state', () => {
    const exported = buildJsonExport(cloneFile());

    expect(exported).not.toHaveProperty('preferences');
    expect(exported).not.toHaveProperty('observations');
    expect(exported).not.toHaveProperty('dismissals');
  });

  it('survives a JSON round-trip unchanged', () => {
    const exported = buildJsonExport(cloneFile());
    expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
  });

  it('copies instead of aliasing the vault', () => {
    const file = cloneFile();
    const exported = buildJsonExport(file);

    exported.keys[0].name = 'Renamed in export';
    expect(file.keys[0].name).toBe('Edge key');
  });

  it('dates the suggested filename', () => {
    expect(jsonExportFileName(new Date('2026-03-02T09:00:00.000Z'))).toBe(
      'keya-export-2026-03-02.json'
    );
  });
});
