/**
 * Biometric unlock via WebAuthn platform authenticator.
 *
 * WebAuthn serves as a biometric UI gate (Touch ID / Face ID / Windows Hello).
 * The vault password is encrypted with a random AES-GCM key stored in IndexedDB.
 * Authentication via WebAuthn must succeed before decryption proceeds.
 */

import { openMetaDB, BIOMETRIC_STORE } from './storage';

// ── Types ──

interface BiometricRecord {
  vault_id: string;
  credentialId: Uint8Array;
  encryptedPassword: string; // base64
  aesKey: string;            // base64
  iv: string;                // base64
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

// ── AES-GCM encrypt/decrypt ──

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

// ── WebAuthn ──

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
  return record !== null && !!record.aesKey;
}

/**
 * Register biometric credential and store encrypted password.
 */
export async function registerBiometric(vaultId: string, password: string): Promise<void> {
  // Step 1: Create WebAuthn credential (triggers Touch ID / Face ID)
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
    },
  }) as PublicKeyCredential;

  if (!credential) throw new Error('Biometric registration cancelled.');

  // Step 2: Encrypt password with random AES key
  const aesKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPassword = await aesEncrypt(password, aesKey, iv);

  // Step 3: Store
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
 */
export async function unlockWithBiometric(vaultId: string): Promise<string> {
  const record = await getRecord(vaultId);
  if (!record || !record.aesKey) throw new Error('No biometric credential found for this vault.');

  // Step 1: WebAuthn authentication (triggers Touch ID / Face ID)
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId(),
      allowCredentials: [{
        id: toBuffer(record.credentialId),
        type: 'public-key',
      }],
      userVerification: 'required',
    },
  }) as PublicKeyCredential;

  if (!assertion) throw new Error('Biometric authentication cancelled.');

  // Step 2: Decrypt password
  return aesDecrypt(record.encryptedPassword, fromBase64(record.aesKey), fromBase64(record.iv));
}

/**
 * Remove biometric credential for a vault.
 */
export async function removeBiometric(vaultId: string): Promise<void> {
  await deleteRecord(vaultId);
}
