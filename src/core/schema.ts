/**
 * .keya file format — binary read/write
 *
 * File layout:
 *   Header (128B) | EncParams (96B) | PayloadLen (4B) | Payload (N) | HMAC (32B)
 */

import type { KeyaDatabase } from './types';
import { encryptDatabase, decryptRaw, deriveKey, initCrypto } from './crypto';
import sodium from 'libsodium-wrappers-sumo';

// ── Constants ──

const MAGIC = new TextEncoder().encode('KEYA');
const HEADER_SIZE = 128;
const ENC_PARAMS_SIZE = 96;
const HMAC_SIZE = 32;
const PREAMBLE_SIZE = HEADER_SIZE + ENC_PARAMS_SIZE; // everything before payload

// ── Header ──

export function createHeader(
  fileId: string,
  created: Date = new Date()
): Uint8Array {
  const buf = new Uint8Array(HEADER_SIZE);
  let off = 0;

  // Magic: 4 bytes "KEYA"
  buf.set(MAGIC, off);
  off += 4;

  // Version: uint16 LE = 1
  new DataView(buf.buffer).setUint16(off, 1, true);
  off += 2;

  // Flags: uint16 LE = 0 (reserved)
  new DataView(buf.buffer).setUint16(off, 0, true);
  off += 2;

  // FileID: 16 bytes UUID as hex
  const hex = fileId.replace(/-/g, '');
  for (let i = 0; i < 16; i++) {
    buf[off + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  off += 16;

  // Created / Modified: uint64 LE (writes as uint32 x2 since JS is limited)
  const createdSec = BigInt(Math.floor(created.getTime() / 1000));
  new DataView(buf.buffer).setBigUint64(off, createdSec, true);
  off += 8;
  new DataView(buf.buffer).setBigUint64(off, createdSec, true);
  off += 8;

  // Remaining 88 bytes are zero (already zero-filled)
  return buf;
}

export interface HeaderMeta {
  version: number;
  flags: number;
  fileId: string;
  created: Date;
  modified: Date;
}

export function parseHeader(buf: Uint8Array): HeaderMeta {
  const dv = new DataView(buf.buffer, buf.byteOffset, HEADER_SIZE);
  let off = 0;

  // Verify magic
  const magic = buf.slice(off, off + 4);
  if (new TextDecoder().decode(magic) !== 'KEYA') {
    throw new Error('Not a valid .keya file (bad magic)');
  }
  off += 4;

  const version = dv.getUint16(off, true);
  off += 2;
  const flags = dv.getUint16(off, true);
  off += 2;

  // FileID: 16 bytes → UUID string
  const hexParts: string[] = [];
  for (let i = 0; i < 16; i++) {
    hexParts.push(buf[off + i].toString(16).padStart(2, '0'));
  }
  off += 16;
  const fileId = [
    hexParts.slice(0, 4).join(''),
    hexParts.slice(4, 6).join(''),
    hexParts.slice(6, 8).join(''),
    hexParts.slice(8, 10).join(''),
    hexParts.slice(10, 16).join(''),
  ].join('-');

  const createdSec = Number(dv.getBigUint64(off, true));
  off += 8;
  const modifiedSec = Number(dv.getBigUint64(off, true));
  off += 8;

  return {
    version,
    flags,
    fileId,
    created: new Date(createdSec * 1000),
    modified: new Date(modifiedSec * 1000),
  };
}

// ── Encryption Params ──

export interface EncParams {
  ops: number;
  mem: number;
  salt: Uint8Array;
  nonce: Uint8Array;
}

export function createEncParams(
  salt: Uint8Array,
  nonce: Uint8Array
): Uint8Array {
  const buf = new Uint8Array(ENC_PARAMS_SIZE);
  const dv = new DataView(buf.buffer);
  let off = 0;

  // KDF Algo: 0x0001 = Argon2id
  dv.setUint16(off, 0x0001, true);
  off += 2;

  // OpsLimit: 3
  dv.setUint32(off, 3, true);
  off += 4;

  // MemLimit: 65536
  dv.setUint32(off, 65536, true);
  off += 4;

  // SaltLen + Salt
  dv.setUint16(off, salt.length, true);
  off += 2;
  buf.set(salt, off);
  off += salt.length;

  // NonceLen + Nonce
  dv.setUint16(off, nonce.length, true);
  off += 2;
  buf.set(nonce, off);
  off += nonce.length;

  // Enc Algo: 0x0001 = XChaCha20-Poly1305
  dv.setUint16(off, 0x0001, true);

  return buf;
}

export function parseEncParams(buf: Uint8Array): EncParams {
  const dv = new DataView(buf.buffer, buf.byteOffset, ENC_PARAMS_SIZE);
  let off = 0;

  // KDF algo
  const kdf = dv.getUint16(off, true);
  off += 2;
  if (kdf !== 0x0001)
    throw new Error(`Unsupported KDF algorithm: 0x${kdf.toString(16)}`);

  const ops = dv.getUint32(off, true);
  off += 4;
  const mem = dv.getUint32(off, true);
  off += 4;

  const saltLen = dv.getUint16(off, true);
  off += 2;
  const salt = buf.slice(off, off + saltLen);
  off += saltLen;

  const nonceLen = dv.getUint16(off, true);
  off += 2;
  const nonce = buf.slice(off, off + nonceLen);
  off += nonceLen;

  const encAlgo = dv.getUint16(off, true);
  if (encAlgo !== 0x0001)
    throw new Error(
      `Unsupported encryption algorithm: 0x${encAlgo.toString(16)}`
    );

  return { ops, mem, salt, nonce };
}

// ── HMAC ──

export async function computeHMAC(data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('keya-hmac-key').buffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    data.slice().buffer as ArrayBuffer
  );
  return new Uint8Array(sig);
}

export async function verifyHMAC(
  data: Uint8Array,
  expected: Uint8Array
): Promise<boolean> {
  const computed = await computeHMAC(data);
  if (computed.length !== expected.length) return false;
  return computed.every((b, i) => b === expected[i]);
}

// ── Full file read/write ──

export async function serializeToFile(
  db: KeyaDatabase,
  password: string
): Promise<Uint8Array> {
  await initCrypto();

  const json = JSON.stringify(db, null, 2);
  const { salt, nonce, encrypted } = encryptDatabase(json, password);

  // Backward compatibility: accept file_id if vault_id is missing
  const vaultId = db.vault_id || (db as any).file_id;
  const header = createHeader(vaultId, new Date(db.created_at));
  const params = createEncParams(salt, nonce);

  // Payload
  const payloadLen = new Uint8Array(4);
  new DataView(payloadLen.buffer).setUint32(0, encrypted.length, true);

  // Assemble (without HMAC)
  const preamble = new Uint8Array(PREAMBLE_SIZE);
  preamble.set(header, 0);
  preamble.set(params, HEADER_SIZE);

  const total = PREAMBLE_SIZE + 4 + encrypted.length + HMAC_SIZE;
  const file = new Uint8Array(total);
  file.set(preamble, 0);
  file.set(payloadLen, PREAMBLE_SIZE);
  file.set(encrypted, PREAMBLE_SIZE + 4);

  // HMAC over everything before it
  const preHMAC = file.slice(0, total - HMAC_SIZE);
  const hmac = await computeHMAC(preHMAC);
  file.set(hmac, total - HMAC_SIZE);

  return file;
}

export async function deserializeFromFile(
  fileBytes: Uint8Array,
  password: string
): Promise<KeyaDatabase> {
  await initCrypto();

  // Verify HMAC
  const preHMAC = fileBytes.slice(0, fileBytes.length - HMAC_SIZE);
  const storedHMAC = fileBytes.slice(fileBytes.length - HMAC_SIZE);
  if (!(await verifyHMAC(preHMAC, storedHMAC))) {
    throw new Error('File integrity check failed (HMAC mismatch)');
  }

  // Parse header
  const header = parseHeader(fileBytes.slice(0, HEADER_SIZE));

  // Parse encryption params
  const params = parseEncParams(fileBytes.slice(HEADER_SIZE, PREAMBLE_SIZE));

  // Read payload length and encrypted data
  const payloadLen = new DataView(
    fileBytes.buffer,
    fileBytes.byteOffset + PREAMBLE_SIZE,
    4
  ).getUint32(0, true);
  const encrypted = fileBytes.slice(
    PREAMBLE_SIZE + 4,
    PREAMBLE_SIZE + 4 + payloadLen
  );

  // Decrypt
  const key = deriveKey(password, params.salt);
  const plaintext = decryptRaw(encrypted, params.nonce, key);
  const json = sodium.to_string(plaintext);
  const db = JSON.parse(json) as KeyaDatabase;

  // Backward compatibility: migrate file_id → vault_id
  if (!db.vault_id && (db as any).file_id) {
    db.vault_id = (db as any).file_id;
    delete (db as any).file_id;
  }

  // Default vault metadata for old files without these fields
  if (!db.name) db.name = '';
  if (!db.icon || db.icon === '🔐') db.icon = '';
  // Remove deprecated fields from old files
  delete (db as any).description;
  delete (db as any).color;
  // Remove status/notes from individual keys in old files
  for (const k of db.api_keys) {
    delete (k as any).status;
    delete (k as any).notes;
    if (k.expires_at === undefined) (k as any).expires_at = null;
    if (!(k as any).connection_check) {
      (k as any).connection_check = {
        status:
          (k as any).test_status === 'success'
            ? 'success'
            : (k as any).test_status === 'failed'
              ? 'failed'
              : 'untested',
        checked_at: (k as any).last_tested ?? null,
        latency_ms: (k as any).test_latency_ms ?? null,
        error_message: null,
      };
    }
    delete (k as any).last_tested;
    delete (k as any).test_status;
    delete (k as any).test_latency_ms;
  }

  // Default new settings fields for old files
  if (db.settings.auto_test_on_save === undefined)
    db.settings.auto_test_on_save = false;
  if (db.settings.auto_test_daily === undefined)
    db.settings.auto_test_daily = false;
  if ((db.settings as any).clipboard_detection_on_add === undefined)
    (db.settings as any).clipboard_detection_on_add = true;
  if (db.settings.custom_providers === undefined)
    db.settings.custom_providers = [];
  if (db.settings.disabled_providers === undefined)
    db.settings.disabled_providers = [];
  if ((db.settings as any).keyboard_shortcuts === undefined)
    (db.settings as any).keyboard_shortcuts = {};
  if (!Array.isArray((db as any).inbox)) (db as any).inbox = [];

  // Update modified time from header
  db.updated_at = header.modified.toISOString();

  return db;
}
