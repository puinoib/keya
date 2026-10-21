/**
 * Container-level constants for .keya version 2.
 *
 * These describe the byte layout only. Payload limits live in
 * `core/payload/limits.ts`.
 */

/** "KEYA" — identical for every version, which is why `version` exists. */
export const MAGIC = new Uint8Array([0x4b, 0x45, 0x59, 0x41]);

/** The only version this build understands (§15). */
export const VERSION = 2;

/** magic(4) version(2) kdf_ops(4) kdf_mem(4) salt(16) nonce(24) */
export const PREAMBLE_SIZE = 54;
export const VERSION_OFFSET = 4;
export const VERSION_SIZE = 2;
export const KDF_OPS_OFFSET = 6;
export const KDF_MEM_OFFSET = 10;
export const SALT_OFFSET = 14;
export const SALT_SIZE = 16;
export const NONCE_OFFSET = 30;
export const NONCE_SIZE = 24;

/** Poly1305 tag appended to the ciphertext. */
export const TAG_SIZE = 16;

/** A file shorter than this cannot hold a preamble and a tag. */
export const MIN_FILE_SIZE = PREAMBLE_SIZE + TAG_SIZE;

/**
 * Hard input cap. Derived from the payload limits (see the format spec §6.2);
 * also the memory guard applied before `JSON.parse`.
 */
export const MAX_FILE_SIZE = 33_554_432;

/**
 * Argon2id policy. `mem` is capped by the weakest target device available heap
 * and is a version constant; `ops` has headroom inside v2 (10 -> 16).
 */
export const KDF_DEFAULT_OPS = 10;
export const KDF_DEFAULT_MEM = 67_108_864;
export const KDF_OPS_MIN = 2;
export const KDF_OPS_MAX = 16;
export const KDF_MEM_MIN = 19_922_944; // 19 MiB
export const KDF_MEM_MAX = 67_108_864; // 64 MiB
/** 2 x 19 MiB, i.e. the OWASP/RFC 9106 floor expressed as ops x mem. */
export const KDF_WORK_MIN = 39_845_888;
/** 16 x 64 MiB — the CPU-time guard against a crafted preamble. */
export const KDF_WORK_MAX = 1_073_741_824;

export const SEND_PREFIX = 'keya/send/1';
export const OBS_PREFIX = 'keya/obs/1';
export const CONTAINER_PREFIX = 'keya/container/1';

export interface KdfParams {
  ops: number;
  mem: number;
}

/**
 * Whether a file's KDF parameters sit inside the envelope this version accepts.
 * Checked *before* deriving, because the preamble is not authenticated yet.
 */
export function isKdfParamsAccepted(params: KdfParams): boolean {
  const { ops, mem } = params;
  if (!Number.isInteger(ops) || !Number.isInteger(mem)) return false;
  if (ops < KDF_OPS_MIN || ops > KDF_OPS_MAX) return false;
  if (mem < KDF_MEM_MIN || mem > KDF_MEM_MAX) return false;
  const work = ops * mem;
  return work >= KDF_WORK_MIN && work <= KDF_WORK_MAX;
}
