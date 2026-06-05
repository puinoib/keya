import { EXPIRY_REMINDER_DAYS, type ApiKey, type ExpiryStatus } from './types';

export function getExpiryStatus(
  expiresAt: string | null | undefined,
  now = new Date()
): ExpiryStatus {
  if (!expiresAt) return 'none';

  const expiresAtDate = new Date(expiresAt);
  const daysUntilExpiry = Math.ceil(
    (expiresAtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= EXPIRY_REMINDER_DAYS) return 'expiring_soon';
  return 'valid';
}

export function getDaysUntilExpiry(
  expiresAt: string | null | undefined,
  now = new Date()
): number | null {
  if (!expiresAt) return null;

  const expiresAtDate = new Date(expiresAt);
  return Math.ceil(
    (expiresAtDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function getConnectionStatusLabel(status: ApiKey['connection_check']['status']): string {
  if (status === 'success') return 'Success';
  if (status === 'failed') return 'Failed';
  return 'Untested';
}

export function getExpiryStatusLabel(status: ExpiryStatus): string | null {
  if (status === 'expired') return 'Expired';
  if (status === 'expiring_soon') return 'Expiring Soon';
  if (status === 'valid') return 'No Expiry Issue';
  return null;
}
