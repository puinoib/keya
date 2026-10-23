/**
 * A vault the store can be driven against, built from in-memory ports.
 *
 * Everything here is synthetic: the file is sealed with a throwaway password and
 * the "network" never leaves the process.
 */

import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import { sealContainer } from '../../../core/format/container';
import { deriveFileKeyInline } from '../../../core/format/kdf';
import { serializePayload } from '../../../core/payload/serialize';
import { importDeviceKey } from '../../../core/fingerprint';
import type { KeyaFile } from '../../../core/payload/types';
import type { ProbeFetch } from '../../probe/execute';
import type { OpenedVault } from '../../lib/storage';
import { VaultSession } from '../../runtime/session';
import { LocalState, type KeyValuePort } from '../../storage/local/state';
import { Vault } from '../../vault/vault';
import {
  MemoryFile,
  fixedClock,
  memoryPorts,
} from '../../vault/__tests__/memory-port';

export const PASSWORD = 'a fairly long synthetic passphrase';
export const FIXED_NOW = '2026-03-01T12:00:00.000Z';
const SALT = new Uint8Array([...Array(16).keys()]);
const KDF = { ops: 2, mem: 19_922_944 };

/** The smallest KV a LocalState needs. */
export class MemoryKv implements KeyValuePort {
  private map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((key) => key.startsWith(prefix));
  }
}

export interface Harness {
  opened: OpenedVault;
  vault: Vault;
  session: VaultSession;
  local: LocalState;
  file: MemoryFile;
  payload: KeyaFile;
  /** URLs the probe pipeline actually asked for. */
  requests: string[];
}

/** Builds a sealed vault, opens it, and wraps it the way the app does. */
export async function openHarness(
  overrides: {
    payload?: KeyaFile;
    fetch?: ProbeFetch;
    now?: string;
    password?: string;
  } = {}
): Promise<Harness> {
  const payload = overrides.payload ?? cloneFile();
  const password = overrides.password ?? PASSWORD;
  const requests: string[] = [];

  const fileKey = await deriveFileKeyInline({
    password,
    salt: SALT,
    kdf: KDF,
  });
  const bytes = await sealContainer({
    payload: serializePayload(payload),
    fileKey,
    container: { kdf: KDF, salt: SALT },
    nonce: new Uint8Array(24).fill(7),
  });

  const file = new MemoryFile(bytes);
  const clock = fixedClock(overrides.now ?? FIXED_NOW);
  const session_ = await Vault.open(memoryPorts(file, clock), { password });
  if (!session_.ok) throw new Error(session_.failure);

  const local = new LocalState(new MemoryKv(), {
    newId: () => `obs-${Math.random().toString(16).slice(2)}`,
    now: () => overrides.now ?? FIXED_NOW,
  });
  const deviceKey = await importDeviceKey(new Uint8Array(32).fill(9));

  const fetchImpl: ProbeFetch =
    overrides.fetch ??
    (async (url) => {
      requests.push(url);
      return { status: 200, contentType: 'application/json' };
    });

  const session = new VaultSession({
    vault: session_.vault,
    local,
    deviceKey,
    fetch: fetchImpl,
  });

  return {
    opened: {
      fileName: 'work.keya',
      fingerprint: session_.vault.containerInfo.fingerprint,
      vault: session_.vault,
      session,
      deviceKey,
    },
    vault: session_.vault,
    session,
    local,
    file,
    payload,
    requests,
  };
}

export { IDS };
