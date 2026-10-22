/**
 * Device-local state (§11).
 *
 * Nothing here is encrypted and nothing here is part of the file: containers,
 * observations, dismissals, grants and preferences describe *this device*.
 * Losing them costs a re-check and a few preferences, which is why they are
 * allowed to live in plain browser storage.
 *
 * The storage itself is behind a tiny key/value port so the logic is testable
 * without IndexedDB; the browser adapter is a thin translation layer.
 */

import type {
  BusinessDismissal,
  ObservationDismissal,
} from '../../../core/runtime/dismissals';
import {
  effectiveBusinessDismissals,
  effectiveObservationDismissals,
  type BusinessFact,
  type ObservationFact,
} from '../../../core/runtime/dismissals';
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
const BUSINESS_DISMISSAL = 'dismissals/business';
const OBSERVATION_DISMISSAL = 'dismissals/observation';
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

  // ── dismissals ──

  async listBusinessDismissals(vaultId: string): Promise<BusinessDismissal[]> {
    return this.collect<BusinessDismissal>(keyOf(BUSINESS_DISMISSAL, vaultId));
  }

  async putBusinessDismissal(dismissal: BusinessDismissal): Promise<void> {
    await this.kv.set(
      keyOf(
        BUSINESS_DISMISSAL,
        dismissal.vault_id,
        dismissal.key_id,
        dismissal.rule
      ),
      dismissal
    );
  }

  async removeBusinessDismissal(
    vaultId: string,
    keyId: string,
    rule: string
  ): Promise<void> {
    await this.kv.delete(keyOf(BUSINESS_DISMISSAL, vaultId, keyId, rule));
  }

  async listObservationDismissals(
    vaultId: string
  ): Promise<ObservationDismissal[]> {
    return this.collect<ObservationDismissal>(
      keyOf(OBSERVATION_DISMISSAL, vaultId)
    );
  }

  async putObservationDismissal(
    dismissal: ObservationDismissal
  ): Promise<void> {
    await this.kv.set(
      keyOf(
        OBSERVATION_DISMISSAL,
        dismissal.vault_id,
        dismissal.key_id,
        dismissal.rule
      ),
      dismissal
    );
  }

  async removeObservationDismissal(
    vaultId: string,
    keyId: string,
    rule: string
  ): Promise<void> {
    await this.kv.delete(keyOf(OBSERVATION_DISMISSAL, vaultId, keyId, rule));
  }

  /**
   * Drop the dismissals whose fact no longer matches. Called when reminders are
   * read: this is the only invalidation mechanism, so it must actually run.
   */
  async pruneDismissals(
    vaultId: string,
    businessFacts: readonly BusinessFact[],
    observationFacts: readonly ObservationFact[]
  ): Promise<{
    business: BusinessDismissal[];
    observation: ObservationDismissal[];
  }> {
    const business = await this.listBusinessDismissals(vaultId);
    const observation = await this.listObservationDismissals(vaultId);

    const keptBusiness = effectiveBusinessDismissals(business, businessFacts);
    const keptObservation = effectiveObservationDismissals(
      observation,
      observationFacts
    );

    for (const stale of business) {
      if (!keptBusiness.includes(stale)) {
        await this.removeBusinessDismissal(
          stale.vault_id,
          stale.key_id,
          stale.rule
        );
      }
    }
    for (const stale of observation) {
      if (!keptObservation.includes(stale)) {
        await this.removeObservationDismissal(
          stale.vault_id,
          stale.key_id,
          stale.rule
        );
      }
    }

    return { business: keptBusiness, observation: keptObservation };
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

  /** Deleting a key removes its observations and both dismissal kinds. */
  async forgetKey(vaultId: string, keyId: string): Promise<void> {
    const observations = await this.listObservations(vaultId, keyId);
    for (const observation of observations) {
      await this.kv.delete(
        keyOf(OBSERVATION, vaultId, keyId, observation.observation_id)
      );
    }

    for (const dismissal of await this.listBusinessDismissals(vaultId)) {
      if (dismissal.key_id === keyId) {
        await this.removeBusinessDismissal(vaultId, keyId, dismissal.rule);
      }
    }
    for (const dismissal of await this.listObservationDismissals(vaultId)) {
      if (dismissal.key_id === keyId) {
        await this.removeObservationDismissal(vaultId, keyId, dismissal.rule);
      }
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
