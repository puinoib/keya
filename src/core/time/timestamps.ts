/**
 * Strict timestamp and calendar-day validation.
 *
 * The format stores RFC 3339 UTC instants with millisecond precision, and
 * `YYYY-MM-DD` calendar days. Both are validated by construction — regex, then
 * component round-trip — never by "does Date.parse accept it" (that silently
 * rolls 2026-02-30 into March).
 */

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number, width: number) =>
  String(value).padStart(width, '0');

/**
 * Returns the UTC Date for the given instant string, or null when the string is
 * not a real, canonical timestamp.
 */
export function parseTimestamp(value: string): Date | null {
  if (!TIMESTAMP_RE.test(value)) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  const milli = Number(value.slice(20, 23));

  // `Date.UTC` maps years 0-99 to 1900-1999, so the year is set explicitly.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, milli);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== milli
  ) {
    return null;
  }

  return formatTimestamp(date) === value ? date : null;
}

export function formatTimestamp(date: Date): string {
  return (
    `${date.getUTCFullYear().toString().padStart(4, '0')}-` +
    `${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}T` +
    `${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:` +
    `${pad(date.getUTCSeconds(), 2)}.${pad(date.getUTCMilliseconds(), 3)}Z`
  );
}

export function isTimestamp(value: string): boolean {
  return parseTimestamp(value) !== null;
}

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/** Returns the parsed calendar day, or null when it is not a real date. */
export function parseCalendarDay(value: string): CalendarDay | null {
  if (!DATE_RE.test(value)) return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isCalendarDay(value: string): boolean {
  return parseCalendarDay(value) !== null;
}
