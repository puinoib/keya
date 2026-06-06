import { describe, expect, it } from 'vitest';
import { Database } from '../database';
import {
  collectExpiryAlerts,
  collectConnectionAlerts,
  collectAllAlerts,
  syncInboxWithAlerts,
} from '../inbox';

function makeKey(overrides: Partial<{
  name: string;
  provider: string;
  endpoint: string;
  expires_at: string | null;
  connection_check: {
    status: 'success' | 'failed' | 'untested';
    checked_at: string | null;
    latency_ms: number | null;
    error_message: string | null;
  };
}> = {}) {
  return {
    name: overrides.name ?? 'Test Key',
    key: `sk-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    provider: overrides.provider ?? 'OpenAI',
    endpoint: overrides.endpoint ?? 'https://api.openai.com/v1',
    group_id: null as string | null,
    expires_at: overrides.expires_at ?? null,
    connection_check: overrides.connection_check ?? {
      status: 'untested' as const,
      checked_at: null,
      latency_ms: null,
      error_message: null,
    },
  };
}

describe('expiry alerts', () => {
  it('creates one upcoming reminder per expiring key', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      name: 'OpenAI Prod',
      expires_at: '2026-06-10T00:00:00.000Z',
    }));

    const alerts = collectExpiryAlerts(
      db.getApiKeys(),
      db.getData().vault_id,
      new Date('2026-06-04T09:00:00.000Z')
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('key_expiry_upcoming');
    expect(alerts[0]?.metadata.days_until_expiry).toBe(6);
  });

  it('creates expired reminder for past-due keys', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      expires_at: '2026-06-01T00:00:00.000Z',
    }));

    const alerts = collectExpiryAlerts(
      db.getApiKeys(),
      db.getData().vault_id,
      new Date('2026-06-04T09:00:00.000Z')
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('key_expiry_expired');
  });
});

describe('connection alerts', () => {
  it('creates alert for failed connection', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      connection_check: {
        status: 'failed',
        checked_at: '2026-06-05T09:00:00.000Z',
        latency_ms: null,
        error_message: 'Invalid API key',
      },
    }));

    const alerts = collectConnectionAlerts(db.getApiKeys());

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('connection_failed');
    expect(alerts[0]?.metadata.error_message).toBe('Invalid API key');
  });

  it('creates alert for never-tested keys', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      connection_check: {
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
      },
    }));

    const alerts = collectConnectionAlerts(db.getApiKeys());

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('never_tested');
  });

  it('creates alert for insecure http:// endpoint', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      endpoint: 'http://insecure.example.com/v1',
      connection_check: {
        status: 'success',
        checked_at: '2026-06-05T09:00:00.000Z',
        latency_ms: 120,
        error_message: null,
      },
    }));

    const alerts = collectConnectionAlerts(db.getApiKeys());

    const insecure = alerts.find((a) => a.type === 'insecure_endpoint');
    expect(insecure).toBeDefined();
    expect(insecure?.metadata.endpoint).toBe('http://insecure.example.com/v1');
  });

  it('creates alert for stale test (30+ days)', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      connection_check: {
        status: 'success',
        checked_at: '2026-04-01T09:00:00.000Z',
        latency_ms: 100,
        error_message: null,
      },
    }));

    const alerts = collectConnectionAlerts(
      db.getApiKeys(),
      new Date('2026-06-05T09:00:00.000Z')
    );

    const stale = alerts.find((a) => a.type === 'stale_test');
    expect(stale).toBeDefined();
    expect(stale?.metadata.days_since_test).toBeGreaterThanOrEqual(30);
  });

  it('does not create stale alert for recent test', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      connection_check: {
        status: 'success',
        checked_at: '2026-06-01T09:00:00.000Z',
        latency_ms: 100,
        error_message: null,
      },
    }));

    const alerts = collectConnectionAlerts(
      db.getApiKeys(),
      new Date('2026-06-05T09:00:00.000Z')
    );

    expect(alerts.find((a) => a.type === 'stale_test')).toBeUndefined();
  });

  it('does not create connection_failed or stale_test for untested keys', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      connection_check: {
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
      },
    }));

    const alerts = collectConnectionAlerts(db.getApiKeys());

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('never_tested');
  });

  it('skips alerts for healthy keys', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      connection_check: {
        status: 'success',
        checked_at: '2026-06-04T09:00:00.000Z',
        latency_ms: 100,
        error_message: null,
      },
    }));

    const alerts = collectConnectionAlerts(
      db.getApiKeys(),
      new Date('2026-06-05T09:00:00.000Z')
    );

    expect(alerts).toHaveLength(0);
  });
});

describe('collectAllAlerts', () => {
  it('combines expiry and connection alerts', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      expires_at: '2026-06-01T00:00:00.000Z',
      connection_check: {
        status: 'failed',
        checked_at: '2026-06-05T09:00:00.000Z',
        latency_ms: null,
        error_message: 'Unauthorized',
      },
    }));

    const alerts = collectAllAlerts(
      db.getApiKeys(),
      db.getData().vault_id,
      new Date('2026-06-05T09:00:00.000Z')
    );

    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.type)).toContain('key_expiry_expired');
    expect(alerts.map((a) => a.type)).toContain('connection_failed');
  });
});

describe('sync', () => {
  it('does not duplicate reminders across repeated checks', () => {
    const db = new Database();
    db.addApiKey(makeKey({
      name: 'Anthropic Prod',
      expires_at: '2026-06-09T00:00:00.000Z',
    }));

    const now = new Date('2026-06-04T09:00:00.000Z');
    const first = syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );
    const second = syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    expect(first.added.length).toBeGreaterThanOrEqual(1);
    expect(second.added).toHaveLength(0);
  });

  it('archives expiry reminder when issue is resolved', () => {
    const db = new Database();
    const key = db.addApiKey(makeKey({
      expires_at: '2026-06-06T00:00:00.000Z',
    }));
    const now = new Date('2026-06-04T09:00:00.000Z');

    syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    db.updateApiKey(key.id, { expires_at: '2026-07-20T00:00:00.000Z' });

    const resolved = syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    expect(resolved.archived.length).toBeGreaterThanOrEqual(1);
    expect(db.getInboxItems().find((i) => i.entity_id === key.id && i.type === 'key_expiry_upcoming')?.archive_reason).toBe('resolved');
  });

  it('archives connection_failed when key passes test', () => {
    const db = new Database();
    const key = db.addApiKey(makeKey({
      connection_check: {
        status: 'failed',
        checked_at: '2026-06-05T09:00:00.000Z',
        latency_ms: null,
        error_message: 'Unauthorized',
      },
    }));

    const now = new Date('2026-06-05T09:00:00.000Z');
    syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    // Simulate passing test
    db.updateApiKey(key.id, {
      connection_check: {
        status: 'success',
        checked_at: '2026-06-05T10:00:00.000Z',
        latency_ms: 100,
        error_message: null,
      },
    });

    const resolved = syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    expect(resolved.archived.length).toBeGreaterThanOrEqual(1);
    const item = db.getInboxItems().find((i) => i.entity_id === key.id && i.type === 'connection_failed');
    expect(item?.archive_reason).toBe('resolved');
  });

  it('archives insecure_endpoint when endpoint is fixed', () => {
    const db = new Database();
    const key = db.addApiKey(makeKey({
      endpoint: 'http://insecure.example.com/v1',
      connection_check: {
        status: 'success',
        checked_at: '2026-06-05T09:00:00.000Z',
        latency_ms: 100,
        error_message: null,
      },
    }));

    const now = new Date('2026-06-05T09:00:00.000Z');
    syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    db.updateApiKey(key.id, { endpoint: 'https://secure.example.com/v1' });

    syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    const item = db.getInboxItems().find((i) => i.entity_id === key.id && i.type === 'insecure_endpoint');
    expect(item?.archive_reason).toBe('resolved');
  });

  it('archives never_tested when key gets tested', () => {
    const db = new Database();
    const key = db.addApiKey(makeKey({
      connection_check: {
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
      },
    }));

    const now = new Date('2026-06-05T09:00:00.000Z');
    syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    db.updateApiKey(key.id, {
      connection_check: {
        status: 'success',
        checked_at: '2026-06-05T10:00:00.000Z',
        latency_ms: 100,
        error_message: null,
      },
    });

    syncInboxWithAlerts(
      db.getData(),
      collectAllAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    const item = db.getInboxItems().find((i) => i.entity_id === key.id && i.type === 'never_tested');
    expect(item?.archive_reason).toBe('resolved');
  });
});
