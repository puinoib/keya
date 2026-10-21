/**
 * The session facade: reminders, dismissals, grants and probes for one vault.
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
    timeZone: 'UTC',
  });

  // Seed a grant through the public API when the test needs one.
  if (options.grant) {
    const grant = await value.grant(IDS.key);
    if (grant) grants.push(grant.fingerprint);
  }

  return { session: value, payload, requests, grants, local };
}

describe('reminders', () => {
  it('combines expiry, destination and never-probed facts', async () => {
    const payload = cloneFile();
    payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
    const { session: value } = await session({ payload });

    const reminders = await value.reminders();
    const rules = reminders.map((entry) => entry.reminder.rule).sort();
    expect(rules).toEqual(['expiry_upcoming', 'never_probed']);
  });

  it('omits observation reminders for a recipe that cannot run', async () => {
    const payload = cloneFile();
    payload.providers[0].probe = null;
    const { session: value } = await session({ payload });

    const reminders = await value.reminders();
    expect(
      reminders.some((entry) => entry.reminder.kind === 'observation')
    ).toBe(false);
  });

  it('hides a reminder once dismissed and keeps it inspectable', async () => {
    const payload = cloneFile();
    payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
    const { session: value } = await session({ payload });

    const before = await value.reminders();
    const target = before.find(
      (entry) => entry.reminder.rule === 'expiry_upcoming'
    )!;
    await value.dismiss(target.reminder);

    const after = await value.reminders();
    expect(
      after.some((entry) => entry.reminder.rule === 'expiry_upcoming')
    ).toBe(false);

    const silenced = await value.dismissed();
    expect(silenced.business).toHaveLength(1);
    expect(silenced.business[0].condition).toBe('date:2026-03-05');

    await value.restore(target.reminder);
    const restored = await value.reminders();
    expect(
      restored.some((entry) => entry.reminder.rule === 'expiry_upcoming')
    ).toBe(true);
  });

  it('brings the reminder back when the fact changes', async () => {
    const payload = cloneFile();
    payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
    const { session: value } = await session({ payload });

    const target = (await value.reminders()).find(
      (entry) => entry.reminder.rule === 'expiry_upcoming'
    )!;
    await value.dismiss(target.reminder);

    // Editing the payload changes the fact; the stored dismissal is pruned.
    value.payload.keys[0].expiry = { kind: 'date', value: '2026-03-06' };
    const reminders = await value.reminders();

    expect(
      reminders.some((entry) => entry.reminder.rule === 'expiry_upcoming')
    ).toBe(true);
    expect((await value.dismissed()).business).toHaveLength(0);
  });
});

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
