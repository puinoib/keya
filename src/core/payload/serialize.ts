/**
 * Plaintext encoding (§4).
 *
 * Writers emit a fixed field order with no insignificant whitespace so that the
 * same in-memory state always produces the same bytes — that is what makes the
 * frozen vectors and byte-level debugging meaningful. Readers accept any valid
 * JSON shape: canonical form is a writer obligation, not a reader requirement.
 */

import type { Expiry, Group, Key, KeyaFile, Probe, Provider } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Serialize a payload. Field order here is normative (§5.1). */
export function serializePayload(file: KeyaFile): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      vault: {
        id: file.vault.id,
        name: file.vault.name,
        icon: file.vault.icon,
        created_at: file.vault.created_at,
        content_updated_at: file.vault.content_updated_at,
      },
      providers: file.providers.map(serializeProvider),
      groups: file.groups.map(serializeGroup),
      keys: file.keys.map(serializeKey),
    })
  );
}

function serializeProvider(provider: Provider) {
  return {
    id: provider.id,
    name: provider.name,
    description: provider.description,
    default_endpoint: provider.default_endpoint,
    probe: serializeProbe(provider.probe),
  };
}

function serializeProbe(probe: Probe | null) {
  if (!probe) return null;
  return {
    target: probe.target,
    auth: serializeAuth(probe.auth),
    headers: probe.headers.map((header) => ({
      name: header.name,
      value: header.value,
    })),
  };
}

function serializeAuth(auth: Probe['auth']) {
  switch (auth.mode) {
    case 'bearer':
    case 'basic':
      return { mode: auth.mode };
    case 'header':
      return { mode: auth.mode, name: auth.name };
    case 'query':
      return { mode: auth.mode, param: auth.param };
  }
}

function serializeGroup(group: Group) {
  return {
    id: group.id,
    name: group.name,
    icon: group.icon,
    order: group.order,
  };
}

function serializeKey(key: Key) {
  return {
    id: key.id,
    name: key.name,
    description: key.description,
    provider_id: key.provider_id,
    endpoint: key.endpoint,
    secret: key.secret,
    group_id: key.group_id,
    expiry: serializeExpiry(key.expiry),
    archived_at: key.archived_at,
    created_at: key.created_at,
    content_updated_at: key.content_updated_at,
  };
}

function serializeExpiry(expiry: Expiry | null) {
  if (!expiry) return null;
  return { kind: expiry.kind, value: expiry.value };
}

/**
 * Decode the plaintext into an unknown JSON value. Invalid UTF-8 fails here;
 * shape validation is a separate step so the two failure modes stay distinct
 * (§3.5 steps 7 and 8).
 */
export function parsePayload(bytes: Uint8Array): unknown {
  const text = decoder.decode(bytes);
  return JSON.parse(text) as unknown;
}
