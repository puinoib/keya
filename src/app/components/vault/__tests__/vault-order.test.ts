import { describe, expect, it } from 'vitest';
import type { CachedVaultMeta } from '../../../lib/storage';
import { sortVaultFiles, vaultDisplayName } from '../vault-order';

function meta(fileName: string, updatedAt: string, name = ''): CachedVaultMeta {
  return {
    vault_id: `id-${fileName}`,
    fileName,
    name,
    icon: '',
    keyCount: 1,
    updatedAt,
  };
}

describe('sortVaultFiles', () => {
  it('puts the active vault first even when it is the oldest', () => {
    const metas = {
      'a.keya': meta('a.keya', '2026-01-01T00:00:00.000Z'),
      'b.keya': meta('b.keya', '2026-05-01T00:00:00.000Z'),
    };
    expect(sortVaultFiles(['a.keya', 'b.keya'], metas, 'a.keya')).toEqual([
      'a.keya',
      'b.keya',
    ]);
  });

  it('orders the rest by most recent save', () => {
    const metas = {
      'old.keya': meta('old.keya', '2026-01-01T00:00:00.000Z'),
      'recent.keya': meta('recent.keya', '2026-05-01T00:00:00.000Z'),
      'never.keya': meta('never.keya', ''),
    };
    expect(
      sortVaultFiles(['old.keya', 'never.keya', 'recent.keya'], metas)
    ).toEqual(['recent.keya', 'old.keya', 'never.keya']);
  });

  it('falls back to the display name so the order is stable', () => {
    const metas = {
      'vault-2.keya': meta('vault-2.keya', '2026-01-01T00:00:00.000Z', 'Zebra'),
      'vault-1.keya': meta('vault-1.keya', '2026-01-01T00:00:00.000Z', 'Apple'),
    };
    expect(sortVaultFiles(['vault-2.keya', 'vault-1.keya'], metas)).toEqual([
      'vault-1.keya',
      'vault-2.keya',
    ]);
  });
});

describe('vaultDisplayName', () => {
  it('prefers the stored name and falls back to the file name', () => {
    expect(
      vaultDisplayName('vault-1.keya', meta('vault-1.keya', '', 'Work'))
    ).toBe('Work');
    expect(
      vaultDisplayName('vault-1.keya', meta('vault-1.keya', '', '  '))
    ).toBe('vault-1');
    expect(vaultDisplayName('vault-1.keya')).toBe('vault-1');
  });
});
