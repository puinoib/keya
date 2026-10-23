/**
 * Browser wiring: the one place that instantiates the real adapters.
 *
 * Everything else takes its dependencies as arguments, which is why the runtime
 * is testable in Node while production uses IndexedDB, File System Access and
 * `fetch`.
 */

import {
  KDF_DEFAULT_MEM,
  KDF_DEFAULT_OPS,
  VERSION,
  type KdfParams,
} from '../../core/format/constants';
import {
  generateNonce,
  generateSalt,
  sealContainer,
} from '../../core/format/container';
import { deriveFileKey } from '../../core/format/kdf';
import { serializePayload } from '../../core/payload/serialize';
import {
  checkIconForWriter,
  normalizeKeyaFile,
} from '../../core/payload/normalize';
import { summarizeIssues, validateKeyaFile } from '../../core/payload/validate';
import type { KeyaFile } from '../../core/payload/types';
import { VAULT_WRITE_LOCK, Vault } from '../vault/vault';
import { checkPasswordShape } from '../../core/payload/password';
import { systemClock } from '../vault/ports';
import { VaultSession } from '../runtime/session';
import { IndexedDbKeyValue } from './local/idb-kv';
import { LocalState } from './local/state';
import type { ContainerRecord } from './local/state';
import { webLocks } from './browser';
import type { ProbeFetch } from '../probe/execute';
import type { Workspace } from './workspace';
import type { FilePort } from '../vault/ports';

/** Process-wide device state. */
export const localState = new LocalState(new IndexedDbKeyValue());

/** A real fetch that only exposes what the probe layer is allowed to use. */
export const browserFetch: ProbeFetch = async (url, init) => {
  const response = await fetch(url, init);
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
  };
};

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export type SessionOpenFailure = 'missing_file' | string;

export interface OpenedSession {
  session: VaultSession;
  vault: Vault;
  fingerprint: string;
  record: ContainerRecord;
}

/** Open a file, unlock it and register it for the locked-state listing. */
export async function openSession(
  workspace: Workspace,
  fileName: string,
  password: string,
  options: { signal?: AbortSignal; fileKey?: Uint8Array } = {}
): Promise<
  { ok: true; opened: OpenedSession } | { ok: false; failure: string }
> {
  const file = await workspace.filePort(fileName);
  const result = await Vault.open(
    { file, clock: systemClock, locks: webLocks },
    { password, signal: options.signal, fileKey: options.fileKey }
  );

  if (!result.ok) return { ok: false, failure: result.failure };

  const vault = result.vault;
  const payload = vault.getPayload();
  const deviceKey = await localState.ensureDeviceKey();

  const record: ContainerRecord = {
    fingerprint: vault.containerInfo.fingerprint,
    file_name: fileName,
    vault_id: payload.vault.id,
    name: payload.vault.name,
    icon: payload.vault.icon,
    key_count: payload.keys.length,
    content_updated_at: payload.vault.content_updated_at,
    last_opened_at: new Date().toISOString(),
  };
  await localState.putContainer(record);

  return {
    ok: true,
    opened: {
      vault,
      fingerprint: record.fingerprint,
      record,
      session: new VaultSession({
        vault,
        local: localState,
        deviceKey,
        fetch: browserFetch,
      }),
    },
  };
}

export interface CreateVaultOptions {
  name: string;
  icon: string;
}

/**
 * Create a new vault file. Refuses to overwrite; stamps the container with a
 * fresh salt and the current KDF defaults.
 *
 * Creation runs under the vault write lock so the existence check and the write
 * cannot interleave with another tab, and the key derived here is handed to the
 * open step instead of being derived a second time.
 */
export async function createVault(
  workspace: Workspace,
  fileName: string,
  password: string,
  options: CreateVaultOptions
): Promise<
  { ok: true; opened: OpenedSession } | { ok: false; failure: string }
> {
  const shape = checkPasswordShape(password);
  if (shape) return { ok: false, failure: shape };

  const now = new Date().toISOString();
  const candidate: KeyaFile = {
    vault: {
      id: crypto.randomUUID(),
      name: options.name.trim() || fileName.replace(/\.keya$/, ''),
      icon: options.icon?.trim() ?? '',
      created_at: now,
      content_updated_at: now,
    },
    providers: [],
    groups: [],
    keys: [],
  };

  // The same normalization and class A gate every edit passes through, so a
  // name that is too long cannot produce a file nobody can open.
  const normalized = normalizeKeyaFile(candidate);
  const validated = validateKeyaFile(normalized);
  if (!validated.ok)
    return { ok: false, failure: summarizeIssues(validated.issues) };
  if (checkIconForWriter(validated.value.vault.icon) !== 'ok')
    return { ok: false, failure: 'invalid_icon' };

  const kdf: KdfParams = { ops: KDF_DEFAULT_OPS, mem: KDF_DEFAULT_MEM };
  const salt = generateSalt();

  return webLocks.run(VAULT_WRITE_LOCK, async () => {
    let file: FilePort;
    try {
      file = await workspace.createFilePort(fileName);
    } catch (error) {
      return {
        ok: false,
        failure: error instanceof Error ? error.message : 'io_failed',
      };
    }

    const fileKey = await deriveFileKey({ password, salt, kdf });
    const bytes = await sealContainer({
      payload: serializePayload(validated.value),
      fileKey,
      container: { version: VERSION, kdf, salt },
      nonce: generateNonce(),
    });

    try {
      await file.write(bytes);
    } catch {
      // Do not leave a half-created file that blocks the next attempt.
      await workspace.remove(fileName).catch(() => undefined);
      return { ok: false, failure: 'io_failed' };
    }

    return openSession(workspace, fileName, password, { fileKey });
  });
}
