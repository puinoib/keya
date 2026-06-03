// @keya/core — public API
// Types
export type { KeyaDatabase, ApiKey, Group, Settings } from './types';
export { DEFAULT_GROUPS, DEFAULT_SETTINGS, ENDPOINT_DEFAULTS } from './types';

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
