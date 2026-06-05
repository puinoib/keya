import { useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  CheckCircle,
  Heartbeat,
  ShieldCheck,
  Warning,
  WarningCircle,
} from '@phosphor-icons/react';
import { auditVault, type VaultAuditCheck } from '@/core/audit';
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

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-primary">
            Health
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-quaternary">
            A local security review for this vault. Use it to find expired,
            failing, stale, and poorly organized keys.
          </p>
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
