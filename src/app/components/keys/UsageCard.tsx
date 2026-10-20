import { useState } from 'react';
import { Clock, Gauge, Warning } from '@phosphor-icons/react';
import {
  describeAge,
  describeReset,
  supportsUsage,
  tightestWindow,
  unsupportedUsageReason,
  type UsageEntry,
  type UsageFailure,
} from '../../lib/usage';

/**
 * Allowance read from the provider on demand. Nothing here is stored in the
 * vault: the figures are only as good as the last request, so the card always
 * says when that was and refuses to show anything when the provider did not
 * actually answer.
 */
export function UsageCard({
  provider,
  entry,
  onRefresh,
  now = new Date(),
}: {
  provider: string;
  /** This session's result for the key, or undefined before the first query. */
  entry: UsageEntry | undefined;
  onRefresh: () => void;
  now?: Date;
}) {
  const [renderedAt] = useState(now);

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
  const snapshot = entry?.state === 'ok' ? entry.snapshot : undefined;
  const failure = entry?.state === 'failed' ? entry.failure : undefined;
  const tightest = tightestWindow(snapshot);

  return (
    <div className="rounded-lg bg-surface-2 border border-line-subtle p-3 mb-4 animate-stagger-in">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-ink-quaternary">
          <Gauge className="size-3" />
          Usage
        </span>
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

      {failure && <UsageFailureNote failure={failure} />}

      {!entry && (
        <p className="text-[11px] leading-relaxed text-ink-quaternary">
          Ask {provider} for {provider === 'OpenCode Go' ? 'its' : 'the'}{' '}
          allowance windows. Nothing is stored in this vault.
        </p>
      )}

      {snapshot && (
        <div className="space-y-2">
          {snapshot.windows.map((window) => {
            const reset = describeReset(window.resets_at, renderedAt);
            const used = Math.round(window.percent_used);
            return (
              <div key={window.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-ink-tertiary">
                    {window.label}
                  </span>
                  <span
                    className={`text-[11px] font-medium ${
                      used >= 90
                        ? 'text-danger'
                        : used >= 70
                          ? 'text-[#d97706] dark:text-[#fbbf24]'
                          : 'text-ink-secondary'
                    }`}
                  >
                    {used}% used
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${
                      used >= 90
                        ? 'bg-danger'
                        : used >= 70
                          ? 'bg-[#d97706] dark:bg-[#fbbf24]'
                          : 'bg-success-bright'
                    }`}
                    style={{ width: `${used}%` }}
                  />
                </div>
                {reset && (
                  <p className="mt-0.5 text-[10px] text-ink-quaternary">
                    {reset}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-ink-quaternary">
            {tightest ? `${tightest.label} is closest to its limit. ` : ''}
            Read from {provider} {describeAge(snapshot.checked_at, renderedAt)}.
          </p>
        </div>
      )}
    </div>
  );
}

function UsageFailureNote({ failure }: { failure: UsageFailure }) {
  const title =
    failure.kind === 'auth'
      ? 'The provider rejected this key'
      : failure.kind === 'forbidden'
        ? 'This key cannot read usage'
        : failure.kind === 'shape'
          ? 'Unrecognized reply'
          : failure.kind === 'rate_limited'
            ? 'Rate limited'
            : failure.kind === 'timeout'
              ? 'No reply in time'
              : 'Could not read usage';

  return (
    <div className="rounded border border-line-subtle bg-surface-3 p-2">
      <p className="flex items-center gap-1 text-[11px] font-medium text-ink-tertiary">
        <Warning className="size-3 shrink-0" />
        {title}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-quaternary">
        {failure.message}
      </p>
    </div>
  );
}
