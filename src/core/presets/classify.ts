/**
 * Recipe classification (§10.3).
 *
 * A key's probe recipe is in exactly one of six states, and the state decides
 * which reminders and which authorization UI are possible. The two interesting
 * distinctions:
 *
 * - "not executable" has four different causes, three of which the user can
 *   fix. Collapsing them into one message tells a user their provider is
 *   unsupported when all they did was leave the endpoint blank.
 * - "manual only" (`http:`) can never hold a persistent grant, so it must never
 *   show "needs re-authorization": that warning could not be cleared.
 */

import { findPreset, type Preset } from '../presets/data';
import type { ProbeAuth, Provider, StaticHeader } from '../payload/types';
import { isCustomId, isPresetId, PRESET_ID_PREFIX } from '../payload/ids';
import { resolveTarget } from '../payload/url';

export type NotExecutableReason =
  /** The provider has no usable recipe, or the browser cannot verify it. */
  | 'capability_missing'
  /** Relative target but the key has no endpoint. */
  | 'missing_endpoint'
  /** Absolute target that cannot be used as an HTTP request. */
  | 'invalid_target'
  /** The file references a preset this build does not ship. */
  | 'unknown_preset';

export interface RecipePlan {
  /** `resolved.href` — the only string form used for fingerprints. */
  resolvedHref: string;
  target: string;
  auth: ProbeAuth;
  headers: StaticHeader[];
  /** Scoped interpreter version, part of `observation_binding`. */
  interpreterId: string;
  /** What a 2xx is allowed to claim. */
  verifies: 'credential' | 'request';
  providerId: string;
}

export type RecipeState =
  | {
      kind: 'not_executable';
      reason: NotExecutableReason;
      /** Present when a preset is known to be unverifiable from a browser. */
      unverifiable?: string;
    }
  | { kind: 'manual_only'; plan: RecipePlan }
  | { kind: 'auto'; plan: RecipePlan };

export interface RecipeInput {
  provider_id: string | null;
  endpoint: string | null;
}

interface RecipeSource {
  providerId: string;
  target: string;
  auth: ProbeAuth;
  headers: StaticHeader[];
  interpreterId: string;
  verifies: 'credential' | 'request';
  unverifiable?: string;
}

function fromPreset(preset: Preset): RecipeSource | NotExecutableSource {
  if (!preset.probe) {
    return {
      notExecutable: 'capability_missing',
      unverifiable: preset.unverifiable ?? undefined,
    };
  }
  return {
    providerId: `preset:${preset.slug}`,
    target: preset.probe.target,
    auth: preset.probe.auth,
    headers: preset.probe.headers,
    interpreterId: `preset:${preset.slug}/1`,
    verifies: preset.verifies,
  };
}

function fromCustom(provider: Provider): RecipeSource | NotExecutableSource {
  if (!provider.probe) return { notExecutable: 'capability_missing' };
  return {
    providerId: provider.id,
    target: provider.probe.target,
    auth: provider.probe.auth,
    headers: provider.probe.headers,
    interpreterId: 'custom/1',
    verifies: 'request',
  };
}

interface NotExecutableSource {
  notExecutable: NotExecutableReason;
  unverifiable?: string;
}

const isNotExecutable = (
  source: RecipeSource | NotExecutableSource
): source is NotExecutableSource => 'notExecutable' in source;

/** Resolve the recipe source for a key's provider reference. */
function resolveSource(
  input: RecipeInput,
  providers: readonly Provider[]
): RecipeSource | NotExecutableSource {
  const providerId = input.provider_id;

  if (providerId === null) {
    return { notExecutable: 'capability_missing' };
  }

  if (isPresetId(providerId)) {
    const preset = findPreset(providerId.slice(PRESET_ID_PREFIX.length));
    if (!preset) return { notExecutable: 'unknown_preset' };
    return fromPreset(preset);
  }

  if (isCustomId(providerId)) {
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) return { notExecutable: 'capability_missing' };
    return fromCustom(provider);
  }

  return { notExecutable: 'unknown_preset' };
}

export function classifyRecipe(
  input: RecipeInput,
  providers: readonly Provider[]
): RecipeState {
  const source = resolveSource(input, providers);
  if (isNotExecutable(source)) {
    return {
      kind: 'not_executable',
      reason: source.notExecutable,
      unverifiable: source.unverifiable,
    };
  }

  const resolved = resolveTarget(input.endpoint, source.target);
  if (!resolved.ok) {
    const reason: NotExecutableReason =
      resolved.reason === 'missing_endpoint'
        ? 'missing_endpoint'
        : 'invalid_target';
    return { kind: 'not_executable', reason };
  }

  const plan: RecipePlan = {
    resolvedHref: resolved.url!.href,
    target: source.target,
    auth: source.auth,
    headers: source.headers,
    interpreterId: source.interpreterId,
    verifies: source.verifies,
    providerId: source.providerId,
  };

  return resolved.url!.protocol === 'http:'
    ? { kind: 'manual_only', plan }
    : { kind: 'auto', plan };
}

/**
 * Whether observations may exist for this key at all. Non-executable recipes
 * produce none, which is why they must also produce no observation reminders.
 */
export function isExecutable(state: RecipeState): boolean {
  return state.kind !== 'not_executable';
}
