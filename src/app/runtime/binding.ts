/**
 * Fingerprints for the keys of an unlocked vault.
 *
 * Both derived values depend on the same send description, so they are computed
 * in one pass: `send` for consent, `binding` for observation freshness. Keys
 * whose recipe cannot run get no entry, which is what keeps "never checked"
 * Inbox facts from appearing for providers that cannot be checked at all.
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

  // Hashing is per key and independent, so it can overlap instead of waiting
  // for a thousand sequential WebCrypto round trips. The pool keeps a large
  // vault from queueing thousands of tiny operations at once.
  const entries = await mapWithConcurrency(payload.keys, 8, (key) =>
    bindingFor(payload, key, deviceKey)
  );

  for (const entry of entries) {
    if (entry) result.set(entry.keyId, entry);
  }

  return result;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  map: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await map(items[index]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
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
