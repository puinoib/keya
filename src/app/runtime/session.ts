/**
 * One unlocked vault, as the UI sees it.
 *
 * Owns the pieces that must agree with each other: the payload, the device
 * facts and the probes. Everything here returns data ready to render — no
 * component computes a fingerprint or decides whether a grant exists.
 */

import type { CheckOutcome, CheckMode } from '../probe/check';
import { runCheck, type AuthorizationPort } from '../probe/check';
import type { ProbeFetch } from '../probe/execute';
import type { LocalState } from '../storage/local/state';
import type { Vault } from '../vault/vault';
import { currentBindings, type KeyBinding } from './binding';
import type { Approval } from '../../core/runtime/grants';
import {
  allowsPersistentGrant,
  consumeApproval,
} from '../../core/runtime/grants';
import { isPlaintextRequest } from '../../core/payload/url';
import { sendFingerprint } from '../../core/fingerprint';
import type { Grant } from '../../core/runtime/grants';

export interface SessionOptions {
  vault: Vault;
  local: LocalState;
  deviceKey: CryptoKey;
  fetch: ProbeFetch;
  clock: () => Date;
}

export class VaultSession {
  private readonly vault: Vault;
  private readonly local: LocalState;
  private readonly deviceKey: CryptoKey;
  private readonly fetch: ProbeFetch;
  private readonly clock: () => Date;

  /** One-shot approvals for this unlock only; never persisted. */
  private approvals: Approval[] = [];
  private requestSeq = 0;
  /** Highest adopted `request_seq` per key, so an older result cannot win. */
  private readonly adoptedSeq = new Map<string, number>();
  /** Aborted when the session ends, so no request outlives the unlock. */
  private readonly controller = new AbortController();

  constructor(options: SessionOptions) {
    this.vault = options.vault;
    this.local = options.local;
    this.deviceKey = options.deviceKey;
    this.fetch = options.fetch;
    this.clock = options.clock;
  }

  /** Pass to every request this session starts. */
  get signal(): AbortSignal {
    return this.controller.signal;
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
   * Persistent consent for one request shape. Called only after the user has
   * seen the real recipient; the fingerprint is recomputed here so the grant
   * cannot be written for a stale configuration. A plaintext target can never
   * hold one (I7).
   */
  async grant(keyId: string): Promise<Grant | null> {
    const binding = (await this.bindings()).get(keyId);
    if (!binding) return null;
    if (!this.mayPersistGrant(binding.plan.resolvedHref)) return null;

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
    if (!this.mayPersistGrant(binding.plan.resolvedHref)) return false;
    return this.hasGrantFor(binding.send);
  }

  /** `http:` never keeps consent, so a stored grant for it must not count. */
  private mayPersistGrant(resolvedHref: string): boolean {
    try {
      return allowsPersistentGrant(isPlaintextRequest(new URL(resolvedHref)));
    } catch {
      return false;
    }
  }

  /**
   * Usage queries are not probes, but they still send the credential somewhere.
   * They get the same one-shot consent: a click approves this URL once, and a
   * standing grant for the same shape keeps working without another click.
   */
  async approveUsageOnce(keyId: string, url: string): Promise<string | null> {
    const fingerprint = await this.usageFingerprint(keyId, url);
    if (!fingerprint) return null;

    this.approvals = [
      ...this.approvals,
      { fingerprint, keyId, sessionId: this.sessionId },
    ];
    return fingerprint;
  }

  /** Consume the approval created for exactly this usage request. */
  async authorizeUsage(keyId: string, url: string): Promise<boolean> {
    const fingerprint = await this.usageFingerprint(keyId, url);
    if (!fingerprint) return false;
    if (await this.hasGrantFor(fingerprint)) return true;

    const outcome = consumeApproval(this.approvals, {
      fingerprint,
      keyId,
      sessionId: this.sessionId,
    });
    this.approvals = outcome.remaining;
    return outcome.ok;
  }

  private async usageFingerprint(
    keyId: string,
    url: string
  ): Promise<string | null> {
    if (!this.payload.keys.some((key) => key.id === keyId)) return null;
    return sendFingerprint({
      keyId,
      resolvedHref: url,
      auth: { mode: 'bearer' },
      headers: [],
    });
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
        signal: this.signal,
        isActive: () => !this.signal.aborted,
        lastAdoptedSeq: (id) => this.adoptedSeq.get(id) ?? -1,
        adoptSeq: (id, seq) => {
          this.adoptedSeq.set(id, seq);
        },
      },
      { keyId, mode }
    );
  }

  /**
   * Lock out: approvals die with the session (I8), and every request it started
   * is aborted so a credential cannot leave after the user asked to stop.
   */
  lock(): void {
    this.controller.abort();
    this.approvals = [];
    this.adoptedSeq.clear();
  }

  private async hasGrantFor(fingerprint: string): Promise<boolean> {
    return this.local.hasGrant(fingerprint);
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
