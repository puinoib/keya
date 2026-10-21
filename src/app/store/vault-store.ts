/**
 * Application state for one screen's worth of vault.
 *
 * Holds the unlocked session, mirrors its payload for rendering, and keeps the
 * reminder list current. Every mutation goes through the vault's edit
 * transactions, so the UI cannot invent states the format does not allow.
 *
 * The password never enters this store (I16): it is passed to `unlock` and
 * discarded once the session exists.
 */

import { create } from 'zustand';
import type { KeyaFile, Group, Key, Provider } from '../../core/payload/types';
import type { ReminderView } from '../runtime/session';
import type { VaultSession } from '../runtime/session';
import type { Vault } from '../vault/vault';
import type { ContainerRecord } from '../storage/local/state';
import type { Reminder } from '../../core/reminders';

export interface OpenedSession {
  session: VaultSession;
  vault: Vault;
  fingerprint: string;
  record: ContainerRecord;
}

export type OpenOutcome =
  | { ok: true; opened: OpenedSession }
  | { ok: false; failure: string };

/** Everything the store needs from the browser, injectable for tests. */
export interface VaultPlatform {
  restoreWorkspace(): Promise<{ name: string } | null>;
  pickWorkspace(): Promise<{ name: string } | null>;
  listFiles(): Promise<string[]>;
  openSession(fileName: string, password: string): Promise<OpenOutcome>;
  createVault(
    fileName: string,
    password: string,
    options: { name: string; icon: string }
  ): Promise<OpenOutcome>;
  listContainers(): Promise<ContainerRecord[]>;
}

export type SaveState = 'clean' | 'dirty' | 'saving' | 'error';

export interface VaultStoreState {
  ready: boolean;
  workspaceName: string | null;
  files: string[];
  containers: ContainerRecord[];

  session: VaultSession | null;
  vault: Vault | null;
  fileName: string | null;
  fingerprint: string | null;
  payload: KeyaFile | null;

  reminders: ReminderView[];
  saveState: SaveState;
  error: string | null;
  busy: boolean;

  init: () => Promise<void>;
  pickWorkspace: () => Promise<void>;
  refreshFiles: () => Promise<void>;

  unlock: (fileName: string, password: string) => Promise<boolean>;
  createVault: (
    fileName: string,
    password: string,
    options: { name: string; icon: string }
  ) => Promise<boolean>;
  lock: () => Promise<void>;
  save: () => Promise<boolean>;

  refreshReminders: () => Promise<void>;
  dismiss: (reminder: Reminder) => Promise<void>;
  restore: (reminder: Reminder) => Promise<void>;

  saveKey: (key: Key) => Promise<void>;
  removeKey: (keyId: string) => Promise<void>;
  archiveKey: (keyId: string, archived: boolean) => Promise<void>;
  saveGroup: (group: Group) => Promise<void>;
  removeGroup: (groupId: string) => Promise<void>;
  reorderGroups: (orderedIds: readonly string[]) => Promise<void>;
  saveProvider: (provider: Provider) => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  updateMeta: (patch: { name?: string; icon?: string }) => Promise<void>;
}

export const createVaultStore = (platform: VaultPlatform) =>
  create<VaultStoreState>()((set, get) => {
    const sync = async () => {
      const { session, vault } = get();
      if (!session || !vault) return;
      set({ payload: vault.getPayload() });
      await get().refreshReminders();
    };

    const apply = async (
      run: () => { ok: true; changed: boolean } | { ok: false; reason: string }
    ) => {
      const result = run();
      if (!result.ok) {
        set({ error: result.reason });
        return;
      }
      if (!result.changed) return;
      set({ saveState: 'dirty' });
      await sync();
    };

    return {
      ready: false,
      workspaceName: null,
      files: [],
      containers: [],
      session: null,
      vault: null,
      fileName: null,
      fingerprint: null,
      payload: null,
      reminders: [],
      saveState: 'clean',
      error: null,
      busy: false,

      init: async () => {
        const workspace = await platform.restoreWorkspace();
        if (!workspace) {
          set({
            ready: true,
            workspaceName: null,
            containers: await platform.listContainers(),
          });
          return;
        }
        set({
          ready: true,
          workspaceName: workspace.name,
          files: await platform.listFiles(),
          containers: await platform.listContainers(),
        });
      },

      pickWorkspace: async () => {
        const workspace = await platform.pickWorkspace();
        if (!workspace) return;
        set({
          workspaceName: workspace.name,
          files: await platform.listFiles(),
        });
      },

      refreshFiles: async () => {
        set({ files: await platform.listFiles() });
      },

      unlock: async (fileName, password) => {
        set({ busy: true, error: null });
        try {
          const outcome = await platform.openSession(fileName, password);
          if (!outcome.ok) {
            set({ error: outcome.failure, busy: false });
            return false;
          }
          const { session, vault, fingerprint, record } = outcome.opened;
          set({
            session,
            vault,
            fileName,
            fingerprint,
            payload: vault.getPayload(),
            saveState: 'clean',
            busy: false,
            containers: await platform.listContainers(),
          });
          await get().refreshReminders();
          void record;
          return true;
        } catch (error) {
          set({ error: describe(error), busy: false });
          return false;
        }
      },

      createVault: async (fileName, password, options) => {
        set({ busy: true, error: null });
        try {
          const outcome = await platform.createVault(
            fileName,
            password,
            options
          );
          if (!outcome.ok) {
            set({ error: outcome.failure, busy: false });
            return false;
          }
          const { session, vault, fingerprint } = outcome.opened;
          set({
            session,
            vault,
            fileName,
            fingerprint,
            payload: vault.getPayload(),
            saveState: 'clean',
            busy: false,
            files: await platform.listFiles(),
            containers: await platform.listContainers(),
          });
          await get().refreshReminders();
          return true;
        } catch (error) {
          set({ error: describe(error), busy: false });
          return false;
        }
      },

      lock: async () => {
        const { vault } = get();
        if (!vault) return;
        const saved = await get().save();
        if (!saved) return;
        const outcome = vault.lock();
        if (!outcome.ok) {
          set({ error: 'Unsaved changes must be written before locking.' });
          return;
        }
        set({
          session: null,
          vault: null,
          fileName: null,
          fingerprint: null,
          payload: null,
          reminders: [],
          saveState: 'clean',
        });
      },

      save: async () => {
        const { vault, session } = get();
        if (!vault || !session) return false;

        set({ saveState: 'saving' });
        const result = await vault.flush();
        if (!result.ok) {
          set({ saveState: 'error', error: result.failure });
          return false;
        }
        set({
          saveState: 'clean',
          payload: vault.getPayload(),
          containers: await platform.listContainers(),
        });
        return true;
      },

      refreshReminders: async () => {
        const { session } = get();
        if (!session) {
          set({ reminders: [] });
          return;
        }
        set({ reminders: await session.reminders() });
      },

      dismiss: async (reminder) => {
        await get().session?.dismiss(reminder);
        await get().refreshReminders();
      },

      restore: async (reminder) => {
        await get().session?.restore(reminder);
        await get().refreshReminders();
      },

      saveKey: async (key) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.saveKey(key));
      },

      removeKey: async (keyId) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.removeKey(keyId));
      },

      archiveKey: async (keyId, archived) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.archiveKey(keyId, archived));
      },

      saveGroup: async (group) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.saveGroup(group));
      },

      removeGroup: async (groupId) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.removeGroup(groupId));
      },

      reorderGroups: async (orderedIds) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.reorderGroups(orderedIds));
      },

      saveProvider: async (provider) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.saveProvider(provider));
      },

      removeProvider: async (providerId) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.removeProvider(providerId));
      },

      updateMeta: async (patch) => {
        const vault = get().vault;
        if (!vault) return;
        await apply(() => vault.updateMeta(patch));
      },
    };
  });

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
