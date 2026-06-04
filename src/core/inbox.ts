import type { ApiKey, InboxItem, KeyaDatabase } from './types';
import { EXPIRY_REMINDER_DAYS } from './types';

export interface ExpiryAlert {
  dedupeKey: string;
  fingerprint: string;
  type: InboxItem['type'];
  title: string;
  body: string;
  severity: InboxItem['severity'];
  entityId: string;
  metadata: InboxItem['metadata'];
}

export interface InboxSyncSummary {
  added: InboxItem[];
  updated: InboxItem[];
  archived: InboxItem[];
  unchanged: InboxItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(iso: string): Date | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

export function getDaysUntilExpiry(
  expiresAt: string,
  now = new Date()
): number | null {
  const expiryDay = parseDateOnly(expiresAt);
  if (!expiryDay) return null;
  const currentDay = startOfDay(now);
  return Math.round((expiryDay.getTime() - currentDay.getTime()) / DAY_MS);
}

export function collectExpiryAlerts(
  keys: ApiKey[],
  vaultId: string,
  now = new Date(),
  reminderDays = EXPIRY_REMINDER_DAYS
): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = [];

  for (const key of keys) {
    if (!key.expires_at) continue;
    const daysUntilExpiry = getDaysUntilExpiry(key.expires_at, now);
    if (daysUntilExpiry == null) continue;

    if (daysUntilExpiry < 0) {
      const overdueDays = Math.abs(daysUntilExpiry);
      alerts.push({
        dedupeKey: `expiry:${vaultId}:${key.id}:expired`,
        fingerprint: `expired:${key.expires_at}`,
        type: 'key_expiry_expired',
        title: `${key.name} has expired`,
        body:
          overdueDays === 1
            ? `${key.provider} key expired yesterday. Review or replace it soon.`
            : `${key.provider} key expired ${overdueDays} days ago. Review or replace it soon.`,
        severity: 'critical',
        entityId: key.id,
        metadata: {
          key_name: key.name,
          provider: key.provider,
          expires_at: key.expires_at,
          days_until_expiry: daysUntilExpiry,
        },
      });
      continue;
    }

    if (daysUntilExpiry <= reminderDays) {
      alerts.push({
        dedupeKey: `expiry:${vaultId}:${key.id}:upcoming`,
        fingerprint: `upcoming:${key.expires_at}`,
        type: 'key_expiry_upcoming',
        title: `${key.name} expires soon`,
        body:
          daysUntilExpiry === 0
            ? `${key.provider} key expires today. Make sure the replacement is ready.`
            : `${key.provider} key expires in ${daysUntilExpiry} days. Plan a rotation before it stops working.`,
        severity: 'warning',
        entityId: key.id,
        metadata: {
          key_name: key.name,
          provider: key.provider,
          expires_at: key.expires_at,
          days_until_expiry: daysUntilExpiry,
        },
      });
    }
  }

  return alerts;
}

function buildInboxItem(
  alert: ExpiryAlert,
  vaultId: string,
  nowIso: string
): InboxItem {
  return {
    id: crypto.randomUUID(),
    type: alert.type,
    title: alert.title,
    body: alert.body,
    severity: alert.severity,
    status: 'open',
    dedupe_key: alert.dedupeKey,
    fingerprint: alert.fingerprint,
    entity_type: 'api_key',
    entity_id: alert.entityId,
    vault_id: vaultId,
    archive_reason: null,
    created_at: nowIso,
    updated_at: nowIso,
    archived_at: null,
    last_detected_at: nowIso,
    metadata: alert.metadata,
  };
}

export function syncInboxWithAlerts(
  db: KeyaDatabase,
  alerts: ExpiryAlert[],
  now = new Date()
): InboxSyncSummary {
  const nowIso = now.toISOString();
  const summary: InboxSyncSummary = {
    added: [],
    updated: [],
    archived: [],
    unchanged: [],
  };

  const alertsByKey = new Map(alerts.map((alert) => [alert.dedupeKey, alert]));
  const nextItems = db.inbox.map((item) => ({
    ...item,
    metadata: { ...item.metadata },
  }));

  for (const item of nextItems) {
    const matchingAlert = alertsByKey.get(item.dedupe_key);

    if (!matchingAlert) {
      const shouldResolve =
        item.type === 'key_expiry_upcoming' ||
        item.type === 'key_expiry_expired';
      if (item.status === 'open' && shouldResolve) {
        item.status = 'archived';
        item.archive_reason = 'resolved';
        item.archived_at = nowIso;
        item.updated_at = nowIso;
        summary.archived.push(item);
      }
      continue;
    }

    alertsByKey.delete(item.dedupe_key);

    if (item.status === 'archived') {
      summary.unchanged.push(item);
      continue;
    }

    const changed =
      item.title !== matchingAlert.title ||
      item.body !== matchingAlert.body ||
      item.severity !== matchingAlert.severity ||
      item.fingerprint !== matchingAlert.fingerprint ||
      item.metadata.days_until_expiry !==
        matchingAlert.metadata.days_until_expiry ||
      item.metadata.expires_at !== matchingAlert.metadata.expires_at;

    item.title = matchingAlert.title;
    item.body = matchingAlert.body;
    item.severity = matchingAlert.severity;
    item.fingerprint = matchingAlert.fingerprint;
    item.last_detected_at = nowIso;
    item.updated_at = nowIso;
    item.metadata = matchingAlert.metadata;

    if (changed) summary.updated.push(item);
    else summary.unchanged.push(item);
  }

  for (const alert of alertsByKey.values()) {
    const newItem = buildInboxItem(alert, db.vault_id, nowIso);
    nextItems.push(newItem);
    summary.added.push(newItem);
  }

  db.inbox = nextItems.sort((a, b) => {
    const archivedDelta =
      Number(a.status === 'archived') - Number(b.status === 'archived');
    if (archivedDelta !== 0) return archivedDelta;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return summary;
}
