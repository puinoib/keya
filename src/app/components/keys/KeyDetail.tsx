import { useStore } from '../../store/useStore';
import { useNavigate } from '@tanstack/react-router';
import { ApiTester, unverifiableReason } from '../../lib/api-tester';
import {
  checkOf,
  expiryOf,
  keyById,
  plaintextTargetOf,
  sortedGroups,
} from '../../state/view';
import { keysSearch } from '../../state/keys-search';
import { expiryToDate, expiryStatusLabel } from '../../state/presentation';
import { providerLabel } from '../../state/providers';
import {
  describeTestResult,
  getTestActionHint,
  getTestActionLabel,
} from '../../lib/test-feedback';
import { maskKey } from '@/lib/mask';
import { toast } from 'sonner';
import { scheduleClipboardClear } from '../../lib/clipboard';
import type { Key } from '../../../core/payload/types';
import { getProviderLogo } from '@/app/lib/provider-logo';
import { checkStateHint, describeFailure } from '../../state/presentation';
import { isUnverified } from '../../../core/runtime/observations';
import {
  Archive,
  ArrowCounterClockwise,
  Copy,
  Flask,
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  X,
  CheckCircle,
  Clock,
  Globe,
  FileText,
  Warning,
} from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { EditKeyDialog } from './KeyList';
import { UsageCard } from './UsageCard';
import { DeleteKeyDialog } from './DeleteKeyDialog';
import { useAppHotkey } from '@/app/hooks/useAppHotkey';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function KeyDetail() {
  const navigate = useNavigate();
  const {
    view,
    selectedKeyId,
    setSelectedKeyId,
    updateKey,
    archiveKey,
    restoreKey,
    refreshUsage,
    usage,
    filterGroupId,
    setFilterGroupId,
    setFilterProvider,
    setShowArchived,
  } = useStore();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingKey, setEditingKey] = useState<Key | null>(null);
  const [deletingKey, setDeletingKey] = useState<Key | null>(null);

  useEffect(() => {
    setShowKey(false);
    setCopied(false);
  }, [selectedKeyId]);

  useAppHotkey('key.reveal', () => setShowKey((visible) => !visible), {
    enabled: !!selectedKeyId && !editingKey,
  });

  if (!view || !selectedKeyId) return null;

  const key = keyById(view, selectedKeyId);
  if (!key) return null;

  const providers = view.file.providers;
  const provider = providerLabel(key.provider_id, providers);
  const group = key.group_id
    ? sortedGroups(view).find((entry) => entry.id === key.group_id)
    : null;
  const check = checkOf(view, key);
  const observed = check.observation;
  const connectionStatus = check.status;
  const stateHint = checkStateHint(check);
  const plannedKind = check.kind;
  const testOk = connectionStatus === 'success';
  const testFail = connectionStatus === 'failed';
  // A rejection is about the credential; a network or timeout failure is not.
  const testUnverified =
    connectionStatus === 'failed' && observed !== undefined
      ? isUnverified(observed)
      : false;
  const checkError =
    check.kind === 'unverifiable'
      ? unverifiableReason(provider)
      : (observed?.detail_code ?? null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(key.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      scheduleClipboardClear(key.secret);
      toast.success('Copied to clipboard');
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleTest = async () => {
    if (key.archived_at) return;
    const vaultId = useStore.getState().view?.vaultId;
    setTesting(true);
    const result = await ApiTester.testStored(key.id);
    if (useStore.getState().view?.vaultId !== vaultId) {
      setTesting(false);
      return;
    }
    setTesting(false);
    if (!result) return;
    const feedback = describeTestResult(result);
    toast[result.success ? 'success' : 'error'](feedback.title, {
      description: feedback.description,
    });
  };

  const handleArchive = () => {
    archiveKey(key.id);
    toast.success(`Archived "${key.name}"`, {
      action: { label: 'Undo', onClick: () => restoreKey(key.id) },
    });
  };

  const handleRestore = () => {
    restoreKey(key.id);
    toast.success(`Restored "${key.name}"`);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const expiryStatus = expiryOf(view, key).status;
  const expiryDate = expiryToDate(key.expiry);
  const groupLabel = group ? `${group.icon} ${group.name}` : '📥 Ungrouped';
  const expiryLabel =
    expiryStatus === 'expired' || expiryStatus === 'expiring_soon'
      ? expiryStatusLabel(expiryStatus)
      : null;
  const expiryValue = expiryDate
    ? [formatDate(expiryDate.toISOString()), expiryLabel]
        .filter(Boolean)
        .join(' · ')
    : 'Never';
  // The list encodes the last check as a dot; the panel shows the same dot for
  // the same key, and puts the words behind it on hover instead of a second
  // badge. Colour alone is never the only carrier: the tooltip says the rest.
  const statusDot = testOk
    ? 'bg-success-bright'
    : testUnverified
      ? 'bg-amber-500'
      : testFail
        ? 'bg-danger'
        : 'bg-ink-quaternary/35';
  const verdictHint =
    check.kind === 'unverifiable'
      ? (checkError ??
        stateHint ??
        'Keya cannot verify this provider from a browser.')
      : testOk
        ? check.kind === 'credential'
          ? 'Verified: the provider accepted this credential.'
          : 'Reachable: the endpoint answered. This does not prove the credential is valid.'
        : testFail
          ? testUnverified
            ? `Could not verify: ${describeFailure(observed) ?? 'the last request did not finish'}. This says nothing about the credential.`
            : `Rejected: ${describeFailure(observed) ?? 'the provider did not accept this credential'}.`
          : 'Untested: no check has run from this device yet.';
  const plaintextTarget = plaintextTargetOf(view, key);
  const showStatusChips = Boolean(
    expiryLabel || (stateHint && (check.manualOnly || check.needsAuthorization))
  );

  /** Group is a filter, so using it means leaving the panel whose row it came from. */
  const handleGroupClick = () => {
    // The group filter belongs to the active scope. An archived key therefore
    // opens the active list for that group rather than reintroducing the
    // archived-plus-group state that the sidebar avoids.
    const groupId = key.group_id ?? '__ungrouped__';
    setShowArchived(false);
    setFilterGroupId(groupId);
    setSelectedKeyId(null);
    navigate({ to: '/keys', search: keysSearch({ groupId }) });
  };

  /** The provider is a filter in exactly the same way. */
  const handleProviderClick = () => {
    const archived = Boolean(key.archived_at);
    setShowArchived(archived);
    setFilterProvider(provider);
    setSelectedKeyId(null);
    navigate({
      to: '/keys',
      search: keysSearch({
        archived,
        groupId: archived ? null : filterGroupId,
      }),
    });
  };
  const groupTitle = key.group_id
    ? `Filter the list by ${group?.name ?? 'this group'}`
    : 'Filter the list by ungrouped keys';

  return (
    <>
      {/* The card fills the animated wrapper minus its right gutter, so the
          wrapper is the only place the panel width is decided. */}
      <div
        className="w-[calc(100%-0.75rem)] mr-3 flex h-full min-h-0 flex-col rounded-xl
                   bg-canvas-raised border border-line shadow-elevated
                   overflow-hidden"
      >
        {/* Identity and status stay put while the details scroll. */}
        <div className="shrink-0 px-4 pt-4">
          {/* Identity */}
          <div
            className="flex items-start justify-between gap-3 animate-stagger-in"
            style={{ animationDelay: '40ms' }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                {key.archived_at ? (
                  <Archive className="size-3 shrink-0 text-ink-quaternary" />
                ) : (
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      delay={200}
                      aria-label={verdictHint}
                      className="inline-flex size-3 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright/40"
                    >
                      <span
                        className={`size-1.5 rounded-full ${statusDot}`}
                        aria-hidden
                      />
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6} className="max-w-56">
                      {verdictHint}
                    </TooltipContent>
                  </Tooltip>
                )}
                <h2 className="min-w-0 truncate text-base font-semibold text-ink-primary">
                  {key.name}
                </h2>
              </div>
              {/* Belonging: what this key is, and where it is filed. Both are
                  filters, so both lead back to the list. */}
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink-tertiary">
                <button
                  type="button"
                  onClick={handleProviderClick}
                  title={`Filter the list by ${provider}`}
                  className="inline-flex min-w-0 items-center gap-1.5 rounded transition-colors duration-100 hover:text-ink-primary"
                >
                  {getProviderLogo(provider) && (
                    <img
                      src={getProviderLogo(provider)!}
                      alt=""
                      className="size-3 shrink-0"
                    />
                  )}
                  <span className="truncate">{provider}</span>
                </button>
                <span className="shrink-0 text-divider">·</span>
                <button
                  type="button"
                  onClick={handleGroupClick}
                  title={groupTitle}
                  className="inline-flex min-w-0 items-center gap-1 rounded transition-colors duration-100 hover:text-ink-primary"
                >
                  <span className="truncate">{groupLabel}</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedKeyId(null)}
              aria-label="Close the key details"
              className="inline-flex items-center justify-center size-6 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-100 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {!key.archived_at && showStatusChips && (
            <div
              className="mt-3 flex flex-wrap items-center gap-1.5 animate-stagger-in"
              style={{ animationDelay: '120ms' }}
            >
              {expiryLabel && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    expiryStatus === 'expired'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-[#d97706]/10 text-[#d97706] dark:bg-[#fbbf24]/10 dark:text-[#fbbf24]'
                  }`}
                >
                  <Warning className="size-3" /> {expiryLabel}
                </span>
              )}
              {stateHint && (check.manualOnly || check.needsAuthorization) && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-quaternary">
                  <Warning className="size-3" /> {stateHint}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-4 scrollbar-hidden">
          {key.archived_at && (
            <div className="mb-4 rounded-md border border-line-subtle bg-surface-2 px-2 py-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
                <Archive className="size-3" />
                Archived {formatDate(key.archived_at)}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-quaternary">
                Archived credentials are excluded from tests and from the Inbox.
              </p>
            </div>
          )}

          {testFail && !key.archived_at && checkError && (
            <p
              className={`mb-4 text-xs break-words ${
                testUnverified ? 'text-ink-quaternary' : 'text-danger/80'
              }`}
            >
              {checkError}
            </p>
          )}

          {plaintextTarget && !key.archived_at && (
            <p className="mb-4 rounded-md border border-amber-500/25 bg-amber-500/5 p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <Warning className="mr-1 inline size-3 align-[-2px]" />
              This key travels in clear text to {plaintextTarget.origin}. A
              check is approved one request at a time; a plain http destination
              never keeps standing consent.
            </p>
          )}

          {!key.archived_at && check.kind === 'unverifiable' && (
            <p className="mb-4 rounded-md border border-line-subtle bg-surface-2 p-2.5 text-[11px] leading-relaxed text-ink-quaternary">
              {stateHint ?? checkError ?? unverifiableReason(provider)}
            </p>
          )}

          {/* Key Value */}
          <div
            className="rounded-lg bg-surface-2 border border-line-subtle p-3 mb-4 animate-stagger-in"
            style={{ animationDelay: '160ms' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-ink-quaternary">
                API Key or Token
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? 'Hide credential' : 'Show credential'}
                  className="inline-flex items-center justify-center size-5 rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
                >
                  {showKey ? (
                    <EyeSlash className="size-3" />
                  ) : (
                    <Eye className="size-3" />
                  )}
                </button>
                <button
                  onClick={handleCopy}
                  aria-label="Copy the credential"
                  className="inline-flex items-center justify-center size-5 rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
                >
                  {copied ? (
                    <CheckCircle className="size-3 text-success-bright" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
            </div>
            <p className="font-mono text-xs text-ink-secondary break-all leading-relaxed select-all">
              {showKey ? key.secret : maskKey(key.secret)}
            </p>
          </div>

          {/* Meta fields */}
          <div
            className="space-y-3 animate-stagger-in"
            style={{ animationDelay: '200ms' }}
          >
            {key.endpoint && (
              <MetaRow
                icon={Globe}
                label="Endpoint"
                value={key.endpoint}
                mono
                copyable
              />
            )}
            {key.description && (
              <MetaRow
                icon={FileText}
                label="Description"
                value={key.description}
              />
            )}
            <MetaRow
              icon={Warning}
              label="Expires"
              value={expiryValue}
              nowrap
              tone={
                expiryStatus === 'expired'
                  ? 'danger'
                  : expiryStatus === 'expiring_soon'
                    ? 'warning'
                    : undefined
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <MetaRow
                icon={Clock}
                label="Last tested"
                value={
                  observed?.finished_at
                    ? formatDate(observed.finished_at)
                    : 'Never'
                }
              />
              <MetaRow
                icon={Flask}
                label="Latency"
                value={
                  observed?.latency_ms != null
                    ? `${observed.latency_ms}ms`
                    : '-'
                }
                highlight={testOk && observed?.latency_ms != null}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetaRow
                icon={Clock}
                label="Created"
                value={formatDate(key.created_at)}
              />
              <MetaRow
                icon={Clock}
                label="Updated"
                value={formatDate(key.content_updated_at)}
              />
            </div>
          </div>

          {/* The only provider-specific block, so it goes last: everything
              above it has the same place in every key's panel. */}
          <div className="mt-4">
            <UsageCard
              key={key.id}
              provider={provider}
              entry={usage[key.id]}
              onRefresh={() => void refreshUsage(key.id)}
            />
          </div>
        </div>

        {/* Actions */}
        <div
          className="px-4 py-3 border-t border-line-subtle shrink-0 space-y-1 animate-stagger-in"
          style={{ animationDelay: '240ms' }}
        >
          {key.archived_at ? (
            <button
              onClick={handleRestore}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100"
            >
              <ArrowCounterClockwise className="size-3.5" /> Restore
            </button>
          ) : (
            <>
              <button
                onClick={handleTest}
                disabled={testing}
                title={getTestActionHint(plannedKind)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100 disabled:opacity-50"
              >
                {testing ? (
                  <span className="size-3 border-[1.5px] border-ink-tertiary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Flask className="size-3.5" />
                )}
                {testing ? 'Testing...' : getTestActionLabel(plannedKind)}
              </button>
              <button
                onClick={() => setEditingKey(key)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100"
              >
                <PencilSimple className="size-3.5" /> Edit
              </button>
              <button
                onClick={handleArchive}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100"
              >
                <Archive className="size-3.5" /> Archive
              </button>
            </>
          )}
          <button
            onClick={() => setDeletingKey(key)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-danger/70 hover:text-danger hover:bg-danger/5 transition-colors duration-100"
          >
            <Trash className="size-3.5" /> Delete
          </button>
        </div>
      </div>

      <EditKeyDialog
        key={editingKey?.id ?? 'none'}
        editingKey={editingKey}
        onClose={() => setEditingKey(null)}
        onSave={(id, updates) => {
          if (!updateKey(id, updates)) return false;
          setEditingKey(null);
          return true;
        }}
      />

      <DeleteKeyDialog
        deletingKey={deletingKey}
        onClose={() => setDeletingKey(null)}
      />
    </>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
  highlight,
  tone,
  detail,
  nowrap,
  copyable,
  valueTitle,
  onValueClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  tone?: 'danger' | 'warning';
  detail?: string;
  nowrap?: boolean;
  /** Adds a copy control for values a reader pastes elsewhere. */
  copyable?: boolean;
  /** Makes the value a button, with this as its tooltip. */
  valueTitle?: string;
  onValueClick?: () => void;
}) {
  const [copiedValue, setCopiedValue] = useState(false);
  const iconClassName =
    tone === 'danger'
      ? 'text-danger'
      : tone === 'warning'
        ? 'text-[#d97706] dark:text-[#fbbf24]'
        : 'text-ink-quaternary';
  const valueClassName =
    tone === 'danger'
      ? 'text-danger font-medium'
      : tone === 'warning'
        ? 'text-[#d97706] dark:text-[#fbbf24] font-medium'
        : highlight
          ? 'text-success-bright font-medium'
          : 'text-ink-secondary';
  const detailClassName =
    tone === 'danger'
      ? 'text-danger/80'
      : tone === 'warning'
        ? 'text-[#d97706]/80 dark:text-[#fbbf24]/80'
        : 'text-ink-quaternary';
  const valueClass = `text-xs ${valueClassName} ${
    mono ? 'font-mono break-all' : nowrap ? 'whitespace-nowrap' : 'break-words'
  }`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(true);
      setTimeout(() => setCopiedValue(false), 2000);
      toast.success('Copied to clipboard');
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex items-start gap-2">
      <Icon className={`size-3 mt-0.5 shrink-0 ${iconClassName}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-quaternary">{label}</p>
        <div className="flex items-start gap-1">
          {onValueClick ? (
            <button
              type="button"
              onClick={onValueClick}
              title={valueTitle}
              className={`min-w-0 text-left transition-colors hover:text-ink-primary ${valueClass}`}
            >
              {value}
            </button>
          ) : (
            <p className={`min-w-0 ${valueClass}`}>{value}</p>
          )}
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy ${label.toLowerCase()}`}
              title={copiedValue ? 'Copied!' : `Copy ${label.toLowerCase()}`}
              className="inline-flex size-4 shrink-0 items-center justify-center rounded text-ink-quaternary transition-colors hover:text-ink-secondary"
            >
              {copiedValue ? (
                <CheckCircle className="size-3 text-success-bright" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          )}
        </div>
        {detail && detail !== value && (
          <p className={`mt-0.5 text-xs ${detailClassName}`}>{detail}</p>
        )}
      </div>
    </div>
  );
}
