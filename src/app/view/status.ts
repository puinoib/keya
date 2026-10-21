/**
 * Presentation-level status helpers.
 *
 * Expiry verdicts come from the view, which derives them with the core rules in
 * the device's time zone; this module only turns them into copy.
 */

const DAY = 24 * 60 * 60 * 1000;

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'none';
export type ConnectionStatusLabel =
  | 'Verified'
  | 'Reachable'
  | 'Failed'
  | 'Untested';

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
