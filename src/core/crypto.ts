/**
 * Encryption module using libsodium (Argon2id + XChaCha20-Poly1305)
 */
import sodium from 'libsodium-wrappers-sumo';

let initialized = false;

export async function initCrypto(): Promise<void> {
  if (!initialized) {
    await sodium.ready;
    initialized = true;
  }
}

function ensureInit(): void {
  if (!initialized) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
}

/** Generate 16-byte random salt (libsodium crypto_pwhash requirement) */
export function generateSalt(): Uint8Array {
  ensureInit();
  return sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
}

/** Generate 24-byte random nonce */
export function generateNonce(): Uint8Array {
  ensureInit();
  return sodium.randombytes_buf(24);
}

/** Pre-hash password for KDF input (enables future keyfile support) */
export function preHashPassword(password: string): Uint8Array {
  ensureInit();
  return sodium.crypto_hash_sha256(sodium.from_string(password));
}

/** Derive 256-bit key from password using Argon2id */
export function deriveKey(
  password: string | Uint8Array,
  salt: Uint8Array,
  ops: number = 10,
  mem: number = 67108864
): Uint8Array {
  ensureInit();
  const algo: number = (sodium as any).crypto_pwhash_ALG_ARGON2ID13 ?? 2;
  return sodium.crypto_pwhash(32, password, salt, ops, mem, algo);
}

/** Combine derived key with master seed to produce final encryption key */
export function finalizeKey(
  derivedKey: Uint8Array,
  masterSeed: Uint8Array
): Uint8Array {
  ensureInit();
  const combined = new Uint8Array(masterSeed.length + derivedKey.length);
  combined.set(masterSeed, 0);
  combined.set(derivedKey, masterSeed.length);
  return sodium.crypto_hash_sha256(combined);
}

/** Encrypt plaintext with key using XChaCha20-Poly1305 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  ensureInit();
  return sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext, null, null, nonce, key, null
  );
}

/** Decrypt ciphertext with key using XChaCha20-Poly1305 */
export function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array {
  ensureInit();
  const result = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, ciphertext, null, nonce, key, null
  );
  if (!result) {
    throw new Error('Decryption failed: wrong password or corrupted data');
  }
  return result;
}
