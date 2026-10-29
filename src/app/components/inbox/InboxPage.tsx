import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  CaretDown,
  CheckCircle,
  ClockAfternoon,
  Lightning,
  Warning,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { Key } from '../../../core/payload/types';
import {
  attentionCount,
  attentionSeverity,
  deviceBacklog,
  rejectionText,
  type AttentionRow,
} from '../../state/view';
import { providerLabel } from '../../state/providers';
import { daysSince } from '../../state/presentation';
import { Button } from '@/components/ui/button';
import {
  useStore,
  runManualCheck,
  runManualChecks,
} from '../../store/useStore';
import { cn } from '@/lib/utils';
import { ProviderLogo } from '@/app/components/ui/provider-logo';
import { format } from 'date-fns';

function expiryLine(row: AttentionRow): string {
  if (row.fact.kind !== 'expiry') return '';
  const days = row.fact.days_left;
  if (row.fact.phase === 'expired') {
    return Math.abs(days) === 1
      ? 'expired yesterday'
      : `expired ${Math.abs(days)} days ago`;
  }
  return days <= 0
    ? 'expires today'
    : `expires in ${days} day${days === 1 ? '' : 's'}`;
}

function whyLine(row: AttentionRow): string {
  if (row.fact.kind === 'expiry') {
    const fact = row.key.expiry?.value ?? 'no date';
    return `Rule: expiry · fact: ${fact}. This clears when you move the date or archive the key.`;
  }
  const when = format(new Date(row.fact.finished_at), 'MMM d, HH:mm');
  const detail = row.fact.detail_code ?? row.fact.outcome;
  return `Rule: rejected · fact: ${detail} at ${when}. This clears when a later check succeeds, or when you archive the key.`;
}

export function InboxPage() {
  const navigate = useNavigate();
  const view = useStore((s) => s.view);
  const archiveKey = useStore((s) => s.archiveKey);
  const setSelectedKeyId = useStore((s) => s.setSelectedKeyId);
  const setShowArchived = useStore((s) => s.setShowArchived);

  const [housekeepingOpen, setHousekeepingOpen] = useState(false);
  const [expandedWhy, setExpandedWhy] = useState<string | null>(null);
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  const attention = useMemo(() => view?.attention ?? [], [view]);
  const backlog = useMemo(() => (view ? deviceBacklog(view) : []), [view]);

  const providerOf = (key: Key) =>
    providerLabel(key.provider_id, view?.file.providers ?? []);

  const openKey = (key: Key) => {
    setShowArchived(Boolean(key.archived_at));
    setSelectedKeyId(key.id);
    navigate({ to: '/keys' });
  };

  const check = async (keyId: string, announce: boolean): Promise<boolean> => {
    setBusyKeyId(keyId);
    try {
      const result = await runManualCheck(keyId);
      // A declined destination or a session that ended mid-flight sent nothing;
      // neither says anything about the credential.
      if (!result || result.discarded) return false;
      const success = result.success;
      if (!success && announce) {
        toast.error('The check did not pass', {
          description:
            result.error ??
            'The provider did not accept this check. The key is unchanged.',
        });
      }
      return success;
    } finally {
      setBusyKeyId(null);
    }
  };

  const checkAll = async () => {
    setBatchBusy(true);
    try {
      // One gesture names every destination; each request below still earns and
      // consumes its own single-use approval. A decline sends nothing.
      const result = await runManualChecks(backlog.map((row) => row.key.id));
      if (result.declined || result.checked === 0) return;

      if (result.failed > 0) {
        toast.error(
          result.failed === 1
            ? 'One check did not pass'
            : `${result.failed} checks did not pass`,
          {
            description:
              'The provider rejected or could not confirm those keys. Nothing was changed.',
          }
        );
        return;
      }
      toast.success(
        result.checked === 1 ? 'Key checked' : `${result.checked} keys checked`
      );
    } finally {
      setBatchBusy(false);
    }
  };

  if (!view) return null;

  const needsAttention = attentionCount(view);
  const rowId = (row: AttentionRow) => `${row.fact.kind}:${row.key.id}`;

  return (
    <div className="w-full px-6 py-6">
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-4">
        Inbox
        {needsAttention > 0 && (
          <span className="ml-1.5 text-xs font-normal text-ink-quaternary tabular-nums">
            {needsAttention}
          </span>
        )}
      </h1>

      {needsAttention === 0 ? (
        <div className="py-14 text-center">
          <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-quaternary">
            <CheckCircle className="size-5" />
          </div>
          <p className="mt-4 text-sm font-medium text-ink-primary">
            Nothing needs attention
          </p>
          <p className="mt-1 text-xs text-ink-quaternary">
            Expiries and rejected checks appear here. Nothing else does.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-line-subtle bg-surface-2/40 overflow-hidden divide-y divide-line-subtle">
          {attention.map((row) => {
            const severity = attentionSeverity(row.fact);
            const BadgeIcon =
              row.fact.kind === 'rejected'
                ? Lightning
                : row.fact.phase === 'expired'
                  ? Warning
                  : ClockAfternoon;
            const label =
              row.fact.kind === 'rejected'
                ? row.fact.outcome === 'auth_failed'
                  ? 'Rejected'
                  : 'Forbidden'
                : row.fact.phase === 'expired'
                  ? 'Expired'
                  : 'Due soon';
            const context =
              row.fact.kind === 'expiry'
                ? expiryLine(row)
                : `${rejectionText(row)}${
                    attentionAge(row, view.now)
                      ? ` · ${attentionAge(row, view.now)}`
                      : ''
                  }`;
            const busy = busyKeyId === row.key.id;

            return (
              <div key={rowId(row)} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          severity === 'critical'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        )}
                      >
                        <BadgeIcon className="size-3" />
                        {label}
                      </span>
                      <span className="text-sm font-medium text-ink-primary truncate">
                        {row.key.name}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-ink-quaternary truncate">
                      <ProviderLogo
                        provider={providerOf(row.key)}
                        className="size-3"
                      />
                      <span className="truncate">
                        {providerOf(row.key)} · {context}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* A rejected credential clears by checking it again; an
                        expiry clears when the date is edited, which is what
                        Open is for. */}
                    {row.fact.kind === 'rejected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={busy}
                        onClick={() => void check(row.key.id, true)}
                      >
                        {busy ? 'Checking…' : 'Check now'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openKey(row.key)}
                    >
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => archiveKey(row.key.id)}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <button
                    onClick={() =>
                      setExpandedWhy(
                        expandedWhy === rowId(row) ? null : rowId(row)
                      )
                    }
                    className="text-[11px] text-ink-quaternary hover:text-ink-secondary transition-colors"
                  >
                    Why am I seeing this?
                  </button>
                </div>
                {expandedWhy === rowId(row) && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-tertiary">
                    {whyLine(row)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {backlog.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setHousekeepingOpen(!housekeepingOpen)}
            className="flex items-center gap-1.5 text-xs text-ink-quaternary hover:text-ink-secondary transition-colors"
          >
            <CaretDown
              className={cn(
                'size-3 transition-transform',
                !housekeepingOpen && '-rotate-90'
              )}
            />
            Housekeeping
            <span className="tabular-nums">({backlog.length})</span>
            <span className="text-ink-quaternary/70">
              — this device has not verified these lately
            </span>
          </button>
          {housekeepingOpen && (
            <div className="mt-2 rounded-lg border border-line-subtle bg-surface-2/20 overflow-hidden divide-y divide-line-subtle">
              <div className="flex items-center justify-between gap-2 px-4 py-2 text-[11px] text-ink-quaternary">
                <span>
                  Nothing here is broken. A check is offered, never assumed.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => void checkAll()}
                  disabled={batchBusy || busyKeyId !== null}
                >
                  Check all
                </Button>
              </div>
              {backlog.map((row) => (
                <div
                  key={row.key.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 text-sm text-ink-tertiary truncate">
                    {row.key.name}
                    <span className="ml-2 text-xs text-ink-quaternary">
                      {row.never_verified
                        ? 'never verified on this device'
                        : `verified ${row.days_since} days ago`}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={busyKeyId === row.key.id}
                      onClick={() => void check(row.key.id, true)}
                    >
                      {busyKeyId === row.key.id ? 'Checking…' : 'Check'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => openKey(row.key)}
                    >
                      Open
                    </Button>
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

function attentionAge(row: AttentionRow, now: Date): string | null {
  if (row.fact.kind !== 'rejected') return null;
  const days = daysSince(row.fact.finished_at, now);
  if (days === null) return null;
  if (days === 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
