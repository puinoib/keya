/**
 * §16.4 / §16.5 — the authorization gate and the full probe pipeline.
 *
 * The point of these tests is that no request leaves the browser without a
 * gesture-backed one-shot approval, and that a result is only stored when it
 * still describes the current configuration.
 */

import { describe, expect, it } from 'vitest';
import {
  runCheck,
  type AuthorizationPort,
  type CheckDependencies,
} from '../check';
import type { ProbeFetch } from '../execute';
import { LocalState, type KeyValuePort } from '../../storage/local/state';
import { importDeviceKey } from '../../../core/fingerprint';
import { cloneFile, IDS } from '../../../core/__tests__/fixtures';
import { presetId } from '../../../core/presets/data';
import type { KeyaFile } from '../../../core/payload/types';

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

const DEVICE_KEY_RAW = new Uint8Array(32).fill(7);

async function setup(options: { approval?: boolean; payload?: KeyaFile } = {}) {
  const payload = options.payload ?? cloneFile();
  const local = new LocalState(new MemoryKv(), {
    now: () => '2026-06-01T00:00:00.000Z',
  });
  const deviceKey = await importDeviceKey(DEVICE_KEY_RAW);

  const approved: string[] = [];
  // One approval, consumed by the first request that asks for it.
  let remaining = options.approval ? 1 : 0;
  const authorization: AuthorizationPort = {
    consumeApproval: (fingerprint) => {
      if (remaining <= 0) return false;
      remaining -= 1;
      approved.push(fingerprint);
      return true;
    },
  };

  let seq = 0;
  const requests: string[] = [];
  const fetch: ProbeFetch = async (url) => {
    requests.push(url);
    return { status: 200, contentType: 'application/json' };
  };

  const dependencies: CheckDependencies = {
    payload: () => payload,
    local,
    deviceKey,
    fetch,
    authorization,
    nextRequestSeq: () => ++seq,
    sessionId: 'session-a',
  };

  return { dependencies, local, requests, approved, payload };
}

describe('authorization gate', () => {
  it('refuses a probe with nothing behind it', async () => {
    const { dependencies, requests } = await setup();
    const result = await runCheck(dependencies, { keyId: IDS.key });

    expect(result.status).toBe('needs_authorization');
    expect(requests).toEqual([]);
  });

  it('accepts the one-shot approval the click created', async () => {
    const { dependencies, requests, approved, local } = await setup({
      approval: true,
    });
    const result = await runCheck(dependencies, { keyId: IDS.key });

    expect(result.status).toBe('observed');
    expect(requests).toHaveLength(1);
    expect(approved).toHaveLength(1);
    expect(await local.listObservations(IDS.vault, IDS.key)).toHaveLength(1);
  });

  it('needs a fresh approval every time, even for an https target', async () => {
    const { dependencies, requests } = await setup({ approval: true });
    expect((await runCheck(dependencies, { keyId: IDS.key })).status).toBe(
      'observed'
    );
    // The approval was consumed by the request above.
    expect((await runCheck(dependencies, { keyId: IDS.key })).status).toBe(
      'needs_authorization'
    );
    expect(requests).toHaveLength(1);
  });

  it('needs a gesture for a plaintext target too', async () => {
    const payload = cloneFile();
    payload.providers[0].probe = {
      target: 'http://192.168.1.5:8080/models',
      auth: { mode: 'bearer' },
      headers: [],
    };
    const { dependencies, requests } = await setup({ payload });

    const result = await runCheck(dependencies, { keyId: IDS.key });
    expect(result.status).toBe('needs_authorization');
    expect(requests).toEqual([]);
  });

  it('reports a non-executable recipe without touching the network', async () => {
    const payload = cloneFile();
    payload.keys[0].provider_id = presetId('exa');
    const { dependencies, requests } = await setup({ payload, approval: true });

    const result = await runCheck(dependencies, { keyId: IDS.key });
    expect(result.status).toBe('not_executable');
    if (result.status === 'not_executable') {
      expect(result.reason).toBe('capability_missing');
      expect(result.unverifiable).toBeTruthy();
    }
    expect(requests).toEqual([]);
  });

  it('reports an unknown key instead of throwing', async () => {
    const { dependencies } = await setup({ approval: true });
    const result = await runCheck(dependencies, {
      keyId: '99999999-9999-4999-8999-999999999999',
    });
    expect(result).toEqual({ status: 'no_key' });
  });
});

describe('adoption and persistence', () => {
  it('stores the observation with the binding of what was sent', async () => {
    const { dependencies, local, payload } = await setup({ approval: true });
    const result = await runCheck(dependencies, { keyId: IDS.key });
    expect(result.status).toBe('observed');
    if (result.status !== 'observed') return;

    const [stored] = await local.listObservations(payload.vault.id, IDS.key);
    expect(stored.observation_id).toBe(result.observation.observation_id);
    expect(stored.binding).toBe(result.observation.binding);
    expect(stored.outcome).toBe('ok');
  });

  it('discards a result whose configuration changed while in flight', async () => {
    const payload = cloneFile();
    const { dependencies, local } = await setup({ approval: true, payload });

    // Rotate the secret during the request.
    const originalFetch = dependencies.fetch;
    dependencies.fetch = async (url, init) => {
      payload.keys[0].secret = 'sk-rotated';
      return originalFetch(url, init);
    };

    const result = await runCheck(dependencies, { keyId: IDS.key });

    expect(result.status).toBe('discarded');
    expect(await local.listObservations(payload.vault.id, IDS.key)).toEqual([]);
  });
});
