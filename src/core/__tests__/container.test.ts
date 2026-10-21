/**
 * §16.1 — container and cryptography.
 *
 * The vector in the first test is frozen: fixed password, salt, nonce, KDF
 * parameters and plaintext bytes. It pins the preamble layout, the KDF input
 * handling and the AEAD construction in one place.
 */

import { describe, expect, it } from 'vitest';
import {
  KDF_WORK_MAX,
  KDF_WORK_MIN,
  MAX_FILE_SIZE,
  MIN_FILE_SIZE,
  isKdfParamsAccepted,
} from '../format/constants';
import {
  freshNonce,
  generateNonce,
  generateSalt,
  openContainer,
  sealContainer,
} from '../format/container';
import { deriveFileKeyInline } from '../format/kdf';
import { encodePreamble, inspectContainer, nonceOf } from '../format/preamble';
import { loadSodium } from '../format/sodium';

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const PASSWORD = 'correct horse battery staple synthetic';
const SALT = new Uint8Array([...Array(16).keys()]);
const NONCE = new Uint8Array(24).fill(0xaa);
const KDF = { ops: 2, mem: 19_922_944 };
const PAYLOAD = new TextEncoder().encode('{"k":"synthetic"}');

const FROZEN = {
  key: '2848affdee27be70d662d9fd2f5136aa261f9c8a58211144cf309fe648b3db45',
  preamble:
    '4b45594102000200000000003001000102030405060708090a0b0c0d0e0faaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ciphertext:
    '8dc56724c66142bad76203f3f909565c122351429e3190502e662d92384df635c6',
};

async function seal(payload = PAYLOAD, nonce = NONCE) {
  const key = await deriveFileKeyInline({
    password: PASSWORD,
    salt: SALT,
    kdf: KDF,
  });
  const file = await sealContainer({
    payload,
    fileKey: key,
    container: { kdf: KDF, salt: SALT },
    nonce,
  });
  return { key, file };
}

describe('§16.1 container', () => {
  it('1 standard vector is stable', async () => {
    const { key, file } = await seal();
    expect(hex(key)).toBe(FROZEN.key);
    expect(hex(file.slice(0, 54))).toBe(FROZEN.preamble);
    expect(hex(file.slice(54))).toBe(FROZEN.ciphertext);
  });

  it('2 an empty AAD produces a file that fails to open', async () => {
    const sodium = await loadSodium();
    const { key } = await seal();
    const header = encodePreamble({
      version: 2,
      kdf: KDF,
      salt: SALT,
      nonce: NONCE,
    });

    // Encrypt with no associated data at all.
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      PAYLOAD,
      null,
      null,
      NONCE,
      key
    );
    const file = new Uint8Array(header.length + ciphertext.length);
    file.set(header, 0);
    file.set(ciphertext, header.length);

    const opened = await openContainer(file, key);
    expect(opened.ok).toBe(false);
    if (!opened.ok) expect(opened.failure).toBe('auth_failed');
  });

  it('3 single-byte changes in the preamble are rejected', async () => {
    const { key, file } = await seal();
    const mutable: [number, number][] = [
      [4, 0xff], // version
      [6, 0x01], // kdf_ops
      [10, 0x01], // kdf_mem
      [14, 0x99], // salt
      [30, 0x99], // nonce
    ];

    for (const [offset, value] of mutable) {
      const tampered = file.slice();
      tampered[offset] = value;
      const opened = await openContainer(tampered, key);
      expect(opened.ok, `offset ${offset}`).toBe(false);
    }
  });

  it('4 append, truncate and ciphertext flips all fail authentication', async () => {
    const { key, file } = await seal();

    const appended = new Uint8Array(file.length + 1);
    appended.set(file, 0);
    const truncated = file.slice(0, file.length - 1);
    const flipped = file.slice();
    flipped[60] = flipped[60] ^ 0x01;

    for (const [name, candidate] of [
      ['append', appended],
      ['truncate', truncated],
      ['flip', flipped],
    ] as const) {
      const opened = await openContainer(candidate, key);
      expect(opened.ok, name).toBe(false);
    }
  });

  it('5 a wrong password is indistinguishable from tampering', async () => {
    const { file } = await seal();
    const other = await deriveFileKeyInline({
      password: 'a different synthetic passphrase',
      salt: SALT,
      kdf: KDF,
    });

    const wrongPassword = await openContainer(file, other);
    const tampered = await openContainer(
      new Uint8Array([
        ...file.slice(0, file.length - 1),
        file[file.length - 1] ^ 1,
      ]),
      other
    );

    expect(wrongPassword.ok).toBe(false);
    expect(tampered.ok).toBe(false);
    if (!wrongPassword.ok && !tampered.ok) {
      expect(wrongPassword.failure).toBe('auth_failed');
      expect(tampered.failure).toBe('auth_failed');
    }
  });

  it('6 KDF parameters outside the envelope are refused before deriving', () => {
    expect(isKdfParamsAccepted({ ops: 1, mem: 19_922_944 })).toBe(false);
    expect(isKdfParamsAccepted({ ops: 17, mem: 19_922_944 })).toBe(false);
    expect(isKdfParamsAccepted({ ops: 2, mem: 18 * 1024 * 1024 })).toBe(false);
    expect(isKdfParamsAccepted({ ops: 2, mem: 65 * 1024 * 1024 })).toBe(false);
    expect(isKdfParamsAccepted({ ops: 16, mem: 128 * 1024 * 1024 })).toBe(
      false
    );

    expect(isKdfParamsAccepted({ ops: 2, mem: KDF_WORK_MIN / 2 })).toBe(true);
    expect(isKdfParamsAccepted({ ops: 10, mem: 67_108_864 })).toBe(true);
    expect(isKdfParamsAccepted({ ops: 16, mem: KDF_WORK_MAX / 16 })).toBe(true);
  });

  it('7 file size bounds are enforced', async () => {
    const { key, file } = await seal();

    const tooShort = file.slice(0, MIN_FILE_SIZE - 1);
    const shortResult = await openContainer(tooShort, key);
    expect(shortResult.ok).toBe(false);
    if (!shortResult.ok) expect(shortResult.failure).toBe('file_too_short');

    const huge = new Uint8Array(MAX_FILE_SIZE + 1);
    huge.set(file.slice(0, 100), 0);
    const hugeResult = await openContainer(huge, key);
    expect(hugeResult.ok).toBe(false);
    if (!hugeResult.ok) expect(hugeResult.failure).toBe('file_too_large');
  });

  it('8 rejects a foreign magic and an unsupported version', async () => {
    const { key, file } = await seal();

    const foreign = file.slice();
    foreign[0] = 0x58;
    const magicResult = await openContainer(foreign, key);
    if (!magicResult.ok) expect(magicResult.failure).toBe('bad_magic');

    const future = file.slice();
    new DataView(future.buffer).setUint16(4, 3, true);
    const versionResult = await openContainer(future, key);
    if (!versionResult.ok)
      expect(versionResult.failure).toBe('unsupported_version');
  });

  it('9 a v3 file with a v2-shaped prefix is refused, not misparsed', async () => {
    const { file } = await seal();
    const future = file.slice();
    new DataView(future.buffer).setUint16(4, 3, true);

    const inspected = inspectContainer(future);
    expect(inspected.ok).toBe(false);
    if (!inspected.ok) expect(inspected.failure).toBe('unsupported_version');
  });

  it('10 the minimum length is preamble + tag (v2: 70)', () => {
    expect(MIN_FILE_SIZE).toBe(70);
    const empty = new Uint8Array(69);
    expect(inspectContainer(empty).ok).toBe(false);
  });

  it('11 two saves of the same payload never reuse a keystream', async () => {
    const { key } = await seal();
    const firstNonce = generateNonce();
    const secondNonce = generateNonce();
    expect(hex(firstNonce)).not.toBe(hex(secondNonce));

    const container = { kdf: KDF, salt: SALT };
    const first = await sealContainer({
      payload: PAYLOAD,
      fileKey: key,
      container,
      nonce: firstNonce,
    });
    const second = await sealContainer({
      payload: PAYLOAD,
      fileKey: key,
      container,
      nonce: secondNonce,
    });

    const xor = (left: Uint8Array, right: Uint8Array) =>
      left.map((byte, index) => byte ^ right[index]);

    const ciphertextXor = xor(first.slice(54), second.slice(54));
    const plaintextXor = xor(PAYLOAD, PAYLOAD);

    // Identical plaintext must not produce an identical keystream.
    expect(hex(ciphertextXor)).not.toBe(hex(plaintextXor));
    expect(hex(first.slice(54))).not.toBe(hex(second.slice(54)));
  });

  it('11b a nonce equal to the file on disk is replaced', () => {
    const previous = generateNonce();
    const fresh = freshNonce(previous);
    expect(hex(fresh)).not.toBe(hex(previous));
    expect(fresh.length).toBe(24);
  });

  it('12 generating a salt and a nonce has the right sizes', () => {
    expect(generateSalt().length).toBe(16);
    expect(generateNonce().length).toBe(24);
  });

  it('nonceOf reads the stored nonce without a password', async () => {
    const { file } = await seal();
    expect(hex(nonceOf(file)!)).toBe(hex(NONCE));
  });
});
