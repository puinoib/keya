/**
 * One-shot network approval (§10.2).
 *
 * Every request that leaves the browser needs a gesture from the same
 * interaction. An approval is that gesture, in memory: it names one exact
 * request shape, one key and one session, and the request that follows consumes
 * it. Nothing is persisted, so a reload or a lock ends every approval.
 *
 * There is no standing permission. A stored grant used to let automatic checks
 * run unattended; that feature is gone, so consent never outlives the tab.
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
