/**
 * One AEAD message per file (§3.4, §3.6).
 *
 * `ciphertext = file[54..EOF)` — there is no length field, so truncation and
 * appended bytes fail authentication rather than being trimmed away. The AAD is
 * the preamble itself, which means the KDF parameters, salt and nonce are
 * authenticated by the same operation that decrypts the payload.
 */

import {
  NONCE_SIZE,
  PREAMBLE_SIZE,
  TAG_SIZE,
  VERSION,
  type KdfParams,
} from './constants';
import {
  encodePreamble,
  inspectContainer,
  nonceOf,
  type Preamble,
  type ReadFailure,
} from './preamble';
import { loadSodium } from './sodium';

export interface ContainerContext {
  version?: number;
  kdf: KdfParams;
  salt: Uint8Array;
}

export interface SealOptions {
  /** Serialized payload: compact JSON, no padding. */
  payload: Uint8Array;
  fileKey: Uint8Array;
  container: ContainerContext;
  /** Newly generated nonce; callers must not reuse one. */
  nonce: Uint8Array;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generateSalt(): Uint8Array {
  return randomBytes(16);
}

export function generateNonce(): Uint8Array {
  return randomBytes(NONCE_SIZE);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

/**
 * A fresh nonce that differs from the one already on disk (I15). Comparing
 * against the previous file costs nothing and catches "reused the last nonce"
 * bugs that an in-memory counter would miss after a reload.
 */
export function freshNonce(previous: Uint8Array | null): Uint8Array {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidate = generateNonce();
    if (!previous || !sameBytes(candidate, previous)) return candidate;
  }
  throw new Error('could not generate a nonce distinct from the previous one');
}

/** Encrypt a payload into a complete file image. */
export async function sealContainer(options: SealOptions): Promise<Uint8Array> {
  const sodium = await loadSodium();
  const version = options.container.version ?? VERSION;

  const preamble: Preamble = {
    version,
    kdf: options.container.kdf,
    salt: options.container.salt,
    nonce: options.nonce,
  };
  const header = encodePreamble(preamble);

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    options.payload,
    header,
    null,
    preamble.nonce,
    options.fileKey
  );

  const file = new Uint8Array(PREAMBLE_SIZE + ciphertext.length);
  file.set(header, 0);
  file.set(ciphertext, PREAMBLE_SIZE);
  return file;
}

export type OpenResult =
  | { ok: true; payload: Uint8Array; preamble: Preamble }
  | { ok: false; failure: ReadFailure; detail?: string };

/**
 * Decrypt a file image. Every post-KDF failure is `auth_failed`: a wrong
 * password, a flipped ciphertext byte, a truncated file and an appended byte
 * must be indistinguishable to the user (§3.5).
 */
export async function openContainer(
  bytes: Uint8Array,
  fileKey: Uint8Array
): Promise<OpenResult> {
  const inspected = inspectContainer(bytes);
  if (!inspected.ok) {
    return { ok: false, failure: inspected.failure, detail: inspected.detail };
  }

  const sodium = await loadSodium();
  const header = bytes.slice(0, PREAMBLE_SIZE);

  try {
    const payload = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      inspected.ciphertext,
      header,
      inspected.preamble.nonce,
      fileKey
    );
    if (!payload) return { ok: false, failure: 'auth_failed' };
    return { ok: true, payload, preamble: inspected.preamble };
  } catch {
    return { ok: false, failure: 'auth_failed' };
  }
}

/** Nonce of an existing file image, or null when it is not readable as one. */
export function previousNonceOf(bytes: Uint8Array | null): Uint8Array | null {
  if (!bytes) return null;
  return nonceOf(bytes);
}

export { TAG_SIZE };
