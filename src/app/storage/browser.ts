/**
 * Browser adapters for the ports the runtime depends on.
 *
 * Kept deliberately thin: everything that decides behaviour lives in the port
 * consumers, so these files translate to platform APIs and nothing else.
 */

import type { FilePort, LockPort } from '../vault/ports';

/**
 * A `.keya` file behind the File System Access API.
 *
 * `createWritable() → write() → close()` is the only commit point; a failure
 * between write and close aborts the writable so no partial file is left in
 * place. There is no fsync, so this does not promise crash safety — only that a
 * failed write does not silently look like a success.
 */
export class FileHandlePort implements FilePort {
  private readonly handle: FileSystemFileHandle;

  constructor(handle: FileSystemFileHandle) {
    this.handle = handle;
  }

  async read(): Promise<Uint8Array | null> {
    try {
      const file = await this.handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }
      throw error;
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    const writable = await this.handle.createWritable();
    try {
      await writable.write(bytes as unknown as BufferSource);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => undefined);
      throw error;
    }
  }
}

/** Web Locks: exclusive, cross-tab, no timeout (the caller owns bounding). */
export const webLocks: LockPort = {
  run: (name, task) =>
    navigator.locks.request(name, { mode: 'exclusive' }, task),
};

export function hasWebLocks(): boolean {
  return typeof navigator !== 'undefined' && 'locks' in navigator;
}
