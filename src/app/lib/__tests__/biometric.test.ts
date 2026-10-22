import { describe, expect, it, vi } from 'vitest';
import {
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
  unlockWithBiometric,
  type BiometricDeps,
  type BiometricRecord,
  type BiometricRecordStore,
} from '../biometric';

const VAULT = 'vault-1';
const PASSWORD = 'a synthetic passphrase for biometrics';
const PRF = new Uint8Array(32).fill(5).buffer;

class MemoryStore implements BiometricRecordStore {
  records = new Map<string, BiometricRecord>();
  deleted: string[] = [];

  async get(vaultId: string) {
    return this.records.get(vaultId) ?? null;
  }
  async put(record: BiometricRecord) {
    this.records.set(record.vault_id, record);
  }
  async delete(vaultId: string) {
    this.deleted.push(vaultId);
    this.records.delete(vaultId);
  }
}

function fakeCredential(prf?: {
  enabled?: boolean;
  output?: ArrayBuffer | null;
}) {
  return {
    rawId: new Uint8Array([1, 2, 3, 4]).buffer,
    getClientExtensionResults: () => ({
      prf: prf
        ? {
            enabled: prf.enabled ?? true,
            results:
              prf.output === undefined
                ? undefined
                : prf.output === null
                  ? undefined
                  : { first: prf.output },
          }
        : undefined,
    }),
  };
}

function fakeCredentials(options: {
  create?: ReturnType<typeof fakeCredential> | null;
  get?: ReturnType<typeof fakeCredential> | null;
  getThrows?: boolean;
}): CredentialsContainer {
  return {
    create: vi.fn(async () => options.create ?? null),
    get: vi.fn(async () => {
      if (options.getThrows) throw new Error('not allowed');
      return options.get ?? null;
    }),
  } as unknown as CredentialsContainer;
}

function makeDeps(
  store: MemoryStore,
  credentials: CredentialsContainer
): BiometricDeps {
  return { store, credentials, rpId: 'localhost' };
}

describe('registerBiometric', () => {
  it('wraps the password with a PRF-derived key and never stores a raw key', async () => {
    const store = new MemoryStore();
    const deps = makeDeps(
      store,
      fakeCredentials({ create: fakeCredential({ output: PRF }) })
    );

    await registerBiometric(VAULT, PASSWORD, deps);

    const record = await store.get(VAULT);
    expect(record?.prfSalt).toBeTruthy();
    expect(record?.encryptedPassword).toBeTruthy();
    expect(record?.aesKey).toBeUndefined();
    expect(await isBiometricRegistered(VAULT, deps)).toBe(true);
  });

  it('refuses to store anything when PRF never evaluates', async () => {
    const store = new MemoryStore();
    const deps = makeDeps(
      store,
      fakeCredentials({
        create: fakeCredential({ enabled: true, output: null }),
        getThrows: true,
      })
    );

    await expect(registerBiometric(VAULT, PASSWORD, deps)).rejects.toThrow(
      /PRF/
    );
    expect(await store.get(VAULT)).toBeNull();
  });

  it('refuses when the authenticator does not enable PRF at all', async () => {
    const store = new MemoryStore();
    const deps = makeDeps(store, fakeCredentials({ create: fakeCredential() }));

    await expect(registerBiometric(VAULT, PASSWORD, deps)).rejects.toThrow(
      /PRF/
    );
    expect(await store.get(VAULT)).toBeNull();
  });
});

describe('unlockWithBiometric', () => {
  it('returns the password when the authenticator evaluates the same PRF', async () => {
    const store = new MemoryStore();
    const credentials = fakeCredentials({
      create: fakeCredential({ output: PRF }),
      get: fakeCredential({ output: PRF }),
    });
    const deps = makeDeps(store, credentials);
    await registerBiometric(VAULT, PASSWORD, deps);

    await expect(unlockWithBiometric(VAULT, deps)).resolves.toBe(PASSWORD);
  });

  it('refuses when PRF evaluation fails instead of falling back', async () => {
    const store = new MemoryStore();
    const credentials = fakeCredentials({
      create: fakeCredential({ output: PRF }),
      get: fakeCredential({ output: null }),
    });
    const deps = makeDeps(store, credentials);
    await registerBiometric(VAULT, PASSWORD, deps);

    await expect(unlockWithBiometric(VAULT, deps)).rejects.toThrow(
      /PRF evaluation failed/
    );
    // The record is left alone, but nothing was returned.
    expect(await store.get(VAULT)).not.toBeNull();
  });

  it('deletes a legacy record and never returns a stored key', async () => {
    const store = new MemoryStore();
    await store.put({
      vault_id: VAULT,
      credentialId: new Uint8Array([9, 9, 9]),
      encryptedPassword: btoa('wrapped-by-a-stored-key'),
      iv: btoa('0123456789ab'),
      aesKey: 'legacy-plaintext-key',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const deps = makeDeps(store, fakeCredentials({}));

    await expect(unlockWithBiometric(VAULT, deps)).rejects.toThrow(
      /Legacy biometric credentials were removed/
    );
    expect(store.deleted).toContain(VAULT);
    expect(await store.get(VAULT)).toBeNull();
    expect(await isBiometricRegistered(VAULT, deps)).toBe(false);
  });

  it('reports a missing record instead of guessing', async () => {
    const store = new MemoryStore();
    const deps = makeDeps(store, fakeCredentials({}));

    await expect(unlockWithBiometric(VAULT, deps)).rejects.toThrow(
      /No biometric credential/
    );
  });

  it('never returns the password when the ciphertext was tampered with', async () => {
    const store = new MemoryStore();
    const credentials = fakeCredentials({
      create: fakeCredential({ output: PRF }),
      get: fakeCredential({ output: PRF }),
    });
    const deps = makeDeps(store, credentials);
    await registerBiometric(VAULT, PASSWORD, deps);

    const record = await store.get(VAULT);
    await store.put({
      ...record!,
      encryptedPassword: btoa('tampered-ciphertext'),
    });

    await expect(unlockWithBiometric(VAULT, deps)).rejects.toThrow();
  });

  it('returns the password again after a re-registration', async () => {
    const store = new MemoryStore();
    const credentials = fakeCredentials({
      create: fakeCredential({ output: PRF }),
      get: fakeCredential({ output: PRF }),
    });
    const deps = makeDeps(store, credentials);
    await registerBiometric(VAULT, PASSWORD, deps);
    await removeBiometric(VAULT, deps);
    expect(await isBiometricRegistered(VAULT, deps)).toBe(false);

    await registerBiometric(VAULT, 'a second synthetic passphrase', deps);

    await expect(unlockWithBiometric(VAULT, deps)).resolves.toBe(
      'a second synthetic passphrase'
    );
  });
});

describe('isBiometricRegistered', () => {
  it('clears a record that still carries an AES key', async () => {
    const store = new MemoryStore();
    await store.put({
      vault_id: VAULT,
      credentialId: new Uint8Array([1]),
      encryptedPassword: btoa('x'),
      iv: btoa('0123456789ab'),
      aesKey: 'stored-key',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(
      await isBiometricRegistered(VAULT, makeDeps(store, fakeCredentials({})))
    ).toBe(false);
    expect(store.deleted).toContain(VAULT);
    expect(await store.get(VAULT)).toBeNull();
  });
});
