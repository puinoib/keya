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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Copy, MoreHorizontal, FlaskConical, Trash2, Pencil,
  Eye, EyeOff, Key, Plus, Search,
} from "lucide-react"
import { maskKey } from "@/lib/mask"

export function KeyList() {
  const db = useStore((s) => s.db)
  const { searchQuery, filterGroupId, filterProvider, filterStatus, filterTestStatus, selectedKeyId, setSelectedKeyId, setShowAddForm, updateKey, deleteKey } = useStore()
  const [testing, setTesting] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)

  if (!db) return null

  let keys = db.getApiKeys()
  if (searchQuery) keys = db.searchKeys(searchQuery)
  if (filterGroupId) {
    keys = filterGroupId === "__ungrouped__"
      ? keys.filter((k) => !k.group_id)
      : keys.filter((k) => k.group_id === filterGroupId)
  }
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

  const hasFilters = searchQuery || filterGroupId || filterProvider || filterStatus || filterTestStatus

  if (keys.length === 0 && !hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex items-center justify-center size-14 rounded-2xl bg-accent-default/10 text-accent-bright mb-5">
          <Key className="size-6" />
        </div>
        <h3 className="text-sm font-semibold text-ink-primary mb-1.5">No API Keys yet</h3>
        <p className="text-xs text-ink-quaternary mb-6 max-w-[200px]">Securely store and manage your API keys in one place</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent-default px-4 py-2 text-xs font-medium text-white hover:bg-accent-bright transition-colors duration-150"
        >
          <Plus className="size-3.5" />
          Add your first key
        </button>
      </div>
    )
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center size-10 rounded-xl bg-surface-3 text-ink-quaternary mb-3">
          <Search className="size-4" />
        </div>
        <p className="text-sm text-ink-tertiary">No keys match your filters</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-1">
        {keys.map((key) => {
          const group = getGroup(key.group_id)
          const isTesting = testing === key.id
          const testOk = key.test_status === "success"
          const testFail = key.test_status === "failed"

          return (
            <div
              key={key.id}
              onClick={() => setSelectedKeyId(selectedKeyId === key.id ? null : key.id)}
              className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-lg cursor-pointer
                         transition-all duration-200
                         ${selectedKeyId === key.id ? "bg-surface-4" : "hover:bg-surface-3"}`}
            >
              {/* Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center size-8 rounded-lg bg-surface-4 text-ink-secondary shrink-0 text-sm">
                    {group?.icon ? group.icon : <Key className="size-3.5" />}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{group?.name ?? "Ungrouped"}</TooltipContent>
              </Tooltip>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink-primary truncate">{key.name}</span>
                  {testOk && <span className="shrink-0 size-1.5 rounded-full bg-success-bright" />}
                  {testFail && <span className="shrink-0 size-1.5 rounded-full bg-danger" />}
                  {!key.test_status && <span className="shrink-0 size-1.5 rounded-full bg-ink-quaternary/30" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-2xs text-ink-quaternary">
                  <span>{key.provider}</span>
                  <span className="text-divider">·</span>
                  <span className="font-mono">{maskKey(key.key)}</span>
                  {testOk && key.test_latency_ms != null && (
                    <><span className="text-divider">·</span><span className="text-success-bright font-medium">{key.test_latency_ms}ms</span></>
                  )}
                  {testFail && <><span className="text-divider">·</span><span className="text-danger font-medium">Failed</span></>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleTest(key)} disabled={isTesting}
                            className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-5 transition-colors duration-100 disabled:opacity-50">
                      {isTesting ? <span className="size-3 border-[1.5px] border-ink-tertiary border-t-transparent rounded-full animate-spin" /> : <FlaskConical className="size-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{isTesting ? "Testing..." : "Test key"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleCopy(key.key, key.id)}
                            className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-5 transition-colors duration-100">
                      {copiedId === key.id ? <span className="text-xs text-success-bright font-medium">✓</span> : <Copy className="size-3.5" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{copiedId === key.id ? "Copied!" : "Copy to clipboard"}</TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-5 transition-colors duration-100">
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

export function EditKeyDialog({ editingKey, onClose, onSave }: {
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

          {/* Provider */}
          <div className="space-y-1.5">
            <Label className="text-xs">Provider</Label>
            <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <Label className="text-xs">Endpoint</Label>
            <Input value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} placeholder="https://api.openai.com/v1" className="font-mono text-xs" />
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label className="text-xs">Group</Label>
            <Select
              value={form.group_id ?? "__none__"}
              onValueChange={(v) => setForm((f) => ({ ...f, group_id: v === "__none__" ? null : v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Ungrouped</SelectItem>
                {db?.getGroups().map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.icon} {g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
