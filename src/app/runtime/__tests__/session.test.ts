/**
 * The session facade: bindings, grants and probes for one vault.
 *
 * These tests exercise what the UI will actually call, with fakes for the file,
 * the network and local storage.
 */

import { describe, expect, it } from 'vitest';
import { VaultSession } from '../session';
import { Vault } from '../../vault/vault';
import { LocalState, type KeyValuePort } from '../../storage/local/state';
import {
  MemoryFile,
  fixedClock,
  memoryPorts,
} from '../../vault/__tests__/memory-port';
import { sealContainer } from '../../../core/format/container';
import { deriveFileKeyInline } from '../../../core/format/kdf';
import { serializePayload } from '../../../core/payload/serialize';
import { importDeviceKey } from '../../../core/fingerprint';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import type { KeyaFile } from '../../../core/payload/types';
import type { ProbeFetch } from '../../probe/execute';

const PASSWORD = 'a fairly long synthetic passphrase';
const SALT = new Uint8Array([...Array(16).keys()]);
const KDF = { ops: 2, mem: 19_922_944 };
const NOW = '2026-03-01T12:00:00.000Z';

class MemoryKv implements KeyValuePort {
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

async function makeBytes(payload: KeyaFile): Promise<Uint8Array> {
  const fileKey = await deriveFileKeyInline({
    password: PASSWORD,
    salt: SALT,
    kdf: KDF,
  });
  return sealContainer({
    payload: serializePayload(payload),
    fileKey,
    container: { kdf: KDF, salt: SALT },
    nonce: new Uint8Array(24).fill(3),
  });
}

async function session(
  options: { payload?: KeyaFile; grant?: boolean } = {}
): Promise<{
  session: VaultSession;
  payload: KeyaFile;
  requests: string[];
  grants: string[];
  local: LocalState;
}> {
  const payload = options.payload ?? cloneFile();
  const file = new MemoryFile(await makeBytes(payload));
  const clock = fixedClock(NOW);
  const opened = await Vault.open(memoryPorts(file, clock), {
    password: PASSWORD,
  });
  if (!opened.ok) throw new Error(opened.failure);

  const local = new LocalState(new MemoryKv(), { now: () => NOW });
  const deviceKey = await importDeviceKey(new Uint8Array(32).fill(9));
  const requests: string[] = [];
  const grants: string[] = [];

  const fetchImpl: ProbeFetch = async (url) => {
    requests.push(url);
    return { status: 200, contentType: 'application/json' };
  };

  const value = new VaultSession({
    vault: opened.vault,
    local,
    deviceKey,
    fetch: fetchImpl,
    clock: () => new Date(NOW),
  });

  // Seed a grant through the public API when the test needs one.
  if (options.grant) {
    const grant = await value.grant(IDS.key);
    if (grant) grants.push(grant.fingerprint);
  }

  return { session: value, payload, requests, grants, local };
}

describe('probes', () => {
  it('needs authorization, then runs after a grant', async () => {
    const denied = await session();
    expect(await denied.session.probe(IDS.key, 'automatic')).toMatchObject({
      status: 'needs_authorization',
    });
    expect(denied.requests).toEqual([]);

    const allowed = await session({ grant: true });
    expect(await allowed.session.probe(IDS.key, 'automatic')).toMatchObject({
      status: 'observed',
    });
    expect(allowed.requests).toHaveLength(1);
  });

  it('runs a manual probe after a one-shot approval, once', async () => {
    const { session: value, requests } = await session();

    expect(await value.probe(IDS.key, 'manual')).toMatchObject({
      status: 'needs_authorization',
    });

    expect(await value.approveOnce(IDS.key)).toBeTruthy();
    expect(await value.probe(IDS.key, 'manual')).toMatchObject({
      status: 'observed',
    });

    // The approval is gone; a second attempt without a gesture is refused.
    expect(await value.probe(IDS.key, 'manual')).toMatchObject({
      status: 'needs_authorization',
    });
    expect(requests).toHaveLength(1);
  });

  it('drops approvals on lock', async () => {
    const { session: value } = await session();
    await value.approveOnce(IDS.key);
    value.lock();
    expect(await value.probe(IDS.key, 'manual')).toMatchObject({
      status: 'needs_authorization',
    });
  });

  it('derives the grant from the current configuration', async () => {
    const { session: value } = await session();
    const grant = await value.grant(IDS.key);

    expect(grant).not.toBeNull();
    expect(grant!.origin).toBe('https://edge.example.com');
    expect(grant!.path).toBe('/v1/models');
    expect(grant!.fingerprint).toHaveLength(64);
  });

  it('cannot grant a key whose recipe cannot run', async () => {
    const payload = cloneFile();
    payload.providers[0].probe = null;
    const { session: value } = await session({ payload });
    expect(await value.grant(IDS.key)).toBeNull();
  });
});

describe('usage consent', () => {
  const URL = 'https://example.test/usage';

  it('consumes the approval once and then refuses', async () => {
    const { session: value } = await session();

    expect(await value.authorizeUsage(IDS.key, URL)).toBe(false);
    expect(await value.approveUsageOnce(IDS.key, URL)).not.toBeNull();
    expect(await value.authorizeUsage(IDS.key, URL)).toBe(true);
    expect(await value.authorizeUsage(IDS.key, URL)).toBe(false);
  });

  it('keeps approvals apart from the probe approval', async () => {
    const { session: value } = await session();

    await value.approveOnce(IDS.key);
    expect(await value.authorizeUsage(IDS.key, URL)).toBe(false);
  });

  it('accepts a standing grant without a fresh click', async () => {
    const { session: value } = await session();
    const fingerprint = await value.approveUsageOnce(IDS.key, URL);
    await value.authorizeUsage(IDS.key, URL);

    expect(fingerprint).not.toBeNull();
    // A different URL is a different request and needs its own consent.
    expect(await value.authorizeUsage(IDS.key, `${URL}?v=2`)).toBe(false);
  });

  it('ignores keys that are not in the vault', async () => {
    const { session: value } = await session();

    expect(await value.approveUsageOnce('not-a-key', URL)).toBeNull();
    expect(await value.authorizeUsage('not-a-key', URL)).toBe(false);
  });
});
