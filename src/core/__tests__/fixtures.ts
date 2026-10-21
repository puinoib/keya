/**
 * Fixtures for validation tests. Every string is synthetic.
 */

import type { KeyaFile, Provider } from '../payload/types';
import { validateKeyaFile } from '../payload/validate';

const TS = '2026-03-01T10:00:00.000Z';
const UUID_VAULT = '11111111-1111-4111-8111-111111111111';
const UUID_GROUP = '22222222-2222-4222-8222-222222222222';
const UUID_KEY = '33333333-3333-4333-8333-333333333333';
const UUID_PROVIDER = '44444444-4444-4444-8444-444444444444';

export const IDS = {
  vault: UUID_VAULT,
  group: UUID_GROUP,
  key: UUID_KEY,
  provider: UUID_PROVIDER,
  providerId: `custom:${UUID_PROVIDER}`,
};

export function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: IDS.providerId,
    name: 'Edge Gateway',
    description: 'Internal gateway',
    default_endpoint: 'https://edge.example.com/v1',
    probe: {
      target: 'models',
      auth: { mode: 'header', name: 'x-api-key' },
      headers: [{ name: 'anthropic-version', value: '2023-06-01' }],
    },
    ...overrides,
  };
}

export function makeFile(): KeyaFile {
  return {
    vault: {
      id: IDS.vault,
      name: 'Work',
      icon: '🔑',
      created_at: TS,
      content_updated_at: TS,
    },
    providers: [makeProvider()],
    groups: [{ id: IDS.group, name: 'Production', icon: '🚀', order: 0 }],
    keys: [
      {
        id: IDS.key,
        name: 'Edge key',
        description: 'staging',
        provider_id: IDS.providerId,
        endpoint: 'https://edge.example.com/v1',
        secret: 'sk-synthetic',
        group_id: IDS.group,
        expiry: { kind: 'date', value: '2026-12-01' },
        archived_at: null,
        created_at: TS,
        content_updated_at: TS,
      },
    ],
  };
}

/** Deep clone so each test can mutate freely. */
export function cloneFile(): KeyaFile {
  return structuredClone(makeFile());
}

/** Paths reported for a rejected payload. */
export function issuePaths(value: unknown): string[] {
  const result = validateKeyaFile(value);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

export function issueCodes(value: unknown): string[] {
  const result = validateKeyaFile(value);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}
