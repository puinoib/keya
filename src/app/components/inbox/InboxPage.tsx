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
import type { Key } from '../../../core/payload/types';
import {
  reminderDisplay,
  type InboxRule,
  type ReminderRow,
} from '../../state/view';
import { providerLabel } from '../../state/providers';
import { Button } from '@/components/ui/button';
import { useStore } from '../../store/useStore';
import { cn } from '@/lib/utils';
import { ProviderLogo } from '@/app/components/ui/provider-logo';
import { toast } from 'sonner';

type Severity = 'critical' | 'warning' | 'info';

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function getSeverity(rule: InboxRule): Severity {
  switch (rule) {
    case 'expiry_expired':
    case 'probe_failed':
    case 'insecure_endpoint':
      return 'critical';
    case 'expiry_upcoming':
    case 'never_probed':
      return 'warning';
    case 'probe_stale':
      return 'info';
  }
}

const TYPE_BADGE: Record<InboxRule, { label: string; icon: typeof Warning }> = {
  expiry_expired: { label: 'Expired', icon: Warning },
  expiry_upcoming: { label: 'Upcoming', icon: ClockAfternoon },
  probe_failed: { label: 'Failed', icon: Lightning },
  never_probed: { label: 'Untested', icon: Question },
  insecure_endpoint: { label: 'Insecure', icon: ShieldWarning },
  probe_stale: { label: 'Stale', icon: Timer },
};

const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  critical: 'bg-danger/10 text-danger',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  info: 'bg-ink-quaternary/10 text-ink-tertiary',
};

function getContextSuffix(
  row: ReminderRow,
  display: ReturnType<typeof reminderDisplay>
): string {
  switch (row.reminder.rule) {
    case 'expiry_expired': {
      const overdue = Math.abs(display.daysUntilExpiry ?? 0);
      return overdue === 1
        ? 'expired yesterday'
        : `expired ${overdue} days ago`;
    }
    case 'expiry_upcoming': {
      const days = display.daysUntilExpiry ?? 0;
      return days === 0 ? 'expires today' : `expires in ${days} days`;
    }
    case 'probe_failed':
      return display.failureText ?? 'connection failed';
    case 'never_probed':
      return 'never tested';
    case 'insecure_endpoint':
      return display.endpoint ?? 'insecure endpoint';
    case 'probe_stale':
      return `last tested ${display.daysSinceCheck ?? 0} days ago`;
  }
}

function getArchivedContext(row: ReminderRow): string {
  return `${TYPE_BADGE[row.reminder.rule].label} · Archived`;
}

export function InboxPage() {
  const navigate = useNavigate();
  const view = useStore((s) => s.view);
  const inboxVersion = useStore((s) => s.inboxVersion);
  const setReminderDismissed = useStore((s) => s.setReminderDismissed);
  const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);
  const setShowArchived = useStore((s) => s.setShowArchived);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const rows = useMemo(
    () => view?.reminders ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, inboxVersion]
  );
  const openItems = useMemo(() => {
    const open = rows.filter((row) => !row.dismissed);
    return open.sort((a, b) => {
      const sa = SEVERITY_ORDER[getSeverity(a.reminder.rule)];
      const sb = SEVERITY_ORDER[getSeverity(b.reminder.rule)];
      if (sa !== sb) return sa - sb;
      return Date.parse(b.stamp) - Date.parse(a.stamp);
    });
  }, [rows]);
  const archivedItems = useMemo(
    () => rows.filter((row) => row.dismissed),
    [rows]
  );

  const providerOf = (key: Key) =>
    providerLabel(key.provider_id, view?.file.providers ?? []);

  const handleViewKey = (key: Key) => {
    if (view && !view.file.keys.some((entry) => entry.id === key.id)) {
      toast('This credential no longer exists');
      return;
    }
    setShowArchived(Boolean(key.archived_at));
    setSelectedKeyId(key.id);
    navigate({ to: '/keys' });
  };

  return (
    <div className="w-full px-6 py-6">
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-4">
        Inbox
        {openItems.length > 0 && (
          <span className="ml-1.5 text-xs font-normal text-ink-quaternary tabular-nums">
            {openItems.length}
          </span>
        )}
      </h1>

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
          {openItems.map((row) => {
            const rule = row.reminder.rule;
            const severity = getSeverity(rule);
            const badge = TYPE_BADGE[rule];
            const BadgeIcon = badge.icon;
            const display = view
              ? reminderDisplay(view, row, providerOf)
              : null;
            return (
              <div key={`${rule}:${row.key.id}`} className="px-4 py-3">
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
                        {row.key.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-ink-quaternary truncate">
                      <ProviderLogo
                        provider={display?.provider ?? ''}
                        className="size-3"
                      />
                      <span className="truncate">
                        {display?.provider} ·{' '}
                        {display ? getContextSuffix(row, display) : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleViewKey(row.key)}
                    >
                      View
                    </Button>
                    <button
                      onClick={() => setReminderDismissed(row, true)}
                      aria-label="Dismiss this reminder"
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
              {archivedItems.slice(0, 20).map((row) => (
                <div
                  key={`${row.reminder.rule}:${row.key.id}`}
                  className="px-4 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 text-sm text-ink-tertiary truncate">
                    {row.key.name}
                    <span className="ml-2 text-xs text-ink-quaternary">
                      {getArchivedContext(row)}
                    </span>
                  </div>
                  <div className="shrink-0 text-xs text-ink-quaternary">
                    {row.dismissedAt
                      ? new Intl.DateTimeFormat('en', {
                          month: 'short',
                          day: 'numeric',
                        }).format(new Date(row.dismissedAt))
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
