import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Archive,
  ArrowClockwise,
  Warning,
  ClockAfternoon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useStore } from '../../store/useStore';
import { cn } from '@/lib/utils';
import { formatInboxItemTime } from '../../lib/inbox';

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
  const runInboxChecks = useStore((s) => s.runInboxChecks);
  const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);
  const clearFilters = useStore((s) => s.clearFilters);
  const setSearchQuery = useStore((s) => s.setSearchQuery);

  const items = db?.getInboxItems() ?? [];
  const openItems = useMemo(
    () => items.filter((item) => item.status === 'open'),
    [items]
  );
  const archivedItems = useMemo(
    () => items.filter((item) => item.status === 'archived'),
    [items]
  );
  const criticalCount = openItems.filter(
    (item) => item.severity === 'critical'
  ).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-primary">
            Inbox
          </h1>
          <p className="mt-1 text-sm text-ink-quaternary max-w-2xl">
            Persistent reminders live here until you archive them. Keya
            refreshes expiry reminders whenever you open or unlock the vault.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => runInboxChecks()}>
          <ArrowClockwise className="size-4" />
          Check now
        </Button>
      </div>

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
            {openItems.map((item) => (
              <article key={item.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          item.severity === 'critical'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        )}
                      >
                        {item.severity === 'critical' ? (
                          <Warning className="size-3" />
                        ) : (
                          <ClockAfternoon className="size-3" />
                        )}
                        {item.severity === 'critical' ? 'Expired' : 'Upcoming'}
                      </span>
                      <h3 className="text-sm font-medium text-ink-primary">
                        {item.title}
                      </h3>
                    </div>

                    <p className="mt-2 text-sm text-ink-secondary">
                      {item.body}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-quaternary">
                      <span>Provider: {item.metadata.provider}</span>
                      <span>Expires: {formatInboxItemTime(item)}</span>
                      <span>Key: {item.metadata.key_name}</span>
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
                    <Button size="sm" onClick={() => archiveInboxItem(item.id)}>
                      Archive
                    </Button>
                  </div>
                </div>
              </article>
            ))}
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
                  <div>{item.title}</div>
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
