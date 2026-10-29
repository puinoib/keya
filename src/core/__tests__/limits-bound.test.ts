/**
 * §16.3 #41 — the bound-versus-limits assertion.
 *
 * The 32 MiB file limit is derived from the class A field limits (§6.2). If any
 * limit, charset or count changes, the derivation can silently stop being an
 * upper bound: some payload would then satisfy every field rule and still be
 * refused by the writer, which is exactly the "delete forever and still cannot
 * save" failure P4 forbids. This test builds a legal payload at every limit with
 * the worst escaped characters and asserts it still fits.
 */

import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE, PREAMBLE_SIZE } from '../format/constants';
import {
  MAX_GROUP_NAME,
  MAX_GROUPS,
  MAX_HEADER_NAME,
  MAX_HEADER_VALUE,
  MAX_KEY_DESCRIPTION,
  MAX_KEY_NAME,
  MAX_KEYS,
  MAX_PROVIDER_DESCRIPTION,
  MAX_PROVIDER_NAME,
  MAX_PROVIDERS,
  MAX_SECRET,
  MAX_STATIC_HEADERS,
  MAX_TARGET,
  MAX_URL,
  MAX_VAULT_NAME,
} from '../payload/limits';
import { serializePayload } from '../payload/serialize';
import type { Group, Key, KeyaFile, Provider } from '../payload/types';
import { validateKeyaFile } from '../payload/validate';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

/** `"` and `\` are the two characters JSON escapes as two bytes. */
const worst = (length: number): string => '"'.repeat(length);

const uuid = (index: number): string =>
  `${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;

/** A valid base address of exactly `length` bytes. */
const urlOf = (length: number): string => {
  const prefix = 'https://a.example/';
  return prefix + 'a'.repeat(length - prefix.length);
};

const provider = (index: number): Provider => ({
  id: `custom:${uuid(index)}`,
  // Unique, and exactly the byte cap.
  name: (String(index) + worst(MAX_PROVIDER_NAME)).slice(0, MAX_PROVIDER_NAME),
  description: worst(MAX_PROVIDER_DESCRIPTION),
  default_endpoint: urlOf(MAX_URL),
  probe: {
    target: 'a'.repeat(MAX_TARGET),
    auth: { mode: 'bearer' },
    headers: Array.from({ length: MAX_STATIC_HEADERS }, (_, headerIndex) => ({
      name: (`x-${index}-${headerIndex}-` + 'a'.repeat(MAX_HEADER_NAME)).slice(
        0,
        MAX_HEADER_NAME
      ),
      value: worst(MAX_HEADER_VALUE),
    })),
  },
});

const group = (index: number): Group => ({
  id: uuid(index),
  name: worst(MAX_GROUP_NAME),
  icon: '',
  order: index,
});

const key = (index: number): Key => ({
  id: uuid(index),
  name: worst(MAX_KEY_NAME),
  description: worst(MAX_KEY_DESCRIPTION),
  provider_id: `preset:${'a'.repeat(63)}`,
  endpoint: urlOf(MAX_URL),
  secret: worst(MAX_SECRET),
  group_id: null,
  expiry: { kind: 'instant', value: TIMESTAMP },
  archived_at: null,
  created_at: TIMESTAMP,
  content_updated_at: TIMESTAMP,
});

const largestLegalFile = (): KeyaFile => ({
  vault: {
    id: uuid(0),
    name: worst(MAX_VAULT_NAME),
    icon: '',
    created_at: TIMESTAMP,
    content_updated_at: TIMESTAMP,
  },
  providers: Array.from({ length: MAX_PROVIDERS }, (_, index) =>
    provider(index)
  ),
  groups: Array.from({ length: MAX_GROUPS }, (_, index) => group(index)),
  keys: Array.from({ length: MAX_KEYS }, (_, index) => key(index)),
});

describe('§6.2 total-size bound', () => {
  it('a payload at every limit still fits the 32 MiB file cap', () => {
    const file = largestLegalFile();
    const validated = validateKeyaFile(file);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const bytes = serializePayload(validated.value);
    // The spec's table derives ~30.47 MB; this must stay a real worst case, not
    // a payload that happens to be small.
    expect(bytes.length).toBeGreaterThan(25_000_000);
    expect(bytes.length + PREAMBLE_SIZE).toBeLessThanOrEqual(MAX_FILE_SIZE);
  }, 60_000);
});
