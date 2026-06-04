import { useStore } from "../../store/useStore"
import { ApiTester } from "../../lib/api-tester"
import { maskKey } from "@/lib/mask"
import type { ApiKey } from "../../../core/types"
import {
  Copy, FlaskConical, Pencil, Trash2, Key, Eye, EyeOff, X,
  CheckCircle2, XCircle, MinusCircle, Clock, Globe, Tag, FileText,
} from "lucide-react"
import { useState, useEffect } from "react"
import { EditKeyDialog } from "./KeyList"

export function KeyDetail() {
  const { db, selectedKeyId, setSelectedKeyId, updateKey, deleteKey } = useStore()
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)

  useEffect(() => { setShowKey(false); setCopied(false) }, [selectedKeyId])

  if (!db || !selectedKeyId) return null

  const key = db.getApiKeys().find((k) => k.id === selectedKeyId)
  if (!key) return null

  const group = key.group_id ? db.getGroups().find((g) => g.id === key.group_id) : null
  const testOk = key.test_status === "success"
  const testFail = key.test_status === "failed"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(key.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      setTimeout(() => navigator.clipboard.writeText(""), 15000)
    } catch { /* clipboard unavailable */ }
  }

  const handleTest = async () => {
    setTesting(true)
    const result = await ApiTester.testKey(key)
    updateKey(key.id, {
      last_tested: new Date().toISOString(),
      test_status: result.success ? "success" : "failed",
      test_latency_ms: result.latency_ms ?? null,
    })
    setTesting(false)
  }

  const handleDelete = () => {
    if (confirm("Delete this key?")) {
      deleteKey(key.id)
      setSelectedKeyId(null)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <>
      <div
        className="w-72 mr-3 mt-10 mb-3 flex flex-col rounded-xl
                   bg-canvas-raised border border-line shadow-elevated
                   overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 animate-stagger-in" style={{ animationDelay: "40ms" }}>
          <span className="text-2xs font-medium text-ink-quaternary uppercase tracking-wider">Overview</span>
          <button
            onClick={() => setSelectedKeyId(null)}
            className="inline-flex items-center justify-center size-6 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-100"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
          {/* Identity */}
          <div className="flex items-center gap-2.5 mb-3 animate-stagger-in" style={{ animationDelay: "80ms" }}>
            <div className="flex items-center justify-center size-10 rounded-xl bg-accent/10 text-accent-bright text-lg shrink-0">
              {group?.icon ? group.icon : <Key className="size-4.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-ink-primary truncate">{key.name}</h2>
              <p className="text-2xs text-ink-quaternary">{group?.name ?? "Ungrouped"}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 mb-4 animate-stagger-in" style={{ animationDelay: "120ms" }}>
            {testOk && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success-bright text-2xs font-medium">
                <CheckCircle2 className="size-3" /> Working
              </span>
            )}
            {testFail && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-danger/10 text-danger text-2xs font-medium">
                <XCircle className="size-3" /> Failed
              </span>
            )}
            {!key.test_status && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-3 text-ink-quaternary text-2xs font-medium">
                <MinusCircle className="size-3" /> Untested
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-3 text-ink-tertiary text-2xs font-medium">
              {key.status}
            </span>
          </div>

          {/* Key Value */}
          <div className="rounded-lg bg-surface-2 border border-line-subtle p-3 mb-4 animate-stagger-in" style={{ animationDelay: "160ms" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-2xs text-ink-quaternary">API Key</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="inline-flex items-center justify-center size-5 rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
                >
                  {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center size-5 rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
                >
                  {copied ? <CheckCircle2 className="size-3 text-success-bright" /> : <Copy className="size-3" />}
                </button>
              </div>
            </div>
            <p className="font-mono text-xs text-ink-secondary break-all leading-relaxed select-all">
              {showKey ? key.key : maskKey(key.key)}
            </p>
          </div>

          {/* Meta fields */}
          <div className="space-y-3 animate-stagger-in" style={{ animationDelay: "200ms" }}>
            <MetaRow icon={Tag} label="Provider" value={key.provider} />
            {key.endpoint && <MetaRow icon={Globe} label="Endpoint" value={key.endpoint} mono />}
            {key.test_latency_ms != null && (
              <MetaRow icon={FlaskConical} label="Latency" value={`${key.test_latency_ms}ms`} highlight={testOk} />
            )}
            {key.last_tested && <MetaRow icon={Clock} label="Last tested" value={formatDate(key.last_tested)} />}
            <MetaRow icon={Clock} label="Created" value={formatDate(key.created_at)} />
            {key.description && <MetaRow icon={FileText} label="Description" value={key.description} />}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-line-subtle shrink-0 space-y-1 animate-stagger-in" style={{ animationDelay: "240ms" }}>
          <button
            onClick={handleTest}
            disabled={testing}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100 disabled:opacity-50"
          >
            {testing
              ? <span className="size-3 border-[1.5px] border-ink-tertiary border-t-transparent rounded-full animate-spin" />
              : <FlaskConical className="size-3.5" />}
            {testing ? "Testing..." : "Test Key"}
          </button>
          <button
            onClick={() => setEditingKey(key)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink-primary hover:bg-surface-3 transition-colors duration-100"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-danger/70 hover:text-danger hover:bg-danger/5 transition-colors duration-100"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      </div>

      <EditKeyDialog
        key={editingKey?.id ?? "none"}
        editingKey={editingKey}
        onClose={() => setEditingKey(null)}
        onSave={(id, updates) => { updateKey(id, updates); setEditingKey(null) }}
      />
    </>
  )
}

function MetaRow({ icon: Icon, label, value, mono, highlight }: {
  icon: React.ElementType
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-3 text-ink-quaternary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-2xs text-ink-quaternary">{label}</p>
        <p className={`text-xs ${highlight ? "text-success-bright font-medium" : "text-ink-secondary"} ${mono ? "font-mono break-all" : "break-words"}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
