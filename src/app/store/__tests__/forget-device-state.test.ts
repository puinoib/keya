import { describe, expect, it, vi } from 'vitest';
import { IDS } from '../../../core/__tests__/fixtures';
import { createAppStore } from '../create-store';
import { FIXED_NOW, openHarness } from './fixtures';

// The record lives in IndexedDB, which this environment does not have. What
// matters here is that the action asks for it to be deleted.
const biometric = vi.hoisted(() => ({
  removeBiometric: vi.fn(async () => undefined),
}));

vi.mock('../../lib/biometric', () => ({
  isBiometricSupported: () => true,
  isBiometricRegistered: async () => true,
  registerBiometric: async () => undefined,
  removeBiometric: biometric.removeBiometric,
}));

const FINGERPRINT = 'f'.repeat(64);

describe('forgetDeviceState', () => {
  it('drops observations, approvals and cached allowances for this vault', async () => {
    const h = await openHarness();
    const store = createAppStore({
      local: h.local,
      clock: () => new Date(FIXED_NOW),
      timeZone: () => 'UTC',
      saveDelayMs: 0,
      confirmDestination: async () => true,
    });
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    const binding = (await h.session.bindings()).get(IDS.key)?.binding;
    expect(binding).toBeTruthy();
    await h.local.recordObservation({
      observation_id: 'obs-forget',
      vault_id: h.payload.vault.id,
      key_id: IDS.key,
      binding: binding as string,
      kind: 'request',
      outcome: 'ok',
      detail_code: null,
      http_status: 200,
      latency_ms: 1,
      started_at: FIXED_NOW,
      finished_at: FIXED_NOW,
    });
    await h.local.putGrant({
      fingerprint: FINGERPRINT,
      vault_id: h.payload.vault.id,
      origin: 'https://api.example.com',
      path: '/v1',
      approved_at: FIXED_NOW,
    });
    store.useStore.setState({
      usage: {
        [IDS.key]: {
          state: 'ok',
          vault_id: h.payload.vault.id,
          checked_at: FIXED_NOW,
          snapshot: {
            provider: 'example',
            checked_at: FIXED_NOW,
            windows: [
              {
                id: 'month',
                label: 'Month',
                percent_used: 10,
                resets_at: null,
              },
            ],
          },
        },
      } as never,
    });

    await store.useStore.getState().refresh();
    const before = store.useStore.getState().view;
    expect(before?.checks.has(IDS.key)).toBe(true);

    await store.useStore.getState().forgetDeviceState();

    expect(await h.local.listObservations(h.payload.vault.id, IDS.key)).toEqual(
      []
    );
    expect(await h.local.listGrants()).toEqual([]);
    expect(biometric.removeBiometric).toHaveBeenCalledWith(h.payload.vault.id);

    const after = store.useStore.getState();
    expect(after.usage).toEqual({});
    // The Inbox badge was derived from the observation that is now gone.
    expect(after.view?.checks.has(IDS.key)).toBe(false);
    // Nothing durable changed: the file still holds the key and its secret.
    expect(store.useStore.getState().hasUnsavedChanges).toBe(false);
    expect(
      store.useStore.getState().view?.file.keys.some((k) => k.id === IDS.key)
    ).toBe(true);
  }, 30_000);

  it("leaves another vault's approval alone", async () => {
    const h = await openHarness();
    const store = createAppStore({
      local: h.local,
      clock: () => new Date(FIXED_NOW),
      timeZone: () => 'UTC',
      saveDelayMs: 0,
      confirmDestination: async () => true,
    });
    // Grants are stored without a vault namespace so a clone keeps them; the
    // audit field is what a cleanup uses to tell them apart.
    await h.local.putGrant({
      fingerprint: 'a'.repeat(64),
      vault_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      origin: 'https://other.example.com',
      path: '/v1',
      approved_at: FIXED_NOW,
    });
    await store.useStore.getState().unlock(h.opened, 'work.keya', 'folder');

    await store.useStore.getState().forgetDeviceState();

    const remaining = await h.local.listGrants();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].origin).toBe('https://other.example.com');
  }, 30_000);
});
