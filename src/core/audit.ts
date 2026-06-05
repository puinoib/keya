import type { ApiKey, Group } from './types';
import { EXPIRY_REMINDER_DAYS } from './types';

export type VaultAuditSeverity = 'critical' | 'warning' | 'suggestion';
export type VaultAuditActionFilter = {
  provider?: string;
  groupId?: string;
  testStatus?: ApiKey['connection_check']['status'];
  expiryStatus?: 'expired' | 'expiring' | 'valid';
  keyId?: string;
};

export interface VaultAuditCheck {
  id: string;
  severity: VaultAuditSeverity;
  title: string;
  description: string;
  affectedKeyIds: string[];
  action?: {
    label: string;
    filter: VaultAuditActionFilter;
  };
}

export interface VaultAuditReport {
  score: number;
  summary: Record<VaultAuditSeverity, number>;
  checks: VaultAuditCheck[];
  metrics: {
    totalKeys: number;
    providerCount: number;
    failedTests: number;
    expiringSoon: number;
    ungrouped: number;
  };
  charts: {
    providerDistribution: Array<{
      provider: string;
      count: number;
      percentage: number;
    }>;
    connectionHealth: {
      success: number;
      failed: number;
      untested: number;
    };
    expiryBreakdown: {
      expired: number;
      expiringSoon: number;
      valid: number;
      noExpiry: number;
    };
    groupCoverage: {
      grouped: number;
      ungrouped: number;
    };
  };
}

type KeyWithDays = ApiKey & { daysUntilExpiry: number };

const DAY_MS = 1000 * 60 * 60 * 24;
const STALE_TEST_DAYS = 30;
const STALE_UPDATE_DAYS = 90;

function getDaysUntil(dateString: string | null | undefined, now: Date) {
  if (!dateString) return null;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - now.getTime()) / DAY_MS);
}

function getDaysSince(dateString: string | null | undefined, now: Date) {
  if (!dateString) return null;
  const time = new Date(dateString).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((now.getTime() - time) / DAY_MS);
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function hostFromEndpoint(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return null;
  }
}

function hasPlaceholderEndpoint(endpoint: string) {
  const normalized = endpoint.toLowerCase();
  return (
    normalized.includes('your_resource') ||
    normalized.includes('example.com') ||
    normalized.includes('localhost') ||
    normalized.includes('replace') ||
    normalized.includes('placeholder')
  );
}

function addCheck(checks: VaultAuditCheck[], check: VaultAuditCheck) {
  if (check.affectedKeyIds.length > 0) checks.push(check);
}

function summarize(checks: VaultAuditCheck[]) {
  return checks.reduce<Record<VaultAuditSeverity, number>>(
    (acc, check) => {
      acc[check.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, suggestion: 0 }
  );
}

function calculateScore(checks: VaultAuditCheck[], totalKeys: number) {
  if (totalKeys === 0) return 100;

  const penalty = checks.reduce((sum, check) => {
    const affectedWeight = Math.min(check.affectedKeyIds.length, 10);
    const base =
      check.severity === 'critical' ? 18 : check.severity === 'warning' ? 8 : 3;
    return sum + base + affectedWeight;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

function sortChecks(checks: VaultAuditCheck[]) {
  const severityRank: Record<VaultAuditSeverity, number> = {
    critical: 0,
    warning: 1,
    suggestion: 2,
  };

  return [...checks].sort((a, b) => {
    const severityDiff = severityRank[a.severity] - severityRank[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.affectedKeyIds.length - a.affectedKeyIds.length;
  });
}

function percentage(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

export function auditVault(input: {
  keys: ApiKey[];
  groups: Group[];
  now?: Date;
}): VaultAuditReport {
  const now = input.now ?? new Date();
  const keys = input.keys;
  const checks: VaultAuditCheck[] = [];
  const groupIds = new Set(input.groups.map((group) => group.id));

  const expired = keys
    .map((key) => ({
      ...key,
      daysUntilExpiry: getDaysUntil(key.expires_at, now),
    }))
    .filter((key): key is KeyWithDays => key.daysUntilExpiry !== null)
    .filter((key) => key.daysUntilExpiry < 0);

  const expiringSoon = keys
    .map((key) => ({
      ...key,
      daysUntilExpiry: getDaysUntil(key.expires_at, now),
    }))
    .filter((key): key is KeyWithDays => key.daysUntilExpiry !== null)
    .filter(
      (key) =>
        key.daysUntilExpiry >= 0 && key.daysUntilExpiry <= EXPIRY_REMINDER_DAYS
    );

  const noExpiry = keys.filter((key) => !key.expires_at);
  const validExpiry = keys.filter((key) => {
    const days = getDaysUntil(key.expires_at, now);
    return days !== null && days > EXPIRY_REMINDER_DAYS;
  });
  const failedTests = keys.filter(
    (key) => key.connection_check?.status === 'failed'
  );
  const successfulTests = keys.filter(
    (key) => key.connection_check?.status === 'success'
  );
  const neverTested = keys.filter(
    (key) =>
      !key.connection_check?.checked_at ||
      key.connection_check.status === 'untested'
  );
  const staleTests = keys.filter((key) => {
    if (!key.connection_check?.checked_at) return false;
    const days = getDaysSince(key.connection_check.checked_at, now);
    return days !== null && days >= STALE_TEST_DAYS;
  });
  const staleUpdates = keys.filter((key) => {
    const days = getDaysSince(key.updated_at, now);
    return days !== null && days >= STALE_UPDATE_DAYS;
  });
  const ungrouped = keys.filter(
    (key) => !key.group_id || !groupIds.has(key.group_id)
  );
  const insecureEndpoints = keys.filter((key) =>
    key.endpoint.trim().toLowerCase().startsWith('http://')
  );
  const invalidEndpoints = keys.filter(
    (key) => key.endpoint.trim() !== '' && !hostFromEndpoint(key.endpoint)
  );
  const placeholderEndpoints = keys.filter((key) =>
    hasPlaceholderEndpoint(key.endpoint)
  );

  addCheck(checks, {
    id: 'expired-keys',
    severity: 'critical',
    title: `${plural(expired.length, 'key')} expired`,
    description:
      'Expired API keys may already be unusable and should be rotated or removed.',
    affectedKeyIds: expired.map((key) => key.id),
    action: {
      label: 'Show expired keys',
      filter: { expiryStatus: 'expired' },
    },
  });

  addCheck(checks, {
    id: 'failed-tests',
    severity: 'critical',
    title: `${plural(failedTests.length, 'key')} failed the latest test`,
    description:
      'These keys did not pass the last connectivity check. Review their endpoint, provider, and permissions.',
    affectedKeyIds: failedTests.map((key) => key.id),
    action: {
      label: 'Show failed keys',
      filter: { testStatus: 'failed' },
    },
  });

  addCheck(checks, {
    id: 'insecure-endpoints',
    severity: 'critical',
    title: `${plural(insecureEndpoints.length, 'key')} uses an insecure endpoint`,
    description:
      'HTTP endpoints can leak API keys in transit. Prefer HTTPS endpoints whenever possible.',
    affectedKeyIds: insecureEndpoints.map((key) => key.id),
  });

  addCheck(checks, {
    id: 'expiring-soon',
    severity: 'warning',
    title: `${plural(expiringSoon.length, 'key')} expires within ${EXPIRY_REMINDER_DAYS} days`,
    description: 'Plan rotation before these keys stop working.',
    affectedKeyIds: expiringSoon.map((key) => key.id),
    action: {
      label: 'Show expiring keys',
      filter: { expiryStatus: 'expiring' },
    },
  });

  addCheck(checks, {
    id: 'no-expiry',
    severity: 'warning',
    title: `${plural(noExpiry.length, 'key')} has no expiry date`,
    description:
      'Expiry dates make rotation visible and reduce the chance of forgotten long-lived credentials.',
    affectedKeyIds: noExpiry.map((key) => key.id),
  });

  addCheck(checks, {
    id: 'never-tested',
    severity: 'warning',
    title: `${plural(neverTested.length, 'key')} has never been tested`,
    description:
      'Untested keys may be stale, revoked, or pointing at the wrong endpoint.',
    affectedKeyIds: neverTested.map((key) => key.id),
    action: {
      label: 'Show untested keys',
      filter: { testStatus: 'untested' },
    },
  });

  addCheck(checks, {
    id: 'stale-tests',
    severity: 'suggestion',
    title: `${plural(staleTests.length, 'key')} has not been tested in ${STALE_TEST_DAYS}+ days`,
    description:
      'Run a fresh connectivity check to make sure these credentials still work.',
    affectedKeyIds: staleTests.map((key) => key.id),
  });

  addCheck(checks, {
    id: 'stale-updates',
    severity: 'suggestion',
    title: `${plural(staleUpdates.length, 'key')} has not changed in ${STALE_UPDATE_DAYS}+ days`,
    description:
      'Older credentials may need a rotation review, especially for production services.',
    affectedKeyIds: staleUpdates.map((key) => key.id),
  });

  addCheck(checks, {
    id: 'ungrouped-keys',
    severity: 'suggestion',
    title: `${plural(ungrouped.length, 'key')} is ungrouped`,
    description:
      'Grouping keys by environment or project makes ownership and review easier.',
    affectedKeyIds: ungrouped.map((key) => key.id),
    action: {
      label: 'Show ungrouped keys',
      filter: { groupId: '__ungrouped__' },
    },
  });

  addCheck(checks, {
    id: 'invalid-endpoints',
    severity: 'suggestion',
    title: `${plural(invalidEndpoints.length, 'key')} has an invalid endpoint`,
    description:
      'Malformed endpoints can make connectivity tests fail or hit an unintended target.',
    affectedKeyIds: invalidEndpoints.map((key) => key.id),
  });

  addCheck(checks, {
    id: 'placeholder-endpoints',
    severity: 'suggestion',
    title: `${plural(placeholderEndpoints.length, 'key')} uses a placeholder endpoint`,
    description:
      'Replace example or placeholder URLs before relying on these keys.',
    affectedKeyIds: placeholderEndpoints.map((key) => key.id),
  });

  const providerCounts = new Map<string, number>();
  for (const key of keys) {
    const provider = key.provider.trim() || 'Custom';
    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);
  }
  const concentratedProvider = [...providerCounts.entries()].find(
    ([, count]) => keys.length >= 5 && count / keys.length >= 0.6
  );
  if (concentratedProvider) {
    const [provider, count] = concentratedProvider;
    checks.push({
      id: 'provider-concentration',
      severity: 'suggestion',
      title: `${provider} contains ${Math.round((count / keys.length) * 100)}% of this vault`,
      description:
        'High provider concentration may be fine, but it is worth reviewing dependency and fallback plans.',
      affectedKeyIds: keys
        .filter((key) => (key.provider.trim() || 'Custom') === provider)
        .map((key) => key.id),
      action: {
        label: `Show ${provider} keys`,
        filter: { provider },
      },
    });
  }

  const sortedChecks = sortChecks(checks);
  const summary = summarize(sortedChecks);
  const providerDistribution = [...providerCounts.entries()]
    .map(([provider, count]) => ({
      provider,
      count,
      percentage: percentage(count, keys.length),
    }))
    .sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));

  return {
    score: calculateScore(sortedChecks, keys.length),
    summary,
    checks: sortedChecks,
    metrics: {
      totalKeys: keys.length,
      providerCount: providerCounts.size,
      failedTests: failedTests.length,
      expiringSoon: expiringSoon.length,
      ungrouped: ungrouped.length,
    },
    charts: {
      providerDistribution,
      connectionHealth: {
        success: successfulTests.length,
        failed: failedTests.length,
        untested: neverTested.length,
      },
      expiryBreakdown: {
        expired: expired.length,
        expiringSoon: expiringSoon.length,
        valid: validExpiry.length,
        noExpiry: noExpiry.length,
      },
      groupCoverage: {
        grouped: keys.length - ungrouped.length,
        ungrouped: ungrouped.length,
      },
    },
  };
}
