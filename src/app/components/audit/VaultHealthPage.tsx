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

function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
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

// ── SVG Donut Chart ──

interface DonutSegment {
  label: string;
  count: number;
  color: string;
}

function DonutChart({
  segments,
  size = 120,
  strokeWidth = 20,
  animated = true,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
}) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  let cumulativePercent = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      {/* Background track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-surface-4"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {segments
        .filter((seg) => seg.count > 0)
        .map((seg) => {
          const percent = seg.count / total;
          const dashLength = percent * circumference;
          const offset = -cumulativePercent * circumference;
          cumulativePercent += percent;

          return (
            <circle
              key={seg.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
              className={animated ? 'transition-all duration-700 ease-out' : ''}
            />
          );
        })}
    </svg>
  );
}

// ── Score Ring ──

function ScoreRing({
  score,
  size = 100,
  strokeWidth = 6,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashLength = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        {/* Background track - subtle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-surface-4"
          strokeWidth={strokeWidth}
        />
        {/* Score arc */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashLength} ${circumference - dashLength}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Score number centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            'text-2xl font-semibold tracking-tight tabular-nums',
            scoreTone(score)
          )}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// ── Donut Legend (list) ──

function DonutLegend({
  segments,
  onClick,
}: {
  segments: (DonutSegment & { active?: boolean })[];
  onClick?: (label: string) => void;
}) {
  return (
    <div className="space-y-2">
      {segments
        .filter((s) => s.count > 0)
        .map((seg) => (
          <button
            key={seg.label}
            type="button"
            disabled={!onClick}
            onClick={() => onClick?.(seg.label)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
              seg.active
                ? 'bg-surface-3/60'
                : 'hover:bg-surface-3/30',
              onClick && 'cursor-pointer'
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-ink-tertiary">{seg.label}</span>
            </div>
            <span className="tabular-nums text-ink-secondary font-medium">
              {seg.count}
            </span>
          </button>
        ))}
    </div>
  );
}

// ── Provider Distribution ──

function ProviderDistributionChart({
  providers,
  onFilter,
}: {
  providers: VaultAuditReport['charts']['providerDistribution'];
  onFilter: (filter: VaultAuditActionFilter) => void;
}) {
  const visibleProviders = providers.slice(0, 8);
  const maxCount = Math.max(...visibleProviders.map((p) => p.count), 1);

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
          {visibleProviders.map((item, i) => {
            const hue = 210 + (i / visibleProviders.length) * 120;
            return (
              <button
                key={item.provider}
                type="button"
                onClick={() => onFilter({ provider: item.provider })}
                className="group w-full text-left"
              >
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-ink-secondary group-hover:text-ink-primary">
                    {item.provider}
                  </span>
                  <span className="shrink-0 text-ink-quaternary tabular-nums">
                    {item.count} · {item.percentage}%
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-4">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${(item.count / maxCount) * 100}%`,
                      background: `linear-gradient(90deg, hsl(${hue}, 60%, 50%), hsl(${hue + 20}, 70%, 55%))`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ChartShell>
  );
}

// ── Connection Health ──

function ConnectionHealthChart({
  health,
  onFilter,
}: {
  health: VaultAuditReport['charts']['connectionHealth'];
  onFilter: (filter: VaultAuditActionFilter) => void;
}) {
  const total = health.success + health.failed + health.untested;
  const segments: DonutSegment[] = [
    { label: 'Success', count: health.success, color: '#22c55e' },
    { label: 'Failed', count: health.failed, color: '#ef4444' },
    { label: 'Untested', count: health.untested, color: '#6b7280' },
  ];
  const legendSegments = segments.map((s) => ({
    ...s,
    active: false,
  }));

  return (
    <ChartShell
      title="Connection health"
      description="Latest API connectivity test results."
    >
      <div className="flex items-center gap-6">
        <DonutChart segments={segments} size={100} strokeWidth={16} />
        <div className="flex-1">
          <DonutLegend
            segments={legendSegments}
            onClick={(label) => {
              const status = label.toLowerCase() as 'success' | 'failed' | 'untested';
              onFilter({ testStatus: status });
            }}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-line-subtle bg-surface-2 px-2.5 py-2">
          <div className="text-xs text-ink-quaternary">Success rate</div>
          <div className="text-sm font-medium text-success-bright tabular-nums">
            {percent(health.success, total)}%
          </div>
        </div>
        <div className="rounded-lg border border-line-subtle bg-surface-2 px-2.5 py-2">
          <div className="text-xs text-ink-quaternary">Failure rate</div>
          <div className="text-sm font-medium text-danger tabular-nums">
            {percent(health.failed, total)}%
          </div>
        </div>
        <div className="rounded-lg border border-line-subtle bg-surface-2 px-2.5 py-2">
          <div className="text-xs text-ink-quaternary">Coverage</div>
          <div className="text-sm font-medium text-ink-secondary tabular-nums">
            {percent(health.success + health.failed, total)}%
          </div>
        </div>
      </div>
    </ChartShell>
  );
}

// ── Expiry Breakdown ──

function ExpiryBreakdownChart({
  expiry,
  onFilter,
}: {
  expiry: VaultAuditReport['charts']['expiryBreakdown'];
  onFilter: (filter: VaultAuditActionFilter) => void;
}) {
  const segments: DonutSegment[] = [
    { label: 'Expired', count: expiry.expired, color: '#ef4444' },
    { label: 'Expiring', count: expiry.expiringSoon, color: '#f59e0b' },
    { label: 'Valid', count: expiry.valid, color: '#22c55e' },
    { label: 'No expiry', count: expiry.noExpiry, color: '#6b7280' },
  ];
  const legendSegments = segments.map((s) => ({
    ...s,
    active: false,
  }));

  return (
    <ChartShell
      title="Expiry posture"
      description="Rotation visibility across saved keys."
    >
      <div className="flex items-center gap-6">
        <DonutChart segments={segments} size={100} strokeWidth={16} />
        <div className="flex-1">
          <DonutLegend
            segments={legendSegments}
            onClick={(label) => {
              if (label === 'Expired') onFilter({ expiryStatus: 'expired' });
              if (label === 'Expiring') onFilter({ expiryStatus: 'expiring' });
            }}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line-subtle bg-surface-2 px-2.5 py-2">
          <div className="text-xs text-ink-quaternary">At risk</div>
          <div className="text-sm font-medium text-danger tabular-nums">
            {expiry.expired + expiry.expiringSoon}
          </div>
        </div>
        <div className="rounded-lg border border-line-subtle bg-surface-2 px-2.5 py-2">
          <div className="text-xs text-ink-quaternary">With expiry</div>
          <div className="text-sm font-medium text-success-bright tabular-nums">
            {expiry.expired + expiry.expiringSoon + expiry.valid}
          </div>
        </div>
      </div>
    </ChartShell>
  );
}

// ── Group Coverage ──

function GroupCoverageChart({
  coverage,
}: {
  coverage: VaultAuditReport['charts']['groupCoverage'];
  total: number;
}) {
  const total = coverage.grouped + coverage.ungrouped;
  const segments: DonutSegment[] = [
    { label: 'Grouped', count: coverage.grouped, color: '#3b82f6' },
    { label: 'Ungrouped', count: coverage.ungrouped, color: '#6b7280' },
  ];
  const legendSegments = segments.map((s) => ({
    ...s,
    active: false,
  }));

  return (
    <ChartShell
      title="Group coverage"
      description="How well your keys are organized into groups."
    >
      <div className="flex items-center gap-6">
        <DonutChart segments={segments} size={80} strokeWidth={14} />
        <div className="flex-1">
          <DonutLegend segments={legendSegments} />
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-ink-quaternary">Grouped</div>
          <div className="text-lg font-semibold text-accent-bright tabular-nums">
            {percent(coverage.grouped, total)}%
          </div>
        </div>
      </div>
    </ChartShell>
  );
}

// ── Score Card ──

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

        <div className="flex items-center gap-5">
          <ScoreRing score={score} size={100} />
          <div className="space-y-1.5 text-xs text-ink-quaternary">
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
