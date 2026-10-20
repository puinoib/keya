// Runtime validation for .keya file format
import { z } from 'zod';

export const ConnectionCheckKindSchema = z.enum([
  'credential',
  'reachability',
  'unverifiable',
]);

export const ConnectionCheckSchema = z
  .object({
    status: z.enum(['success', 'failed', 'untested']).default('untested'),
    checked_at: z.string().nullable().default(null),
    latency_ms: z.number().nullable().default(null),
    error_message: z.string().nullable().default(null),
    kind: ConnectionCheckKindSchema.optional(),
  })
  .passthrough();

export const ApiKeySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().default(''),
    provider: z.string(),
    endpoint: z.string().default(''),
    key: z.string(),
    group_id: z.string().nullable().default(null),
    expires_at: z.string().nullable().default(null),
    archived_at: z.string().nullable().default(null),
    connection_check: ConnectionCheckSchema.default({
      status: 'untested',
      checked_at: null,
      latency_ms: null,
      error_message: null,
    }),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const GroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    icon: z.string().default(''),
    order: z.number().default(0),
  })
  .passthrough();

export const CustomProviderCheckSchema = z
  .object({
    path: z.string().optional(),
    auth: z.enum(['bearer', 'x-api-key', 'header', 'query']),
    header_name: z.string().optional(),
    query_param: z.string().optional(),
  })
  .passthrough();

export const CustomProviderSchema = z
  .object({
    name: z.string(),
    endpoint: z.string(),
    check: CustomProviderCheckSchema.optional(),
  })
  .passthrough();

export const SettingsSchema = z
  .object({
    auto_lock_minutes: z.number().default(5),
    auto_test_on_save: z.boolean().default(false),
    auto_test_daily: z.boolean().default(false),
    clipboard_detection_on_add: z.boolean().default(true),
    custom_providers: z.array(CustomProviderSchema).default([]),
    disabled_providers: z.array(z.string()).default([]),
  })
  .passthrough();

export const InboxItemSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      'key_expiry_upcoming',
      'key_expiry_expired',
      'connection_failed',
      'never_tested',
      'insecure_endpoint',
      'stale_test',
    ]),
    entity_id: z.string(),
    status: z.enum(['open', 'archived']),
    archive_reason: z.enum(['user', 'resolved']).nullable().default(null),
    created_at: z.string(),
    updated_at: z.string(),
    archived_at: z.string().nullable().default(null),
    metadata: z
      .object({
        key_name: z.string(),
        provider: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const KeyaDatabaseSchema = z
  .object({
    vault_id: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    name: z.string().default(''),
    icon: z.string().default(''),
    api_keys: z.array(ApiKeySchema).default([]),
    groups: z.array(GroupSchema).default([]),
    settings: SettingsSchema.default({
      auto_lock_minutes: 5,
      auto_test_on_save: false,
      auto_test_daily: false,
      clipboard_detection_on_add: true,
      custom_providers: [],
      disabled_providers: [],
    }),
    inbox: z.array(InboxItemSchema).default([]),
  })
  .passthrough();

/**
 * Validate parsed JSON against the KeyaDatabase shape.
 * Returns the normalized object with defaults applied and unknown fields kept.
 * Throws on failure.
 */
export function validateDatabase(
  data: unknown
): import('./types').KeyaDatabase {
  const result = KeyaDatabaseSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid database format: ${issues}`);
  }
  return result.data as import('./types').KeyaDatabase;
}
