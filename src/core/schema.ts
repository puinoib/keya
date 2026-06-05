/**
 * .keya file format — binary read/write
 *
 * V1 layout:
 *   Header (128B) | EncParams (96B) | PayloadLen (4B) | Payload (N)
 *
 * V2 layout:
 *   Header (128B) | HeaderHash (32B) | EncParams (96B) | PayloadLen (4B) | Payload (N)
 *
 * Header layout (128B):
 *   [Magic 4B] [Version 2B] [Flags 2B] [FileID 16B]
 *   [Created 8B] [Modified 8B] [MasterSeed 32B] [Reserved 56B]
 */

import type { KeyaDatabase } from './types';
import {
  generateSalt,
  generateNonce,
  deriveKey,
  preHashPassword,
  finalizeKey,
  encrypt,
  decrypt,
  initCrypto,
} from './crypto';
import sodium from 'libsodium-wrappers-sumo';

// ── Constants ──

const MAGIC = new TextEncoder().encode('KEYA');
const HEADER_SIZE = 128;
const HEADER_HASH_SIZE = 32;
const ENC_PARAMS_SIZE = 96;
const PAD_BLOCK_SIZE = 4096;
const MASTER_SEED_SIZE = 32;

const DEFAULT_OPS = 10;
const DEFAULT_MEM = 65536;

// ── Version helpers ──

function preambleSize(version: number): number {
  return version >= 2
    ? HEADER_SIZE + HEADER_HASH_SIZE + ENC_PARAMS_SIZE
    : HEADER_SIZE + ENC_PARAMS_SIZE;
}

function encParamsOffset(version: number): number {
  return version >= 2 ? HEADER_SIZE + HEADER_HASH_SIZE : HEADER_SIZE;
}

// ── Header ──

export function createHeader(
  fileId: string,
  masterSeed: Uint8Array,
  version: number,
  created: Date = new Date(),
  modified: Date = new Date()
): Uint8Array {
  const buf = new Uint8Array(HEADER_SIZE);
  let off = 0;

  // Magic: 4 bytes "KEYA"
  buf.set(MAGIC, off);
  off += 4;

  // Version: uint16 LE
  new DataView(buf.buffer).setUint16(off, version, true);
  off += 2;

  // Flags: uint16 LE = 0 (reserved)
  new DataView(buf.buffer).setUint16(off, 0, true);
  off += 2;

  // FileID: 16 bytes UUID as raw bytes
  const hex = fileId.replace(/-/g, '');
  for (let i = 0; i < 16; i++) {
    buf[off + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  off += 16;

  // Created / Modified: uint64 LE
  const createdSec = BigInt(Math.floor(created.getTime() / 1000));
  const modifiedSec = BigInt(Math.floor(modified.getTime() / 1000));
  new DataView(buf.buffer).setBigUint64(off, createdSec, true);
  off += 8;
  new DataView(buf.buffer).setBigUint64(off, modifiedSec, true);
  off += 8;

  // MasterSeed: 32 bytes
  buf.set(masterSeed, off);

  // Remaining 56 bytes are zero (already zero-filled)
  return buf;
}

export interface HeaderMeta {
  version: number;
  flags: number;
  fileId: string;
  masterSeed: Uint8Array;
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

  // MasterSeed: 32 bytes
  const masterSeed = buf.slice(off, off + MASTER_SEED_SIZE);

  return {
    version,
    flags,
    fileId,
    masterSeed,
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
  nonce: Uint8Array,
  ops: number = DEFAULT_OPS,
  mem: number = DEFAULT_MEM
): Uint8Array {
  const buf = new Uint8Array(ENC_PARAMS_SIZE);
  const dv = new DataView(buf.buffer);
  let off = 0;

  // KDF Algo: 0x0001 = Argon2id
  dv.setUint16(off, 0x0001, true);
  off += 2;

  // OpsLimit
  dv.setUint32(off, ops, true);
  off += 4;

  // MemLimit
  dv.setUint32(off, mem, true);
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

// ── Padding ──

/** Pad data with spaces to next 4096-byte boundary (spaces are valid JSON whitespace) */
function padToBlock(data: Uint8Array): Uint8Array {
  const remainder = data.length % PAD_BLOCK_SIZE;
  if (remainder === 0) return data;
  const padding = PAD_BLOCK_SIZE - remainder;
  const padded = new Uint8Array(data.length + padding);
  padded.set(data, 0);
  padded.fill(0x20, data.length);
  return padded;
}

// ── Full file read/write ──

export async function serializeToFile(
  db: KeyaDatabase,
  password: string
): Promise<Uint8Array> {
  await initCrypto();

  // Always save as V2
  const version = 2;

  // Generate cryptographic material
  const masterSeed = sodium.randombytes_buf(MASTER_SEED_SIZE);
  const salt = generateSalt();
  const nonce = generateNonce();

  // Derive final encryption key: pre-hash → Argon2id → SHA-256(masterSeed + derivedKey)
  const keyInput = preHashPassword(password);
  const derivedKey = deriveKey(keyInput, salt, DEFAULT_OPS, DEFAULT_MEM);
  const finalKey = finalizeKey(derivedKey, masterSeed);

  // Serialize and pad JSON (compact, no pretty-print)
  const json = JSON.stringify(db);
  const plaintext = padToBlock(sodium.from_string(json));

  // Encrypt
  const encrypted = encrypt(plaintext, finalKey, nonce);

  // Build header
  const header = createHeader(
    db.vault_id,
    masterSeed,
    version,
    new Date(db.created_at),
    new Date(db.updated_at)
  );

  // Compute header hash
  const headerHash = sodium.crypto_hash_sha256(header);

  // Build enc params with V2 defaults
  const params = createEncParams(salt, nonce, DEFAULT_OPS, DEFAULT_MEM);

  // Assemble file
  const pre = preambleSize(version);
  const payloadLen = new Uint8Array(4);
  new DataView(payloadLen.buffer).setUint32(0, encrypted.length, true);

  const total = pre + 4 + encrypted.length;
  const file = new Uint8Array(total);
  file.set(header, 0);
  file.set(headerHash, HEADER_SIZE);
  file.set(params, encParamsOffset(version));
  file.set(payloadLen, pre);
  file.set(encrypted, pre + 4);

  return file;
}

export async function deserializeFromFile(
  fileBytes: Uint8Array,
  password: string
): Promise<KeyaDatabase> {
  await initCrypto();

  // Verify header and extract version + masterSeed
  const headerMeta = parseHeader(fileBytes.slice(0, HEADER_SIZE));
  const { version } = headerMeta;

  // V2: verify header integrity before decryption
  if (version >= 2) {
    const storedHash = fileBytes.slice(
      HEADER_SIZE,
      HEADER_SIZE + HEADER_HASH_SIZE
    );
    const computedHash = sodium.crypto_hash_sha256(
      fileBytes.slice(0, HEADER_SIZE)
    );
    if (!equalBytes(storedHash, computedHash)) {
      throw new Error(
        'Header integrity check failed: file may be corrupted. Try restoring from a backup.'
      );
    }
  }

  // Parse encryption params
  const paramsOff = encParamsOffset(version);
  const params = parseEncParams(
    fileBytes.slice(paramsOff, paramsOff + ENC_PARAMS_SIZE)
  );

  // Read payload length and encrypted data
  const pre = preambleSize(version);
  const payloadLen = new DataView(
    fileBytes.buffer,
    fileBytes.byteOffset + pre,
    4
  ).getUint32(0, true);
  const encrypted = fileBytes.slice(pre + 4, pre + 4 + payloadLen);

  // Derive final encryption key
  const keyInput = version >= 2 ? preHashPassword(password) : password;
  const derivedKey = deriveKey(keyInput, params.salt, params.ops, params.mem);
  const finalKey = finalizeKey(derivedKey, headerMeta.masterSeed);

  // Decrypt and parse JSON
  const plaintext = decrypt(encrypted, params.nonce, finalKey);
  const json = sodium.to_string(plaintext).trim();
  const db = JSON.parse(json) as KeyaDatabase;

  return db;
}

// ── Helpers ──

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
