/**
 * Turning the vault's own values into what a screen shows.
 *
 * Everything here is copy or formatting: a stored `expiry` union becomes the
 * day a picker works in, an observation becomes the badge status, and a
 * provider reference becomes the name beside it. No screen keeps its own copy
 * of these rules.
 */

import type { Expiry } from '../../core/time/expiry';
import { expiryStatus } from '../../core/time/expiry';
import type { Observation } from '../../core/runtime/observations';

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'none';

const DAY = 24 * 60 * 60 * 1000;
const EXPIRY_REMINDER_DAYS = 7;

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

/** A calendar day is a local day, so the picker and the file agree. */
export function expiryToDate(expiry: Expiry | null): Date | undefined {
  if (!expiry) return undefined;
  if (expiry.kind === 'instant') return new Date(expiry.value);

  const [year, month, day] = expiry.value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** A picked midnight stays a day; anything with a time becomes an instant. */
export function dateToExpiry(date: Date | undefined): Expiry | null {
  if (!date || Number.isNaN(date.getTime())) return null;

  const midnight =
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0;

  if (midnight) {
    return {
      kind: 'date',
      value: `${String(date.getFullYear()).padStart(4, '0')}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    };
  }

  return { kind: 'instant', value: date.toISOString() };
}

/** Calendar days from today to the expiry's own day; negative once passed. */
export function daysUntilExpiry(
  expiry: Expiry | null,
  now: Date,
  timeZone: string
): number | null {
  if (!expiry) return null;
  const to =
    expiry.kind === 'date' ? expiry.value : localDayOf(expiry.value, timeZone);
  const from = localDayOf(now, timeZone);
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY
  );
}

export function expiryVerdict(
  expiry: Expiry | null,
  now: Date,
  timeZone: string
): ExpiryStatus {
  switch (expiryStatus(expiry, now, timeZone, EXPIRY_REMINDER_DAYS)) {
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

export function expiryStatusLabel(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'Expired';
    case 'expiring_soon':
      return 'Expiring soon';
    case 'valid':
      return 'Valid';
    case 'none':
      return 'No expiry';
  }
}

export type CheckStatus = 'success' | 'failed' | 'untested';

export function checkStatus(observation: Observation | undefined): CheckStatus {
  if (!observation) return 'untested';
  return observation.outcome === 'ok' ? 'success' : 'failed';
}

export function checkStatusLabel(
  status: CheckStatus,
  kind?: 'credential' | 'request' | 'unverifiable'
): string {
  if (status === 'untested') return 'Untested';
  if (status === 'failed') return 'Failed';
  return kind === 'credential' ? 'Verified' : 'Reachable';
}

/** Controlled copy for an observed failure; provider text is never stored. */
export function describeFailure(
  observation: Observation | undefined
): string | null {
  if (!observation) return null;
  switch (observation.outcome) {
    case 'auth_failed':
      return 'the service rejected the credential';
    case 'forbidden':
      return 'the credential lacks permission';
    case 'rate_limited':
      return 'the service is rate limiting requests';
    case 'server_error':
      return 'the service returned an error';
    case 'failed':
      return observation.detail_code === 'unexpected_html'
        ? 'the address answered with a web page'
        : 'the request was answered with an unexpected status';
    case 'timeout':
      return 'the request did not finish in time';
    case 'network':
      return 'the request could not be completed';
    default:
      return null;
  }
}

export function daysSince(date: string | null, now: Date): number | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / DAY);
}
