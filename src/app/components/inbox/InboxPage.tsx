import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Archive,
  Warning,
  ClockAfternoon,
  ShieldWarning,
  Lightning,
  Question,
  Timer,
} from '@phosphor-icons/react';
import type { InboxItem, InboxItemType } from '@/core/types';
import { Button } from '@/components/ui/button';
import { useStore } from '../../store/useStore';
import { cn } from '@/lib/utils';
import { formatInboxItemTime } from '../../lib/inbox';

type Severity = 'critical' | 'warning' | 'info';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function getSeverity(item: InboxItem): Severity {
  switch (item.type) {
    case 'key_expiry_expired':
    case 'connection_failed':
    case 'insecure_endpoint':
      return 'critical';
    case 'key_expiry_upcoming':
    case 'never_tested':
      return 'warning';
    case 'stale_test':
      return 'info';
  }
}

const TYPE_BADGE: Record<InboxItemType, { label: string; icon: typeof Warning }> = {
  key_expiry_expired: { label: 'Expired', icon: Warning },
  key_expiry_upcoming: { label: 'Upcoming', icon: ClockAfternoon },
  connection_failed: { label: 'Failed', icon: Lightning },
  never_tested: { label: 'Untested', icon: Question },
  insecure_endpoint: { label: 'Insecure', icon: ShieldWarning },
  stale_test: { label: 'Stale', icon: Timer },
};

function getTitle(item: InboxItem): string {
  const { key_name } = item.metadata;
  switch (item.type) {
    case 'key_expiry_expired':
      return `${key_name} has expired`;
    case 'key_expiry_upcoming':
      return `${key_name} expires soon`;
    case 'connection_failed':
      return `${key_name} connection failed`;
    case 'never_tested':
      return `${key_name} has never been tested`;
    case 'insecure_endpoint':
      return `${key_name} uses an insecure endpoint`;
    case 'stale_test':
      return `${key_name} test result is outdated`;
  }
}

function getBody(item: InboxItem): string {
  const { provider, days_until_expiry, error_message, endpoint, days_since_test } =
    item.metadata;
  switch (item.type) {
    case 'key_expiry_expired': {
      const overdue = Math.abs(days_until_expiry ?? 0);
      return overdue === 1
        ? `${provider} key expired yesterday. Review or replace it soon.`
        : `${provider} key expired ${overdue} days ago. Review or replace it soon.`;
    }
    case 'key_expiry_upcoming': {
      const days = days_until_expiry ?? 0;
      return days === 0
        ? `${provider} key expires today. Make sure the replacement is ready.`
        : `${provider} key expires in ${days} days. Plan a rotation before it stops working.`;
    }
    case 'connection_failed':
      return error_message
        ? `${provider} key failed to connect: ${error_message}. Test again or check the key value.`
        : `${provider} key failed to connect. Test again or check the key value.`;
    case 'never_tested':
      return `${provider} key has never been tested. Run a connectivity test to verify it works.`;
    case 'insecure_endpoint':
      return `${provider} key is using an insecure HTTP endpoint (${endpoint}). Switch to HTTPS to protect your key in transit.`;
    case 'stale_test': {
      const days = days_since_test ?? 0;
      return `${provider} key was last tested ${days} days ago. The result may no longer be reliable.`;
    }
  }
}

function getMetaItems(item: InboxItem): { label: string; value: string }[] {
  const { provider } = item.metadata;
  const meta: { label: string; value: string }[] = [
    { label: 'Provider', value: provider },
  ];

  switch (item.type) {
    case 'key_expiry_expired':
    case 'key_expiry_upcoming':
      meta.push({ label: 'Expires', value: formatInboxItemTime(item) });
      break;
    case 'connection_failed':
      if (item.metadata.checked_at) {
        meta.push({
          label: 'Last tested',
          value: new Intl.DateTimeFormat('en', {
            month: 'short',
            day: 'numeric',
          }).format(new Date(item.metadata.checked_at)),
        });
      }
      break;
    case 'stale_test':
      if (item.metadata.checked_at) {
        meta.push({
          label: 'Last tested',
          value: new Intl.DateTimeFormat('en', {
            month: 'short',
            day: 'numeric',
          }).format(new Date(item.metadata.checked_at)),
        });
      }
      break;
    case 'insecure_endpoint':
      meta.push({ label: 'Endpoint', value: item.metadata.endpoint ?? '' });
      break;
  }

  meta.push({ label: 'Key', value: item.metadata.key_name });
  return meta;
}

const SEVERITY_STYLES: Record<Severity, { badge: string; tone: 'default' | 'critical' }> = {
  critical: {
    badge: 'bg-danger/10 text-danger',
    tone: 'critical',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    tone: 'default',
  },
  info: {
    badge: 'bg-ink-quaternary/10 text-ink-tertiary',
    tone: 'default',
  },
};

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'critical';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        tone === 'critical'
          ? 'border-danger/30 bg-danger/5'
          : 'border-line-subtle bg-surface-2/70'
      )}
    >
      <div className="text-xs text-ink-quaternary">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink-primary tabular-nums">
        {value}
      </div>
    </div>
  );
}

export function InboxPage() {
  const navigate = useNavigate();
  const db = useStore((s) => s.db);
  const archiveInboxItem = useStore((s) => s.archiveInboxItem);
  const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);
  const clearFilters = useStore((s) => s.clearFilters);
  const setSearchQuery = useStore((s) => s.setSearchQuery);

  const items = db?.getInboxItems() ?? [];
  const openItems = useMemo(() => {
    const open = items.filter((item) => item.status === 'open');
    return open.sort((a, b) => {
      const sa = SEVERITY_ORDER[getSeverity(a)];
      const sb = SEVERITY_ORDER[getSeverity(b)];
      if (sa !== sb) return sa - sb;
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [items]);
  const archivedItems = useMemo(
    () => items.filter((item) => item.status === 'archived'),
    [items]
  );
  const criticalCount = openItems.filter(
    (item) => getSeverity(item) === 'critical'
  ).length;

  return (
    <div className="w-full px-6 py-6">
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
        Inbox
      </h1>

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <MetricCard label="Open" value={openItems.length} />
        <MetricCard label="Critical" value={criticalCount} tone="critical" />
        <MetricCard label="Archived" value={archivedItems.length} />
      </div>

      <section className="rounded-2xl border border-line-subtle bg-surface-2/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line-subtle">
          <div>
            <h2 className="text-sm font-semibold text-ink-primary">
              Open reminders
            </h2>
            <p className="text-xs text-ink-quaternary mt-0.5">
              Archive a reminder after you have handled or acknowledged it.
            </p>
          </div>
          <span className="text-xs tabular-nums text-ink-quaternary">
            {openItems.length}
          </span>
        </div>

        {openItems.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-quaternary">
              <Archive className="size-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-ink-primary">
              Inbox is clear
            </p>
            <p className="mt-1 text-xs text-ink-quaternary">
              No persistent reminders need attention right now.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line-subtle">
            {openItems.map((item) => {
              const severity = getSeverity(item);
              const badge = TYPE_BADGE[item.type];
              const style = SEVERITY_STYLES[severity];
              const BadgeIcon = badge.icon;
              return (
                <article key={item.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                            style.badge
                          )}
                        >
                          <BadgeIcon className="size-3" />
                          {badge.label}
                        </span>
                        <h3 className="text-sm font-medium text-ink-primary">
                          {getTitle(item)}
                        </h3>
                      </div>

                      <p className="mt-2 text-sm text-ink-secondary">
                        {getBody(item)}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-quaternary">
                        {getMetaItems(item).map((m) => (
                          <span key={m.label}>
                            {m.label}: {m.value}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          clearFilters();
                          setSearchQuery('');
                          setSelectedKeyId(item.entity_id);
                          navigate({ to: '/keys' });
                        }}
                      >
                        View key
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => archiveInboxItem(item.id)}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {archivedItems.length > 0 && (
        <section className="mt-6 rounded-2xl border border-line-subtle bg-surface-2/20 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line-subtle">
            <h2 className="text-sm font-semibold text-ink-primary">Archived</h2>
            <span className="text-xs tabular-nums text-ink-quaternary">
              {archivedItems.length}
            </span>
          </div>
          <div className="divide-y divide-line-subtle">
            {archivedItems.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 text-sm text-ink-tertiary flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div>{getTitle(item)}</div>
                  <div className="mt-1 text-xs text-ink-quaternary">
                    {item.archive_reason === 'resolved'
                      ? 'Archived automatically after the issue was resolved'
                      : 'Archived by you'}
                  </div>
                </div>
                <div className="text-xs text-ink-quaternary">
                  {item.archived_at
                    ? new Intl.DateTimeFormat('en', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }).format(new Date(item.archived_at))
                    : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
