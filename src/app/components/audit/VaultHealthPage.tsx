import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  CheckCircle,
  Heartbeat,
  ShieldCheck,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  auditVault,
  type VaultAuditActionFilter,
  type VaultAuditCheck,
  type VaultAuditReport,
} from '@/core/audit';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStore } from '../../store/useStore';

function scoreTone(score: number) {
  if (score >= 85) return 'text-success-bright';
  if (score >= 60) return 'text-amber-500';
  return 'text-danger';
}

function severityStyles(severity: VaultAuditCheck['severity']) {
  if (severity === 'critical') {
    return {
      icon: WarningCircle,
      label: 'Critical',
      badge: 'bg-danger/10 text-danger',
      card: 'border-danger/25 bg-danger/5',
    };
  }
  if (severity === 'warning') {
    return {
      icon: Warning,
      label: 'Warning',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      card: 'border-amber-500/25 bg-amber-500/5',
    };
  }
  return {
    icon: CheckCircle,
    label: 'Suggestion',
    badge: 'bg-accent/10 text-accent-bright',
    card: 'border-line-subtle bg-surface-2/40',
  };
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line-subtle bg-surface-2/60 px-4 py-3">
      <div className="text-xs text-ink-quaternary">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink-primary tabular-nums">
        {value}
      </div>
    </div>
  );
}

function percent(count: number, total: number) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

function ChartShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line-subtle bg-surface-2/30 p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-ink-primary">{title}</h2>
        <p className="mt-1 text-xs text-ink-quaternary">{description}</p>
      </div>
      {children}
    </section>
  );
}

function StackedBar({
  segments,
}: {
  segments: Array<{
    label: string;
    count: number;
    className: string;
  }>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-4">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={segment.className}
            style={{ width: `${percent(segment.count, total)}%` }}
            title={`${segment.label}: ${segment.count}`}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {segments.map((segment) => (
          <div key={segment.label} className="text-xs">
            <div className="flex items-center justify-between gap-2 text-ink-tertiary">
              <span>{segment.label}</span>
              <span className="tabular-nums">{segment.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderDistributionChart({
  providers,
  onFilter,
}: {
  providers: VaultAuditReport['charts']['providerDistribution'];
  onFilter: (filter: VaultAuditActionFilter) => void;
}) {
  const visibleProviders = providers.slice(0, 6);

  return (
    <ChartShell
      title="Provider distribution"
      description="Which providers dominate this vault."
    >
      {visibleProviders.length === 0 ? (
        <div className="py-8 text-center text-xs text-ink-quaternary">
          No provider data yet.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleProviders.map((item) => (
            <button
              key={item.provider}
              type="button"
              onClick={() => onFilter({ provider: item.provider })}
              className="group w-full text-left"
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-ink-secondary group-hover:text-ink-primary">
                  {item.provider}
                </span>
                <span className="shrink-0 text-ink-quaternary tabular-nums">
                  {item.count} · {item.percentage}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-4">
                <div
                  className="h-full rounded-full bg-accent transition-all group-hover:bg-accent-bright"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </ChartShell>
  );
}

function ConnectionHealthChart({
  health,
  total,
  onFilter,
}: {
  health: VaultAuditReport['charts']['connectionHealth'];
  total: number;
  onFilter: (filter: VaultAuditActionFilter) => void;
}) {
  const segments = [
    { label: 'Success', count: health.success, className: 'bg-success-bright' },
    { label: 'Failed', count: health.failed, className: 'bg-danger' },
    { label: 'Untested', count: health.untested, className: 'bg-surface-6' },
  ];

  return (
    <ChartShell
      title="Connection health"
      description="Latest API connectivity test results."
    >
      <StackedBar segments={segments} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onFilter({ testStatus: 'success' })}
          className="rounded-lg border border-line-subtle bg-surface-2 px-2 py-2 text-left hover:bg-surface-4"
        >
          <div className="text-xs text-ink-quaternary">Success</div>
          <div className="text-sm font-medium text-success-bright tabular-nums">
            {percent(health.success, total)}%
          </div>
        </button>
        <button
          type="button"
          onClick={() => onFilter({ testStatus: 'failed' })}
          className="rounded-lg border border-line-subtle bg-surface-2 px-2 py-2 text-left hover:bg-surface-4"
        >
          <div className="text-xs text-ink-quaternary">Failed</div>
          <div className="text-sm font-medium text-danger tabular-nums">
            {percent(health.failed, total)}%
          </div>
        </button>
        <button
          type="button"
          onClick={() => onFilter({ testStatus: 'untested' })}
          className="rounded-lg border border-line-subtle bg-surface-2 px-2 py-2 text-left hover:bg-surface-4"
        >
          <div className="text-xs text-ink-quaternary">Untested</div>
          <div className="text-sm font-medium text-ink-secondary tabular-nums">
            {percent(health.untested, total)}%
          </div>
        </button>
      </div>
    </ChartShell>
  );
}

function ExpiryBreakdownChart({
  expiry,
  onFilter,
}: {
  expiry: VaultAuditReport['charts']['expiryBreakdown'];
  onFilter: (filter: VaultAuditActionFilter) => void;
}) {
  return (
    <ChartShell
      title="Expiry posture"
      description="Rotation visibility across saved keys."
    >
      <StackedBar
        segments={[
          { label: 'Expired', count: expiry.expired, className: 'bg-danger' },
          {
            label: 'Expiring',
            count: expiry.expiringSoon,
            className: 'bg-amber-500',
          },
          {
            label: 'Valid',
            count: expiry.valid,
            className: 'bg-success-bright',
          },
          {
            label: 'No expiry',
            count: expiry.noExpiry,
            className: 'bg-surface-6',
          },
        ]}
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onFilter({ expiryStatus: 'expired' })}
          className="rounded-lg border border-line-subtle bg-surface-2 px-2 py-2 text-left hover:bg-surface-4"
        >
          <div className="text-xs text-ink-quaternary">Expired</div>
          <div className="text-sm font-medium text-danger tabular-nums">
            {expiry.expired}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onFilter({ expiryStatus: 'expiring' })}
          className="rounded-lg border border-line-subtle bg-surface-2 px-2 py-2 text-left hover:bg-surface-4"
        >
          <div className="text-xs text-ink-quaternary">Expiring soon</div>
          <div className="text-sm font-medium text-amber-500 tabular-nums">
            {expiry.expiringSoon}
          </div>
        </button>
      </div>
    </ChartShell>
  );
}

function GroupCoverageChart({
  coverage,
  total,
}: {
  coverage: VaultAuditReport['charts']['groupCoverage'];
  total: number;
}) {
  return (
    <ChartShell
      title="Group coverage"
      description="How well your keys are organized into groups."
    >
      <StackedBar
        segments={[
          {
            label: 'Grouped',
            count: coverage.grouped,
            className: 'bg-accent',
          },
          {
            label: 'Ungrouped',
            count: coverage.ungrouped,
            className: 'bg-surface-6',
          },
        ]}
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line-subtle bg-surface-2 px-2 py-2">
          <div className="text-xs text-ink-quaternary">Grouped</div>
          <div className="text-sm font-medium text-accent-bright tabular-nums">
            {percent(coverage.grouped, total)}%
          </div>
        </div>
        <div className="rounded-lg border border-line-subtle bg-surface-2 px-2 py-2">
          <div className="text-xs text-ink-quaternary">Ungrouped</div>
          <div className="text-sm font-medium text-ink-secondary tabular-nums">
            {percent(coverage.ungrouped, total)}%
          </div>
        </div>
      </div>
    </ChartShell>
  );
}

function ScoreCard({
  score,
  critical,
  warning,
  suggestion,
}: {
  score: number;
  critical: number;
  warning: number;
  suggestion: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line-subtle bg-surface-2/50 p-5">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(39,166,68,0.16),transparent_42%)]" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-surface-3 px-2 py-1 text-xs text-ink-tertiary">
            <ShieldCheck className="size-3.5" />
            Local vault audit
          </div>
          <h2 className="mt-4 text-lg font-semibold tracking-tight text-ink-primary">
            Vault health score
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-quaternary">
            Keya checks expiry, connectivity, grouping, rotation age, and
            endpoint hygiene without sending any data out.
          </p>
        </div>

        <div className="flex items-end gap-5">
          <div className="text-right">
            <div
              className={cn(
                'text-5xl font-semibold tracking-tight tabular-nums',
                scoreTone(score)
              )}
            >
              {score}
            </div>
            <div className="mt-1 text-xs text-ink-quaternary">out of 100</div>
          </div>
          <div className="space-y-1 text-xs text-ink-quaternary">
            <div>
              <span className="text-danger tabular-nums">{critical}</span>{' '}
              critical
            </div>
            <div>
              <span className="text-amber-500 tabular-nums">{warning}</span>{' '}
              warnings
            </div>
            <div>
              <span className="text-accent-bright tabular-nums">
                {suggestion}
              </span>{' '}
              suggestions
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyHealth() {
  return (
    <div className="rounded-2xl border border-line-subtle bg-surface-2/40 px-6 py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-quaternary">
        <Heartbeat className="size-5" />
      </div>
      <p className="mt-4 text-sm font-medium text-ink-primary">
        Nothing to audit yet
      </p>
      <p className="mt-1 text-xs text-ink-quaternary">
        Add a few API keys and Keya will surface health checks here.
      </p>
    </div>
  );
}

function CheckCard({
  check,
  onAction,
}: {
  check: VaultAuditCheck;
  onAction: (check: VaultAuditCheck) => void;
}) {
  const styles = severityStyles(check.severity);
  const Icon = styles.icon;

  return (
    <article className={cn('rounded-xl border px-4 py-4', styles.card)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                styles.badge
              )}
            >
              <Icon className="size-3" />
              {styles.label}
            </span>
            <h3 className="text-sm font-medium text-ink-primary">
              {check.title}
            </h3>
          </div>
          <p className="mt-2 text-sm text-ink-secondary">{check.description}</p>
          <div className="mt-3 text-xs text-ink-quaternary tabular-nums">
            {check.affectedKeyIds.length} affected{' '}
            {check.affectedKeyIds.length === 1 ? 'key' : 'keys'}
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => onAction(check)}>
          {check.action?.label ?? 'View sample'}
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </article>
  );
}

export function VaultHealthPage() {
  const navigate = useNavigate();
  const db = useStore((s) => s.db);
  const clearFilters = useStore((s) => s.clearFilters);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const setFilterProvider = useStore((s) => s.setFilterProvider);
  const setFilterGroupId = useStore((s) => s.setFilterGroupId);
  const setFilterTestStatus = useStore((s) => s.setFilterTestStatus);
  const setFilterExpiryStatus = useStore((s) => s.setFilterExpiryStatus);
  const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);

  if (!db) return null;

  const report = auditVault({ keys: db.getApiKeys(), groups: db.getGroups() });

  const handleAction = (check: VaultAuditCheck) => {
    clearFilters();
    setSearchQuery('');
    setSelectedKeyId(null);

    const filter = check.action?.filter;
    if (filter?.provider) setFilterProvider(filter.provider);
    if (filter?.groupId) setFilterGroupId(filter.groupId);
    if (filter?.testStatus) setFilterTestStatus(filter.testStatus);
    if (filter?.expiryStatus) setFilterExpiryStatus(filter.expiryStatus);
    if (!filter && check.affectedKeyIds[0])
      setSelectedKeyId(check.affectedKeyIds[0]);
    if (filter?.keyId) setSelectedKeyId(filter.keyId);

    navigate({ to: '/keys' });
  };

  const handleChartFilter = (filter: VaultAuditActionFilter) => {
    clearFilters();
    setSearchQuery('');
    setSelectedKeyId(null);

    if (filter.provider) setFilterProvider(filter.provider);
    if (filter.groupId) setFilterGroupId(filter.groupId);
    if (filter.testStatus) setFilterTestStatus(filter.testStatus);
    if (filter.expiryStatus) setFilterExpiryStatus(filter.expiryStatus);
    if (filter.keyId) setSelectedKeyId(filter.keyId);

    navigate({ to: '/keys' });
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-primary">
            Health
          </h1>
        </div>
      </div>

      <ScoreCard
        score={report.score}
        critical={report.summary.critical}
        warning={report.summary.warning}
        suggestion={report.summary.suggestion}
      />

      <div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Keys" value={report.metrics.totalKeys} />
        <MetricCard label="Providers" value={report.metrics.providerCount} />
        <MetricCard label="Failed tests" value={report.metrics.failedTests} />
        <MetricCard label="Expiring soon" value={report.metrics.expiringSoon} />
        <MetricCard label="Ungrouped" value={report.metrics.ungrouped} />
      </div>

      {report.metrics.totalKeys > 0 && (
        <div className="my-4 space-y-3">
          <ProviderDistributionChart
            providers={report.charts.providerDistribution}
            onFilter={handleChartFilter}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <ConnectionHealthChart
              health={report.charts.connectionHealth}
              total={report.metrics.totalKeys}
              onFilter={handleChartFilter}
            />
            <ExpiryBreakdownChart
              expiry={report.charts.expiryBreakdown}
              onFilter={handleChartFilter}
            />
          </div>
          <GroupCoverageChart
            coverage={report.charts.groupCoverage}
            total={report.metrics.totalKeys}
          />
        </div>
      )}

      {report.metrics.totalKeys === 0 ? (
        <EmptyHealth />
      ) : report.checks.length === 0 ? (
        <div className="rounded-2xl border border-success/25 bg-success/5 px-6 py-14 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-success/10 text-success-bright">
            <ShieldCheck className="size-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-ink-primary">
            No issues found
          </p>
          <p className="mt-1 text-xs text-ink-quaternary">
            This vault has no current audit findings.
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-line-subtle bg-surface-2/20 p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-ink-primary">Findings</h2>
            <span className="text-xs text-ink-quaternary tabular-nums">
              {report.checks.length}
            </span>
          </div>
          <div className="space-y-3">
            {report.checks.map((check) => (
              <CheckCard key={check.id} check={check} onAction={handleAction} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
