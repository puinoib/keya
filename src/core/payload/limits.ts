/**
 * Every length and count limit in the payload (§6.2).
 *
 * Limits are **UTF-8 byte lengths of the stored string**, not serialized JSON
 * lengths. The file cap in `format/constants.ts` is derived from these, so
 * changing one here means re-deriving that number.
 */

export const MAX_VAULT_NAME = 200;
export const MAX_ICON = 64;

export const MAX_PROVIDER_NAME = 100;
export const MAX_PROVIDER_DESCRIPTION = 2000;

export const MAX_KEY_NAME = 200;
export const MAX_KEY_DESCRIPTION = 2000;
export const MAX_SECRET = 8192;
export const MIN_SECRET = 1;

export const MAX_GROUP_NAME = 100;

export const MAX_URL = 2048;
export const MAX_TARGET = 2048;

export const MAX_HEADER_NAME = 64;
export const MAX_HEADER_VALUE = 256;
export const MAX_STATIC_HEADERS = 8;
export const MAX_AUTH_HEADER_NAME = 64;
export const MAX_QUERY_PARAM = 64;

export const MAX_GROUP_ORDER = 99_999;

export const MAX_KEYS = 1000;
export const MAX_GROUPS = 500;
export const MAX_PROVIDERS = 200;

/** Days before expiry that the `expiry_upcoming` reminder starts. */
export const EXPIRY_UPCOMING_DAYS = 7;

/** Days after which an observation is considered stale. */
export const OBSERVATION_STALE_DAYS = 30;
