// Runtime validation for .keya file format
import { z } from 'zod';

export const ConnectionCheckSchema = z.object({
  status: z.enum(['success', 'failed', 'untested']),
  checked_at: z.string().nullable(),
  latency_ms: z.number().nullable(),
  error_message: z.string().nullable(),
});

export const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: z.string(),
  endpoint: z.string(),
  key: z.string(),
  group_id: z.string().nullable(),
  expires_at: z.string().nullable(),
  connection_check: ConnectionCheckSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  order: z.number(),
});

export const SettingsSchema = z.object({
  auto_lock_minutes: z.number(),
  auto_test_on_save: z.boolean(),
  auto_test_daily: z.boolean(),
  clipboard_detection_on_add: z.boolean(),
  custom_providers: z.array(
    z.object({ name: z.string(), endpoint: z.string() })
  ),
  disabled_providers: z.array(z.string()),
});

export const InboxItemSchema = z.object({
  id: z.string(),
  type: z.enum(['key_expiry_upcoming', 'key_expiry_expired']),
  entity_id: z.string(),
  status: z.enum(['open', 'archived']),
  archive_reason: z.enum(['user', 'resolved']).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: z.string().nullable(),
  metadata: z.object({
    key_name: z.string(),
    provider: z.string(),
    expires_at: z.string(),
    days_until_expiry: z.number(),
  }),
});

export const KeyaDatabaseSchema = z.object({
  version: z.string(),
  vault_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  name: z.string(),
  icon: z.string(),
  api_keys: z.array(ApiKeySchema),
  groups: z.array(GroupSchema),
  settings: SettingsSchema,
  inbox: z.array(InboxItemSchema),
});

/** Validate parsed JSON against KeyaDatabase shape. Throws on failure. */
export function validateDatabase(data: unknown): asserts data is import('./types').KeyaDatabase {
  const result = KeyaDatabaseSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid database format: ${issues}`);
  }
}
