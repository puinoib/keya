/**
 * Conversions between the stored payload and the view models.
 */

import type { Expiry } from '../../core/time/expiry';
import { expiryStatus } from '../../core/time/expiry';
import type { Key, KeyaFile, Provider } from '../../core/payload/types';
import type { Observation } from '../../core/runtime/observations';
import type { ApiKey, ConnectionCheck, CustomProvider, Group } from './types';
import type { ExpiryStatus } from './status';
import { providerLabel } from './catalog';

const DAY = 24 * 60 * 60 * 1000;

/** The local calendar day an instant falls on, as `YYYY-MM-DD`. */
function localDayOf(input: Date | string, timeZone: string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function daysBetweenDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / DAY);
}

/** Calendar days from the local day of `now` to the expiry's local day. */
export function daysUntilExpiry(
  expiry: Expiry | null,
  now: Date,
  timeZone: string
): number | null {
  if (!expiry) return null;
  return daysBetweenDays(
    localDayOf(now, timeZone),
    expiry.kind === 'date' ? expiry.value : localDayOf(expiry.value, timeZone)
  );
}

function toViewStatus(status: ReturnType<typeof expiryStatus>): ExpiryStatus {
  switch (status) {
    case 'expired':
      return 'expired';
    case 'upcoming':
      return 'expiring_soon';
    case 'ok':
      return 'valid';
    default:
      return 'none';
  }
}

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
  observation: Observation | undefined,
  context: { now: Date; timeZone: string }
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
    expiry_status: toViewStatus(
      expiryStatus(key.expiry, context.now, context.timeZone)
    ),
    days_until_expiry: daysUntilExpiry(
      key.expiry,
      context.now,
      context.timeZone
    ),
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
    return {
      id: provider.id,
      name: provider.name,
      endpoint: provider.default_endpoint ?? '',
    };
  }

  const auth = probe.auth;
  const mode =
    auth.mode === 'header' && auth.name.toLowerCase() === 'x-api-key'
      ? 'x-api-key'
      : auth.mode;

  return {
    id: provider.id,
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
