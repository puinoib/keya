/**
 * Network grants (§10.2).
 *
 * Two kinds of approval, deliberately not sharing a word:
 *
 * - a **grant** is persisted and lets automatic probing run;
 * - an **approval** is an in-memory token, consumed by one fetch, never stored.
 *
 * Matching is by fingerprint only. `origin`, `path` and `vault_id` are audit
 * fields: keeping grants out of a per-vault namespace is what lets a clone
 * inherit them.
 */

export interface Grant {
  /** `send_fingerprint` of the request this grant approves. */
  fingerprint: string;
  /** Audit only; never matched. */
  vault_id: string;
  /** Display only, so the user can see what they approved. */
  origin: string;
  path: string;
  approved_at: string;
}

export function hasGrant(
  grants: readonly Grant[],
  fingerprint: string
): boolean {
  return grants.some((grant) => grant.fingerprint === fingerprint);
}

export function addGrant(grants: readonly Grant[], grant: Grant): Grant[] {
  if (hasGrant(grants, grant.fingerprint)) return [...grants];
  return [...grants, grant];
}

export function removeGrant(
  grants: readonly Grant[],
  fingerprint: string
): Grant[] {
  return grants.filter((grant) => grant.fingerprint !== fingerprint);
}

/**
 * A one-shot approval. Created by a user gesture and consumed by the request
 * that follows; retrying needs a new gesture.
 */
export interface Approval {
  fingerprint: string;
  keyId: string;
  sessionId: string;
}

export interface ApprovalRequest {
  fingerprint: string;
  keyId: string;
  sessionId: string;
}

/**
 * Consume an approval if it matches the request exactly. Returns the remaining
 * approvals, so a second attempt with the same token cannot succeed.
 */
export function consumeApproval(
  approvals: readonly Approval[],
  request: ApprovalRequest
): { ok: true; remaining: Approval[] } | { ok: false; remaining: Approval[] } {
  const index = approvals.findIndex(
    (approval) =>
      approval.fingerprint === request.fingerprint &&
      approval.keyId === request.keyId &&
      approval.sessionId === request.sessionId
  );

  if (index === -1) return { ok: false, remaining: [...approvals] };
  return {
    ok: true,
    remaining: approvals.filter((_, position) => position !== index),
  };
}

/**
 * Plaintext targets never keep a persistent grant: each execution needs a fresh
 * approval, and the UI must say so.
 */
export function allowsPersistentGrant(isPlaintext: boolean): boolean {
  return !isPlaintext;
}
