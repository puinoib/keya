/**
 * One unlocked vault, as the UI sees it.
 *
 * Owns the pieces that must agree with each other: the payload, the device
 * facts and the probes. Everything here returns data ready to render — no
 * component computes a fingerprint or decides whether a request is approved.
 */

import type { CheckOutcome } from '../probe/check';
import { runCheck, type AuthorizationPort } from '../probe/check';
import type { ProbeFetch } from '../probe/execute';
import type { LocalState } from '../storage/local/state';
import type { Vault } from '../vault/vault';
import { currentBindings, type KeyBinding } from './binding';
import { consumeApproval, type Approval } from '../../core/runtime/approvals';
import { sendFingerprint } from '../../core/fingerprint';

export interface SessionOptions {
  vault: Vault;
  local: LocalState;
  deviceKey: CryptoKey;
  fetch: ProbeFetch;
}

export class VaultSession {
  private readonly vault: Vault;
  private readonly local: LocalState;
  private readonly deviceKey: CryptoKey;
  private readonly fetch: ProbeFetch;

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
   * Usage queries are not probes, but they still send the credential somewhere.
   * They get the same one-shot consent: the click approves this URL once.
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

  async probe(keyId: string): Promise<CheckOutcome> {
    const authorization: AuthorizationPort = {
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
      { keyId }
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
}
