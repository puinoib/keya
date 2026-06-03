import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ApiTester } from "../../lib/api-tester"
import type { ApiKey } from "../../../core/types"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Copy, MoreHorizontal, FlaskConical, Trash2, Pencil,
  Eye, EyeOff, Key,
} from "lucide-react"
import { maskKey } from "@/lib/mask"

export function KeyList() {
  const db = useStore((s) => s.db)
  const { searchQuery, filterGroupId, filterProvider, filterStatus, filterTestStatus, setShowAddForm, updateKey, deleteKey } = useStore()
  const [testing, setTesting] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)

  if (!db) return null

  let keys = db.getApiKeys()
  if (searchQuery) keys = db.searchKeys(searchQuery)
  if (filterGroupId) keys = keys.filter((k) => k.group_id === filterGroupId)
  if (filterProvider) keys = keys.filter((k) => k.provider === filterProvider)
  if (filterStatus) keys = keys.filter((k) => k.status === filterStatus)
  if (filterTestStatus) keys = keys.filter((k) => {
    if (filterTestStatus === "untested") return !k.test_status
    return k.test_status === filterTestStatus
  })

  const groups = db.getGroups()
  const getGroup = (id: string | null) => groups.find((g) => g.id === id)

  const handleTest = async (key: ApiKey) => {
    setTesting(key.id)
    const result = await ApiTester.testKey(key)
    updateKey(key.id, {
      last_tested: new Date().toISOString(),
      test_status: result.success ? "success" : "failed",
      test_latency_ms: result.latencyMs ?? null,
    })
    setTesting(null)
  }

  const handleCopy = async (keyValue: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(keyValue)
      setCopiedId(keyId)
      setTimeout(() => setCopiedId(null), 2000)
      setTimeout(() => navigator.clipboard.writeText(""), 15000)
    } catch { /* clipboard unavailable */ }
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center size-12 rounded-xl bg-surface-3 border border-line-subtle mb-4">
          <FlaskConical className="size-5 text-ink-quaternary" />
        </div>
        <h3 className="text-sm font-medium text-ink-secondary mb-1">No API Keys yet</h3>
        <p className="text-xs text-ink-quaternary mb-5">Add your first key to get started</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-bright transition-colors"
        >
          Add your first key
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {keys.map((key) => {
          const group = getGroup(key.group_id)
          const isTesting = testing === key.id
          const testOk = key.test_status === "success"
          const testFail = key.test_status === "failed"

          return (
            <div
              key={key.id}
              className="group flex items-center gap-4 px-4 py-3 rounded-lg
                         bg-surface-1 border border-line-2
                         hover:bg-surface-3 hover:border-line-4
                         transition-all duration-150"
            >
              {/* Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center size-9 rounded-lg shrink-0 text-base"
                       style={{ backgroundColor: (group?.color ?? "#5e6ad2") + "18", color: group?.color ?? "#7170ff" }}>
                    {group?.icon ? group.icon : <Key className="size-4" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{group?.name ?? "Ungrouped"}</TooltipContent>
              </Tooltip>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-primary truncate">{key.name}</span>
                  {testOk && <span className="shrink-0 size-1.5 rounded-full bg-success-bright" />}
                  {testFail && <span className="shrink-0 size-1.5 rounded-full bg-danger" />}
                  {!key.test_status && <span className="shrink-0 size-1.5 rounded-full bg-ink-quaternary/30" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-quaternary">
                  <span>{key.provider}</span>
                  {key.service && <><span className="text-divider">·</span><span>{key.service}</span></>}
                  <span className="text-divider">·</span>
                  <span className="font-mono text-2xs">{maskKey(key.key)}</span>
                  {testOk && key.test_latency_ms != null && (
                    <><span className="text-divider">·</span><span className="text-success-bright font-medium">{key.test_latency_ms}ms</span></>
                  )}
                  {testFail && <><span className="text-divider">·</span><span className="text-danger font-medium">Failed</span></>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleTest(key)} disabled={isTesting}
                            className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-primary hover:bg-surface-5 transition-colors disabled:opacity-50">
                      {isTesting ? <span className="size-3.5 border-2 border-ink-tertiary border-t-transparent rounded-full animate-spin" /> : <FlaskConical className="size-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isTesting ? "Testing..." : "Test key"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleCopy(key.key, key.id)}
                            className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-primary hover:bg-surface-5 transition-colors">
                      {copiedId === key.id ? <span className="text-xs text-success-bright font-medium">✓</span> : <Copy className="size-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{copiedId === key.id ? "Copied!" : "Copy to clipboard"}</TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-primary hover:bg-surface-5 transition-colors">
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setEditingKey(key)}>
                      <Pencil className="size-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCopy(key.key, key.id)}>
                      <Copy className="size-3.5" /> Copy Key
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTest(key)}>
                      <FlaskConical className="size-3.5" /> Test Key
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => { if (confirm("Delete this key?")) deleteKey(key.id) }}
                      className="text-danger focus:text-danger">
                      <Trash2 className="size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Dialog */}
      <EditKeyDialog
        key={editingKey?.id ?? "none"}
        editingKey={editingKey}
        onClose={() => setEditingKey(null)}
        onSave={(id, updates) => { updateKey(id, updates); setEditingKey(null) }}
      />
    </>
  )
}

/* ── Inline Edit Dialog ── */

const PROVIDERS = ["OpenAI", "Anthropic", "Google", "Groq", "DeepSeek", "Moonshot", "Zhipu", "Mistral", "Cohere", "Together", "Custom"]

function EditKeyDialog({ editingKey, onClose, onSave }: {
  editingKey: ApiKey | null
  onClose: () => void
  onSave: (id: string, updates: Partial<ApiKey>) => void
}) {
  const db = useStore((s) => s.db)
  const [showKey, setShowKey] = useState(false)
  const [form, setForm] = useState({
    name: editingKey?.name ?? "",
    key: editingKey?.key ?? "",
    provider: editingKey?.provider ?? "OpenAI",
    service: editingKey?.service ?? "",
    endpoint: editingKey?.endpoint ?? "",
    description: editingKey?.description ?? "",
    group_id: editingKey?.group_id ?? null as string | null,
  })

  const handleSave = () => {
    if (!editingKey || !form.name.trim()) return
    onSave(editingKey.id, {
      name: form.name.trim(),
      key: form.key.trim(),
      provider: form.provider,
      service: form.service,
      endpoint: form.endpoint,
      description: form.description,
      group_id: form.group_id,
    })
  }

  return (
    <Dialog open={editingKey !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleSave() }} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Key name" required />
          </div>

          {/* Key Value */}
          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="sk-..." className="pr-9 font-mono text-sm" required
              />
              <button type="button" onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-quaternary hover:text-ink-secondary">
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Provider & Service */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                      className="flex h-9 w-full rounded-md bg-surface-2 border border-line px-3 py-2 text-sm text-ink-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright appearance-none">
                {PROVIDERS.map((p) => <option key={p} value={p} className="bg-canvas-raised">{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Service</Label>
              <Input value={form.service} onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))} placeholder="e.g. ChatGPT" />
            </div>
          </div>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <Label className="text-xs">Endpoint</Label>
            <Input value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} placeholder="https://api.openai.com/v1" className="font-mono text-xs" />
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label className="text-xs">Group</Label>
            <select
              value={form.group_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value || null }))}
              className="flex h-9 w-full rounded-md bg-surface-2 border border-line px-3 py-2
                         text-sm text-ink-primary focus-visible:outline-none focus-visible:ring-1
                         focus-visible:ring-accent-bright appearance-none"
            >
              <option value="" className="bg-canvas-raised">Ungrouped</option>
              {db?.getGroups().map((g) => (
                <option key={g.id} value={g.id} className="bg-canvas-raised">{g.icon} {g.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm">Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
