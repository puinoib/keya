/**
 * The "test this credential" entry point the screens call.
 *
 * A click is the user gesture that authorizes one request: the check is routed
 * through the vault session, which records the result as an observation. A key
 * that is still a draft in the form has no stored identity yet, so it is tested
 * directly and nothing is recorded.
 */

import { classifyRecipe } from '../../core/presets/classify';
import { findPreset } from '../../core/presets/data';
import { runProbe } from '../probe/execute';
import { browserFetch } from '../storage/platform';
import { providerIdForLabel } from '../view/catalog';
import type { ApiKey, Settings } from '../view/types';
import { runManualCheck } from '../store/useStore';

export type TestKind =
  | 'credential'
  | 'request'
  | 'reachability'
  | 'unverifiable';

export interface TestResult {
  success: boolean;
  latency_ms: number;
  error?: string;
  kind: TestKind;
}

export class ApiTester {
  /** What a successful answer would be allowed to claim for this provider. */
  static checkKindFor(provider: string, settings?: Settings): TestKind {
    const providers = (settings?.custom_providers ?? []).map((entry) => ({
      id: `custom:${entry.name}`,
      name: entry.name,
    }));
    const id = providerIdForLabel(provider, providers);
    if (!id?.startsWith('preset:')) return 'request';

    const preset = findPreset(id.slice('preset:'.length));
    if (!preset) return 'request';
    if (!preset.probe) return 'unverifiable';
    return preset.verifies;
  }

  /** Draft credentials from the form have no stored identity yet. */
  static async testRaw(
    provider: string,
    endpoint: string,
    key: string,
    settings?: Settings
  ): Promise<TestResult> {
    const { providerIdForLabel: resolve } = await import('../view/catalog');
    return ApiTester.testKey(
      {
        id: 'draft',
        name: 'draft',
        description: '',
        provider,
        provider_id: resolve(
          provider,
          (settings?.custom_providers ?? []).map((entry) => ({
            id: entry.name,
            name: entry.name,
          }))
        ),
        endpoint,
        key,
        group_id: null,
        expires_at: null,
        expiry_status: 'none',
        days_until_expiry: null,
        expiry: null,
        archived_at: null,
        connection_check: {
          status: 'untested',
          checked_at: null,
          latency_ms: null,
          error_message: null,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      settings
    );
  }

  static unverifiableReason(provider: string): string {
    return `${provider} cannot be verified from this browser; this is not proof that the credential is invalid.`;
  }

  static async testKey(key: ApiKey, settings?: Settings): Promise<TestResult> {
    const stored = await runManualCheck(key.id);
    if (stored) return stored;

    // Draft key: no stored identity, so nothing can be recorded.
    const providers = (settings?.custom_providers ?? []).map((entry) => ({
      id: `custom:${entry.name}`,
      name: entry.name,
    }));
    const state = classifyRecipe(
      {
        provider_id:
          key.provider_id ?? providerIdForLabel(key.provider, providers),
        endpoint: key.endpoint || null,
      },
      []
    );

    if (state.kind === 'not_executable') {
      return {
        success: false,
        latency_ms: 0,
        error: 'This provider cannot be checked.',
        kind: 'request',
      };
    }

    const { observation } = await runProbe(
      {
        plan: state.plan,
        secret: key.key,
        binding: 'draft',
        vaultId: 'draft',
        keyId: key.id,
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
      kind: state.plan.verifies === 'credential' ? 'credential' : 'request',
    };
  }
}
