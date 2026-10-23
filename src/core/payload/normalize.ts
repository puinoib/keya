/**
 * The single normalization function (§8.1).
 *
 * Every write path — create, edit, plaintext import, merge import, programmatic
 * edit — must run it. Skipping one entry point makes the same credential produce
 * different bytes depending on how it arrived, and `observation_binding` is
 * sensitive to exactly that.
 *
 * Rules:
 * - single-line text fields are trimmed of ASCII whitespace;
 * - descriptions are **not** trimmed (leading indentation may be intentional);
 * - static header names are lowercased and headers are sorted;
 * - nothing here validates: run class A validation afterwards, so there is one
 *   place that decides legality.
 */

import { canonicalizeHeaders } from './headers';
import type {
  KeyaFile,
  Probe,
  ProbeAuth,
  Provider,
  StaticHeader,
} from './types';
import { graphemeCount, trimAsciiWhitespace, utf8Length } from './text';
import { MAX_ICON } from './limits';

const trimIfPresent = (value: string): string => trimAsciiWhitespace(value);

function normalizeAuth(auth: ProbeAuth): ProbeAuth {
  switch (auth.mode) {
    case 'bearer':
    case 'basic':
      return { mode: auth.mode };
    case 'header':
      return {
        mode: 'header',
        name: trimIfPresent(auth.name).toLowerCase(),
      };
    case 'query':
      return { mode: 'query', param: trimIfPresent(auth.param) };
  }
}

function normalizeHeaders(headers: readonly StaticHeader[]): StaticHeader[] {
  const cleaned = headers.map((header) => ({
    name: trimIfPresent(header.name).toLowerCase(),
    value: trimIfPresent(header.value),
  }));
  return canonicalizeHeaders(cleaned);
}

function normalizeProbe(probe: Probe | null): Probe | null {
  if (!probe) return null;
  return {
    target: trimIfPresent(probe.target),
    auth: normalizeAuth(probe.auth),
    headers: normalizeHeaders(probe.headers),
  };
}

function normalizeProvider(provider: Provider): Provider {
  return {
    id: provider.id,
    name: trimIfPresent(provider.name),
    // Multi-line: keep the author's formatting.
    description: provider.description,
    default_endpoint:
      provider.default_endpoint === null
        ? null
        : trimIfPresent(provider.default_endpoint),
    probe: normalizeProbe(provider.probe),
  };
}

export function normalizeKeyaFile(file: KeyaFile): KeyaFile {
  return {
    vault: {
      id: file.vault.id,
      name: trimIfPresent(file.vault.name),
      icon: trimIfPresent(file.vault.icon),
      created_at: file.vault.created_at,
      content_updated_at: file.vault.content_updated_at,
    },
    providers: file.providers.map(normalizeProvider),
    groups: file.groups.map((group) => ({
      id: group.id,
      name: trimIfPresent(group.name),
      icon: trimIfPresent(group.icon),
      order: group.order,
    })),
    keys: file.keys.map((key) => ({
      id: key.id,
      name: trimIfPresent(key.name),
      description: key.description,
      provider_id: key.provider_id,
      endpoint: key.endpoint === null ? null : trimIfPresent(key.endpoint),
      secret: trimIfPresent(key.secret),
      group_id: key.group_id,
      expiry: key.expiry,
      archived_at: key.archived_at,
      created_at: key.created_at,
      content_updated_at: key.content_updated_at,
    })),
  };
}

/**
 * Writer-side rule that readers do not enforce: an icon is either empty or a
 * single grapheme cluster. Grapheme segmentation depends on the engine, so it
 * cannot be a file legality rule — but the writer must still refuse to split a
 * cluster, and must never truncate to fit the byte cap.
 */
export function checkIconForWriter(
  icon: string
): 'ok' | 'too_long' | 'clusters' {
  if (utf8Length(icon) > MAX_ICON) return 'too_long';
  if (graphemeCount(icon) > 1) return 'clusters';
  return 'ok';
}
