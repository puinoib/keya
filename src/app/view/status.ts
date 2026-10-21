/**
 * Presentation-level status helpers.
 *
 * They read the instant the view exposes, so a calendar-day expiry still shows
 * the status of the day it represents.
 */

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'none';
export type ConnectionStatusLabel =
  | 'Verified'
  | 'Reachable'
  | 'Failed'
  | 'Untested';

export const EXPIRY_REMINDER_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDaysUntilExpiry(
  expiresAt: string,
  now = new Date()
): number | null {
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round(
    (startOfDay(parsed).getTime() - startOfDay(now).getTime()) / DAY
  );
}

export function getExpiryStatus(
  expiresAt: string | null,
  now = new Date()
): ExpiryStatus {
  if (!expiresAt) return 'none';
  const days = getDaysUntilExpiry(expiresAt, now);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= EXPIRY_REMINDER_DAYS) return 'expiring_soon';
  return 'valid';
}

export function getExpiryStatusLabel(status: ExpiryStatus): string {
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

export function getConnectionStatusLabel(
  status: 'success' | 'failed' | 'untested',
  kind?: 'credential' | 'request' | 'reachability' | 'unverifiable'
): ConnectionStatusLabel {
  if (status === 'untested') return 'Untested';
  if (status === 'failed') return 'Failed';
  return kind === 'credential' ? 'Verified' : 'Reachable';
}

export function getDaysSince(
  date: string | null,
  now = new Date()
): number | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((now.getTime() - parsed.getTime()) / DAY);
}
