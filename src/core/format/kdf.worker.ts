/**
 * KDF worker: the only place Argon2id runs in the browser.
 *
 * Kept deliberately dumb — it derives one key per message and has no state — so
 * that cancelling is simply `worker.terminate()`.
 */

import { loadSodium } from './sodium';

interface DeriveRequest {
  password: string;
  salt: Uint8Array;
  ops: number;
  mem: number;
}

interface DeriveSuccess {
  ok: true;
  key: Uint8Array;
}

interface DeriveFailure {
  ok: false;
  message: string;
}

self.addEventListener('message', async (event: MessageEvent<DeriveRequest>) => {
  const { password, salt, ops, mem } = event.data;

  try {
    const sodium = await loadSodium();
    const key = sodium.crypto_pwhash(
      32,
      sodium.from_string(password),
      salt,
      ops,
      mem,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    const response: DeriveSuccess = { ok: true, key };
    self.postMessage(response, { transfer: [key.buffer as ArrayBuffer] });
  } catch (error) {
    const response: DeriveFailure = {
      ok: false,
      message: error instanceof Error ? error.message : 'kdf failed',
    };
    self.postMessage(response);
  }
});
