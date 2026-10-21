/**
 * View models for the UI.
 *
 * These types describe what a screen needs to render, not what the file stores.
 * They exist so components can stay synchronous and presentation-shaped while
 * the vault itself is asynchronous, validated and version-bounded. Nothing here
 * is written to disk.
 */

import type { Expiry } from '../../core/time/expiry';

export type ConnectionStatus = 'success' | 'failed' | 'untested';
export type ConnectionKind =
  | 'credential'
  | 'request'
  | 'reachability'
  | 'unverifiable';

/** How the last check on this device ended. Provider text is never stored. */
export interface ConnectionCheck {
  status: ConnectionStatus;
  checked_at: string | null;
  latency_ms: number | null;
  error_message: string | null;
  kind?: ConnectionKind;
  detail_code?: string | null;
}

export interface ApiKey {
  id: string;
  name: string;
  description: string;
  /** Display label of the provider, e.g. `OpenAI` or a custom provider name. */
  provider: string;
  /** `null`, `preset:<slug>` or `custom:<uuid>`. */
  provider_id: string | null;
  endpoint: string;
  key: string;
  group_id: string | null;
  /** Verdict from the core rules, so screens never re-derive it. */
  expiry_status: import('./status').ExpiryStatus;
  /** Calendar days until the expiry day; negative once passed. */
  days_until_expiry: number | null;
  /** Local-midnight ISO form of the expiry, or an exact instant. */
  expires_at: string | null;
  /** The stored representation, so the form can round-trip a calendar day. */
  expiry: Expiry | null;
  archived_at: string | null;
  connection_check: ConnectionCheck;
  created_at: string;
  updated_at: string;
}

export type NewApiKey = Omit<
  ApiKey,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'archived_at'
  | 'expiry'
  | 'provider_id'
  | 'connection_check'
  | 'expiry_status'
  | 'days_until_expiry'
> & {
  provider_id?: string | null;
  connection_check?: ConnectionCheck;
  archived_at?: string | null;
  expiry?: Expiry | null;
};

export interface Group {
  id: string;
  name: string;
  icon: string;
  order: number;
}

/**
 * The check recipe as the settings screen presents it: a target plus where the
 * credential goes, with the constant headers kept alongside.
 */
export interface CustomProviderCheck {
  path?: string;
  auth: 'bearer' | 'basic' | 'x-api-key' | 'header' | 'query';
  header_name?: string;
  query_param?: string;
  headers?: { name: string; value: string }[];
}

export interface CustomProvider {
  /** Payload provider id, so an edit can follow a rename. */
  id?: string;
  name: string;
  endpoint: string;
  check?: CustomProviderCheck;
}

export interface Settings {
  auto_lock_minutes: number;
  auto_test_on_save: boolean;
  auto_test_daily: boolean;
  clipboard_detection_on_add: boolean;
  custom_providers: CustomProvider[];
  disabled_providers: string[];
}

export type InboxItemType =
  | 'key_expiry_upcoming'
  | 'key_expiry_expired'
  | 'connection_failed'
  | 'never_tested'
  | 'insecure_endpoint'
  | 'stale_test';

export type InboxItemStatus = 'open' | 'archived';
export type InboxArchiveReason = 'user' | 'resolved';

export interface InboxItemMetadata {
  key_name: string;
  provider: string;
  expires_at?: string;
  days_until_expiry?: number;
  checked_at?: string | null;
  error_message?: string | null;
  endpoint?: string;
  days_since_test?: number;
}

export interface InboxItem {
  id: string;
  type: InboxItemType;
  entity_id: string;
  status: InboxItemStatus;
  archive_reason: InboxArchiveReason | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  metadata: InboxItemMetadata;
}

/** What `db.getData()` used to hand to components. */
export interface VaultData {
  vault_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  icon: string;
  api_keys: ApiKey[];
  groups: Group[];
  settings: Settings;
  inbox: InboxItem[];
}
