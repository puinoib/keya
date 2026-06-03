/**
 * Storage layer — File System Access API
 *
 * Manages the user's sync folder and multiple .keya vault files.
 * IndexedDB stores: workspace folder reference + cached vault metadata.
 */

import { serializeToFile, deserializeFromFile, type KeyaDatabase, Database } from '../../core';

const DB_NAME = 'keya-meta';
const DB_VERSION = 3;
const WORKSPACE_STORE = 'workspace';
const VAULT_META_STORE = 'vault-meta';
const BIOMETRIC_STORE = 'biometric';

// ── Types ──

interface WorkspaceEntry {
  id: 'main';
  directoryHandle: FileSystemDirectoryHandle;
}

export interface CachedVaultMeta {
  vault_id: string;
  fileName: string;
  name: string;
  icon: string;
  keyCount: number;
  updatedAt: string;
}

// ── IndexedDB helpers ──

function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
        db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(VAULT_META_STORE)) {
        db.createObjectStore(VAULT_META_STORE, { keyPath: 'vault_id' });
      }
      if (!db.objectStoreNames.contains(BIOMETRIC_STORE)) {
        db.createObjectStore(BIOMETRIC_STORE, { keyPath: 'vault_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getWorkspace(): Promise<WorkspaceEntry | null> {
  const db = await openMetaDB();
  return new Promise((resolve) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readonly');
    const req = tx.objectStore(WORKSPACE_STORE).get('main');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function saveWorkspace(entry: WorkspaceEntry): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
    tx.objectStore(WORKSPACE_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllCachedMetas(): Promise<CachedVaultMeta[]> {
  const db = await openMetaDB();
  return new Promise((resolve) => {
    const tx = db.transaction(VAULT_META_STORE, 'readonly');
    const req = tx.objectStore(VAULT_META_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => resolve([]);
  });
}

async function putCachedMeta(meta: CachedVaultMeta): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readwrite');
    tx.objectStore(VAULT_META_STORE).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteCachedMeta(vaultId: string): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_META_STORE, 'readwrite');
    tx.objectStore(VAULT_META_STORE).delete(vaultId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Helpers ──

async function ensurePermission(dirHandle: FileSystemDirectoryHandle): Promise<boolean> {
  const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') return true;
  const req = await dirHandle.requestPermission({ mode: 'readwrite' });
  return req === 'granted';
}

function fileNameToStem(fileName: string): string {
  return fileName.replace(/\.keya$/, '');
}

// ── FileStorage ──

export class FileStorage {
  /**
   * Pick a sync folder and save workspace reference.
   */
  static async setupWorkspace(): Promise<FileSystemDirectoryHandle> {
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    await saveWorkspace({ id: 'main', directoryHandle: dirHandle });
    return dirHandle;
  }

  /**
   * List all .keya filenames in the workspace folder, sorted alphabetically.
   */
  static async listVaultFiles(): Promise<string[]> {
    const ws = await getWorkspace();
    if (!ws) return [];
    if (!(await ensurePermission(ws.directoryHandle))) return [];

    const files: string[] = [];
    for await (const [name] of (ws.directoryHandle as any).entries()) {
      if (name.endsWith('.keya')) files.push(name);
    }
    return files.sort();
  }

  /**
   * Open and decrypt a specific vault file.
   */
  static async openVault(fileName: string, password: string): Promise<Database> {
    const ws = await getWorkspace();
    if (!ws) throw new Error('No workspace configured');

    const fileHandle = await ws.directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    const data = await deserializeFromFile(new Uint8Array(buffer), password);
    const db = new Database(data);

    await FileStorage.cacheVaultMeta(fileName, db);
    return db;
  }

  /**
   * Create a new vault file in the workspace folder.
   */
  static async createVault(
    fileName: string,
    password: string,
    meta?: { name?: string; icon?: string },
  ): Promise<Database> {
    const ws = await getWorkspace();
    if (!ws) throw new Error('No workspace configured');

    const displayName = meta?.name || fileNameToStem(fileName);
    const db = new Database(undefined, { name: displayName, icon: meta?.icon });

    await FileStorage.saveVault(fileName, db.getData(), password);
    await FileStorage.cacheVaultMeta(fileName, db);
    return db;
  }

  /**
   * Encrypt and save to a specific vault file.
   */
  static async saveVault(fileName: string, db: KeyaDatabase, password: string): Promise<void> {
    const ws = await getWorkspace();
    if (!ws) throw new Error('No workspace configured');

    await ensurePermission(ws.directoryHandle);
    const bytes = await serializeToFile(db, password);
    const fileHandle = await ws.directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
  }

  /**
   * Cache vault metadata to IndexedDB for display without decryption.
   */
  static async cacheVaultMeta(fileName: string, db: Database): Promise<void> {
    const data = db.getData();
    await putCachedMeta({
      vault_id: data.vault_id,
      fileName,
      name: data.name || fileNameToStem(fileName),
      icon: data.icon,
      keyCount: data.api_keys.length,
      updatedAt: data.updated_at,
    });
  }

  /**
   * Get all cached vault metadata (for welcome page display).
   */
  static async getCachedVaultMetas(): Promise<CachedVaultMeta[]> {
    return getAllCachedMetas();
  }

  /**
   * Remove cached metadata for a vault.
   */
  static async deleteVaultMeta(vaultId: string): Promise<void> {
    await deleteCachedMeta(vaultId);
  }

  /**
   * Clear workspace reference (for switching folders).
   */
  static async clearWorkspace(): Promise<void> {
    const db = await openMetaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_STORE, 'readwrite');
      tx.objectStore(WORKSPACE_STORE).delete('main');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async hasWorkspace(): Promise<boolean> {
    const ws = await getWorkspace();
    return ws !== null;
  }

  static async getWorkspaceName(): Promise<string | null> {
    const ws = await getWorkspace();
    return ws?.directoryHandle?.name ?? null;
  }

  /**
   * Legacy save via download (for browsers without File System Access API).
   */
  static async saveViaDownload(db: KeyaDatabase, password: string, fileName = 'my-keys.keya'): Promise<void> {
    const bytes = await serializeToFile(db, password);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export { openMetaDB, BIOMETRIC_STORE };
