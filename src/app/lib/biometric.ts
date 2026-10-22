/**
 * Biometric unlock via WebAuthn platform authenticator.
 *
 * When the PRF extension is supported, the encryption key is derived from the
 * biometric credential itself (never stored in any database). PRF is required;
 * legacy records containing encryption keys are removed.
 */

import { openMetaDB, BIOMETRIC_STORE } from '../storage/biometric-db';

/**
 * Where the wrapped password lives. Injected so the no-downgrade rule can be
 * tested without a browser, and so the storage choice stays a detail.
 */
export interface BiometricRecordStore {
  get(vaultId: string): Promise<BiometricRecord | null>;
  put(record: BiometricRecord): Promise<void>;
  delete(vaultId: string): Promise<void>;
}

export interface BiometricDeps {
  store?: BiometricRecordStore;
  credentials?: CredentialsContainer;
  /** Relying-party id; the hostname in the browser. */
  rpId?: string;
}

// ── Types ──

export interface BiometricRecord {
  vault_id: string;
  credentialId: Uint8Array;
  encryptedPassword: string;
  iv: string;
  createdAt: string;
  prfSalt?: string;
  aesKey?: string;
}

// ── Helpers ──

function toBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function toBuffer(source: Uint8Array): ArrayBuffer {
  return source.buffer.slice(
    source.byteOffset,
    source.byteOffset + source.byteLength
  ) as ArrayBuffer;
}

// ── IndexedDB ──

/** The browser's record store: one IndexedDB object store keyed by vault id. */
export function indexedDbRecordStore(): BiometricRecordStore {
  return {
    async get(vaultId) {
      const db = await openMetaDB();
      return new Promise((resolve) => {
        const tx = db.transaction(BIOMETRIC_STORE, 'readonly');
        const req = tx.objectStore(BIOMETRIC_STORE).get(vaultId);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    },
    async put(record) {
      const db = await openMetaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(BIOMETRIC_STORE, 'readwrite');
        tx.objectStore(BIOMETRIC_STORE).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async delete(vaultId) {
      const db = await openMetaDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(BIOMETRIC_STORE, 'readwrite');
        tx.objectStore(BIOMETRIC_STORE).delete(vaultId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}

let browserStore: BiometricRecordStore | null = null;

function recordStore(deps: BiometricDeps): BiometricRecordStore {
  if (deps.store) return deps.store;
  browserStore ??= indexedDbRecordStore();
  return browserStore;
}

function credentialsOf(deps: BiometricDeps): CredentialsContainer {
  return deps.credentials ?? navigator.credentials;
}

// ── AES-GCM encrypt/decrypt ──

async function aesEncrypt(
  plaintext: string,
  key: Uint8Array | CryptoKey,
  iv: Uint8Array
): Promise<string> {
  const cryptoKey =
    key instanceof CryptoKey
      ? key
      : await crypto.subtle.importKey(
          'raw',
          toBuffer(key),
          { name: 'AES-GCM' },
          false,
          ['encrypt']
        );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );
  return toBase64(new Uint8Array(encrypted));
}

async function aesDecrypt(
  ciphertext: string,
  key: Uint8Array | CryptoKey,
  iv: Uint8Array
): Promise<string> {
  const cryptoKey =
    key instanceof CryptoKey
      ? key
      : await crypto.subtle.importKey(
          'raw',
          toBuffer(key),
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toBuffer(iv) },
    cryptoKey,
    toBuffer(fromBase64(ciphertext))
  );
  return new TextDecoder().decode(decrypted);
}

// ── WebAuthn PRF ──

function rpIdOf(deps: BiometricDeps): string {
  return deps.rpId ?? location.hostname;
}

async function deriveKeyFromPrf(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    prfOutput,
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode('keya-biometric-v1'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Perform a separate get() to evaluate PRF when create() didn't return results. */
async function evalPrf(
  credentialId: ArrayBuffer,
  prfSalt: Uint8Array,
  deps: BiometricDeps
): Promise<ArrayBuffer | null> {
  try {
    const assertion = (await credentialsOf(deps).get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: rpIdOf(deps),
        allowCredentials: [{ id: credentialId, type: 'public-key' }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: toBuffer(prfSalt) } } },
      },
    })) as PublicKeyCredential;
    return (
      (assertion?.getClientExtensionResults().prf?.results
        ?.first as ArrayBuffer) ?? null
    );
  } catch {
    return null;
  }
}

// ── Public API ──

export function isBiometricSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
      'function'
  );
}

export async function isBiometricRegistered(
  vaultId: string,
  deps: BiometricDeps = {}
): Promise<boolean> {
  const store = recordStore(deps);
  const record = await store.get(vaultId);
  if (record?.aesKey) {
    await store.delete(vaultId);
    return false;
  }
  return !!record?.prfSalt;
}

/**
 * Register biometric credential and store encrypted password.
 * Requires PRF; never falls back to storing an encryption key.
 */
export async function registerBiometric(
  vaultId: string,
  password: string,
  deps: BiometricDeps = {}
): Promise<void> {
  const store = recordStore(deps);
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));

  // Step 1: Create WebAuthn credential (triggers Touch ID / Face ID)
  const credential = (await credentialsOf(deps).create({
    publicKey: {
      rp: { id: rpIdOf(deps), name: 'Keya' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(32)),
        name: `keya-vault-${vaultId}`,
        displayName: 'Keya Vault',
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      extensions: { prf: { eval: { first: toBuffer(prfSalt) } } },
    },
  })) as PublicKeyCredential;

  if (!credential) throw new Error('Biometric registration cancelled.');

  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Step 2: Try PRF path
  const prfExt = credential.getClientExtensionResults().prf;
  let prfOutput: ArrayBuffer | undefined;

  if (prfExt?.enabled) {
    prfOutput = prfExt.results?.first as ArrayBuffer | undefined;
    // If create() didn't return PRF output, try a separate get()
    if (!prfOutput) {
      prfOutput = (await evalPrf(credential.rawId, prfSalt, deps)) ?? undefined;
    }
  }

  if (prfOutput) {
    const aesKey = await deriveKeyFromPrf(prfOutput);
    const encryptedPassword = await aesEncrypt(password, aesKey, iv);
    await store.put({
      vault_id: vaultId,
      credentialId: new Uint8Array(credential.rawId),
      encryptedPassword,
      iv: toBase64(iv),
      prfSalt: toBase64(prfSalt),
      createdAt: new Date().toISOString(),
    });
    return;
  }

  throw new Error(
    'This passkey storage location does not support the WebAuthn PRF required for secure biometric unlock. Choose Google Password Manager or iCloud Keychain, then try again. You can also use your master password.'
  );
}

/**
 * Authenticate via biometric and return decrypted vault password.
 * Automatically detects PRF or legacy mode from the stored record.
 */
export async function unlockWithBiometric(
  vaultId: string,
  deps: BiometricDeps = {}
): Promise<string> {
  const store = recordStore(deps);
  const record = await store.get(vaultId);
  if (!record) throw new Error('No biometric credential found for this vault.');

  if (record.prfSalt) {
    // PRF mode: derive key from biometric + credential
    const assertion = (await credentialsOf(deps).get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: rpIdOf(deps),
        allowCredentials: [
          { id: toBuffer(record.credentialId), type: 'public-key' },
        ],
        userVerification: 'required',
        extensions: {
          prf: { eval: { first: toBuffer(fromBase64(record.prfSalt)) } },
        },
      },
    })) as PublicKeyCredential;

    if (!assertion) throw new Error('Biometric authentication cancelled.');

    const prfOutput = assertion.getClientExtensionResults().prf?.results
      ?.first as ArrayBuffer | undefined;
    if (!prfOutput) throw new Error('PRF evaluation failed.');

    const aesKey = await deriveKeyFromPrf(prfOutput);
    return aesDecrypt(record.encryptedPassword, aesKey, fromBase64(record.iv));
  }

  await store.delete(vaultId);
  throw new Error(
    'Legacy biometric credentials were removed. Unlock with your master password.'
  );
}

/**
 * Remove biometric credential for a vault.
 */
export async function removeBiometric(
  vaultId: string,
  deps: BiometricDeps = {}
): Promise<void> {
  await recordStore(deps).delete(vaultId);
}
