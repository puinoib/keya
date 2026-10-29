/**
 * Device-local state (§11).
 *
 * Nothing here is encrypted and nothing here is part of the file: containers,
 * observations and preferences describe *this device*.
 * Losing them costs a re-check and a few preferences, which is why they are
 * allowed to live in plain browser storage.
 *
 * The storage itself is behind a tiny key/value port so the logic is testable
 * without IndexedDB; the browser adapter is a thin translation layer.
 */

import type { Observation } from '../../../core/runtime/observations';
import { compareObservationsNewestFirst } from '../../../core/runtime/observations';
import { importDeviceKey } from '../../../core/fingerprint';

export interface KeyValuePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  /**
   * Every value whose key starts with `prefix`, in one read.
   *
   * A prefix scan followed by one `get` per key is one storage round trip per
   * record; this is one round trip for the whole range.
   */
  values<T>(prefix: string): Promise<T[]>;
}

export interface ContainerRecord {
  /** `container_fingerprint` of the file. */
  fingerprint: string;
  file_name: string;
  /** Known only after a successful unlock. */
  vault_id: string | null;
  name: string;
  icon: string;
  key_count: number;
  content_updated_at: string;
  last_opened_at: string;
}

export interface Preferences {
  auto_lock_minutes: number;
  /** Seconds before a copied credential is cleared; 0 leaves it alone. */
  clipboard_clear_seconds: number;
  hidden_presets: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  auto_lock_minutes: 5,
  clipboard_clear_seconds: 15,
  hidden_presets: [],
};

export interface LocalStateOptions {
  /** Observations kept per key (§11: the most recent ten). */
  observationRetention?: number;
  /** Injected for tests; defaults to `crypto.randomUUID`. */
  newId?: () => string;
  /** Injected for tests so `last_opened_at` is deterministic. */
  now?: () => string;
}

const CONTAINER = 'containers';
const OBSERVATION = 'observations';
const PREFERENCE = 'prefs';
const DEVICE_KEY = 'device/hmacKey';

const keyOf = (...parts: (string | number)[]) => parts.join('/');

export class LocalState {
  private readonly kv: KeyValuePort;
  private readonly retention: number;
  private readonly newId: () => string;
  private readonly now: () => string;
  /** Shared in-flight creation of the device HMAC key. */
  private deviceKeyPromise: Promise<CryptoKey> | null = null;

  constructor(kv: KeyValuePort, options: LocalStateOptions = {}) {
    this.kv = kv;
    this.retention = options.observationRetention ?? 10;
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
  }

  // ── containers (pre-unlock display) ──

  async getContainer(
    fingerprint: string
  ): Promise<ContainerRecord | undefined> {
    return this.kv.get<ContainerRecord>(keyOf(CONTAINER, fingerprint));
  }

  async listContainers(): Promise<ContainerRecord[]> {
    return this.kv.values<ContainerRecord>(`${CONTAINER}/`);
  }

  async putContainer(record: ContainerRecord): Promise<void> {
    await this.kv.set(keyOf(CONTAINER, record.fingerprint), record);
  }

  async deleteContainer(fingerprint: string): Promise<void> {
    await this.kv.delete(keyOf(CONTAINER, fingerprint));
  }

  /**
   * Password change: write the new row first, then drop the old one. Any
   * failure leaves at worst an orphan row, which is harmless; the next unlock
   * re-registers the file.
   */
  async moveContainer(
    record: ContainerRecord,
    previousFingerprint: string | null
  ): Promise<void> {
    await this.putContainer(record);
    if (previousFingerprint && previousFingerprint !== record.fingerprint) {
      await this.deleteContainer(previousFingerprint);
    }
  }

  // ── observations ──

  /**
   * One write chain per key. Assigning `seq` is a read-modify-write, so two
   * results that land at the same moment would otherwise compute the same
   * next number and their order would fall back to the wall clock.
   */
  private readonly writes = new Map<string, Promise<void>>();

  async recordObservation(observation: Observation): Promise<void> {
    const base = keyOf(OBSERVATION, observation.vault_id, observation.key_id);
    const previous = this.writes.get(base) ?? Promise.resolve();
    const run = previous.then(
      () => this.writeObservation(observation, base),
      () => this.writeObservation(observation, base)
    );
    // Keep the chain alive after a failed write so the next result records.
    this.writes.set(
      base,
      run.then(
        () => undefined,
        () => undefined
      )
    );
    return run;
  }

  private async writeObservation(
    observation: Observation,
    base: string
  ): Promise<void> {
    const existing = await this.listObservations(
      observation.vault_id,
      observation.key_id
    );

    // Assign the device-monotonic order here, not in the probe: the sequence is
    // storage bookkeeping, and it is what makes "the latest result" survive a
    // system-clock change (a wall clock is not an ordering key).
    const seq =
      existing.reduce((max, entry) => Math.max(max, entry.seq ?? 0), 0) + 1;
    const record: Observation = { ...observation, seq };
    await this.kv.set(keyOf(base, observation.observation_id), record);

    // Newest first by `seq`, so the tail is what retention drops.
    const ordered = [record, ...existing].sort(compareObservationsNewestFirst);
    for (const stale of ordered.slice(this.retention)) {
      await this.kv.delete(keyOf(base, stale.observation_id));
    }
  }

  async listObservations(
    vaultId: string,
    keyId: string
  ): Promise<Observation[]> {
    // The trailing separator matters: the scan is a raw prefix match, so
    // `observations/v/k` would also match `observations/v/k2/...`.
    const records = await this.kv.values<Observation>(
      `${keyOf(OBSERVATION, vaultId, keyId)}/`
    );
    return records.sort(compareObservationsNewestFirst);
  }

  /**
   * Every observation of one vault, grouped by key, from one read.
   *
   * The view needs the newest record per key on every refresh; reading one
   * prefix per key turned a 1000-key vault into a storage round trip per
   * record on every edit.
   */
  async observationsByKey(
    vaultId: string
  ): Promise<Map<string, Observation[]>> {
    const records = await this.kv.values<Observation>(
      `${keyOf(OBSERVATION, vaultId)}/`
    );

    const grouped = new Map<string, Observation[]>();
    for (const record of records) {
      const list = grouped.get(record.key_id);
      if (list) list.push(record);
      else grouped.set(record.key_id, [record]);
    }
    for (const list of grouped.values())
      list.sort(compareObservationsNewestFirst);
    return grouped;
  }

  // ── preferences ──

  async getPreferences(): Promise<Preferences> {
    return {
      ...DEFAULT_PREFERENCES,
      ...(await this.kv.get<Partial<Preferences>>(PREFERENCE)),
    };
  }

  async setPreferences(patch: Partial<Preferences>): Promise<void> {
    const current = await this.getPreferences();
    await this.kv.set(PREFERENCE, { ...current, ...patch });
  }

  // ── device key ──

  /**
   * The HMAC key behind `observation_binding`. Non-extractable, so a copy of
   * local storage cannot be used to verify guessed secrets offline. Losing it
   * invalidates every stored binding, which is the fail-closed outcome.
   *
   * Concurrent callers share one creation: two unlocks racing would otherwise
   * each generate a key and the loser's bindings would stop verifying.
   */
  async ensureDeviceKey(): Promise<CryptoKey> {
    this.deviceKeyPromise ??= this.loadOrCreateDeviceKey().catch(
      (error: unknown) => {
        // A failed read or write must not poison every later attempt.
        this.deviceKeyPromise = null;
        throw error;
      }
    );
    return this.deviceKeyPromise;
  }

  private async loadOrCreateDeviceKey(): Promise<CryptoKey> {
    const existing = await this.kv.get<CryptoKey>(DEVICE_KEY);
    if (existing) return existing;

    // A second tab can create the key between the read and the write, so the
    // creation runs under a cross-tab lock where one exists.
    const locks = (
      globalThis as unknown as {
        navigator?: { locks?: Pick<LockManager, 'request'> };
      }
    ).navigator?.locks;

    const create = async (): Promise<CryptoKey> => {
      const raced = await this.kv.get<CryptoKey>(DEVICE_KEY);
      if (raced) return raced;
      const raw = new Uint8Array(32);
      crypto.getRandomValues(raw);
      const key = await importDeviceKey(raw);
      await this.kv.set(DEVICE_KEY, key);
      return key;
    };

    return locks
      ? (((await locks.request(DEVICE_KEY, { mode: 'exclusive' }, create)) as
          | CryptoKey
          | undefined) ?? create())
      : create();
  }

  async hasDeviceKey(): Promise<boolean> {
    return Boolean(await this.kv.get<CryptoKey>(DEVICE_KEY));
  }

  // ── key removal ──

  /** Deleting a key removes this device's observations of it. */
  async forgetKey(vaultId: string, keyId: string): Promise<void> {
    const observations = await this.listObservations(vaultId, keyId);
    for (const observation of observations) {
      await this.kv.delete(
        keyOf(OBSERVATION, vaultId, keyId, observation.observation_id)
      );
    }
  }

  /** Forget this device's knowledge of one vault: every observation of it. */
  async forgetVault(vaultId: string): Promise<void> {
    const observations = await this.kv.keys(`${keyOf(OBSERVATION, vaultId)}/`);
    for (const key of observations) {
      await this.kv.delete(key);
    }
  }

  newObservationId(): string {
    return this.newId();
  }

  timestamp(): string {
    return this.now();
  }
}
