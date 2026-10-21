/* @vitest-environment jsdom */
/**
 * The key panel against a real session and the real edit transactions.
 *
 * The vault is stubbed because libsodium's wasm build rejects typed arrays from
 * the jsdom realm, and this test is about the panel: what it renders, and that
 * its buttons reach the store, the transaction layer and the probe gate.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KeysPanel } from '../KeysPanel';
import { useVault } from '../../../store/next-vault';
import { VaultSession } from '../../../runtime/session';
import { LocalState, type KeyValuePort } from '../../../storage/local/state';
import { importDeviceKey } from '../../../../core/fingerprint';
import { cloneFile } from '../../../../core/__tests__/fixtures';
import type { Vault } from '../../../vault/vault';
import type {
  Group,
  Key,
  KeyaFile,
  Provider,
} from '../../../../core/payload/types';
import {
  deleteGroup,
  deleteKey,
  deleteProvider,
  reorderGroups,
  setArchived,
  updateVaultMeta,
  upsertGroup,
  upsertKey,
  upsertProvider,
  type EditResult,
} from '../../../../core/payload/edits';

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

/** Minimal vault: applies real transactions, never touches a file. */
function stubVault(payload: KeyaFile): Vault {
  let current = payload;

  const apply = (result: EditResult) => {
    if (!result.ok) return { ok: false as const, reason: result.reason };
    if (result.changed) current = result.value;
    return { ok: true as const, changed: result.changed };
  };

  return {
    getPayload: () => current,
    sessionId: 'session-test',
    saveKey: (key: Key) => apply(upsertKey(current, key, NOW)),
    removeKey: (id: string) => apply(deleteKey(current, id, NOW)),
    archiveKey: (id: string, archived: boolean) =>
      apply(setArchived(current, id, archived, NOW)),
    saveGroup: (group: Group) => apply(upsertGroup(current, group, NOW)),
    removeGroup: (id: string) => apply(deleteGroup(current, id, NOW)),
    reorderGroups: (ids: readonly string[]) =>
      apply(reorderGroups(current, ids, NOW)),
    saveProvider: (provider: Provider) =>
      apply(upsertProvider(current, provider, NOW)),
    removeProvider: (id: string) => apply(deleteProvider(current, id, NOW)),
    updateMeta: (patch: { name?: string; icon?: string }) =>
      apply(updateVaultMeta(current, patch, NOW)),
    flush: async () => ({ ok: true as const }),
  } as unknown as Vault;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function seed(options: { probeAsks?: boolean } = {}) {
  const payload = cloneFile();
  payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
  payload.providers[0].probe = {
    target: 'models',
    auth: { mode: 'bearer' },
    headers: [],
  };

  const vault = stubVault(payload);
  const session = options.probeAsks
    ? // jsdom has no SubtleCrypto, and this assertion is about the panel's
      // dialog: stub the probe result instead of running the request pipeline.
      (new Proxy(
        {},
        {
          get: (_target, property) => {
            if (property === 'probe') {
              return async () => ({
                status: 'needs_authorization',
                fingerprint: 'f'.repeat(64),
                plan: {
                  resolvedHref: 'https://edge.example.com/v1/models',
                  target: 'models',
                  auth: { mode: 'bearer' },
                  headers: [],
                  interpreterId: 'custom/1',
                  verifies: 'request',
                  providerId: 'custom:1',
                },
              });
            }
            if (property === 'grant' || property === 'approveOnce') {
              return async () => null;
            }
            if (property === 'reminders' || property === 'dismissed') {
              return async () => [];
            }
            return () => undefined;
          },
        }
      ) as unknown as VaultSession)
    : new VaultSession({
        vault,
        local: new LocalState(new MemoryKv()),
        deviceKey: await importDeviceKey(new Uint8Array(32).fill(2)),
        fetch: async () => ({ status: 200, contentType: 'application/json' }),
        clock: () => new Date(NOW),
        timeZone: 'UTC',
      });

  useVault.setState({
    ready: true,
    session,
    vault,
    fileName: 'work.keya',
    payload: vault.getPayload(),
    saveState: 'clean',
    reminders: [],
    error: null,
  });
}

const text = () => container.textContent ?? '';

const buttonWith = (label: string) =>
  [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label
  );

const keyRow = () =>
  [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Edge key')
  )!;

describe('keys panel', () => {
  it('lists the keys and shows the quota', async () => {
    await seed();
    await act(async () => root.render(<KeysPanel />));

    expect(text()).toContain('Edge key');
    expect(text()).toContain('1/1000');
    expect(text()).toContain('0 archived');
  });

  it('opens the editor prefilled when Edit is pressed', async () => {
    await seed();
    await act(async () => root.render(<KeysPanel />));

    await act(async () => keyRow().click());
    await act(async () => buttonWith('Edit')!.click());

    const name = container.querySelector<HTMLInputElement>('#key-name')!;
    expect(name.value).toBe('Edge key');
    expect(
      container.querySelector<HTMLInputElement>('#key-secret')!.value
    ).toBe('sk-synthetic');
  });

  it('asks for approval before the first automatic check', async () => {
    await seed({ probeAsks: true });
    await act(async () => root.render(<KeysPanel />));

    await act(async () => keyRow().click());
    await act(async () => buttonWith('Check now')!.click());

    expect(text()).toContain('Sending the secret needs your approval');
    expect(text()).toContain('https://edge.example.com/v1/models');
    expect(text()).toContain('Authorization header');
  });

  it('archives a key through the transaction layer', async () => {
    await seed();
    await act(async () => root.render(<KeysPanel />));

    await act(async () => keyRow().click());
    await act(async () => buttonWith('Archive')!.click());

    const payload = useVault.getState().payload!;
    expect(payload.keys[0].archived_at).not.toBeNull();
    expect(useVault.getState().saveState).toBe('dirty');
  });

  it('reports a rejected deletion instead of dropping the provider', async () => {
    await seed();

    const result = useVault
      .getState()
      .vault!.removeProvider(useVault.getState().payload!.providers[0].id);
    expect(result).toEqual({ ok: false, reason: 'provider_in_use' });
  });
});
