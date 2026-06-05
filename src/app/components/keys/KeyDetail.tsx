import { useStore } from '../../store/useStore';
import { ApiTester } from '../../lib/api-tester';
import { maskKey } from '@/lib/mask';
import { toast } from 'sonner';
import type { ApiKey } from '../../../core/types';
import {
  getConnectionStatusLabel,
  getExpiryStatus,
  getExpiryStatusLabel,
} from '../../../core';
import {
  Copy,
  Flask,
  PencilSimple,
  Trash,
  Eye,
  EyeSlash,
  X,
  CheckCircle,
  XCircle,
  MinusCircle,
  Clock,
  Globe,
  Tag,
  FileText,
  Warning,
} from '@phosphor-icons/react';
import { useState, useEffect } from 'react';
import { EditKeyDialog } from './KeyList';
import { useAppHotkey } from '@/app/hooks/useAppHotkey';

export function KeyDetail() {
  const { db, selectedKeyId, setSelectedKeyId, updateKey, deleteKey } =
    useStore();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);

  useEffect(() => {
    setShowKey(false);
    setCopied(false);
  }, [selectedKeyId]);

  useAppHotkey('key.reveal', () => setShowKey((visible) => !visible), {
    enabled: !!selectedKeyId && !editingKey,
  });

  if (!db || !selectedKeyId) return null;

  const key = db.getApiKeys().find((k) => k.id === selectedKeyId);
  if (!key) return null;

  const group = key.group_id
    ? db.getGroups().find((g) => g.id === key.group_id)
    : null;
  const connectionStatus = key.connection_check.status;
  const testOk = connectionStatus === 'success';
  const testFail = connectionStatus === 'failed';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(key.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => navigator.clipboard.writeText(''), 15000);
      toast.success('Copied to clipboard');
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await ApiTester.testKey(key);
    updateKey(key.id, {
      connection_check: {
        status: result.success ? 'success' : 'failed',
        checked_at: new Date().toISOString(),
        latency_ms: result.latency_ms ?? null,
        error_message: result.success ? null : (result.error ?? null),
      },
    });
    setTesting(false);
    toast[result.success ? 'success' : 'error'](
      result.success ? 'Connection test succeeded' : 'Connection test failed',
      {
        description: result.success
          ? `${result.latency_ms}ms`
          : result.error || 'Connection failed',
      }
    );
  };

  const handleDelete = () => {
    if (confirm('Delete this key?')) {
      const name = key.name;
      deleteKey(key.id);
      setSelectedKeyId(null);
      toast.success(`Deleted "${name}"`);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const expiryStatus = getExpiryStatus(key.expires_at);
  const groupLabel = group ? `${group.icon} ${group.name}` : '📥 Ungrouped';
  const expiryLabel =
    expiryStatus === 'expired' || expiryStatus === 'expiring_soon'
      ? getExpiryStatusLabel(expiryStatus)
      : null;
  const expiryValue = key.expires_at
    ? [formatDate(key.expires_at), expiryLabel].filter(Boolean).join(' · ')
    : 'Never';

  return (
    <>
      <div
        className="w-72 mr-3 mt-12 mb-3 flex flex-col rounded-xl
                   bg-canvas-raised border border-line shadow-elevated
                   overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 scrollbar-thin">
          {/* Identity */}
          <div
            className="flex items-start justify-between gap-3 mb-3 animate-stagger-in"
            style={{ animationDelay: '40ms' }}
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-ink-primary truncate">
                {key.name}
              </h2>
              <p className="mt-1 truncate text-xs text-ink-tertiary">
                {key.provider}
              </p>
              {testFail && key.connection_check.error_message && (
                <p className="mt-1.5 text-xs text-danger/80 break-words">
                  {key.connection_check.error_message}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedKeyId(null)}
              className="inline-flex items-center justify-center size-6 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-100 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Status */}
          <div
            className="mb-4 flex flex-wrap items-center gap-1.5 animate-stagger-in"
            style={{ animationDelay: '120ms' }}
          >
            {testOk && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success-bright">
                <CheckCircle className="size-3" />
                {getConnectionStatusLabel(connectionStatus)}
              </span>
            )}
            {testFail && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                <XCircle className="size-3" /> Failed
              </span>
            )}
            {connectionStatus === 'untested' && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-quaternary">
                <MinusCircle className="size-3" /> Untested
              </span>
            )}
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
          </div>

          {/* Key Value */}
          <div
            className="rounded-lg bg-surface-2 border border-line-subtle p-3 mb-4 animate-stagger-in"
            style={{ animationDelay: '160ms' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-ink-quaternary">API Key</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setShowKey(!showKey)}
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
              {showKey ? key.key : maskKey(key.key)}
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
              />
            )}
            <MetaRow icon={Tag} label="Group" value={groupLabel} />
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
                  key.connection_check.checked_at
                    ? formatDate(key.connection_check.checked_at)
                    : 'Never'
                }
              />
              <MetaRow
                icon={Flask}
                label="Latency"
                value={
                  key.connection_check.latency_ms != null
                    ? `${key.connection_check.latency_ms}ms`
                    : '-'
                }
                highlight={testOk && key.connection_check.latency_ms != null}
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
                value={formatDate(key.updated_at)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="px-4 py-3 border-t border-line-subtle shrink-0 space-y-1 animate-stagger-in"
          style={{ animationDelay: '240ms' }}
        >
          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100 disabled:opacity-50"
          >
            {testing ? (
              <span className="size-3 border-[1.5px] border-ink-tertiary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Flask className="size-3.5" />
            )}
            {testing ? 'Testing...' : 'Test Key'}
          </button>
          <button
            onClick={() => setEditingKey(key)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100"
          >
            <PencilSimple className="size-3.5" /> Edit
          </button>
          <button
            onClick={handleDelete}
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
          updateKey(id, updates);
          setEditingKey(null);
        }}
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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  tone?: 'danger' | 'warning';
  detail?: string;
  nowrap?: boolean;
}) {
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

  return (
    <div className="flex items-start gap-2">
      <Icon className={`size-3 mt-0.5 shrink-0 ${iconClassName}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-quaternary">{label}</p>
        <p
          className={`text-xs ${valueClassName} ${mono ? 'font-mono break-all' : nowrap ? 'whitespace-nowrap' : 'break-words'}`}
        >
          {value}
        </p>
        {detail && detail !== value && (
          <p className={`mt-0.5 text-xs ${detailClassName}`}>{detail}</p>
        )}
      </div>
    </div>
  );
}
