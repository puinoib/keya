/**
 * The user's sync folder: the only place `.keya` files come from.
 *
 * Wraps the File System Access API just enough that the rest of the app works
 * with filenames and `FilePort`s. Permission is re-checked before every use
 * because browsers revoke it across reloads.
 */

import { FileHandlePort } from './browser';
import type { FilePort } from '../vault/ports';

const DB_NAME = 'keya-workspace';
const DB_VERSION = 1;
const STORE = 'handle';
const KEY = 'directory';

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .get(KEY);
      request.onsuccess = () =>
        resolve(
          (request.result as FileSystemDirectoryHandle | undefined) ?? null
        );
      request.onerror = () => reject(request.error);
    });
  } finally {
    // Connections are opened per operation, so they must be closed per
    // operation: a leaked one blocks a future schema upgrade forever.
    db.close();
  }
}

async function writeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(handle, KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/** Drop the remembered folder. The next restore() finds nothing. */
async function deleteHandle(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).delete(KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export type PermissionState = 'granted' | 'prompt' | 'denied';

export class Workspace {
  private handle: FileSystemDirectoryHandle;

  private constructor(handle: FileSystemDirectoryHandle) {
    this.handle = handle;
  }

  /** Ask the user for a folder and remember it. Requires a user gesture. */
  static async pick(): Promise<Workspace | null> {
    if (typeof window === 'undefined' || !window.showDirectoryPicker) {
      throw new Error('This browser cannot open a folder.');
    }
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    await writeHandle(handle);
    return new Workspace(handle);
  }

  static async restore(): Promise<Workspace | null> {
    const handle = await readHandle();
    return handle ? new Workspace(handle) : null;
  }

  /** Forget the remembered folder, so a reload does not reconnect to it. */
  static async forget(): Promise<void> {
    await deleteHandle();
  }

  get name(): string {
    return this.handle.name;
  }

  /** The underlying directory handle, for pickers that start in this folder. */
  raw(): FileSystemDirectoryHandle {
    return this.handle;
  }

  async permission(): Promise<PermissionState> {
    const state = await this.handle.queryPermission?.({ mode: 'readwrite' });
    return (state ?? 'prompt') as PermissionState;
  }

  async requestPermission(): Promise<boolean> {
    const state = await this.handle.requestPermission?.({ mode: 'readwrite' });
    return state === 'granted';
  }

  async ensureWritable(): Promise<boolean> {
    if ((await this.permission()) === 'granted') return true;
    return this.requestPermission();
  }

  /** Vault files in the folder, sorted for a stable listing. */
  async listVaultFiles(): Promise<string[]> {
    const names: string[] = [];
    for await (const [name] of this.handle.entries()) {
      if (name.endsWith('.keya')) names.push(name);
    }
    return names.sort();
  }

  async exists(fileName: string): Promise<boolean> {
    try {
      await this.handle.getFileHandle(fileName);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return false;
      }
      throw error;
    }
  }

  /** A port for an existing or newly created file. */
  async filePort(
    fileName: string,
    options: { create?: boolean } = {}
  ): Promise<FilePort> {
    const handle = await this.handle.getFileHandle(fileName, {
      create: options.create ?? false,
    });
    return new FileHandlePort(handle);
  }

  /** Creating a vault must never overwrite an existing file. */
  async createFilePort(fileName: string): Promise<FilePort> {
    if (await this.exists(fileName)) {
      throw new Error('A vault with this filename already exists.');
    }
    return this.filePort(fileName, { create: true });
  }
}
