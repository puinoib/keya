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
import { EXPIRY_UPCOMING_DAYS } from '../../core/payload/limits';
import type {
  Observation,
  RejectedOutcome,
} from '../../core/runtime/observations';
import type { OpenFailure } from '../vault/vault';
import type { Issue } from '../../core/payload/validate';
import { summarizeIssues } from '../../core/payload/validate';
import type {
  NotExecutableReason,
  RecipeState,
} from '../../core/presets/classify';

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'none';

const DAY = 24 * 60 * 60 * 1000;

export { daysUntilExpiry } from '../../core/time/expiry';

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
export function expiryVerdict(
  expiry: Expiry | null,
  now: Date,
  timeZone: string
): ExpiryStatus {
  switch (expiryStatus(expiry, now, timeZone, EXPIRY_UPCOMING_DAYS)) {
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

/** Why a vault could not be opened, in the words the unlock screen shares. */
export function describeOpenFailure(
  failure: OpenFailure,
  issues?: Issue[]
): string {
  switch (failure) {
    case 'missing_file':
      return 'This file no longer exists.';
    case 'file_too_short':
    case 'file_too_large':
      return 'The file is incomplete or too large; it may be damaged.';
    case 'bad_magic':
      return 'This is not a Keya file.';
    case 'unsupported_version':
      return 'This file version is not supported by this build.';
    case 'kdf_out_of_range':
      return 'The file header parameters are outside the allowed range.';
    case 'auth_failed':
      return 'Wrong password, or the file contents have been modified.';
    case 'payload_corrupt':
      return 'The file was decrypted, but its contents are damaged.';
    case 'invalid_payload':
      return issues && issues.length > 0
        ? `The file was decrypted, but its contents are invalid: ${summarizeIssues(issues)}`
        : 'The file was decrypted, but its contents are invalid.';
    case 'kdf_busy':
      return 'Another tab is unlocking a vault. Try again in a moment.';
    case 'kdf_cancelled':
      return 'Unlocking was cancelled.';
    case 'kdf_memory':
      return 'This device does not have enough memory to unlock this file.';
    case 'kdf_failed':
      return 'The key could not be derived from this password.';
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

/** Why a recipe cannot run at all, in the words the screens share. */
export function notExecutableLabel(reason: NotExecutableReason): string {
  switch (reason) {
    case 'missing_endpoint':
      return 'Add an endpoint to check this key';
    case 'invalid_target':
      return 'The check recipe is not a usable request';
    case 'unknown_preset':
      return 'This build does not know the provider preset';
    case 'capability_missing':
      return 'This provider cannot be checked from a browser';
  }
}

/** The one-line state a screen shows beside a key's check result. */
export function checkStateHint(check: {
  checkable: boolean;
  manualOnly: boolean;
  recipe: RecipeState | undefined;
}): string | null {
  if (check.manualOnly) return 'Plain http — approved one request at a time';
  if (!check.checkable && check.recipe?.kind === 'not_executable') {
    return notExecutableLabel(check.recipe.reason);
  }
  return null;
}

/** Controlled copy for an observed failure; provider text is never stored. */
export function describeFailure(
  observation: Observation | undefined
): string | null {
  if (!observation) return null;
  switch (observation.outcome) {
    case 'auth_failed':
    case 'forbidden':
      return rejectionReason(observation.outcome);
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

/** What a rejection means, in the words the inbox and the key share. */
export function rejectionReason(outcome: RejectedOutcome): string {
  return outcome === 'auth_failed'
    ? 'the service rejected the credential'
    : 'the credential lacks permission';
}

export function daysSince(date: string | null, now: Date): number | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / DAY);
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const AGE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/**
 * A timestamp as the sentence a screen shows. Coarse on purpose: these are
 * trust signals ("the file was written two minutes ago"), not a clock.
 */
export function describeAge(timestamp: string, now: Date): string {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return 'at an unknown time';

  const seconds = Math.round((parsed - now.getTime()) / 1000);
  const magnitude = Math.abs(seconds);
  if (magnitude < 60) return 'just now';

  for (const [unit, size] of AGE_UNITS) {
    if (magnitude >= size) {
      return RELATIVE.format(Math.round(seconds / size), unit);
    }
  }
  return RELATIVE.format(seconds, 'second');
}

/**
 * Why the last save failed, in the words the top bar and the toast share.
 * `locked` is included because flush can race a lock.
 */
export function describeSaveFailure(
  failure:
    | 'locked'
    | 'invalid_payload'
    | 'external_change'
    | 'io_failed'
    | string
): string {
  switch (failure) {
    case 'external_change':
      return 'the file changed on disk; your edits are kept in memory';
    case 'io_failed':
      return 'the file could not be written; your edits are kept in memory';
    case 'invalid_payload':
      return 'some edits are not valid, so nothing was written';
    case 'locked':
      return 'the vault locked before the save finished';
    default:
      return 'the save did not complete';
  }
}
