/**
 * The user's folder and the vault files in it.
 *
 * This is the only module the screens talk to about files: it keeps the folder
 * handle, opens vaults, and exposes the summaries shown before unlocking.
 */

import { Vault, type OpenFailure } from '../vault/vault';
import type { Issue } from '../../core/payload/validate';
import { MAX_FILE_SIZE } from '../../core/format/constants';
import { describePasswordVerdict, judgePassword } from './password-policy';
import { VaultSession } from '../runtime/session';
import { webLocks } from '../storage/browser';
import { systemClock } from '../vault/ports';
import { Workspace } from '../storage/workspace';
import type { ContainerRecord } from '../storage/local/state';
import {
  browserFetch,
  createVault as createVaultFile,
  deviceTimeZone,
  localState,
} from '../storage/platform';

/** A failed open with enough detail for the unlock dialog to explain it. */
export class VaultOpenError extends Error {
  readonly failure: OpenFailure;
  readonly issues: Issue[] | undefined;

  constructor(result: {
    failure: OpenFailure;
    issues?: Issue[];
    message?: string;
  }) {
    super(result.message ?? result.failure);
    this.name = 'VaultOpenError';
    this.failure = result.failure;
    this.issues = result.issues;
  }
}

export interface CachedVaultMeta {
  vault_id: string;
  fileName: string;
  name: string;
  icon: string;
  keyCount: number;
  updatedAt: string;
}

/** A vault that has been opened and is ready to become the active session. */
export interface OpenedVault {
  fileName: string;
  fingerprint: string;
  vault: Vault;
  session: VaultSession;
  deviceKey: CryptoKey;
}

let workspace: Workspace | null = null;

async function current(): Promise<Workspace | null> {
  workspace ??= await Workspace.restore();
  return workspace;
}

export class FileStorage {
  static async setupWorkspace(): Promise<Workspace> {
    const picked = await Workspace.pick();
    if (!picked) throw new Error('No folder was chosen.');
    workspace = picked;
    return picked;
  }

  static async clearWorkspace(): Promise<void> {
    workspace = null;
    // The handle lives in IndexedDB; without this, a reload restores the folder
    // the user just disconnected from.
    await Workspace.forget();
  }

  static async hasWorkspace(): Promise<boolean> {
    return Boolean(await current());
  }

  static async getWorkspaceName(): Promise<string | null> {
    return (await current())?.name ?? null;
  }

  static async getWorkspaceHandle(): Promise<FileSystemDirectoryHandle | null> {
    return (await current())?.raw() ?? null;
  }

  static async requestPermission(): Promise<boolean> {
    const folder = await current();
    return folder ? folder.ensureWritable() : false;
  }

  static async listVaultFiles(): Promise<string[] | null> {
    const folder = await current();
    if (!folder) return [];
    if ((await folder.permission()) !== 'granted') return null;
    return folder.listVaultFiles();
  }

  static async getCachedVaultMetas(): Promise<CachedVaultMeta[]> {
    const records = await localState.listContainers();
    return records.map(toCachedMeta);
  }

  static async openVault(
    fileName: string,
    password: string,
    signal?: AbortSignal
  ): Promise<OpenedVault> {
    const folder = await current();
    if (!folder) throw new Error('No folder is connected.');

    const result = await Vault.open(
      {
        file: await folder.filePort(fileName),
        clock: systemClock,
        locks: webLocks,
      },
      { password, signal }
    );
    if (!result.ok) throw new VaultOpenError(result);

    return finishOpen(fileName, result.vault);
  }

  static async createVault(
    fileName: string,
    password: string,
    meta?: { name?: string; icon?: string }
  ): Promise<OpenedVault> {
    const verdict = await judgePassword(password);
    if (!verdict.ok) throw new Error(describePasswordVerdict(verdict));

    const folder = await current();
    if (!folder) throw new Error('No folder is connected.');
    if (!(await folder.ensureWritable())) {
      throw new Error('Write permission for the folder was denied.');
    }

    const created = await createVaultFile(folder, fileName, password, {
      name: meta?.name?.trim() || fileName.replace(/\.keya$/, ''),
      icon: meta?.icon?.trim() || '',
    });
    if (!created.ok) throw new Error(created.failure);

    return finishOpen(fileName, created.opened.vault);
  }

  /**
   * Open a vault from bytes already in memory. Used when the browser has no
   * folder access: the file is read from a copy the user picked.
   */
  static async openVaultFromBytes(
    fileName: string,
    bytes: Uint8Array,
    password: string,
    signal?: AbortSignal
  ): Promise<OpenedVault> {
    if (bytes.length > MAX_FILE_SIZE)
      throw new VaultOpenError({ failure: 'file_too_large' });
    let current = bytes.slice();
    const port = {
      read: async () => current.slice(),
      write: async (next: Uint8Array) => {
        current = next.slice();
      },
    };

    const result = await Vault.open(
      { file: port, clock: systemClock, locks: webLocks },
      { password, signal }
    );
    if (!result.ok) throw new VaultOpenError(result);

    return finishOpen(fileName, result.vault);
  }

  /**
   * Decrypt the raw plaintext for the §6.3 escape hatch. The bytes are not
   * parsed or validated and never enter the vault store.
   */
  static async exportPlaintext(
    fileName: string,
    password: string
  ): Promise<Uint8Array> {
    const folder = await current();
    if (!folder) throw new Error('No folder is connected.');
    const result = await Vault.openRaw(
      {
        file: await folder.filePort(fileName),
        clock: systemClock,
        locks: webLocks,
      },
      { password }
    );
    if (!result.ok) throw new VaultOpenError(result);
    return result.payload;
  }

  static async exportPlaintextFromBytes(
    bytes: Uint8Array,
    password: string
  ): Promise<Uint8Array> {
    if (bytes.length > MAX_FILE_SIZE)
      throw new VaultOpenError({ failure: 'file_too_large' });
    const port = {
      read: async () => bytes.slice(),
      write: async () => undefined,
    };
    const result = await Vault.openRaw(
      { file: port, clock: systemClock, locks: webLocks },
      { password }
    );
    if (!result.ok) throw new VaultOpenError(result);
    return result.payload;
  }
}

async function finishOpen(
  fileName: string,
  vault: Vault
): Promise<OpenedVault> {
  const deviceKey = await localState.ensureDeviceKey();
  const payload = vault.getPayload();

  const session = new VaultSession({
    vault,
    local: localState,
    deviceKey,
    fetch: browserFetch,
    clock: () => new Date(),
    timeZone: deviceTimeZone(),
  });

  await localState.putContainer({
    fingerprint: vault.containerInfo.fingerprint,
    file_name: fileName,
    vault_id: payload.vault.id,
    name: payload.vault.name,
    icon: payload.vault.icon,
    key_count: payload.keys.length,
    content_updated_at: payload.vault.content_updated_at,
    last_opened_at: new Date().toISOString(),
  });

  return {
    fileName,
    fingerprint: vault.containerInfo.fingerprint,
    vault,
    session,
    deviceKey,
  };
}

function toCachedMeta(record: ContainerRecord): CachedVaultMeta {
  return {
    vault_id: record.vault_id ?? record.fingerprint,
    fileName: record.file_name,
    name: record.name,
    icon: record.icon,
    keyCount: record.key_count,
    updatedAt: record.content_updated_at,
  };
}
