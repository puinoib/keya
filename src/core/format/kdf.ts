/**
 * Argon2id key derivation (§3.3).
 *
 * Two hard constraints drive this module:
 *
 * 1. libsodium's `crypto_pwhash` is a synchronous call with no cancellation
 *    point, so it runs in a Worker and cancelling means terminating that
 *    worker.
 * 2. Derivation is a memory bomb if several tabs do it at once, so calls are
 *    serialized through a named Web Lock. The lock wait is bounded: a crafted
 *    preamble must not be able to hold the lock for minutes.
 */

import type { KdfParams } from './constants';
import { loadSodium } from './sodium';

export interface DeriveOptions {
  /** Raw password text; encoding to UTF-8 happens here, without normalization. */
  password: string;
  salt: Uint8Array;
  kdf: KdfParams;
}

export interface DeriveControl {
  signal?: AbortSignal;
  /** How long to wait for the global KDF lock before giving up. */
  lockTimeoutMs?: number;
}

export type KdfFailure = 'cancelled' | 'busy' | 'failed' | 'memory';

export class KdfError extends Error {
  readonly failure: KdfFailure;

  constructor(failure: KdfFailure, message?: string) {
    super(message ?? failure);
    this.name = 'KdfError';
    this.failure = failure;
  }
}

/** Argon2 allocation failures must not look like a wrong password (§3.3.1). */
function classifyFailure(error: unknown): KdfFailure {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /memory|alloc|out of memory/i.test(message) ? 'memory' : 'failed';
}

const KEY_LENGTH = 32;
const LOCK_NAME = 'keya-kdf';
const DEFAULT_LOCK_TIMEOUT_MS = 5000;

/** Run derivation on the current thread. Used by tests and as a fallback. */
export async function deriveFileKeyInline(
  options: DeriveOptions
): Promise<Uint8Array> {
  const sodium = await loadSodium();
  try {
    return sodium.crypto_pwhash(
      KEY_LENGTH,
      sodium.from_string(options.password),
      options.salt,
      options.kdf.ops,
      options.kdf.mem,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );
  } catch (error) {
    throw new KdfError(classifyFailure(error));
  }
}

let workerInstance: Worker | null = null;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  // A terminated worker is never reused: its wasm heap is gone.
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./kdf.worker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return workerInstance;
}

function discardWorker(): void {
  workerInstance?.terminate();
  workerInstance = null;
}

async function deriveInWorker(
  options: DeriveOptions,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const worker = getWorker();
  if (!worker) return deriveFileKeyInline(options);

  return new Promise<Uint8Array>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      // The only way to stop a synchronous wasm KDF.
      discardWorker();
      reject(new KdfError('cancelled'));
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      discardWorker();
      reject(new KdfError(classifyFailure(event.message), event.message));
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { ok: true; key: Uint8Array }
        | { ok: false; message: string };
      cleanup();
      if (data.ok) resolve(new Uint8Array(data.key));
      else
        reject(
          new KdfError(classifyFailure(new Error(data.message)), data.message)
        );
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener('abort', onAbort);
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    worker.postMessage({
      password: options.password,
      salt: options.salt,
      ops: options.kdf.ops,
      mem: options.kdf.mem,
    });
  });
}

let localQueue: Promise<unknown> = Promise.resolve();

/**
 * Serialize KDF calls. In a browser this is a named Web Lock with a bounded
 * wait; elsewhere (tests) it degrades to a promise chain.
 */
async function withKdfLock<T>(
  task: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const locks = (
    globalThis as unknown as {
      navigator?: { locks?: Pick<LockManager, 'request'> };
    }
  ).navigator?.locks;

  if (!locks) {
    const run = localQueue.then(task, task);
    localQueue = run.catch(() => undefined);
    return run;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return (await locks.request(
      LOCK_NAME,
      { mode: 'exclusive', signal: controller.signal },
      task
    )) as T;
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') {
      throw new KdfError('busy', 'another tab is unlocking');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Derive the file key for a container. Rejects with `KdfError` when cancelled,
 * when the lock wait expires, or when libsodium fails.
 */
export async function deriveFileKey(
  options: DeriveOptions,
  control: DeriveControl = {}
): Promise<Uint8Array> {
  if (options.salt.length !== 16)
    throw new KdfError('failed', 'salt must be 16 B');
  if (options.kdf.ops <= 0 || options.kdf.mem < 8192) {
    throw new KdfError('failed', 'kdf parameters rejected');
  }

  return withKdfLock(
    () => deriveInWorker(options, control.signal),
    control.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS
  );
}

/** Test/teardown hook. */
export function shutdownKdfWorker(): void {
  discardWorker();
}
