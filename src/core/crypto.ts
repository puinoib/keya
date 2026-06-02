/**
 * Encryption module using libsodium (Argon2id + ChaCha20-Poly1305)
 */
import sodium from 'libsodium-wrappers';

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

/** Generate 16-byte random salt */
export function generateSalt(): Uint8Array {
  ensureInit();
  return sodium.randombytes_buf(16);
}

/** Generate 24-byte random nonce */
export function generateNonce(): Uint8Array {
  ensureInit();
  return sodium.randombytes_buf(24);
}

/** Derive 256-bit key from password using Argon2id */
export function deriveKey(password: string, salt: Uint8Array): Uint8Array {
  ensureInit();
  return sodium.crypto_pwhash(
    32,        // 256-bit key
    password,
    salt,
    3,         // opslimit (iterations)
    65536,     // memlimit (64 MB)
    sodium.crypto_pwhash_argon2id(),
  );
}

/** Encrypt plaintext with key using ChaCha20-Poly1305 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
): Uint8Array {
  ensureInit();
  return sodium.crypto_secretbox_easy(plaintext, nonce, key);
}

/** Decrypt ciphertext with key using ChaCha20-Poly1305 */
export function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array,
): Uint8Array {
  ensureInit();
  const result = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  if (!result) {
    throw new Error('Decryption failed: wrong password or corrupted data');
  }
  return result;
}

/**
 * Encrypt entire database
 * Returns: [salt (16B)] [nonce (24B)] [ciphertext+tag]
 */
export function encryptDatabase(
  data: string,
  password: string,
): Uint8Array {
  ensureInit();
  const salt = generateSalt();
  const nonce = generateNonce();
  const key = deriveKey(password, salt);
  const plaintext = sodium.from_string(data);
  const ciphertext = encrypt(plaintext, key, nonce);

  const result = new Uint8Array(salt.length + nonce.length + ciphertext.length);
  result.set(salt, 0);
  result.set(nonce, salt.length);
  result.set(ciphertext, salt.length + nonce.length);
  return result;
}

/**
 * Decrypt entire database
 */
export function decryptDatabase(
  data: Uint8Array,
  password: string,
): string {
  ensureInit();
  const salt = data.slice(0, 16);
  const nonce = data.slice(16, 40);
  const ciphertext = data.slice(40);

  const key = deriveKey(password, salt);
  const plaintext = decrypt(ciphertext, nonce, key);
  return sodium.to_string(plaintext);
}
