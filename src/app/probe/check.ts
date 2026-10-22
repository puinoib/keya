/**
 * One probe, end to end (§10.1, §10.2).
 *
 * Ties together the pieces that already exist: classify the recipe, derive the
 * two fingerprints, check authorization, run the request, decide whether the
 * result may be adopted, and persist it. This is the only place that decides a
 * check is allowed to leave the browser.
 */

import {
  type RecipePlan,
  type RecipeState,
  classifyRecipe,
} from '../../core/presets/classify';
import { observationBinding, sendFingerprint } from '../../core/fingerprint';
import type { Observation } from '../../core/runtime/observations';
import { shouldAdopt } from '../../core/runtime/observations';
import type { KeyaFile, Key } from '../../core/payload/types';
import type { LocalState } from '../storage/local/state';
import { runProbe, type ProbeFetch } from './execute';

export type CheckMode = 'manual' | 'automatic';

export interface AuthorizationPort {
  /** A persistent grant for this exact request. */
  hasGrant(fingerprint: string): Promise<boolean>;
  /** Consume a one-shot approval created by the user's gesture. */
  consumeApproval(fingerprint: string, keyId: string): boolean;
}

export interface CheckDependencies {
  payload: () => KeyaFile;
  local: LocalState;
  deviceKey: CryptoKey;
  fetch: ProbeFetch;
  authorization: AuthorizationPort;
  /** Allocates the next `request_seq` for this session. */
  nextRequestSeq: () => number;
  sessionId: string;
  /** Aborted when the vault locks or switches. */
  signal?: AbortSignal;
  /** False once the session that started this check has ended. */
  isActive?: () => boolean;
  /** Highest `request_seq` already adopted for a key, or -1. */
  lastAdoptedSeq?: (keyId: string) => number;
  /** Records that a result was adopted, so an older one can be dropped. */
  adoptSeq?: (keyId: string, requestSeq: number) => void;
}

export interface CheckRequest {
  keyId: string;
  mode: CheckMode;
}

export type CheckOutcome =
  | { status: 'no_key' }
  | {
      status: 'not_executable';
      reason: Extract<RecipeState, { kind: 'not_executable' }>['reason'];
      unverifiable?: string;
    }
  | {
      status: 'skipped';
      reason: 'manual_only' | 'automatic_disabled';
    }
  | {
      status: 'needs_authorization';
      fingerprint: string;
      plan: RecipePlan;
    }
  | { status: 'discarded'; observation: Observation }
  | { status: 'observed'; observation: Observation };

export function findKey(payload: KeyaFile, keyId: string): Key | undefined {
  return payload.keys.find((key) => key.id === keyId);
}

/**
 * The two fingerprints of one send. `send` decides whether consent still
 * applies; `binding` decides whether a stored result still describes this
 * configuration.
 */
export async function describeSend(input: {
  artifact: Parameters<typeof sendFingerprint>[0];
  secret: string;
  interpreterId: string;
  deviceKey: CryptoKey;
}): Promise<{ send: string; binding: string }> {
  return {
    send: await sendFingerprint(input.artifact),
    binding: await observationBinding(input.deviceKey, {
      ...input.artifact,
      secret: input.secret,
      interpreterId: input.interpreterId,
    }),
  };
}

export async function runCheck(
  dependencies: CheckDependencies,
  request: CheckRequest
): Promise<CheckOutcome> {
  const payload = dependencies.payload();
  const key = findKey(payload, request.keyId);
  if (!key) return { status: 'no_key' };

  const state = classifyRecipe(
    { provider_id: key.provider_id, endpoint: key.endpoint },
    payload.providers
  );

  if (state.kind === 'not_executable') {
    return {
      status: 'not_executable',
      reason: state.reason,
      unverifiable: state.unverifiable,
    };
  }

  // Manual-only recipes can never hold a persistent grant, so automatic
  // probing skips them instead of asking for an approval nobody can give.
  if (request.mode === 'automatic' && state.kind === 'manual_only') {
    return { status: 'skipped', reason: 'manual_only' };
  }

  const { send, binding } = await describeSend({
    artifact: {
      keyId: key.id,
      resolvedHref: state.plan.resolvedHref,
      auth: state.plan.auth,
      headers: state.plan.headers,
    },
    secret: key.secret,
    interpreterId: state.plan.interpreterId,
    deviceKey: dependencies.deviceKey,
  });

  // A plaintext target never reuses standing consent: every execution needs a
  // fresh gesture, even if a grant row exists from an older build (I7).
  const authorized =
    (state.kind === 'auto' &&
      (await dependencies.authorization.hasGrant(send))) ||
    (request.mode === 'manual' &&
      dependencies.authorization.consumeApproval(send, key.id));

  if (!authorized) {
    return {
      status: 'needs_authorization',
      fingerprint: send,
      plan: state.plan,
    };
  }

  const requestSeq = dependencies.nextRequestSeq();
  const { observation } = await runProbe(
    {
      plan: state.plan,
      secret: key.secret,
      binding,
      vaultId: payload.vault.id,
      keyId: key.id,
      sessionId: dependencies.sessionId,
      requestSeq,
      signal: dependencies.signal,
    },
    dependencies.fetch
  );

  // A locked session may still deliver an aborted request's synthetic outcome.
  // It describes a configuration that is no longer open, so never store it.
  if (dependencies.signal?.aborted || dependencies.isActive?.() === false) {
    return { status: 'discarded', observation };
  }

  // The key may have changed while the request was in flight; a result for a
  // configuration that no longer exists must not be stored.
  const after = dependencies.payload();
  const current = findKey(after, key.id);
  if (!current) return { status: 'discarded', observation };

  const currentState = classifyRecipe(
    { provider_id: current.provider_id, endpoint: current.endpoint },
    after.providers
  );
  const currentBinding =
    currentState.kind === 'not_executable'
      ? null
      : (
          await describeSend({
            artifact: {
              keyId: current.id,
              resolvedHref: currentState.plan.resolvedHref,
              auth: currentState.plan.auth,
              headers: currentState.plan.headers,
            },
            secret: current.secret,
            interpreterId: currentState.plan.interpreterId,
            deviceKey: dependencies.deviceKey,
          })
        ).binding;

  // §10.1: session, key, archive state, binding and the monotonic sequence all
  // have to agree. "Last started wins", never `finished_at`.
  const adoption = shouldAdopt(
    { sessionId: dependencies.sessionId, requestSeq, binding },
    {
      sessionId: dependencies.sessionId,
      keyExists: true,
      keyArchived: current.archived_at !== null,
      binding: currentBinding ?? '',
      lastAdoptedSeq: dependencies.lastAdoptedSeq?.(key.id) ?? -1,
    }
  );
  if (adoption === 'discard') return { status: 'discarded', observation };

  dependencies.adoptSeq?.(key.id, requestSeq);
  await dependencies.local.recordObservation(observation);

  if (observation.outcome === 'ok') {
    // A success clears the previous failure dismissal so a later failure is
    // reported again instead of staying silent.
    await dependencies.local.removeObservationDismissal(
      payload.vault.id,
      key.id,
      'probe_failed'
    );
  }

  return { status: 'observed', observation };
}
