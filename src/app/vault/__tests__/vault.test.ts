/**
 * §16.6 / §16.8 — vault lifecycle: open, save, lock, password change, clone.
 */

import { describe, expect, it, vi } from 'vitest';
import { sealContainer, generateNonce } from '../../../core/format/container';
import { deriveFileKeyInline } from '../../../core/format/kdf';
import { inspectContainer, nonceOf } from '../../../core/format/preamble';
import { serializePayload } from '../../../core/payload/serialize';
import type { KeyaFile } from '../../../core/payload/types';
import { validateKeyaFile } from '../../../core/payload/validate';
import { MemoryFile, fixedClock, memoryPorts } from './memory-port';
import { Vault } from '../vault';

const PASSWORD = 'a fairly long synthetic passphrase';
const SALT = new Uint8Array([...Array(16).keys()]);
const KDF = { ops: 2, mem: 19_922_944 };
const TS = '2026-06-01T00:00:00.000Z';
const KEY_ID = '33333333-3333-4333-8333-333333333333';

const payload = (): KeyaFile => ({
  vault: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Work',
    icon: '🔑',
    created_at: TS,
    content_updated_at: TS,
  },
  providers: [],
  groups: [],
  keys: [
    {
      id: KEY_ID,
      name: 'Edge key',
      description: '',
      provider_id: null,
      endpoint: 'https://edge.example.com/v1',
      secret: 'sk-synthetic',
      group_id: null,
      expiry: null,
      archived_at: null,
      created_at: TS,
      content_updated_at: TS,
    },
  ],
});

async function makeBytes(
  file: KeyaFile = payload(),
  options: {
    password?: string;
    salt?: Uint8Array;
    kdf?: { ops: number; mem: number };
  } = {}
): Promise<Uint8Array> {
  const password = options.password ?? PASSWORD;
  const salt = options.salt ?? SALT;
  const kdf = options.kdf ?? KDF;
  const fileKey = await deriveFileKeyInline({ password, salt, kdf });
  return sealContainer({
    payload: serializePayload(file),
    fileKey,
    container: { kdf, salt },
    nonce: generateNonce(),
  });
}

/** Seal arbitrary payload bytes, for shapes the serializer would never emit. */
async function makeRawBytes(json: string): Promise<Uint8Array> {
  const fileKey = await deriveFileKeyInline({
    password: PASSWORD,
    salt: SALT,
    kdf: KDF,
  });
  return sealContainer({
    payload: new TextEncoder().encode(json),
    fileKey,
    container: { kdf: KDF, salt: SALT },
    nonce: generateNonce(),
  });
}

async function openedFile() {
  const file = new MemoryFile(await makeBytes());
  const clock = fixedClock();
  const opened = await Vault.open(memoryPorts(file, clock), {
    password: PASSWORD,
  });
  if (!opened.ok) throw new Error(`open failed: ${opened.failure}`);
  return { file, clock, vault: opened.vault };
}

describe('opening a vault', () => {
  it('decrypts and validates the payload', async () => {
    const { vault } = await openedFile();
    expect(vault.getPayload().keys[0].name).toBe('Edge key');
    expect(vault.containerInfo.kdf).toEqual(KDF);
    expect(vault.containerInfo.version).toBe(2);
    expect(vault.containerInfo.fingerprint).toHaveLength(64);
  });

  it('reports distinct failures for distinct causes', async () => {
    const clock = fixedClock();
    const missing = await Vault.open(memoryPorts(new MemoryFile(null), clock), {
      password: PASSWORD,
    });
    expect(missing).toMatchObject({ ok: false, failure: 'missing_file' });

    const wrongPassword = await Vault.open(
      memoryPorts(new MemoryFile(await makeBytes()), clock),
      { password: 'not the passphrase' }
    );
    expect(wrongPassword).toMatchObject({ ok: false, failure: 'auth_failed' });

    const badMagicFile = await makeBytes();
    badMagicFile[0] = 0x00;
    const badMagic = await Vault.open(
      memoryPorts(new MemoryFile(badMagicFile), clock),
      { password: PASSWORD }
    );
    expect(badMagic).toMatchObject({ ok: false, failure: 'bad_magic' });

    // A payload that decrypts fine but violates class A rules.
    const smuggled = JSON.parse(
      new TextDecoder().decode(serializePayload(payload()))
    ) as Record<string, unknown>;
    smuggled.extra = 1;
    const invalid = await Vault.open(
      memoryPorts(
        new MemoryFile(await makeRawBytes(JSON.stringify(smuggled))),
        clock
      ),
      { password: PASSWORD }
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.failure).toBe('invalid_payload');
      expect(invalid.issues?.length).toBeGreaterThan(0);
      expect(invalid.message).toContain('$.extra');
    }
  });
});

describe('saving', () => {
  it('copies version, kdf and salt verbatim and only rotates the nonce', async () => {
    const { file, clock, vault } = await openedFile();
    const before = inspectContainer(file.bytes!);
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    clock.advance(1000);
    vault.updateMeta({ name: 'Work 2' });
    expect(await vault.flush()).toEqual({ ok: true });

    const after = inspectContainer(file.bytes!);
    expect(after.ok).toBe(true);
    if (!after.ok) return;

    expect(after.preamble.version).toBe(before.preamble.version);
    expect(after.preamble.kdf).toEqual(before.preamble.kdf);
    expect(after.preamble.salt).toEqual(before.preamble.salt);
    expect(Array.from(after.preamble.nonce)).not.toEqual(
      Array.from(before.preamble.nonce)
    );

    // Still openable with the same password, and carrying the edit.
    const reopened = await Vault.open(
      memoryPorts(new MemoryFile(file.bytes), clock),
      {
        password: PASSWORD,
      }
    );
    expect(reopened.ok).toBe(true);
    if (reopened.ok)
      expect(reopened.vault.getPayload().vault.name).toBe('Work 2');
  });

  it('coalesces several edits into one write', async () => {
    const { file, vault } = await openedFile();
    const before = file.writes;
    vault.updateMeta({ name: 'A' });
    vault.updateMeta({ name: 'B' });
    vault.updateMeta({ name: 'C' });
    await vault.flush();
    expect(file.writes - before).toBe(1);
  });

  it('writes an edit that lands while a save is in flight', async () => {
    const { file, clock, vault } = await openedFile();

    file.blockNextWrite();
    vault.updateMeta({ name: 'First' });
    const saving = vault.flush();
    await vi.waitFor(() => expect(file.blocked).toBe(true));

    // The first write already holds a snapshot without this edit. It must not
    // be marked clean over the newer payload, and the flush loop must write it.
    clock.advance(1000);
    vault.updateMeta({ name: 'Second' });
    file.releaseWrite();

    expect(await saving).toEqual({ ok: true });
    expect(file.writes).toBe(2);
    expect(vault.getPayload().vault.name).toBe('Second');
    expect(vault.hasUnsavedChanges).toBe(false);

    const reopened = await Vault.open(
      memoryPorts(new MemoryFile(file.bytes), clock),
      { password: PASSWORD }
    );
    expect(reopened.ok).toBe(true);
    if (reopened.ok)
      expect(reopened.vault.getPayload().vault.name).toBe('Second');
  });

  it('does not write when nothing changed', async () => {
    const { file, vault } = await openedFile();
    const before = file.writes;
    expect(await vault.flush()).toEqual({ ok: true });
    expect(file.writes).toBe(before);
  });

  it('refuses to overwrite a file that changed underneath us', async () => {
    const { file, clock, vault } = await openedFile();
    const before = file.bytes!.slice();
    file.externallyReplace(await makeBytes(payload(), { salt: SALT }));

    vault.updateMeta({ name: 'Clobber' });
    const result = await vault.flush();

    expect(result).toEqual({ ok: false, failure: 'external_change' });
    expect(vault.hasUnsavedChanges).toBe(true);
    // The file on disk is still the external version, not ours.
    expect(file.bytes).not.toEqual(before);
    void clock;
  });

  it('keeps the edit pending when the write itself fails', async () => {
    const { file, vault } = await openedFile();
    file.failNextWrite = true;
    vault.updateMeta({ name: 'Pending' });

    expect(await vault.flush()).toEqual({ ok: false, failure: 'io_failed' });
    expect(vault.hasUnsavedChanges).toBe(true);

    // A retry succeeds and persists the edit.
    expect(await vault.flush()).toEqual({ ok: true });
    expect(vault.hasUnsavedChanges).toBe(false);
  });
});

describe('locking', () => {
  it('refuses to lock while edits are unsaved', async () => {
    const { vault } = await openedFile();
    vault.updateMeta({ name: 'Unsaved' });
    expect(vault.lock()).toEqual({ ok: false, failure: 'unsaved_changes' });
    expect(vault.isLocked).toBe(false);
  });

  it('locks once everything is flushed and then refuses work', async () => {
    const { vault } = await openedFile();
    expect(vault.lock()).toEqual({ ok: true });
    expect(vault.isLocked).toBe(true);
    expect(() => vault.getPayload()).toThrow(/locked/);
  });
});

describe('changing the password', () => {
  it('rejects a wrong current password', async () => {
    const { vault } = await openedFile();
    const result = await vault.changePassword(
      'wrong synthetic passphrase',
      'another long synthetic passphrase'
    );
    expect(result).toEqual({ ok: false, failure: 'wrong_password' });
  });

  it('rewrites the container and keeps the payload', async () => {
    const { file, clock, vault } = await openedFile();
    const before = inspectContainer(file.bytes!);
    expect(before.ok).toBe(true);
    if (!before.ok) return;

    const next = 'an entirely different synthetic passphrase';
    expect(await vault.changePassword(PASSWORD, next)).toEqual({ ok: true });

    const after = inspectContainer(file.bytes!);
    expect(after.ok).toBe(true);
    if (!after.ok) return;

    expect(Array.from(after.preamble.salt)).not.toEqual(
      Array.from(before.preamble.salt)
    );
    // The password change resets KDF parameters to the current default.
    expect(after.preamble.kdf).toEqual({ ops: 10, mem: 67_108_864 });
    expect(after.preamble.nonce).not.toBe(before.preamble.nonce);

    const withNew = await Vault.open(
      memoryPorts(new MemoryFile(file.bytes), clock),
      {
        password: next,
      }
    );
    expect(withNew.ok).toBe(true);

    const withOld = await Vault.open(
      memoryPorts(new MemoryFile(file.bytes), clock),
      {
        password: PASSWORD,
      }
    );
    expect(withOld).toMatchObject({ ok: false, failure: 'auth_failed' });
  });

  it('flushes pending edits with the old container first', async () => {
    const { file, clock, vault } = await openedFile();
    vault.updateMeta({ name: 'Saved before rotation' });

    expect(
      await vault.changePassword(PASSWORD, 'a third synthetic passphrase')
    ).toEqual({
      ok: true,
    });

    const reopened = await Vault.open(
      memoryPorts(new MemoryFile(file.bytes), clock),
      {
        password: 'a third synthetic passphrase',
      }
    );
    expect(reopened.ok).toBe(true);
    if (reopened.ok) {
      expect(reopened.vault.getPayload().vault.name).toBe(
        'Saved before rotation'
      );
      expect(reopened.vault.hasUnsavedChanges).toBe(false);
    }
  });

  it('starts a new container fingerprint', async () => {
    const { vault } = await openedFile();
    const before = vault.containerInfo.fingerprint;
    await vault.changePassword(PASSWORD, 'yet another synthetic passphrase');
    expect(vault.containerInfo.fingerprint).not.toBe(before);
  });
});

describe('cloning', () => {
  it('creates a new identity, a new salt and a new fingerprint', async () => {
    const { file, clock, vault } = await openedFile();
    const originalBytes = file.bytes!.slice();
    const target = new MemoryFile(null);

    const cloned = await vault.cloneTo(target, PASSWORD);
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;

    expect(cloned.fingerprint).not.toBe(vault.containerInfo.fingerprint);
    // The original file is untouched and still opens with the same password.
    expect(file.bytes).toEqual(originalBytes);

    const copy = await Vault.open(memoryPorts(target, fixedClock()), {
      password: PASSWORD,
    });
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;

    expect(copy.vault.getPayload().vault.id).not.toBe(
      vault.getPayload().vault.id
    );
    // Assets travel; the key ids are preserved so grant fingerprints survive.
    expect(copy.vault.getPayload().keys[0].id).toBe(KEY_ID);

    const reopenedOriginal = await Vault.open(
      memoryPorts(new MemoryFile(originalBytes), clock),
      { password: PASSWORD }
    );
    expect(reopenedOriginal.ok).toBe(true);
  });

  it('produces a file that is a different container', async () => {
    const { file, vault } = await openedFile();
    const source = inspectContainer(file.bytes!);
    const target = new MemoryFile(null);
    await vault.cloneTo(target, PASSWORD);
    const clone = inspectContainer(target.bytes!);

    expect(source.ok && clone.ok).toBe(true);
    if (!source.ok || !clone.ok) return;
    expect(Array.from(clone.preamble.salt)).not.toEqual(
      Array.from(source.preamble.salt)
    );
    expect(Array.from(nonceOf(target.bytes!)!)).not.toEqual(
      Array.from(source.preamble.nonce)
    );
  });
});

describe('write closure', () => {
  it('every saved file is readable and valid', async () => {
    const { file, clock, vault } = await openedFile();
    vault.updateMeta({ name: 'One' });
    await vault.flush();
    vault.archiveKey(KEY_ID, true);
    await vault.flush();

    const opened = await Vault.open(
      memoryPorts(new MemoryFile(file.bytes), clock),
      {
        password: PASSWORD,
      }
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const validated = validateKeyaFile(opened.vault.getPayload());
    expect(validated.ok).toBe(true);
    expect(opened.vault.getPayload().keys[0].archived_at).not.toBeNull();
  });
});
