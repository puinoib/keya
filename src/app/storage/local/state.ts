/**
 * Device-local state (§11).
 *
 * Nothing here is encrypted and nothing here is part of the file: containers,
 * observations, grants and preferences describe *this device*.
 * Losing them costs a re-check and a few preferences, which is why they are
 * allowed to live in plain browser storage.
 *
 * The storage itself is behind a tiny key/value port so the logic is testable
 * without IndexedDB; the browser adapter is a thin translation layer.
 */

import type { Grant } from '../../../core/runtime/grants';
import type { Observation } from '../../../core/runtime/observations';
import { importDeviceKey } from '../../../core/fingerprint';

export interface KeyValuePort {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
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
  auto_probe_on_save: boolean;
  auto_probe_daily: boolean;
  /** Local day (`YYYY-MM-DD`) of the last daily check, so it runs once. */
  last_daily_probe_day: string | null;
  clipboard_detection_on_add: boolean;
  hidden_presets: string[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  auto_lock_minutes: 5,
  auto_probe_on_save: false,
  auto_probe_daily: false,
  last_daily_probe_day: null,
  clipboard_detection_on_add: true,
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
const GRANT = 'grants';
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
    const keys = await this.kv.keys(`${CONTAINER}/`);
    const records = await Promise.all(
      keys.map((key) => this.kv.get<ContainerRecord>(key))
    );
    return records.filter((record): record is ContainerRecord =>
      Boolean(record)
    );
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

  async recordObservation(observation: Observation): Promise<void> {
    const base = keyOf(OBSERVATION, observation.vault_id, observation.key_id);
    await this.kv.set(keyOf(base, observation.observation_id), observation);

    const existing = await this.listObservations(
      observation.vault_id,
      observation.key_id
    );
    const excess = existing.slice(this.retention);
    for (const stale of excess) {
      await this.kv.delete(keyOf(base, stale.observation_id));
    }
  }

  async listObservations(
    vaultId: string,
    keyId: string
  ): Promise<Observation[]> {
    const keys = await this.kv.keys(keyOf(OBSERVATION, vaultId, keyId));
    const records = await Promise.all(
      keys.map((key) => this.kv.get<Observation>(key))
    );
    return records
      .filter((record): record is Observation => Boolean(record))
      .sort((left, right) => right.finished_at.localeCompare(left.finished_at));
  }

  // ── grants ──

  async listGrants(): Promise<Grant[]> {
    return this.collect<Grant>(GRANT);
  }

  async putGrant(grant: Grant): Promise<void> {
    await this.kv.set(keyOf(GRANT, grant.fingerprint), grant);
  }

  async hasGrant(fingerprint: string): Promise<boolean> {
    return (await this.kv.get<Grant>(keyOf(GRANT, fingerprint))) !== undefined;
  }

  async removeGrant(fingerprint: string): Promise<void> {
    await this.kv.delete(keyOf(GRANT, fingerprint));
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

  newObservationId(): string {
    return this.newId();
  }

  timestamp(): string {
    return this.now();
  }

  private async collect<T>(prefix: string): Promise<T[]> {
    const keys = await this.kv.keys(prefix);
    const collected: T[] = [];
    for (const key of keys) {
      const value = await this.kv.get<T>(key);
      if (value !== undefined) collected.push(value);
    }
    return collected;
  }
}
