/**
 * One unlocked vault, as the UI sees it.
 *
 * Owns the pieces that must agree with each other: the payload, the device
 * facts, the probes and the reminder decisions. Everything here returns data
 * ready to render — no component computes a fingerprint or decides whether a
 * grant exists.
 */

import type { CheckOutcome, CheckMode } from '../probe/check';
import { runCheck, type AuthorizationPort } from '../probe/check';
import type { ProbeFetch } from '../probe/execute';
import type { LocalState } from '../storage/local/state';
import type { Vault } from '../vault/vault';
import {
  businessAlerts,
  observationAlerts,
  visibleReminders,
  type Reminder,
} from '../../core/reminders';
import { currentBindings, type KeyBinding } from './binding';
import type { Approval } from '../../core/runtime/grants';
import { consumeApproval } from '../../core/runtime/grants';
import type {
  BusinessDismissal,
  ObservationDismissal,
} from '../../core/runtime/dismissals';
import type { Grant } from '../../core/runtime/grants';

export interface SessionOptions {
  vault: Vault;
  local: LocalState;
  deviceKey: CryptoKey;
  fetch: ProbeFetch;
  clock: () => Date;
  timeZone: string;
}

export interface ReminderView {
  reminder: Reminder;
  keyId: string;
  /** Human-readable condition summary, e.g. `2026-03-01`. */
  fact: string;
}

export class VaultSession {
  private readonly vault: Vault;
  private readonly local: LocalState;
  private readonly deviceKey: CryptoKey;
  private readonly fetch: ProbeFetch;
  private readonly clock: () => Date;
  private readonly timeZone: string;

  /** One-shot approvals for this unlock only; never persisted. */
  private approvals: Approval[] = [];
  private requestSeq = 0;

  constructor(options: SessionOptions) {
    this.vault = options.vault;
    this.local = options.local;
    this.deviceKey = options.deviceKey;
    this.fetch = options.fetch;
    this.clock = options.clock;
    this.timeZone = options.timeZone;
  }

  get payload() {
    return this.vault.getPayload();
  }

  get sessionId(): string {
    return this.vault.sessionId;
  }

  bindings(): Promise<Map<string, KeyBinding>> {
    return currentBindings(this.payload, this.deviceKey);
  }

  /**
   * Everything the user should see right now: computed facts, minus what they
   * dismissed. Reading also prunes dismissals whose fact changed, which is the
   * only invalidation mechanism.
   */
  async reminders(): Promise<ReminderView[]> {
    const payload = this.payload;
    const bindings = await this.bindings();
    const context = { now: this.clock(), timeZone: this.timeZone };

    const business = businessAlerts(payload, context);
    const observation = observationAlerts(
      payload,
      (key) => bindings.get(key.id)?.binding ?? null,
      await this.allObservations(),
      context
    );

    const pruned = await this.local.pruneDismissals(
      payload.vault.id,
      business,
      observation
    );

    const visible = visibleReminders(
      [...business, ...observation],
      pruned.business,
      pruned.observation
    );

    return visible.map((reminder) => ({
      reminder,
      keyId: reminder.key_id,
      fact:
        reminder.kind === 'business'
          ? reminder.condition
          : reminder.binding.slice(0, 8),
    }));
  }

  /** Summaries of what is currently silenced, so dismissals stay inspectable. */
  async dismissed(): Promise<{
    business: BusinessDismissal[];
    observation: ObservationDismissal[];
  }> {
    const vaultId = this.payload.vault.id;
    const business = businessAlerts(this.payload, {
      now: this.clock(),
      timeZone: this.timeZone,
    });
    const bindings = await this.bindings();
    const observation = observationAlerts(
      this.payload,
      (key) => bindings.get(key.id)?.binding ?? null,
      await this.allObservations(),
      { now: this.clock(), timeZone: this.timeZone }
    );

    return this.local.pruneDismissals(vaultId, business, observation);
  }

  async dismiss(reminder: Reminder): Promise<void> {
    const now = this.clock().toISOString();
    if (reminder.kind === 'business') {
      await this.local.putBusinessDismissal({
        vault_id: reminder.vault_id,
        key_id: reminder.key_id,
        rule: reminder.rule,
        condition: reminder.condition,
        dismissed_at: now,
      });
      return;
    }

    await this.local.putObservationDismissal({
      vault_id: reminder.vault_id,
      key_id: reminder.key_id,
      rule: reminder.rule,
      binding: reminder.binding,
      dismissed_at: now,
    });
  }

  /** Undo a dismissal; the reminder returns immediately. */
  async restore(reminder: Reminder): Promise<void> {
    if (reminder.kind === 'business') {
      await this.local.removeBusinessDismissal(
        reminder.vault_id,
        reminder.key_id,
        reminder.rule
      );
      return;
    }
    await this.local.removeObservationDismissal(
      reminder.vault_id,
      reminder.key_id,
      reminder.rule
    );
  }

  /**
   * Persistent consent for one request shape. Called only after the user has
   * seen the real recipient; the fingerprint is recomputed here so the grant
   * cannot be written for a stale configuration.
   */
  async grant(keyId: string): Promise<Grant | null> {
    const binding = (await this.bindings()).get(keyId);
    if (!binding) return null;

    const grant: Grant = {
      fingerprint: binding.send,
      vault_id: this.payload.vault.id,
      origin: safeOrigin(binding.plan.resolvedHref),
      path: safePath(binding.plan.resolvedHref),
      approved_at: this.clock().toISOString(),
    };

    await this.local.putGrant(grant);
    return grant;
  }

  /** Whether this key's exact request already holds a persistent grant. */
  async hasGrant(keyId: string): Promise<boolean> {
    const binding = (await this.bindings()).get(keyId);
    if (!binding) return false;
    return this.hasGrantFor(binding.send);
  }

  /** One-shot consent from a user gesture; consumed by the next probe. */
  async approveOnce(keyId: string): Promise<string | null> {
    const binding = (await this.bindings()).get(keyId);
    if (!binding) return null;

    this.approvals = [
      ...this.approvals,
      { fingerprint: binding.send, keyId, sessionId: this.sessionId },
    ];
    return binding.send;
  }

  async probe(keyId: string, mode: CheckMode): Promise<CheckOutcome> {
    const authorization: AuthorizationPort = {
      hasGrant: (fingerprint) => this.hasGrantFor(fingerprint),
      consumeApproval: (fingerprint, id) => {
        const outcome = consumeApproval(this.approvals, {
          fingerprint,
          keyId: id,
          sessionId: this.sessionId,
        });
        this.approvals = outcome.remaining;
        return outcome.ok;
      },
    };

    return runCheck(
      {
        payload: () => this.payload,
        local: this.local,
        deviceKey: this.deviceKey,
        fetch: this.fetch,
        authorization,
        nextRequestSeq: () => {
          this.requestSeq += 1;
          return this.requestSeq;
        },
        sessionId: this.sessionId,
      },
      { keyId, mode }
    );
  }

  /** Lock out: approvals die with the session (I8). */
  lock(): void {
    this.approvals = [];
  }

  private async hasGrantFor(fingerprint: string): Promise<boolean> {
    return this.local.hasGrant(fingerprint);
  }

  private async allObservations() {
    const vaultId = this.payload.vault.id;
    const all = [];
    for (const key of this.payload.keys) {
      all.push(...(await this.local.listObservations(vaultId, key.id)));
    }
    return all;
  }
}

function safeOrigin(href: string): string {
  try {
    return new URL(href).origin;
  } catch {
    return '';
  }
}

function safePath(href: string): string {
  try {
    return new URL(href).pathname;
  } catch {
    return '';
  }
}
