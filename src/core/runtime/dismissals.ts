/**
 * Dismissals (§10.3.1).
 *
 * Both kinds live on the device. A dismissal is a *decision bound to a fact*:
 * the stored `condition` (or `binding`) is compared with the current one, and a
 * mismatch deletes the record. That comparison is the only invalidation
 * mechanism — the edit transaction never touches dismissals.
 */

export type BusinessRule =
  | 'expiry_upcoming'
  | 'expiry_expired'
  | 'insecure_endpoint';

export type ObservationRule = 'never_probed' | 'probe_failed' | 'probe_stale';

export interface BusinessDismissal {
  vault_id: string;
  key_id: string;
  rule: BusinessRule;
  /** The fact that was true when the user dismissed, e.g. `date:2026-03-01`. */
  condition: string;
  dismissed_at: string;
}

export interface ObservationDismissal {
  vault_id: string;
  key_id: string;
  rule: ObservationRule;
  /** `observation_binding` at the time of the decision. */
  binding: string;
  dismissed_at: string;
}

export interface BusinessFact {
  vault_id: string;
  key_id: string;
  rule: BusinessRule;
  condition: string;
}

export interface ObservationFact {
  vault_id: string;
  key_id: string;
  rule: ObservationRule;
  binding: string;
}

const keyOf = (vaultId: string, keyId: string, rule: string) =>
  `${vaultId}|${keyId}|${rule}`;

/**
 * Which stored dismissals still describe the current facts. Everything not
 * returned here should be deleted from the local store.
 */
export function effectiveBusinessDismissals(
  dismissals: readonly BusinessDismissal[],
  facts: readonly BusinessFact[]
): BusinessDismissal[] {
  const current = new Map(
    facts.map((fact) => [
      keyOf(fact.vault_id, fact.key_id, fact.rule),
      fact.condition,
    ])
  );

  return dismissals.filter(
    (dismissal) =>
      current.get(
        keyOf(dismissal.vault_id, dismissal.key_id, dismissal.rule)
      ) === dismissal.condition
  );
}

export function effectiveObservationDismissals(
  dismissals: readonly ObservationDismissal[],
  facts: readonly ObservationFact[]
): ObservationDismissal[] {
  const current = new Map(
    facts.map((fact) => [
      keyOf(fact.vault_id, fact.key_id, fact.rule),
      fact.binding,
    ])
  );

  return dismissals.filter(
    (dismissal) =>
      current.get(
        keyOf(dismissal.vault_id, dismissal.key_id, dismissal.rule)
      ) === dismissal.binding
  );
}

/** True when the given fact is currently silenced by a matching record. */
export function isDismissed(
  dismissals: readonly BusinessDismissal[],
  fact: BusinessFact
): boolean {
  return dismissals.some(
    (dismissal) =>
      dismissal.vault_id === fact.vault_id &&
      dismissal.key_id === fact.key_id &&
      dismissal.rule === fact.rule &&
      dismissal.condition === fact.condition
  );
}

/** Replacing a record is how "dismiss again" works: one row per (key, rule). */
export function dismissBusinessFact(
  dismissals: readonly BusinessDismissal[],
  fact: BusinessFact,
  now: string
): BusinessDismissal[] {
  const rest = dismissals.filter(
    (dismissal) =>
      !(
        dismissal.vault_id === fact.vault_id &&
        dismissal.key_id === fact.key_id &&
        dismissal.rule === fact.rule
      )
  );
  return [
    ...rest,
    {
      vault_id: fact.vault_id,
      key_id: fact.key_id,
      rule: fact.rule,
      condition: fact.condition,
      dismissed_at: now,
    },
  ];
}

/** Undo: the record is simply removed, so the reminder returns. */
export function restoreBusinessFact(
  dismissals: readonly BusinessDismissal[],
  fact: Pick<BusinessFact, 'vault_id' | 'key_id' | 'rule'>
): BusinessDismissal[] {
  return dismissals.filter(
    (dismissal) =>
      !(
        dismissal.vault_id === fact.vault_id &&
        dismissal.key_id === fact.key_id &&
        dismissal.rule === fact.rule
      )
  );
}

/**
 * A successful check clears the "probe failed" dismissal, so a failure that
 * happens again after a success is reported again.
 */
export function clearFailureDismissal(
  dismissals: readonly ObservationDismissal[],
  vaultId: string,
  keyId: string
): ObservationDismissal[] {
  return dismissals.filter(
    (dismissal) =>
      !(
        dismissal.vault_id === vaultId &&
        dismissal.key_id === keyId &&
        dismissal.rule === 'probe_failed'
      )
  );
}
