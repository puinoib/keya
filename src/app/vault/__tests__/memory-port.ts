/**
 * In-memory ports for vault tests: a fake file, a fixed clock and immediate
 * locks. Keeps the runtime tests free of browser APIs.
 */

import type { ClockPort, FilePort, LockPort, VaultPorts } from '../ports';

export class MemoryFile implements FilePort {
  bytes: Uint8Array | null;
  writes = 0;
  failNextWrite = false;
  /** Simulate another writer replacing the file behind our back. */
  externallyReplace(bytes: Uint8Array): void {
    this.bytes = bytes;
  }

  constructor(bytes: Uint8Array | null = null) {
    this.bytes = bytes;
  }

  async read(): Promise<Uint8Array | null> {
    return this.bytes ? this.bytes.slice() : null;
  }

  async write(next: Uint8Array): Promise<void> {
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error('disk full');
    }
    this.writes += 1;
    this.bytes = next.slice();
  }
}

export function fixedClock(start = '2026-06-01T00:00:00.000Z'): ClockPort & {
  advance(ms: number): void;
  set(iso: string): void;
} {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advance(ms) {
      current = new Date(current.getTime() + ms);
    },
    set(iso) {
      current = new Date(iso);
    },
  };
}

export const immediateLocks: LockPort = {
  run: (_name, task) => task(),
};

export function memoryPorts(file: MemoryFile, clock: ClockPort): VaultPorts {
  return { file, clock, locks: immediateLocks };
}
