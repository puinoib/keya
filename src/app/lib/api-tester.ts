/**
 * The "test this credential" entry point the screens call.
 *
 * A click is the user gesture that authorizes one request. For a stored key the
 * check runs through the vault session, so the result is recorded as an
 * observation and the Inbox can react to it. A key that is still a draft in the
 * form has no stored identity yet, so it is tested directly and nothing is
 * recorded.
 */

import type { Provider } from '../../core/payload/types';
import { classifyRecipe, type RecipeState } from '../../core/presets/classify';
import { runProbe } from '../probe/execute';
import { browserFetch } from '../storage/platform';
import { runManualCheck } from '../store/useStore';

export type TestKind = 'credential' | 'request' | 'unverifiable';

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
  kind: TestKind;
}

/** What the provider's recipe would claim if the check passed. */
export function checkKind(
  providerId: string | null,
  endpoint: string,
  providers: readonly Provider[]
): TestKind {
  const state = classifyRecipe(
    { provider_id: providerId, endpoint },
    providers
  );
  return state.kind === 'not_executable' ? 'unverifiable' : state.plan.verifies;
}

function notExecutableKind(state: RecipeState): TestKind {
  return state.kind === 'not_executable' ? 'unverifiable' : state.plan.verifies;
}

export class ApiTester {
  /** A stored key: the result becomes an observation. */
  static async testStored(keyId: string): Promise<TestResult> {
    const stored = await runManualCheck(keyId);
    if (stored) return stored;
    return {
      success: false,
      latency_ms: 0,
      error: 'This key is no longer in the vault.',
      kind: 'unverifiable',
    };
  }

  /**
   * Values that are not stored yet. Nothing is recorded, because there is no
   * key to record it against.
   */
  static async testDraft(input: {
    providerId: string | null;
    endpoint: string;
    secret: string;
    providers: readonly Provider[];
  }): Promise<TestResult> {
    const state = classifyRecipe(
      { provider_id: input.providerId, endpoint: input.endpoint },
      input.providers
    );

    if (state.kind === 'not_executable') {
      return {
        success: false,
        latency_ms: 0,
        error:
          state.unverifiable ??
          'This provider cannot be checked from a browser.',
        kind: 'unverifiable',
      };
    }

    const { observation } = await runProbe(
      {
        plan: state.plan,
        secret: input.secret,
        binding: 'draft',
        vaultId: 'draft',
        keyId: 'draft',
        sessionId: 'draft',
        requestSeq: 0,
      },
      browserFetch
    );

    return {
      success: observation.outcome === 'ok',
      latency_ms: observation.latency_ms ?? 0,
      error:
        observation.outcome === 'ok'
          ? undefined
          : (observation.detail_code ?? observation.outcome),
      kind: notExecutableKind(state),
    };
  }
}

export function unverifiableReason(providerLabel: string): string {
  return `${providerLabel} cannot be verified from this browser; this is not proof that the credential is invalid.`;
}
