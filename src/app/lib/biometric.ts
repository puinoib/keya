/**
 * Biometric unlock via WebAuthn PRF extension.
 *
 * Uses the PRF output as an AES-GCM key to encrypt/decrypt the vault password.
 * Encrypted password is stored in IndexedDB keyed by vault_id.
 */

import { openMetaDB, BIOMETRIC_STORE } from './storage';

// ── Types ──

interface BiometricRecord {
  vault_id: string;
  credentialId: Uint8Array;
  encryptedPassword: string; // base64
  salt: string;              // base64 — PRF input
  iv: string;                // base64 — AES-GCM IV
  createdAt: string;
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
  return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
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

// ── AES-GCM encrypt/decrypt using PRF output ──

async function aesEncrypt(plaintext: string, keyBytes: Uint8Array, iv: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', toBuffer(keyBytes), { name: 'AES-GCM' }, false, ['encrypt']);
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toBuffer(iv) }, key, encoded);
  return toBase64(new Uint8Array(encrypted));
}

async function aesDecrypt(ciphertext: string, keyBytes: Uint8Array, iv: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', toBuffer(keyBytes), { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toBuffer(iv) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(decrypted);
}

// ── WebAuthn PRF helpers ──

function rpId(): string {
  return location.hostname;
}

// ── Public API ──

export function isBiometricSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

export async function isBiometricRegistered(vaultId: string): Promise<boolean> {
  const record = await getRecord(vaultId);
  return record !== null;
}

/**
 * Register biometric credential for a vault and store encrypted password.
 * Call this after the user successfully unlocks with password.
 */
export async function registerBiometric(vaultId: string, password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Step 1: Create credential with PRF enabled
  const credential = await navigator.credentials.create({
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
      extensions: {
        prf: {},
      },
    },
  }) as PublicKeyCredential;

  if (!credential) throw new Error('Biometric registration cancelled.');

  const credentialId = new Uint8Array(credential.rawId);

  // Step 2: Immediately authenticate to get PRF output
  const prfKey = await evaluatePrf(credentialId, salt);

  // Step 3: Encrypt password and store
  const encryptedPassword = await aesEncrypt(password, prfKey, iv);
  await putRecord({
    vault_id: vaultId,
    credentialId,
    encryptedPassword,
    salt: toBase64(salt),
    iv: toBase64(iv),
    createdAt: new Date().toISOString(),
  });
}

/**
 * Authenticate with an existing credential and evaluate PRF.
 */
async function evaluatePrf(credentialId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId(),
      allowCredentials: [{
        id: toBuffer(credentialId),
        type: 'public-key',
      }],
      userVerification: 'required',
      extensions: {
        prf: { eval: { first: toBuffer(salt) } },
      },
    },
  }) as PublicKeyCredential;

  if (!assertion) throw new Error('Biometric authentication cancelled.');

  const results = assertion.getClientExtensionResults();
  const prfFirst = results.prf?.results?.first;
  if (!prfFirst) throw new Error('PRF not supported by this device.');
  return new Uint8Array(prfFirst);
}

/**
 * Unlock a vault using biometric authentication.
 * Returns the decrypted vault password.
 */
export async function unlockWithBiometric(vaultId: string): Promise<string> {
  const record = await getRecord(vaultId);
  if (!record) throw new Error('No biometric credential found for this vault.');

  const salt = fromBase64(record.salt);
  const prfKey = await evaluatePrf(record.credentialId, salt);
  const iv = fromBase64(record.iv);
  return aesDecrypt(record.encryptedPassword, prfKey, iv);
}

/**
 * Remove biometric credential for a vault.
 */
export async function removeBiometric(vaultId: string): Promise<void> {
  await deleteRecord(vaultId);
}
