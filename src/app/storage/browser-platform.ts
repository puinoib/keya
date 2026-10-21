/**
 * The browser implementation of the store's platform port.
 *
 * One module keeps the mutable folder handle and translates it into the shape
 * the store expects, so no component touches File System Access directly.
 */

import type { VaultPlatform } from '../store/vault-store';
import { Workspace } from './workspace';
import { createVault, localState, openSession } from './platform';

let current: Workspace | null = null;

async function ensureWorkspace(): Promise<Workspace | null> {
  current ??= await Workspace.restore();
  return current;
}

export const browserVaultPlatform: VaultPlatform = {
  async restoreWorkspace() {
    const workspace = await Workspace.restore();
    current = workspace;
    return workspace ? { name: workspace.name } : null;
  },

  async pickWorkspace() {
    const workspace = await Workspace.pick();
    current = workspace;
    return workspace ? { name: workspace.name } : null;
  },

  async listFiles() {
    const workspace = await ensureWorkspace();
    if (!workspace) return [];
    if (!(await workspace.ensureWritable())) return [];
    return workspace.listVaultFiles();
  },

  async openSession(fileName, password) {
    const workspace = await ensureWorkspace();
    if (!workspace) return { ok: false, failure: 'no_workspace' };
    if (!(await workspace.ensureWritable())) {
      return { ok: false, failure: 'permission_denied' };
    }
    return openSession(workspace, fileName, password);
  },

  async createVault(fileName, password, options) {
    const workspace = await ensureWorkspace();
    if (!workspace) return { ok: false, failure: 'no_workspace' };
    if (!(await workspace.ensureWritable())) {
      return { ok: false, failure: 'permission_denied' };
    }
    return createVault(workspace, fileName, password, options);
  },

  listContainers() {
    return localState.listContainers();
  },
};
