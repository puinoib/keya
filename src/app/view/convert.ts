/**
 * Conversions between the stored payload and the view models.
 */

import type { Expiry } from '../../core/time/expiry';
import type { Key, KeyaFile, Provider } from '../../core/payload/types';
import type { Observation } from '../../core/runtime/observations';
import type { ApiKey, ConnectionCheck, CustomProvider, Group } from './types';
import { providerLabel } from './catalog';

/**
 * A calendar day is presented as local midnight, which is what the date picker
 * and the old `expires_at` field expected. The stored form stays a day, so the
 * timezone-dependent expiry rule is preserved.
 */
export function expiryToIso(expiry: Expiry | null): string | null {
  if (!expiry) return null;
  if (expiry.kind === 'instant') return expiry.value;

  const [year, month, day] = expiry.value.split('-').map(Number);
  return new Date(year, month - 1, day).toISOString();
}

/**
 * Inverse of `expiryToIso`: a picked day stays a day. Anything with a time of
 * day becomes an exact instant.
 */
export function isoToExpiry(iso: string | null): Expiry | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const isMidnight =
    date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
  if (isMidnight) {
    const value = `${String(date.getFullYear()).padStart(4, '0')}-${String(
      date.getMonth() + 1
    ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { kind: 'date', value };
  }

  return { kind: 'instant', value: date.toISOString() };
}

export function connectionFromObservation(
  observation: Observation | undefined
): ConnectionCheck {
  if (!observation) {
    return {
      status: 'untested',
      checked_at: null,
      latency_ms: null,
      error_message: null,
    };
  }

  return {
    status: observation.outcome === 'ok' ? 'success' : 'failed',
    checked_at: observation.finished_at,
    latency_ms: observation.latency_ms,
    error_message: null,
    kind: observation.kind,
    detail_code: observation.detail_code,
  };
}

export function keyToView(
  key: Key,
  file: KeyaFile,
  observation: Observation | undefined
): ApiKey {
  return {
    id: key.id,
    name: key.name,
    description: key.description,
    provider: providerLabel(key.provider_id, file.providers),
    provider_id: key.provider_id,
    endpoint: key.endpoint ?? '',
    key: key.secret,
    group_id: key.group_id,
    expires_at: expiryToIso(key.expiry),
    expiry: key.expiry,
    archived_at: key.archived_at,
    connection_check: connectionFromObservation(observation),
    created_at: key.created_at,
    updated_at: key.content_updated_at,
  };
}

export function groupToView(group: Group): Group {
  return { ...group };
}

export function providerToView(provider: Provider): CustomProvider {
  const probe = provider.probe;
  if (!probe) {
    return { name: provider.name, endpoint: provider.default_endpoint ?? '' };
  }

  const auth = probe.auth;
  const mode =
    auth.mode === 'header' && auth.name.toLowerCase() === 'x-api-key'
      ? 'x-api-key'
      : auth.mode;

  return {
    name: provider.name,
    endpoint: provider.default_endpoint ?? '',
    check: {
      path: probe.target,
      auth: mode,
      header_name: auth.mode === 'header' ? auth.name : undefined,
      query_param: auth.mode === 'query' ? auth.param : undefined,
      headers: probe.headers.map((header) => ({ ...header })),
    },
  };
}
