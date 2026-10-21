/**
 * Preamble encoding and the staged reader checks (§3.1, §3.5).
 *
 * The preamble is the only part of a file that can be understood before the
 * password is known, so every check here is cheap and ordered: size, magic,
 * version, KDF bounds. Authentication happens later, and because the parameters
 * are unauthenticated until then, the bounds are a resource guard rather than a
 * trust boundary.
 */

import {
  KDF_MEM_OFFSET,
  KDF_OPS_OFFSET,
  MAGIC,
  MAX_FILE_SIZE,
  MIN_FILE_SIZE,
  NONCE_OFFSET,
  NONCE_SIZE,
  PREAMBLE_SIZE,
  SALT_OFFSET,
  SALT_SIZE,
  VERSION,
  VERSION_OFFSET,
  isKdfParamsAccepted,
  type KdfParams,
} from './constants';

export interface Preamble {
  version: number;
  kdf: KdfParams;
  salt: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Why a file could not be read. The first four happen before any password is
 * used and must be reported distinctly; `auth_failed` is the only post-KDF
 * outcome and deliberately merges wrong password, tampering, truncation and
 * appended bytes.
 */
export type ReadFailure =
  | 'file_too_short'
  | 'file_too_large'
  | 'bad_magic'
  | 'unsupported_version'
  | 'kdf_out_of_range'
  | 'auth_failed';

export type InspectResult =
  | { ok: true; preamble: Preamble; ciphertext: Uint8Array }
  | { ok: false; failure: ReadFailure; detail?: string };

const MAGIC_ASCII = 'KEYA';

function matchesMagic(bytes: Uint8Array): boolean {
  return (
    bytes[0] === MAGIC[0] &&
    bytes[1] === MAGIC[1] &&
    bytes[2] === MAGIC[2] &&
    bytes[3] === MAGIC[3]
  );
}

/**
 * Walk the reader checks that need no key material.
 *
 * `MIN_FILE_SIZE` and `PREAMBLE_SIZE` describe version 2; a future version with
 * a different layout brings its own constants and reaches this through the
 * version dispatch below.
 */
export function inspectContainer(bytes: Uint8Array): InspectResult {
  if (bytes.length < MIN_FILE_SIZE)
    return { ok: false, failure: 'file_too_short' };
  if (bytes.length > MAX_FILE_SIZE)
    return { ok: false, failure: 'file_too_large' };

  if (!matchesMagic(bytes)) {
    return { ok: false, failure: 'bad_magic', detail: MAGIC_ASCII };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint16(VERSION_OFFSET, true);

  if (version !== VERSION) {
    return {
      ok: false,
      failure: 'unsupported_version',
      detail: `v${version}`,
    };
  }

  const kdf: KdfParams = {
    ops: view.getUint32(KDF_OPS_OFFSET, true),
    mem: view.getUint32(KDF_MEM_OFFSET, true),
  };

  if (!isKdfParamsAccepted(kdf)) {
    return {
      ok: false,
      failure: 'kdf_out_of_range',
      detail: `ops=${kdf.ops} mem=${kdf.mem}`,
    };
  }

  return {
    ok: true,
    preamble: {
      version,
      kdf,
      salt: bytes.slice(SALT_OFFSET, SALT_OFFSET + SALT_SIZE),
      nonce: bytes.slice(NONCE_OFFSET, NONCE_OFFSET + NONCE_SIZE),
    },
    ciphertext: bytes.slice(PREAMBLE_SIZE),
  };
}

/** Serialize a version 2 preamble. Only `nonce` is expected to vary on save. */
export function encodePreamble(preamble: Preamble): Uint8Array {
  if (preamble.version !== VERSION) {
    throw new Error(`cannot encode preamble for version ${preamble.version}`);
  }
  if (preamble.salt.length !== SALT_SIZE) throw new Error('salt must be 16 B');
  if (preamble.nonce.length !== NONCE_SIZE)
    throw new Error('nonce must be 24 B');

  const bytes = new Uint8Array(PREAMBLE_SIZE);
  bytes.set(MAGIC, 0);

  const view = new DataView(bytes.buffer);
  view.setUint16(VERSION_OFFSET, preamble.version, true);
  view.setUint32(KDF_OPS_OFFSET, preamble.kdf.ops, true);
  view.setUint32(KDF_MEM_OFFSET, preamble.kdf.mem, true);

  bytes.set(preamble.salt, SALT_OFFSET);
  bytes.set(preamble.nonce, NONCE_OFFSET);
  return bytes;
}

/** Nonce of an existing container, for the freshness check (I15). */
export function nonceOf(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < PREAMBLE_SIZE) return null;
  return bytes.slice(NONCE_OFFSET, NONCE_OFFSET + NONCE_SIZE);
}
