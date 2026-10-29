/**
 * Runtime for one unlocked vault (§12).
 *
 * Owns the container generation (version, KDF parameters, salt, file key), the
 * plaintext payload, the on-disk digest and the single write queue. Nothing
 * else in the app writes a `.keya` file.
 *
 * Invariants this class is responsible for:
 *
 * - I3/I17: saving copies version, KDF parameters and salt verbatim and only
 *   generates a new nonce. A save never runs the KDF.
 * - I10/I11: a failed save keeps the payload dirty and never discards edits; a
 *   lock that cannot flush is cancelled.
 * - I15: the new nonce is checked against the one already on disk.
 * - I16: the password is not retained; changing it re-derives from a freshly
 *   typed old password.
 */

import {
  KDF_DEFAULT_MEM,
  KDF_DEFAULT_OPS,
  MAX_FILE_SIZE,
  PREAMBLE_SIZE,
  VERSION,
  type KdfParams,
} from '../../core/format/constants';
import {
  freshNonce,
  generateSalt,
  openContainer,
  previousNonceOf,
  sealContainer,
} from '../../core/format/container';
import {
  deriveFileKey,
  KdfError,
  type KdfFailure,
} from '../../core/format/kdf';
import { inspectContainer, type Preamble } from '../../core/format/preamble';
import { parsePayload, serializePayload } from '../../core/payload/serialize';
import {
  checkIconForWriter,
  normalizeKeyaFile,
} from '../../core/payload/normalize';
import type { KeyaFile } from '../../core/payload/types';
import {
  summarizeIssues,
  validateKeyaFile,
  type Issue,
} from '../../core/payload/validate';
import { containerFingerprint } from '../../core/fingerprint';
import {
  deepEqual,
  deleteGroup,
  deleteKey,
  deleteProvider,
  reorderGroups,
  setArchived,
  updateVaultMeta,
  upsertGroup,
  upsertKey,
  upsertProvider,
  type EditRejection,
  type EditResult,
} from '../../core/payload/edits';
import type { Group, Key, Provider } from '../../core/payload/types';
import type { FilePort, VaultPorts } from './ports';
import { FileTooLargeError } from './ports';

export type OpenFailure =
  | 'missing_file'
  | 'file_too_short'
  | 'file_too_large'
  | 'bad_magic'
  | 'unsupported_version'
  | 'kdf_out_of_range'
  | 'auth_failed'
  | 'payload_corrupt'
  | 'invalid_payload'
  | 'kdf_busy'
  | 'kdf_cancelled'
  | 'kdf_failed'
  | 'kdf_memory';

export type SaveFailure =
  | 'locked'
  | 'invalid_payload'
  | 'external_change'
  | 'io_failed';

export type PasswordFailure =
  | 'locked'
  | 'busy'
  | 'wrong_password'
  | 'kdf_busy'
  | 'kdf_cancelled'
  | 'kdf_failed'
  | 'kdf_memory'
  | 'target_exists'
  | SaveFailure;

/** Why an edit never reached memory: a transaction rule or class A. */
export type EditFailure = EditRejection | 'invalid_edit' | 'invalid_icon';

/** Keep Argon2 allocation failure distinct from cancellation and bad input. */
export function kdfFailureCode(
  failure: KdfFailure
): 'kdf_busy' | 'kdf_cancelled' | 'kdf_failed' | 'kdf_memory' {
  switch (failure) {
    case 'busy':
      return 'kdf_busy';
    case 'cancelled':
      return 'kdf_cancelled';
    case 'memory':
      return 'kdf_memory';
    case 'failed':
      return 'kdf_failed';
  }
}

export interface OpenOptions {
  password: string;
  signal?: AbortSignal;
  lockTimeoutMs?: number;
  /** Already-derived key for a file this process just wrote (vault creation). */
  fileKey?: Uint8Array;
}

export type OpenResult =
  | { ok: true; vault: Vault }
  | { ok: false; failure: OpenFailure; issues?: Issue[]; message?: string };

const WRITE_LOCK = 'keya-vault-writes';

/** The same lock the vault takes for every write, so creation is serialized. */
export const VAULT_WRITE_LOCK = WRITE_LOCK;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function digestOf(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return toHex(await crypto.subtle.digest('SHA-256', copy));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

/**
 * The part of a payload an edit can legitimately change. Timestamps move as a
 * side effect of a transaction, so they are excluded when deciding whether a
 * normalized edit is actually a no-op.
 */
/** The writer re-checks the serialized size; the field limits are arithmetic. */
function payloadFits(bytes: Uint8Array): boolean {
  return bytes.length + PREAMBLE_SIZE <= MAX_FILE_SIZE;
}

function businessState(file: KeyaFile): KeyaFile {
  return {
    vault: { ...file.vault, content_updated_at: '' },
    providers: file.providers,
    groups: file.groups,
    keys: file.keys.map((key) => ({ ...key, content_updated_at: '' })),
  };
}

export class Vault {
  private payload: KeyaFile;
  private fileKey: Uint8Array;
  private container: { version: number; kdf: KdfParams; salt: Uint8Array };
  private digest: string;
  private lastNonce: Uint8Array;
  private dirty = false;
  /**
   * Bumped on every applied edit. A save captures it before writing so it can
   * tell "the payload I wrote is still current" from "an edit landed while the
   * write was in flight".
   */
  private revision = 0;
  private locked = false;
  /** Set while a password change owns the container; locking waits it out. */
  private changingPassword = false;
  private queue: Promise<void> = Promise.resolve();
  private readonly ports: VaultPorts;

  readonly sessionId: string;
  private fingerprint: string;

  private constructor(init: {
    payload: KeyaFile;
    fileKey: Uint8Array;
    preamble: Preamble;
    digest: string;
    fingerprint: string;
    sessionId: string;
    ports: VaultPorts;
  }) {
    this.payload = init.payload;
    this.fileKey = init.fileKey;
    this.container = {
      version: init.preamble.version,
      kdf: init.preamble.kdf,
      salt: init.preamble.salt,
    };
    this.digest = init.digest;
    this.lastNonce = init.preamble.nonce;
    this.fingerprint = init.fingerprint;
    this.sessionId = init.sessionId;
    this.ports = init.ports;
  }

  /** Read, decrypt and validate a file. The password is not retained. */
  static async open(
    ports: VaultPorts,
    options: OpenOptions
  ): Promise<OpenResult> {
    let bytes: Uint8Array | null;
    try {
      bytes = await ports.file.read();
    } catch (error) {
      if (error instanceof FileTooLargeError)
        return { ok: false, failure: 'file_too_large' };
      throw error;
    }
    if (!bytes) return { ok: false, failure: 'missing_file' };

    const inspected = inspectContainer(bytes);
    if (!inspected.ok) return { ok: false, failure: inspected.failure };

    let fileKey: Uint8Array;
    if (options.fileKey) {
      // The caller just derived this key for the file it wrote, so deriving it
      // a second time would only double the Argon2 cost of creating a vault.
      fileKey = options.fileKey;
    } else {
      try {
        fileKey = await deriveFileKey(
          {
            password: options.password,
            salt: inspected.preamble.salt,
            kdf: inspected.preamble.kdf,
          },
          { signal: options.signal, lockTimeoutMs: options.lockTimeoutMs }
        );
      } catch (error) {
        if (error instanceof KdfError) {
          return {
            ok: false,
            failure: kdfFailureCode(error.failure),
          };
        }
        throw error;
      }
    }

    const opened = await openContainer(bytes, fileKey);
    if (!opened.ok) {
      return {
        ok: false,
        failure:
          opened.failure === 'auth_failed' ? 'auth_failed' : opened.failure,
      };
    }

    let parsed: unknown;
    try {
      parsed = parsePayload(opened.payload);
    } catch {
      return { ok: false, failure: 'payload_corrupt' };
    }

    const validated = validateKeyaFile(parsed);
    if (!validated.ok) {
      return {
        ok: false,
        failure: 'invalid_payload',
        issues: validated.issues,
        message: summarizeIssues(validated.issues),
      };
    }

    return {
      ok: true,
      vault: new Vault({
        payload: validated.value,
        fileKey,
        preamble: opened.preamble,
        digest: await digestOf(bytes),
        fingerprint: await containerFingerprint(opened.preamble.salt),
        sessionId: crypto.randomUUID(),
        ports,
      }),
    };
  }

  /**
   * Read and decrypt without parsing or validating the payload.
   *
   * This is the isolated escape hatch for a file that decrypted but failed
   * class A validation (§6.3). The bytes never enter the store, are not parsed
   * into the model, and are returned to the caller for one explicit download.
   */
  static async openRaw(
    ports: VaultPorts,
    options: OpenOptions
  ): Promise<
    | { ok: true; payload: Uint8Array; preamble: Preamble }
    | { ok: false; failure: OpenFailure }
  > {
    let bytes: Uint8Array | null;
    try {
      bytes = await ports.file.read();
    } catch (error) {
      if (error instanceof FileTooLargeError)
        return { ok: false, failure: 'file_too_large' };
      throw error;
    }
    if (!bytes) return { ok: false, failure: 'missing_file' };

    const inspected = inspectContainer(bytes);
    if (!inspected.ok) return { ok: false, failure: inspected.failure };

    let fileKey: Uint8Array;
    try {
      fileKey = await deriveFileKey(
        {
          password: options.password,
          salt: inspected.preamble.salt,
          kdf: inspected.preamble.kdf,
        },
        { signal: options.signal, lockTimeoutMs: options.lockTimeoutMs }
      );
    } catch (error) {
      if (error instanceof KdfError)
        return { ok: false, failure: kdfFailureCode(error.failure) };
      throw error;
    }

    const opened = await openContainer(bytes, fileKey);
    if (!opened.ok)
      return {
        ok: false,
        failure:
          opened.failure === 'auth_failed' ? 'auth_failed' : opened.failure,
      };
    return {
      ok: true,
      payload: opened.payload,
      preamble: opened.preamble,
    };
  }

  getPayload(): KeyaFile {
    this.assertUnlocked();
    return this.payload;
  }

  get hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /**
   * Confirm a password without retaining it. Used by flows that must prove the
   * user still knows it (enabling biometric unlock) but must not keep it.
   */
  async verifyPassword(password: string): Promise<boolean> {
    this.assertUnlocked();
    const derived = await deriveFileKey({
      password,
      salt: this.container.salt,
      kdf: this.container.kdf,
    }).catch(() => null);
    if (!derived) return false;
    const matches = constantTimeEqual(derived, this.fileKey);
    derived.fill(0);
    return matches;
  }

  /**
   * Apply an edit transaction result and mark the payload dirty.
   *
   * Every write entry point ends here, so this is the one place that runs the
   * shared normalization (I14) and class A validation before the edit reaches
   * memory. Rejecting it here is what keeps an unsaveable payload out of the
   * vault; the alternative is a dirty vault whose every save fails.
   */
  applyEdit(
    result: EditResult
  ):
    | { ok: true; changed: boolean }
    | { ok: false; reason: EditFailure; issues?: Issue[] } {
    this.assertUnlocked();
    if (!result.ok) return { ok: false, reason: result.reason };
    if (!result.changed) return { ok: true, changed: false };

    const normalized = normalizeKeyaFile(result.value);
    const validated = validateKeyaFile(normalized);
    if (!validated.ok) {
      return { ok: false, reason: 'invalid_edit', issues: validated.issues };
    }
    if (checkIconForWriter(normalized.vault.icon) !== 'ok') {
      return { ok: false, reason: 'invalid_icon' };
    }
    for (const group of normalized.groups) {
      if (checkIconForWriter(group.icon) !== 'ok') {
        return { ok: false, reason: 'invalid_icon' };
      }
    }

    // The transaction compares before normalization, so "  sk-1 " can look
    // different from "sk-1" and move timestamps. Normalization happens here;
    // if the business state is unchanged, this is still a no-op edit and must
    // not write a new file (§8).
    if (
      deepEqual(businessState(this.payload), businessState(validated.value))
    ) {
      return { ok: true, changed: false };
    }

    this.payload = validated.value;
    this.revision += 1;
    this.dirty = true;
    return { ok: true, changed: true };
  }

  // ── edit convenience wrappers ──

  saveKey(key: Key) {
    return this.applyEdit(upsertKey(this.payload, key, this.now()));
  }

  removeKey(keyId: string) {
    return this.applyEdit(deleteKey(this.payload, keyId, this.now()));
  }

  archiveKey(keyId: string, archived: boolean) {
    return this.applyEdit(
      setArchived(this.payload, keyId, archived, this.now())
    );
  }

  saveGroup(group: Group) {
    return this.applyEdit(upsertGroup(this.payload, group, this.now()));
  }

  removeGroup(groupId: string) {
    return this.applyEdit(deleteGroup(this.payload, groupId, this.now()));
  }

  reorderGroups(orderedIds: readonly string[]) {
    return this.applyEdit(reorderGroups(this.payload, orderedIds, this.now()));
  }

  saveProvider(provider: Provider) {
    return this.applyEdit(upsertProvider(this.payload, provider, this.now()));
  }

  removeProvider(providerId: string) {
    return this.applyEdit(deleteProvider(this.payload, providerId, this.now()));
  }

  updateMeta(patch: { name?: string; icon?: string }) {
    return this.applyEdit(updateVaultMeta(this.payload, patch, this.now()));
  }

  /**
   * Flush every pending change. Runs are serialized through one queue, and the
   * run keeps writing until nothing is dirty: an edit that lands during a write
   * is left dirty by `writeOnce`, so this loop is what turns it into a second
   * write instead of losing it.
   */
  async flush(): Promise<{ ok: true } | { ok: false; failure: SaveFailure }> {
    this.assertUnlocked();
    return this.enqueue(() => this.writeUntilClean());
  }

  /**
   * Every write that touches this file goes through one queue. `writeOnce` and
   * the password-change rewrite must not interleave: otherwise a save that
   * read the old container could overwrite the new one.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  /** Write, and retry while edits keep landing mid-write. */
  private async writeUntilClean(): Promise<
    { ok: true } | { ok: false; failure: SaveFailure }
  > {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await this.writeOnce();
      if (!result.ok) return result;
      if (!this.dirty) return result;
    }
    // Still dirty after the bound: report it rather than claim a clean save.
    return { ok: false, failure: 'io_failed' };
  }

  private async writeOnce(): Promise<
    { ok: true } | { ok: false; failure: SaveFailure }
  > {
    if (!this.dirty) return { ok: true };

    const revision = this.revision;
    const validated = validateKeyaFile(this.payload);
    if (!validated.ok) return { ok: false, failure: 'invalid_payload' };

    const payload = serializePayload(validated.value);
    if (!payloadFits(payload)) return { ok: false, failure: 'invalid_payload' };

    try {
      return await this.ports.locks.run(WRITE_LOCK, async () => {
        const current = await this.ports.file.read();
        if (!current)
          return { ok: false as const, failure: 'external_change' as const };
        if ((await digestOf(current)) !== this.digest) {
          return { ok: false as const, failure: 'external_change' as const };
        }

        const nonce = freshNonce(previousNonceOf(current));
        const file = await sealContainer({
          payload,
          fileKey: this.fileKey,
          container: this.container,
          nonce,
        });

        await this.ports.file.write(file);

        this.digest = await digestOf(file);
        this.lastNonce = nonce;
        // Only the payload that actually reached the file may be marked clean.
        // A newer edit keeps its payload and the dirty flag, and the loop in
        // `flush` writes it next.
        if (this.revision === revision) {
          this.payload = validated.value;
          this.dirty = false;
        }
        return { ok: true as const };
      });
    } catch {
      // Keep dirty state: nothing was committed.
      return { ok: false, failure: 'io_failed' };
    }
  }

  /**
   * Change the password. The old password is verified by re-deriving, never by
   * comparing against a retained copy; the write happens only after pending
   * edits have been flushed with the old container.
   */
  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<{ ok: true } | { ok: false; failure: PasswordFailure }> {
    this.assertUnlocked();
    if (this.changingPassword) return { ok: false, failure: 'busy' };

    this.changingPassword = true;
    try {
      return await this.changePasswordLocked(oldPassword, newPassword);
    } finally {
      this.changingPassword = false;
    }
  }

  private async changePasswordLocked(
    oldPassword: string,
    newPassword: string
  ): Promise<{ ok: true } | { ok: false; failure: PasswordFailure }> {
    let verified: Uint8Array;
    try {
      verified = await deriveFileKey({
        password: oldPassword,
        salt: this.container.salt,
        kdf: this.container.kdf,
      });
    } catch (error) {
      if (error instanceof KdfError) {
        return {
          ok: false,
          failure: kdfFailureCode(error.failure),
        };
      }
      throw error;
    }

    const matches = constantTimeEqual(verified, this.fileKey);
    verified.fill(0);
    if (!matches) {
      return { ok: false, failure: 'wrong_password' };
    }

    const next: KdfParams = { ops: KDF_DEFAULT_OPS, mem: KDF_DEFAULT_MEM };
    const salt = generateSalt();

    let nextKey: Uint8Array;
    try {
      nextKey = await deriveFileKey({ password: newPassword, salt, kdf: next });
    } catch (error) {
      if (error instanceof KdfError) {
        return {
          ok: false,
          failure: kdfFailureCode(error.failure),
        };
      }
      throw error;
    }

    // The flag keeps a fresh lock from starting, but one may have finished
    // before this call set it.
    if (this.locked) return { ok: false, failure: 'locked' };

    // Stage 2: everything pending must land with the old container first.
    const flushed = await this.flush();
    if (!flushed.ok) return { ok: false, failure: flushed.failure };
    if (this.locked) {
      nextKey.fill(0);
      return { ok: false, failure: 'locked' };
    }

    const nextFingerprint = await containerFingerprint(salt);

    // Assign the new container inside the same queued task that writes it, so
    // a save queued behind this one cannot observe the old key with the new
    // file on disk.
    const performed = await this.enqueue(async () => {
      const written = await this.rewriteWith({
        fileKey: nextKey,
        container: { version: VERSION, kdf: next, salt },
      });
      if (written.ok) {
        this.fileKey = nextKey;
        this.container = { version: VERSION, kdf: next, salt };
        this.fingerprint = nextFingerprint;
      }
      return written;
    });

    if (!performed.ok) {
      nextKey.fill(0);
      return { ok: false, failure: performed.failure };
    }

    return { ok: true };
  }

  /**
   * Write the whole file with a different container. Used by password change
   * and by clone. Payload and `content_updated_at` are untouched.
   */
  private async rewriteWith(next: {
    fileKey: Uint8Array;
    container: { version: number; kdf: KdfParams; salt: Uint8Array };
  }): Promise<{ ok: true } | { ok: false; failure: SaveFailure }> {
    const validated = validateKeyaFile(this.payload);
    if (!validated.ok) return { ok: false, failure: 'invalid_payload' };

    const payload = serializePayload(validated.value);
    if (!payloadFits(payload)) return { ok: false, failure: 'invalid_payload' };

    try {
      return await this.ports.locks.run(WRITE_LOCK, async () => {
        const current = await this.ports.file.read();
        if (!current)
          return { ok: false as const, failure: 'external_change' as const };
        if ((await digestOf(current)) !== this.digest) {
          return { ok: false as const, failure: 'external_change' as const };
        }

        const nonce = freshNonce(previousNonceOf(current));
        const file = await sealContainer({
          payload,
          fileKey: next.fileKey,
          container: next.container,
          nonce,
        });

        await this.ports.file.write(file);
        this.digest = await digestOf(file);
        this.lastNonce = nonce;
        return { ok: true as const };
      });
    } catch {
      return { ok: false, failure: 'io_failed' };
    }
  }

  /**
   * Clone the vault into another file: a new identity, a new salt and therefore
   * a new container fingerprint. Requires the password because the session no
   * longer holds one (I16).
   */
  async cloneTo(
    file: FilePort,
    password: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<
    { ok: true; fingerprint: string } | { ok: false; failure: PasswordFailure }
  > {
    this.assertUnlocked();

    const now = this.now();
    const salt = generateSalt();
    const kdf: KdfParams = { ops: KDF_DEFAULT_OPS, mem: KDF_DEFAULT_MEM };

    let fileKey: Uint8Array;
    try {
      fileKey = await deriveFileKey(
        { password, salt, kdf },
        { signal: options.signal }
      );
    } catch (error) {
      if (error instanceof KdfError) {
        return {
          ok: false,
          failure: kdfFailureCode(error.failure),
        };
      }
      throw error;
    }

    // Derivation takes seconds and the vault can be locked underneath it. A
    // clone taken from the cleared payload would silently produce an empty
    // vault under the new password.
    if (this.locked) return { ok: false, failure: 'locked' };

    const copy: KeyaFile = {
      vault: {
        ...this.payload.vault,
        id: crypto.randomUUID(),
        created_at: now,
        content_updated_at: now,
      },
      providers: this.payload.providers,
      groups: this.payload.groups,
      keys: this.payload.keys,
    };

    const validated = validateKeyaFile(normalizeKeyaFile(copy));
    if (!validated.ok) return { ok: false, failure: 'invalid_payload' };
    if (checkIconForWriter(validated.value.vault.icon) !== 'ok')
      return { ok: false, failure: 'invalid_payload' };

    // The clone is a write like any other: serialize it against the same lock,
    // and refuse to replace a file that is already there.
    try {
      const written = await this.ports.locks.run(WRITE_LOCK, async () => {
        const existing = await file.read();
        if (existing) {
          return { ok: false as const, failure: 'target_exists' as const };
        }
        const serialized = serializePayload(validated.value);
        if (!payloadFits(serialized)) {
          return { ok: false as const, failure: 'invalid_payload' as const };
        }
        const nonce = freshNonce(previousNonceOf(existing));
        const bytes = await sealContainer({
          payload: serialized,
          fileKey,
          container: { version: VERSION, kdf, salt },
          nonce,
        });
        await file.write(bytes);
        return { ok: true as const };
      });
      if (!written.ok) return written;
    } catch {
      return { ok: false, failure: 'io_failed' };
    }

    return { ok: true, fingerprint: await containerFingerprint(salt) };
  }

  /** Drop the key material and refuse further operations. */
  lock(): { ok: true } | { ok: false; failure: 'unsaved_changes' | 'busy' } {
    if (this.changingPassword) return { ok: false, failure: 'busy' };
    if (this.dirty) return { ok: false, failure: 'unsaved_changes' };
    this.locked = true;
    this.fileKey.fill(0);
    // Drop the plaintext graph too. References held elsewhere are GC's
    // problem, but this object no longer keeps the secrets reachable.
    const { id, created_at, content_updated_at } = this.payload.vault;
    this.payload = {
      vault: { id, name: '', icon: '', created_at, content_updated_at },
      providers: [],
      groups: [],
      keys: [],
    };
    return { ok: true };
  }

  private now(): string {
    return this.ports.clock.now().toISOString();
  }

  private assertUnlocked(): void {
    if (this.locked) throw new Error('vault is locked');
  }

  /** Current payload as a complete file image, without touching the port. */
  async exportBytes(
    options: { markClean?: boolean } = {}
  ): Promise<
    { ok: true; bytes: Uint8Array } | { ok: false; failure: SaveFailure }
  > {
    this.assertUnlocked();
    const revision = this.revision;
    const validated = validateKeyaFile(this.payload);
    if (!validated.ok) return { ok: false, failure: 'invalid_payload' };

    const serialized = serializePayload(validated.value);
    if (!payloadFits(serialized))
      return { ok: false, failure: 'invalid_payload' };

    const nonce = freshNonce(this.lastNonce);
    const bytes = await sealContainer({
      payload: serialized,
      fileKey: this.fileKey,
      container: this.container,
      nonce,
    });
    // Download mode has no writable file: the exported bytes *are* the save.
    // Only clear dirty when the exported snapshot is still the current one; an
    // edit that landed during sealing is not in these bytes.
    if (options.markClean && this.revision === revision) this.dirty = false;
    return { ok: true, bytes };
  }

  /** Nonce currently on disk, for diagnostics and tests. */
  get lastWrittenNonce(): Uint8Array {
    return this.lastNonce;
  }

  get containerInfo(): {
    version: number;
    kdf: KdfParams;
    fingerprint: string;
  } {
    return {
      version: this.container.version,
      kdf: this.container.kdf,
      fingerprint: this.fingerprint,
    };
  }
}
