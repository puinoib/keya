/**
 * Encryption module using libsodium (Argon2id + XChaCha20-Poly1305)
 *
 * libsodium carries a WebAssembly payload that only matters once a vault is
 * opened or created, so it is imported lazily instead of at module load. Every
 * entry point awaits `initCrypto()`; the synchronous helpers below refuse to
 * run before it resolves.
 */

type SodiumModule = typeof import('libsodium-wrappers-sumo').default;

let sodium: SodiumModule | null = null;
let loading: Promise<void> | null = null;

export function initCrypto(): Promise<void> {
  loading ??= (async () => {
    const module = await import('libsodium-wrappers-sumo');
    await module.default.ready;
    sodium = module.default;
  })();
  return loading;
}

/**
 * The loaded libsodium module. Every crypto helper goes through this so a late
 * import cannot leave a call site holding an undefined module.
 */
export function requireSodium(): SodiumModule {
  if (!sodium) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
  return sodium;
}

/** Generate 16-byte random salt (libsodium crypto_pwhash requirement) */
export function generateSalt(): Uint8Array {
  const s = requireSodium();
  return s.randombytes_buf(s.crypto_pwhash_SALTBYTES);
}

/** Generate 24-byte random nonce */
export function generateNonce(): Uint8Array {
  const s = requireSodium();
  return s.randombytes_buf(24);
}

/** Pre-hash password for KDF input (enables future keyfile support) */
export function preHashPassword(password: string): Uint8Array {
  const s = requireSodium();
  return s.crypto_hash_sha256(s.from_string(password));
}

/** Derive 256-bit key from password using Argon2id */
export function deriveKey(
  password: string | Uint8Array,
  salt: Uint8Array,
  ops: number = 10,
  mem: number = 67108864
): Uint8Array {
  const s = requireSodium();
  const algo: number = s.crypto_pwhash_ALG_ARGON2ID13 ?? 2;
  return s.crypto_pwhash(32, password, salt, ops, mem, algo);
}

/** Combine derived key with master seed to produce final encryption key */
export function finalizeKey(
  derivedKey: Uint8Array,
  masterSeed: Uint8Array
): Uint8Array {
  const s = requireSodium();
  const combined = new Uint8Array(masterSeed.length + derivedKey.length);
  combined.set(masterSeed, 0);
  combined.set(derivedKey, masterSeed.length);
  return s.crypto_hash_sha256(combined);
}

/** Encrypt plaintext with key using XChaCha20-Poly1305 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  const s = requireSodium();
  return s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    key,
    null
  );
}

/** Decrypt ciphertext with key using XChaCha20-Poly1305 */
export function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): Uint8Array {
  const s = requireSodium();
  const result = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonce,
    key,
    null
  );
  if (!result) {
    throw new Error('Decryption failed: wrong password or corrupted data');
  }
  return result;
}
