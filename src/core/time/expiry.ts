/**
 * Expiry semantics.
 *
 * `instant` is device independent. `date` means "the end of that calendar day
 * in the timezone of the device that is judging", i.e. the following day at
 * local 00:00 — so the same file may yield different answers on devices in
 * different timezones. That is the semantics, not a bug (§5.3).
 *
 * Everything here is a pure function of an explicit `now` and timezone so the
 * behaviour is testable in one process.
 */

import {
  type CalendarDay,
  isCalendarDay,
  isTimestamp,
  parseCalendarDay,
} from './timestamps';

export type Expiry =
  | { kind: 'date'; value: string }
  | { kind: 'instant'; value: string };

export type ExpiryStatus = 'none' | 'ok' | 'upcoming' | 'expired';

const HOUR = 3_600_000;

interface LocalWall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function localWallAt(instant: number, timeZone: string): LocalWall {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function compareWall(a: LocalWall, b: LocalWall): number {
  const left = [a.year, a.month, a.day, a.hour, a.minute, a.second];
  const right = [b.year, b.month, b.day, b.hour, b.minute, b.second];
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function addDays(day: CalendarDay, days: number): CalendarDay {
  const date = new Date(0);
  date.setUTCFullYear(day.year, day.month - 1, day.day + days);
  date.setUTCHours(0, 0, 0, 0);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * The first instant at which the given timezone's wall clock reaches `target`.
 *
 * Uses a binary search rather than offset iteration so that days whose local
 * midnight does not exist (some zones shift at 00:00) still resolve to the
 * first legal moment of that day.
 */
function firstInstantAtOrAfter(target: LocalWall, timeZone: string): number {
  // `Date.UTC` maps years 0-99 to 1900-1999; the format allows 0000-9999.
  const date = new Date(0);
  date.setUTCFullYear(target.year, target.month - 1, target.day);
  date.setUTCHours(target.hour, target.minute, target.second, 0);
  const base = date.getTime();
  let low = base - 26 * HOUR;
  let high = base + 26 * HOUR;

  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (compareWall(localWallAt(mid, timeZone), target) >= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return high;
}

const MIDNIGHT: Pick<LocalWall, 'hour' | 'minute' | 'second'> = {
  hour: 0,
  minute: 0,
  second: 0,
};

/** Start of the given local day in `timeZone`, as an epoch millisecond value. */
export function startOfLocalDay(day: CalendarDay, timeZone: string): number {
  return firstInstantAtOrAfter({ ...day, ...MIDNIGHT }, timeZone);
}

/**
 * The instant at which the expiry takes effect, or null when there is none.
 * A `date` expiry takes effect when the *following* local day starts.
 */
export function expiryPoint(
  expiry: Expiry | null | undefined,
  timeZone: string
): Date | null {
  if (!expiry) return null;

  if (expiry.kind === 'instant') {
    return isTimestamp(expiry.value) ? new Date(expiry.value) : null;
  }

  const day = parseCalendarDay(expiry.value);
  if (!day) return null;
  return new Date(startOfLocalDay(addDays(day, 1), timeZone));
}

/**
 * Distance from `now` to the expiry point, in milliseconds. Negative once the
 * expiry has passed.
 */
export function msUntilExpiry(
  expiry: Expiry | null | undefined,
  now: Date,
  timeZone: string
): number | null {
  const point = expiryPoint(expiry, timeZone);
  return point ? point.getTime() - now.getTime() : null;
}

export function expiryStatus(
  expiry: Expiry | null | undefined,
  now: Date,
  timeZone: string,
  upcomingDays = 7
): ExpiryStatus {
  if (!expiry) return 'none';
  const remaining = msUntilExpiry(expiry, now, timeZone);
  if (remaining === null) return 'none';
  if (remaining <= 0) return 'expired';
  if (remaining <= upcomingDays * 24 * HOUR) return 'upcoming';
  return 'ok';
}

/**
 * The fact fingerprint a dismissal is bound to: only an unchanged fact keeps a
 * dismissal effective (`BusinessDismissal.condition`).
 */
export function expiryCondition(
  expiry: Expiry | null | undefined
): string | null {
  if (!expiry) return null;
  if (expiry.kind === 'instant') {
    return isTimestamp(expiry.value) ? `instant:${expiry.value}` : null;
  }
  return isCalendarDay(expiry.value) ? `date:${expiry.value}` : null;
}
