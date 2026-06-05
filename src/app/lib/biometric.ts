/**
 * Biometric unlock via WebAuthn platform authenticator.
 *
 * When the PRF extension is supported, the encryption key is derived from the
 * biometric credential itself (never stored in any database). Falls back to
 * storing a random AES key in IndexedDB when PRF is unavailable.
 */

import { openMetaDB, BIOMETRIC_STORE } from './storage';

// ── Types ──

interface BiometricRecord {
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

async function getRecord(vaultId: string): Promise<BiometricRecord | null> {
  const db = await openMetaDB();
  return new Promise((resolve) => {
    const tx = db.transaction(BIOMETRIC_STORE, 'readonly');
    const req = tx.objectStore(BIOMETRIC_STORE).get(vaultId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function putRecord(record: BiometricRecord): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BIOMETRIC_STORE, 'readwrite');
    tx.objectStore(BIOMETRIC_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteRecord(vaultId: string): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BIOMETRIC_STORE, 'readwrite');
    tx.objectStore(BIOMETRIC_STORE).delete(vaultId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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

function rpId(): string {
  return location.hostname;
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
  prfSalt: Uint8Array
): Promise<ArrayBuffer | null> {
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: rpId(),
        allowCredentials: [{ id: credentialId, type: 'public-key' }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: toBuffer(prfSalt) } } },
      },
    })) as PublicKeyCredential;
    return (assertion?.getClientExtensionResults().prf?.results?.first as ArrayBuffer) ?? null;
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

export async function isBiometricRegistered(vaultId: string): Promise<boolean> {
  const record = await getRecord(vaultId);
  return record !== null && (!!record.aesKey || !!record.prfSalt);
}

/**
 * Register biometric credential and store encrypted password.
 * Uses PRF when available (key never stored), falls back to random AES key.
 */
export async function registerBiometric(
  vaultId: string,
  password: string
): Promise<void> {
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));

  // Step 1: Create WebAuthn credential (triggers Touch ID / Face ID)
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { id: rpId(), name: 'Keya' },
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
      prfOutput = (await evalPrf(credential.rawId, prfSalt)) ?? undefined;
    }
  }

  if (prfOutput) {
    const aesKey = await deriveKeyFromPrf(prfOutput);
    const encryptedPassword = await aesEncrypt(password, aesKey, iv);
    await putRecord({
      vault_id: vaultId,
      credentialId: new Uint8Array(credential.rawId),
      encryptedPassword,
      iv: toBase64(iv),
      prfSalt: toBase64(prfSalt),
      createdAt: new Date().toISOString(),
    });
    return;
  }

  // Step 3: Legacy fallback — random AES key stored in IndexedDB
  const aesKey = crypto.getRandomValues(new Uint8Array(32));
  const encryptedPassword = await aesEncrypt(password, aesKey, iv);
  await putRecord({
    vault_id: vaultId,
    credentialId: new Uint8Array(credential.rawId),
    encryptedPassword,
    aesKey: toBase64(aesKey),
    iv: toBase64(iv),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Authenticate via biometric and return decrypted vault password.
 * Automatically detects PRF or legacy mode from the stored record.
 */
export async function unlockWithBiometric(vaultId: string): Promise<string> {
  const record = await getRecord(vaultId);
  if (!record)
    throw new Error('No biometric credential found for this vault.');

  if (record.prfSalt) {
    // PRF mode: derive key from biometric + credential
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: rpId(),
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

    const prfOutput = assertion.getClientExtensionResults().prf?.results?.first as ArrayBuffer | undefined;
    if (!prfOutput) throw new Error('PRF evaluation failed.');

    const aesKey = await deriveKeyFromPrf(prfOutput);
    return aesDecrypt(record.encryptedPassword, aesKey, fromBase64(record.iv));
  }

  // Legacy mode: AES key from IndexedDB
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId(),
      allowCredentials: [
        { id: toBuffer(record.credentialId), type: 'public-key' },
      ],
      userVerification: 'required',
    },
  })) as PublicKeyCredential;

  if (!assertion) throw new Error('Biometric authentication cancelled.');

  return aesDecrypt(
    record.encryptedPassword,
    fromBase64(record.aesKey!),
    fromBase64(record.iv)
  );
}

/**
 * Remove biometric credential for a vault.
 */
export async function removeBiometric(vaultId: string): Promise<void> {
  await deleteRecord(vaultId);
}
