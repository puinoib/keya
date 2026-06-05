// @keya/core — public API
// Types
export type {
  KeyaDatabase,
  ApiKey,
  Group,
  Settings,
  InboxItem,
  InboxItemType,
  InboxItemStatus,
  InboxArchiveReason,
} from './types';
export {
  DEFAULT_GROUPS,
  DEFAULT_SETTINGS,
  ENDPOINT_DEFAULTS,
  EXPIRY_REMINDER_DAYS,
} from './types';

// Crypto
export { initCrypto, packEncrypted, decryptRaw, deriveKey } from './crypto';

// Schema (.keya file format)
export {
  createHeader,
  parseHeader,
  createEncParams,
  parseEncParams,
  computeHMAC,
  verifyHMAC,
  serializeToFile,
  deserializeFromFile,
} from './schema';
export type { HeaderMeta, EncParams } from './schema';

// Database
export { Database, createEmptyDatabase } from './database';

// Inbox
export {
  collectExpiryAlerts,
  getDaysUntilExpiry,
  syncInboxWithAlerts,
} from './inbox';
export type { ExpiryAlert, InboxSyncSummary } from './inbox';

export {
  getConnectionStatusLabel,
  getDaysUntilExpiry as getDaysUntilKeyExpiry,
  getExpiryStatus,
  getExpiryStatusLabel,
} from './key-status';
