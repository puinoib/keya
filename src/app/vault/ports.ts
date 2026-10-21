/**
 * Ports the vault runtime depends on.
 *
 * Everything the browser provides — file access, cryptographic randomness,
 * locks, the clock — enters through these interfaces, so the runtime itself is
 * testable in plain Node and the browser adapters stay thin.
 */

/** One `.keya` file. `read()` returns null when the file does not exist. */
export interface FilePort {
  read(): Promise<Uint8Array | null>;
  write(bytes: Uint8Array): Promise<void>;
}

export interface ClockPort {
  now(): Date;
}

/** A named exclusive lock, used to serialize writes across tabs. */
export interface LockPort {
  run<T>(name: string, task: () => Promise<T>): Promise<T>;
}

export interface VaultPorts {
  file: FilePort;
  clock: ClockPort;
  locks: LockPort;
}

/** Immediate lock: enough for tests and for single-tab environments. */
export const directLocks: LockPort = {
  run: (_name, task) => task(),
};

export const systemClock: ClockPort = { now: () => new Date() };
