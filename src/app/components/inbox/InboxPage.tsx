import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Archive,
  Warning,
  ClockAfternoon,
  ShieldWarning,
  Lightning,
  Question,
  Timer,
  CaretDown,
  X,
} from '@phosphor-icons/react';
import type { InboxItem, InboxItemType } from '@/core/types';
import { Button } from '@/components/ui/button';
import { useStore } from '../../store/useStore';
import { cn } from '@/lib/utils';
import { getProviderLogo } from '@/app/lib/provider-logo';

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

const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  critical: 'bg-danger/10 text-danger',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  info: 'bg-ink-quaternary/10 text-ink-tertiary',
};

function getTitle(item: InboxItem): string {
  return item.metadata.key_name;
}

function getContextSuffix(item: InboxItem): string {
  const { days_until_expiry, error_message, endpoint, days_since_test } =
    item.metadata;
  switch (item.type) {
    case 'key_expiry_expired': {
      const overdue = Math.abs(days_until_expiry ?? 0);
      return overdue === 1 ? 'expired yesterday' : `expired ${overdue} days ago`;
    }
    case 'key_expiry_upcoming': {
      const days = days_until_expiry ?? 0;
      return days === 0 ? 'expires today' : `expires in ${days} days`;
    }
    case 'connection_failed':
      return error_message ?? 'connection failed';
    case 'never_tested':
      return 'never tested';
    case 'insecure_endpoint':
      return endpoint ?? 'insecure endpoint';
    case 'stale_test':
      return `last tested ${days_since_test ?? 0} days ago`;
  }
}

function getArchivedContext(item: InboxItem): string {
  const label = TYPE_BADGE[item.type].label;
  const reason = item.archive_reason === 'resolved' ? 'Resolved' : 'Archived';
  return `${label} · ${reason}`;
}

export function InboxPage() {
  const navigate = useNavigate();
  const db = useStore((s) => s.db);
  const archiveInboxItem = useStore((s) => s.archiveInboxItem);
  const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);
  const clearFilters = useStore((s) => s.clearFilters);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

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

  const handleViewKey = (entityId: string) => {
    clearFilters();
    setSearchQuery('');
    setSelectedKeyId(entityId);
    navigate({ to: '/keys' });
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-semibold tracking-tight text-ink-primary">
          Inbox
        </h1>
        {openItems.length > 0 && (
          <span className="text-xs tabular-nums text-ink-quaternary">
            {openItems.length} open
          </span>
        )}
      </div>

      {openItems.length === 0 ? (
        <div className="py-14 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-quaternary">
            <Archive className="size-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-ink-primary">
            Inbox is clear
          </p>
          <p className="mt-1 text-xs text-ink-quaternary">
            No reminders need attention right now.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-line-subtle bg-surface-2/40 overflow-hidden divide-y divide-line-subtle">
          {openItems.map((item) => {
            const severity = getSeverity(item);
            const badge = TYPE_BADGE[item.type];
            const BadgeIcon = badge.icon;
            return (
              <div key={item.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          SEVERITY_BADGE_CLASS[severity]
                        )}
                      >
                        <BadgeIcon className="size-3" />
                        {badge.label}
                      </span>
                      <span className="text-sm font-medium text-ink-primary truncate">
                        {getTitle(item)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-ink-quaternary truncate">
                      {getProviderLogo(item.metadata.provider) && (
                        <img
                          src={getProviderLogo(item.metadata.provider)!}
                          alt=""
                          className="size-3 shrink-0"
                        />
                      )}
                      <span className="truncate">
                        {item.metadata.provider} · {getContextSuffix(item)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleViewKey(item.entity_id)}
                    >
                      View
                    </Button>
                    <button
                      onClick={() => archiveInboxItem(item.id)}
                      className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {archivedItems.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setArchivedExpanded(!archivedExpanded)}
            className="flex items-center gap-1.5 text-xs text-ink-quaternary hover:text-ink-secondary transition-colors"
          >
            <CaretDown
              className={cn(
                'size-3 transition-transform',
                !archivedExpanded && '-rotate-90'
              )}
            />
            Archived
            <span className="tabular-nums">({archivedItems.length})</span>
          </button>
          {archivedExpanded && (
            <div className="mt-2 rounded-lg border border-line-subtle bg-surface-2/20 overflow-hidden divide-y divide-line-subtle">
              {archivedItems.slice(0, 20).map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 text-sm text-ink-tertiary truncate">
                    {getTitle(item)}
                    <span className="ml-2 text-xs text-ink-quaternary">
                      {getArchivedContext(item)}
                    </span>
                  </div>
                  <div className="shrink-0 text-xs text-ink-quaternary">
                    {item.archived_at
                      ? new Intl.DateTimeFormat('en', {
                          month: 'short',
                          day: 'numeric',
                        }).format(new Date(item.archived_at))
                      : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
