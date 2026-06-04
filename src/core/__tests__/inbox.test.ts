import { describe, expect, it } from 'vitest';
import { Database } from '../database';
import { collectExpiryAlerts, syncInboxWithAlerts } from '../inbox';

describe('inbox reminders', () => {
  it('creates one upcoming reminder per expiring key', () => {
    const db = new Database();
    db.addApiKey({
      name: 'OpenAI Prod',
      key: 'sk-test',
      description: '',
      provider: 'OpenAI',
      endpoint: 'https://api.openai.com/v1',
      group_id: null,
      expires_at: '2026-06-10T00:00:00.000Z',
      last_tested: null,
      test_status: null,
      test_latency_ms: null,
    });

    const alerts = collectExpiryAlerts(
      db.getApiKeys(),
      db.getData().vault_id,
      new Date('2026-06-04T09:00:00.000Z')
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('key_expiry_upcoming');
    expect(alerts[0]?.metadata.days_until_expiry).toBe(6);
  });

  it('does not duplicate reminders across repeated checks', () => {
    const db = new Database();
    const key = db.addApiKey({
      name: 'Anthropic Prod',
      key: 'sk-ant',
      description: '',
      provider: 'Anthropic',
      endpoint: 'https://api.anthropic.com',
      group_id: null,
      expires_at: '2026-06-09T00:00:00.000Z',
      last_tested: null,
      test_status: null,
      test_latency_ms: null,
    });

    const now = new Date('2026-06-04T09:00:00.000Z');
    const first = syncInboxWithAlerts(
      db.getData(),
      collectExpiryAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );
    const second = syncInboxWithAlerts(
      db.getData(),
      collectExpiryAlerts(db.getApiKeys(), db.getData().vault_id, now),
      now
    );

    expect(first.added).toHaveLength(1);
    expect(second.added).toHaveLength(0);
    expect(db.getOpenInboxItems()).toHaveLength(1);
    expect(db.getOpenInboxItems()[0]?.entity_id).toBe(key.id);
  });

  it('archives reminder automatically when expiry issue is resolved', () => {
    const db = new Database();
    const key = db.addApiKey({
      name: 'Groq Sandbox',
      key: 'sk-groq',
      description: '',
      provider: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1',
      group_id: null,
      expires_at: '2026-06-06T00:00:00.000Z',
      last_tested: null,
      test_status: null,
      test_latency_ms: null,
    });
    const initialNow = new Date('2026-06-04T09:00:00.000Z');

    syncInboxWithAlerts(
      db.getData(),
      collectExpiryAlerts(db.getApiKeys(), db.getData().vault_id, initialNow),
      initialNow
    );

    db.updateApiKey(key.id, {
      expires_at: '2026-07-20T00:00:00.000Z',
    });

    const resolved = syncInboxWithAlerts(
      db.getData(),
      collectExpiryAlerts(
        db.getApiKeys(),
        db.getData().vault_id,
        new Date('2026-06-05T09:00:00.000Z')
      ),
      new Date('2026-06-05T09:00:00.000Z')
    );

    expect(resolved.archived).toHaveLength(1);
    expect(db.getInboxItems()[0]?.archive_reason).toBe('resolved');
  });
});
