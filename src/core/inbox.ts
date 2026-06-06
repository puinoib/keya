import type { ApiKey, InboxItem, InboxItemMetadata, KeyaDatabase } from './types';
import { EXPIRY_REMINDER_DAYS } from './types';

export interface Alert {
  type: InboxItem['type'];
  entityId: string;
  metadata: InboxItemMetadata;
}

export interface InboxSyncSummary {
  added: InboxItem[];
  updated: InboxItem[];
  archived: InboxItem[];
  unchanged: InboxItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_TEST_DAYS = 30;

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

function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((now.getTime() - d.getTime()) / DAY_MS);
}

// Dedupe key from type + entity_id (stable across syncs)
function dedupeKeyOf(type: InboxItem['type'], entityId: string): string {
  return `${type}:${entityId}`;
}

// ── Expiry alerts ──

export function collectExpiryAlerts(
  keys: ApiKey[],
  _vaultId: string,
  now = new Date(),
  reminderDays = EXPIRY_REMINDER_DAYS
): Alert[] {
  const alerts: Alert[] = [];

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

// ── Connection alerts ──

export function collectConnectionAlerts(
  keys: ApiKey[],
  now = new Date()
): Alert[] {
  const alerts: Alert[] = [];

  for (const key of keys) {
    // Insecure endpoint (http://)
    if (key.endpoint.startsWith('http://')) {
      alerts.push({
        type: 'insecure_endpoint',
        entityId: key.id,
        metadata: {
          key_name: key.name,
          provider: key.provider,
          endpoint: key.endpoint,
        },
      });
    }

    const check = key.connection_check;

    // Never tested
    if (!check.checked_at || check.status === 'untested') {
      alerts.push({
        type: 'never_tested',
        entityId: key.id,
        metadata: {
          key_name: key.name,
          provider: key.provider,
        },
      });
      continue; // skip stale/failed checks for untested keys
    }

    // Connection failed
    if (check.status === 'failed') {
      alerts.push({
        type: 'connection_failed',
        entityId: key.id,
        metadata: {
          key_name: key.name,
          provider: key.provider,
          checked_at: check.checked_at,
          error_message: check.error_message,
        },
      });
    }

    // Stale test (30+ days)
    if (check.checked_at && daysBetween(check.checked_at, now) >= STALE_TEST_DAYS) {
      alerts.push({
        type: 'stale_test',
        entityId: key.id,
        metadata: {
          key_name: key.name,
          provider: key.provider,
          checked_at: check.checked_at,
          days_since_test: daysBetween(check.checked_at, now),
        },
      });
    }
  }

  return alerts;
}

// ── Combined ──

export function collectAllAlerts(
  keys: ApiKey[],
  vaultId: string,
  now = new Date()
): Alert[] {
  return [
    ...collectExpiryAlerts(keys, vaultId, now),
    ...collectConnectionAlerts(keys, now),
  ];
}

// ── Sync ──

function buildInboxItem(alert: Alert, nowIso: string): InboxItem {
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
  alerts: Alert[],
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
      // Auto-archive any open item whose alert is gone
      if (item.status === 'open') {
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
      JSON.stringify(item.metadata) !==
      JSON.stringify(matchingAlert.metadata);

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
