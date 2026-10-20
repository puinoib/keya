import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  record: null as Record<string, unknown> | null,
  writes: 0,
}));
vi.mock('../storage', () => ({
  BIOMETRIC_STORE: 'biometric',
  openMetaDB: async () => ({
    transaction: () => {
      const tx: Record<string, unknown> = {
        objectStore: () => ({
          get: () => {
            const req: Record<string, unknown> = {};
            queueMicrotask(() => {
              req.result = state.record;
              (req.onsuccess as () => void)();
            });
            return req;
          },
          delete: () => {
            state.record = null;
            queueMicrotask(() => (tx.oncomplete as () => void)());
          },
          put: () => {
            state.writes++;
            queueMicrotask(() => (tx.oncomplete as () => void)());
          },
        }),
      };
      return tx;
    },
  }),
}));
import {
  isBiometricRegistered,
  registerBiometric,
  unlockWithBiometric,
} from '../biometric';

it('rejects non-PRF registration without persisting a secret', async () => {
  vi.stubGlobal('location', { hostname: 'localhost' });
  vi.stubGlobal('navigator', {
    credentials: {
      create: async () => ({ getClientExtensionResults: () => ({}) }),
    },
  });
  await expect(registerBiometric('vault', 'test-password')).rejects.toThrow(
    'passkey storage location does not support the WebAuthn PRF'
  );
  expect(state.writes).toBe(0);
});

it('removes legacy credentials rather than treating them as registered', async () => {
  state.record = { aesKey: 'legacy-key' };
  expect(await isBiometricRegistered('vault')).toBe(false);
  expect(state.record).toBeNull();
});

it('never decrypts legacy records', async () => {
  state.record = { aesKey: 'legacy-key' };
  await expect(unlockWithBiometric('vault')).rejects.toThrow('Legacy');
  expect(state.record).toBeNull();
});
