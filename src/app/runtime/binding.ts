/**
 * Fingerprints for the keys of an unlocked vault.
 *
 * Both derived values depend on the same send description, so they are computed
 * in one pass: `send` for consent, `binding` for observation freshness. Keys
 * whose recipe cannot run get no entry, which is what keeps "never checked"
 * reminders from appearing for providers that cannot be checked at all.
 */

import { observationBinding, sendFingerprint } from '../../core/fingerprint';
import { classifyRecipe, type RecipePlan } from '../../core/presets/classify';
import type { Key, KeyaFile } from '../../core/payload/types';

export interface KeyBinding {
  keyId: string;
  plan: RecipePlan;
  /** `send_fingerprint` of this key's current request. */
  send: string;
  /** `observation_binding` including the secret and interpreter version. */
  binding: string;
}

export async function currentBindings(
  payload: KeyaFile,
  deviceKey: CryptoKey
): Promise<Map<string, KeyBinding>> {
  const result = new Map<string, KeyBinding>();

  for (const key of payload.keys) {
    const binding = await bindingFor(payload, key, deviceKey);
    if (binding) result.set(key.id, binding);
  }

  return result;
}

export async function bindingFor(
  payload: KeyaFile,
  key: Key,
  deviceKey: CryptoKey
): Promise<KeyBinding | null> {
  const state = classifyRecipe(
    { provider_id: key.provider_id, endpoint: key.endpoint },
    payload.providers
  );
  if (state.kind === 'not_executable') return null;

  const artifact = {
    keyId: key.id,
    resolvedHref: state.plan.resolvedHref,
    auth: state.plan.auth,
    headers: state.plan.headers,
  };

  return {
    keyId: key.id,
    plan: state.plan,
    send: await sendFingerprint(artifact),
    binding: await observationBinding(deviceKey, {
      ...artifact,
      secret: key.secret,
      interpreterId: state.plan.interpreterId,
    }),
  };
}
