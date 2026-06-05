import type { ApiKey, InboxItem, KeyaDatabase } from './types';
import { EXPIRY_REMINDER_DAYS } from './types';

export interface ExpiryAlert {
  type: InboxItem['type'];
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

// Derive dedupe_key from type + entity_id (stable across syncs)
function dedupeKeyOf(type: InboxItem['type'], entityId: string): string {
  return `expiry:${type}:${entityId}`;
}

export function collectExpiryAlerts(
  keys: ApiKey[],
  _vaultId: string,
  now = new Date(),
  reminderDays = EXPIRY_REMINDER_DAYS
): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = [];

  for (const key of keys) {
    if (!key.expires_at) continue;
    const daysUntilExpiry = getDaysUntilExpiry(key.expires_at, now);
    if (daysUntilExpiry == null) continue;

    if (daysUntilExpiry < 0) {
      alerts.push({
        type: 'key_expiry_expired',
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
        type: 'key_expiry_upcoming',
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
  nowIso: string
): InboxItem {
  return {
    id: crypto.randomUUID(),
    type: alert.type,
    entity_id: alert.entityId,
    status: 'open',
    archive_reason: null,
    created_at: nowIso,
    updated_at: nowIso,
    archived_at: null,
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

  const alertsByKey = new Map(
    alerts.map((alert) => [dedupeKeyOf(alert.type, alert.entityId), alert])
  );
  const nextItems = db.inbox.map((item) => ({
    ...item,
    metadata: { ...item.metadata },
  }));

  for (const item of nextItems) {
    const itemKey = dedupeKeyOf(item.type, item.entity_id);
    const matchingAlert = alertsByKey.get(itemKey);

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

    alertsByKey.delete(itemKey);

    if (item.status === 'archived') {
      summary.unchanged.push(item);
      continue;
    }

    const changed =
      item.metadata.days_until_expiry !==
        matchingAlert.metadata.days_until_expiry ||
      item.metadata.expires_at !== matchingAlert.metadata.expires_at;

    item.updated_at = nowIso;
    item.metadata = matchingAlert.metadata;

    if (changed) summary.updated.push(item);
    else summary.unchanged.push(item);
  }

  for (const alert of alertsByKey.values()) {
    const newItem = buildInboxItem(alert, nowIso);
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
