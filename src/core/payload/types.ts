/**
 * Payload model of a `.keya` file (version 2).
 *
 * The file holds assets and the dependencies needed to use them — nothing that
 * describes the device, and no operation history. See the format spec §5.
 */

import type { Expiry } from '../time/expiry';

export type { Expiry };

/**
 * A provider of API access. Only user-defined providers live in the file;
 * presets ship with the application and are referenced as `preset:<slug>`.
 */
export interface Provider {
  /** `custom:` followed by a UUIDv4. */
  id: string;
  name: string;
  description: string;
  /** Only copied into a key at creation time; never resolved at runtime. */
  default_endpoint: string | null;
  /** `null` means this provider cannot be probed at all. */
  probe: Probe | null;
}

/** How to send a credential to a provider. Not a general request builder. */
export interface Probe {
  /** Relative to the key's endpoint, or an absolute http(s) URL. */
  target: string;
  auth: ProbeAuth;
  /** Constant protocol headers, sent verbatim. Never secrets. */
  headers: StaticHeader[];
}

export type ProbeAuth =
  | { mode: 'bearer' }
  | { mode: 'basic' }
  | { mode: 'header'; name: string }
  | { mode: 'query'; param: string };

export interface StaticHeader {
  name: string;
  value: string;
}

export interface Group {
  id: string;
  name: string;
  icon: string;
  /** Sparse-capable integer; the writer keeps it dense (`0..n-1`). */
  order: number;
}

export interface Key {
  id: string;
  name: string;
  description: string;
  /** `null` (unclassified), `preset:<slug>` or `custom:<uuid>`. */
  provider_id: string | null;
  /** Absolute http(s) base URL, or `null` when unknown. */
  endpoint: string | null;
  secret: string;
  group_id: string | null;
  expiry: Expiry | null;
  /** ISO timestamp when archived; `null` while active. */
  archived_at: string | null;
  created_at: string;
  content_updated_at: string;
}

export interface Vault {
  id: string;
  name: string;
  icon: string;
  created_at: string;
  content_updated_at: string;
}

/** The decrypted payload: the only top-level object, and the whole schema. */
export interface KeyaFile {
  vault: Vault;
  providers: Provider[];
  groups: Group[];
  keys: Key[];
}

export const TOP_LEVEL_KEYS = ['vault', 'providers', 'groups', 'keys'] as const;
export const VAULT_KEYS = [
  'id',
  'name',
  'icon',
  'created_at',
  'content_updated_at',
] as const;
export const PROVIDER_KEYS = [
  'id',
  'name',
  'description',
  'default_endpoint',
  'probe',
] as const;
export const PROBE_KEYS = ['target', 'auth', 'headers'] as const;
export const STATIC_HEADER_KEYS = ['name', 'value'] as const;
export const GROUP_KEYS = ['id', 'name', 'icon', 'order'] as const;
export const KEY_KEYS = [
  'id',
  'name',
  'description',
  'provider_id',
  'endpoint',
  'secret',
  'group_id',
  'expiry',
  'archived_at',
  'created_at',
  'content_updated_at',
] as const;

export const AUTH_KEYS: Record<ProbeAuth['mode'], readonly string[]> = {
  bearer: ['mode'],
  basic: ['mode'],
  header: ['mode', 'name'],
  query: ['mode', 'param'],
};

export const EXPIRY_KEYS: Record<Expiry['kind'], readonly string[]> = {
  date: ['kind', 'value'],
  instant: ['kind', 'value'],
};
