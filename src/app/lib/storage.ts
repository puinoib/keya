/**
 * Storage layer — File System Access API
 *
 * Manages the user's sync folder and .keya file access.
 * The .keya file is the sole data source; IndexedDB only stores the folder reference.
 */

import { serializeToFile, deserializeFromFile, type KeyaDatabase } from '../../core';

const DB_NAME = 'keya-meta';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';

interface WorkspaceEntry {
  id: 'main';
  directoryHandle: FileSystemDirectoryHandle;
  fileName: string;
}

function openMetaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getWorkspace(): Promise<WorkspaceEntry | null> {
  const db = await openMetaDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('main');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function saveWorkspace(entry: WorkspaceEntry): Promise<void> {
  const db = await openMetaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export class FileStorage {
  /**
   * First-time setup: user picks a sync folder.
   */
  static async setupWorkspace(): Promise<{
    directoryHandle: FileSystemDirectoryHandle;
    existingFile: File | null;
  }> {
    // Request folder
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });

    // Check for existing .keya files
    let existingFile: File | null = null;
    try {
      const files: string[] = [];
      for await (const [name] of (dirHandle as any).entries()) {
        if (name.endsWith('.keya')) files.push(name);
      }

      if (files.length > 0) {
        const fileHandle = await dirHandle.getFileHandle(files[0]);
        existingFile = await fileHandle.getFile();
      }
    } catch {
      // No .keya file found — that's fine, will create one
    }

    // Save workspace reference
    await saveWorkspace({
      id: 'main',
      directoryHandle: dirHandle,
      fileName: existingFile?.name ?? 'my-keys.keya',
    });

    return { directoryHandle: dirHandle, existingFile };
  }

  /**
   * Subsequent opens: try to auto-find the .keya file.
   * Returns null if workspace not set up, or the file if found.
   */
  static async autoOpen(): Promise<{
    directoryHandle: FileSystemDirectoryHandle;
    file: File;
    fileName: string;
  } | null> {
    const ws = await getWorkspace();
    if (!ws) return null;

    // Verify permission still valid
    const perm = await ws.directoryHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const req = await ws.directoryHandle.requestPermission({ mode: 'readwrite' });
      if (req !== 'granted') return null;
    }

    // Try to read the file
    try {
      const fileHandle = await ws.directoryHandle.getFileHandle(ws.fileName);
      const file = await fileHandle.getFile();
      return { directoryHandle: ws.directoryHandle, file, fileName: ws.fileName };
    } catch {
      // File not found — try to find any .keya file in the folder
      for await (const [name] of (ws.directoryHandle as any).entries()) {
        if (name.endsWith('.keya')) {
          const fileHandle = await ws.directoryHandle.getFileHandle(name);
          const file = await fileHandle.getFile();
          // Update stored filename
          ws.fileName = name;
          await saveWorkspace(ws);
          return { directoryHandle: ws.directoryHandle, file, fileName: name };
        }
      }
    }

    return null;
  }

  /**
   * Load and decrypt a .keya file.
   */
  static async load(file: File, password: string): Promise<KeyaDatabase> {
    const buffer = await file.arrayBuffer();
    return deserializeFromFile(new Uint8Array(buffer), password);
  }

  /**
   * Encrypt and save back to the same file in the workspace folder.
   */
  static async save(db: KeyaDatabase, password: string): Promise<void> {
    const ws = await getWorkspace();
    if (!ws) throw new Error('No workspace configured');

    const perm = await ws.directoryHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') {
      await ws.directoryHandle.requestPermission({ mode: 'readwrite' });
    }

    const bytes = await serializeToFile(db, password);
    const fileHandle = await ws.directoryHandle.getFileHandle(ws.fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
  }

  /**
   * Clear workspace reference (e.g., for switching folders).
   */
  static async clearWorkspace(): Promise<void> {
    const db = await openMetaDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('main');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Check if workspace is configured.
   */
  static async hasWorkspace(): Promise<boolean> {
    const ws = await getWorkspace();
    return ws !== null;
  }

  /**
   * Lock: clear workspace reference.
   */
  static async lock(): Promise<void> {
    await FileStorage.clearWorkspace();
  }

  /**
   * Legacy save via download (for browsers without File System Access API).
   */
  static async saveViaDownload(db: KeyaDatabase, password: string, fileName = "my-keys.keya"): Promise<void> {
    const bytes = await serializeToFile(db, password);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
