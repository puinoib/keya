import { useEffect, useRef, useState } from 'react';
import { CaretDown, Clock, Gauge, Warning } from '@phosphor-icons/react';
import {
  describeAge,
  describeReset,
  supportsUsage,
  tightestWindow,
  unsupportedUsageReason,
  type UsageEntry,
  type UsageFailure,
  type UsageWindow,
} from '../../lib/usage';
import { isStaleSnapshot } from '../../lib/usage-cache';

/**
 * Allowance read from the provider on demand.
 *
 * The figures are the provider's, never derived, and they are never written to
 * the vault. A snapshot may be cached for this tab for a short while, so the
 * card always says how old it is and shows a stale one as history rather than
 * as current: a number Keya cannot keep current must not look live.
 *
 * The default state is one summary line, because this is the only block in the
 * detail panel whose height depends on the provider. The full per-window
 * breakdown is one click away.
 */
export function UsageCard({
  provider,
  entry,
  onRefresh,
  now,
}: {
  provider: string;
  /** This session's result for the key, or undefined before the first query. */
  entry: UsageEntry | undefined;
  onRefresh: () => void;
  now?: Date;
}) {
  const currentTime = useNow(now);
  const [expanded, setExpanded] = useState(false);
  // A refresh keeps the previous snapshot, so the card does not collapse while
  // a request is in flight.
  const snapshot = entry?.snapshot;
  const stale = isStaleSnapshot(snapshot?.checked_at, currentTime);

  if (!supportsUsage(provider)) {
    const reason = unsupportedUsageReason(provider);
    if (!reason) return null;
    return (
      <div className="rounded-lg border border-line-subtle bg-surface-2 p-3 mb-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Gauge className="size-3 text-ink-quaternary" />
          <span className="text-xs text-ink-quaternary">Usage</span>
        </div>
        <p className="text-[11px] leading-relaxed text-ink-quaternary">
          {reason}
        </p>
      </div>
    );
  }

  const loading = entry?.state === 'loading';
  const failure = entry?.state === 'failed' ? entry.failure : undefined;
  const tightest = tightestWindow(snapshot);
  /** Nothing to reveal for a provider that has not answered yet. */
  const canExpand = Boolean(snapshot || failure);
  const summaryVisible = !expanded || !canExpand;
  const detailVisible = expanded && canExpand;
  /** Focus has to leave the summary when it is clipped away. */
  const headerToggleRef = useRef<HTMLButtonElement | null>(null);

  const label = (
    <>
      <Gauge className="size-3" />
      Usage
      {stale && snapshot && (
        <span
          data-usage-stale
          title={`Not current — last checked ${describeAge(
            snapshot.checked_at,
            currentTime
          )}. Refresh for current numbers.`}
          className="inline-flex"
        >
          <Warning
            className="size-3 text-[#d97706] dark:text-[#fbbf24]"
            aria-label="This figure is not current"
          />
        </span>
      )}
    </>
  );

  return (
    <div className="rounded-lg bg-surface-2 border border-line-subtle mb-4 animate-stagger-in">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        {canExpand ? (
          <button
            ref={headerToggleRef}
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            title={expanded ? 'Hide usage details' : 'Show usage details'}
            className="flex items-center gap-1.5 rounded text-xs text-ink-quaternary transition-colors hover:text-ink-secondary"
          >
            {label}
            <CaretDown
              className={`size-3 transition-transform duration-150 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-ink-quaternary">
            {label}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Asks the provider for its own allowance. The key is sent to that provider only."
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-100 disabled:opacity-50"
        >
          {loading ? (
            <span className="size-2.5 border-[1.5px] border-ink-tertiary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Clock className="size-2.5" />
          )}
          {loading
            ? 'Checking…'
            : snapshot || failure
              ? 'Refresh'
              : 'Check usage'}
        </button>
      </div>

      {/* Summary: the most-used window while collapsed. Expanding fades it out
          and fades the complete list in, so the same window is never drawn
          twice. Both rows animate with their own content height. */}
      <div
        data-usage-summary
        aria-hidden={!summaryVisible}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          summaryVisible
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          {canExpand ? (
            <button
              type="button"
              aria-expanded={expanded}
              tabIndex={summaryVisible ? 0 : -1}
              onClick={() => {
                setExpanded(true);
                // The row is about to be clipped; keep focus on a control that
                // stays visible.
                headerToggleRef.current?.focus();
              }}
              className="w-full rounded-b-lg px-3 pt-1 pb-2.5 text-left transition-colors hover:bg-surface-3/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright/40"
            >
              {snapshot && tightest ? (
                <WindowRow window={tightest} stale={stale} now={currentTime} />
              ) : (
                <span
                  className={`block truncate text-[11px] ${summaryTone(entry, stale)}`}
                >
                  {summaryLine({ loading, failure, provider })}
                </span>
              )}
            </button>
          ) : (
            <div className="px-3 pt-1 pb-2.5">
              <span
                className={`block truncate text-[11px] ${summaryTone(entry, stale)}`}
              >
                {summaryLine({ loading, failure, provider })}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        data-usage-detail
        aria-hidden={!detailVisible}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
          detailVisible
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 px-3 py-2.5">
            {failure && <UsageFailureNote failure={failure} />}

            {snapshot && (
              <>
                {snapshot.windows.map((window) => (
                  <WindowRow
                    key={window.id}
                    window={window}
                    stale={stale}
                    now={currentTime}
                  />
                ))}
                <p className="text-[10px] leading-relaxed text-ink-quaternary">
                  {stale ? (
                    <>
                      <Warning className="mr-1 inline size-2.5 align-[-1px]" />
                      Last checked{' '}
                      {describeAge(snapshot.checked_at, currentTime)}. The
                      provider may have moved since.
                    </>
                  ) : (
                    <>
                      {tightest
                        ? `${tightest.label} is closest to its limit. `
                        : ''}
                      Read from {provider}{' '}
                      {describeAge(snapshot.checked_at, currentTime)}.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The single line the collapsed card shows when there is no snapshot yet. */
function summaryLine({
  loading,
  failure,
  provider,
}: {
  loading: boolean;
  failure: UsageFailure | undefined;
  provider: string;
}): string {
  if (loading) return `Asking ${provider}…`;
  if (failure) return failureTitle(failure);
  return 'Nothing read yet — the provider’s own numbers, nothing stored.';
}

function summaryTone(entry: UsageEntry | undefined, stale: boolean): string {
  if (entry?.state === 'failed') return 'text-danger';
  if (stale) return 'text-ink-tertiary';
  if (entry?.state === 'ok') return 'text-ink-secondary';
  return 'text-ink-quaternary';
}

function WindowRow({
  window,
  stale,
  now,
}: {
  window: UsageWindow;
  stale: boolean;
  now: Date;
}) {
  const reset = describeReset(window.resets_at, now);
  const used = Math.round(window.percent_used);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-tertiary">{window.label}</span>
        <span className={`text-[11px] font-medium ${percentTone(used, stale)}`}>
          {used}% used
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full ${barTone(used, stale)}`}
          style={{ width: `${used}%` }}
        />
      </div>
      {reset && (
        <p className="mt-0.5 text-[10px] text-ink-quaternary">{reset}</p>
      )}
    </div>
  );
}

function barTone(used: number, stale: boolean): string {
  if (stale || used < 70) return 'bg-ink-quaternary';
  if (used >= 90) return 'bg-danger';
  return 'bg-[#d97706] dark:bg-[#fbbf24]';
}

function percentTone(used: number, stale: boolean): string {
  if (stale) return 'text-ink-tertiary';
  if (used >= 90) return 'text-danger';
  if (used >= 70) return 'text-[#d97706] dark:text-[#fbbf24]';
  return 'text-ink-secondary';
}

/**
 * Re-render on a slow tick so an open card's "3m ago" and its stale styling do
 * not freeze. Only worth doing while there is something to age.
 */
function useNow(now?: Date): Date {
  const [time, setTime] = useState(() => now ?? new Date());

  useEffect(() => {
    if (now) {
      setTime(now);
      return;
    }
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [now]);

  return now ?? time;
}

function failureTitle(failure: UsageFailure): string {
  switch (failure.kind) {
    case 'auth':
      return 'The provider rejected this key';
    case 'forbidden':
      return 'This key cannot read usage';
    case 'shape':
      return 'Unrecognized reply';
    case 'rate_limited':
      return 'Rate limited';
    case 'timeout':
      return 'No reply in time';
    default:
      return 'Could not read usage';
  }
}

function UsageFailureNote({ failure }: { failure: UsageFailure }) {
  return (
    <div className="rounded border border-line-subtle bg-surface-3 p-2">
      <p className="flex items-center gap-1 text-[11px] font-medium text-ink-tertiary">
        <Warning className="size-3 shrink-0" />
        {failureTitle(failure)}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-quaternary">
        {failure.message}
      </p>
    </div>
  );
}
