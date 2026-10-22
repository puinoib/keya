/**
 * A stand-in for libsodium in DOM tests.
 *
 * jsdom mixes typed-array realms, and libsodium's `instanceof Uint8Array`
 * checks reject arrays produced by the other side. The component tests never
 * test cryptography, so they swap in a deterministic, round-tripping
 * implementation and keep the real library for the node suites.
 */

function toBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === 'string' ? new TextEncoder().encode(value) : value;
}

/** A deterministic keystream, so "encrypt" and "decrypt" agree on a key. */
function keystream(
  key: Uint8Array,
  nonce: Uint8Array,
  length: number
): Uint8Array {
  let state = 0x9e3779b9;
  for (const byte of [...key.slice(0, 8), ...nonce.slice(0, 8)]) {
    state = (state * 33 + byte) >>> 0;
  }
  const out = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out[index] = state & 0xff;
  }
  return out;
}

function xor(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length);
  for (let index = 0; index < left.length; index += 1) {
    out[index] = left[index] ^ right[index % right.length];
  }
  return out;
}

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  const out = new Uint8Array(first.length + second.length);
  out.set(first, 0);
  out.set(second, first.length);
  return out;
}

function tagFor(key: Uint8Array, nonce: Uint8Array, body: Uint8Array) {
  return keystream(key, concat(nonce, body), 16);
}

const delay = () => Promise.resolve();

export const fakeSodium = {
  ready: delay(),
  crypto_pwhash_ALG_ARGON2ID13: 2,
  crypto_aead_xchacha20poly1305_ietf_ABYTES: 16,
  from_string: (value: string) => new TextEncoder().encode(value),
  to_string: (value: Uint8Array) => new TextDecoder().decode(value),
  memzero: () => {},
  randombytes_buf: (length: number) =>
    keystream(new Uint8Array([1]), new Uint8Array([2]), length),
  crypto_pwhash: (
    length: number,
    password: string | Uint8Array,
    salt: Uint8Array
  ) => keystream(toBytes(password), salt, length),
  crypto_aead_xchacha20poly1305_ietf_encrypt: (
    message: Uint8Array,
    additionalData: Uint8Array,
    _secret: null,
    nonce: Uint8Array,
    key: Uint8Array
  ) => {
    const body = xor(message, keystream(key, nonce, message.length));
    return concat(body, tagFor(key, nonce, concat(additionalData, body)));
  },
  crypto_aead_xchacha20poly1305_ietf_decrypt: (
    _secret: null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array
  ) => {
    const body = ciphertext.slice(0, ciphertext.length - 16);
    const tag = ciphertext.slice(ciphertext.length - 16);
    const expected = tagFor(key, nonce, concat(additionalData, body));
    const same =
      tag.length === expected.length &&
      tag.every((byte, index) => byte === expected[index]);
    if (!same) throw new Error('wrong secret key for the given ciphertext');
    return xor(body, keystream(key, nonce, body.length));
  },
};
