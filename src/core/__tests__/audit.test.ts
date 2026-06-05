import { describe, expect, it } from 'vitest';
import { auditVault } from '../audit';
import type { ApiKey, Group } from '../types';

const now = new Date('2026-06-05T00:00:00.000Z');
const group: Group = {
  id: 'group-prod',
  name: 'Production',
  icon: 'P',
  order: 1,
};

function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: crypto.randomUUID(),
    name: 'Test Key',
    description: '',
    provider: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    key: 'sk-test',
    group_id: group.id,
    expires_at: '2026-08-01T00:00:00.000Z',
    connection_check: {
      status: 'success',
      checked_at: '2026-06-01T00:00:00.000Z',
      latency_ms: 120,
      error_message: null,
    },
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('auditVault', () => {
  it('returns a clean report for an empty vault', () => {
    const report = auditVault({ keys: [], groups: [], now });

    expect(report.score).toBe(100);
    expect(report.checks).toHaveLength(0);
    expect(report.metrics.totalKeys).toBe(0);
  });

  it('detects critical expiry, test, and endpoint issues', () => {
    const expired = makeKey({
      id: 'expired',
      expires_at: '2026-06-01T00:00:00.000Z',
    });
    const failed = makeKey({
      id: 'failed',
      connection_check: {
        status: 'failed',
        checked_at: '2026-06-04T00:00:00.000Z',
        latency_ms: null,
        error_message: 'Unauthorized',
      },
    });
    const insecure = makeKey({ id: 'insecure', endpoint: 'http://proxy.test' });

    const report = auditVault({
      keys: [expired, failed, insecure],
      groups: [group],
      now,
    });

    expect(report.summary.critical).toBe(3);
    expect(report.checks.map((check) => check.id)).toContain('expired-keys');
    expect(report.checks.map((check) => check.id)).toContain('failed-tests');
    expect(report.checks.map((check) => check.id)).toContain(
      'insecure-endpoints'
    );
  });

  it('detects expiring, untested, stale, and ungrouped keys', () => {
    const key = makeKey({
      id: 'risky',
      group_id: null,
      expires_at: '2026-06-10T00:00:00.000Z',
      connection_check: {
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
      },
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const report = auditVault({ keys: [key], groups: [group], now });
    const ids = report.checks.map((check) => check.id);

    expect(ids).toContain('expiring-soon');
    expect(ids).toContain('never-tested');
    expect(ids).toContain('stale-updates');
    expect(ids).toContain('ungrouped-keys');
  });

  it('adds a provider concentration suggestion for dominant providers', () => {
    const keys = Array.from({ length: 5 }, (_, index) =>
      makeKey({ id: `openai-${index}`, provider: 'OpenAI' })
    );
    keys.push(makeKey({ id: 'anthropic', provider: 'Anthropic' }));

    const report = auditVault({ keys, groups: [group], now });

    expect(
      report.checks.find((check) => check.id === 'provider-concentration')
    ).toBeTruthy();
    expect(report.metrics.providerCount).toBe(2);
    expect(report.charts.providerDistribution[0]).toEqual({
      provider: 'OpenAI',
      count: 5,
      percentage: 83,
    });
  });

  it('flags placeholder and malformed endpoints', () => {
    const report = auditVault({
      keys: [
        makeKey({
          id: 'placeholder',
          endpoint: 'https://YOUR_RESOURCE.openai.azure.com',
        }),
        makeKey({ id: 'invalid', endpoint: 'not a url' }),
      ],
      groups: [group],
      now,
    });

    expect(report.checks.map((check) => check.id)).toContain(
      'placeholder-endpoints'
    );
    expect(report.checks.map((check) => check.id)).toContain(
      'invalid-endpoints'
    );
  });

  it('builds chart breakdowns from the same audit inputs', () => {
    const failed = makeKey({
      id: 'failed',
      connection_check: {
        status: 'failed',
        checked_at: '2026-06-04T00:00:00.000Z',
        latency_ms: null,
        error_message: 'Unauthorized',
      },
      expires_at: '2026-06-04T00:00:00.000Z',
    });
    const untested = makeKey({
      id: 'untested',
      group_id: null,
      connection_check: {
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
      },
      expires_at: null,
    });
    const success = makeKey({
      id: 'success',
      provider: 'Anthropic',
      expires_at: '2026-06-08T00:00:00.000Z',
    });

    const report = auditVault({
      keys: [failed, untested, success],
      groups: [group],
      now,
    });

    expect(report.charts.connectionHealth).toEqual({
      success: 1,
      failed: 1,
      untested: 1,
    });
    expect(report.charts.expiryBreakdown).toEqual({
      expired: 1,
      expiringSoon: 1,
      valid: 0,
      noExpiry: 1,
    });
    expect(report.charts.groupCoverage).toEqual({
      grouped: 2,
      ungrouped: 1,
    });
  });
});
