import { useState, useEffect, useRef } from "react"
import { format } from "date-fns"
import { DayPicker } from "./DayPicker"
import { useStore } from "../../store/useStore"
import { ApiTester } from "../../lib/api-tester"
import type { ApiKey } from "../../../core/types"
import { ENDPOINT_DEFAULTS, getProvidersForDropdown } from "../../../core/types"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialogRoot as AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Copy, MoreHorizontal, FlaskConical, Trash2, Pencil,
  Eye, EyeOff, Key, Plus, Search, RotateCcw, CheckCircle2, XCircle, Loader2, CalendarIcon, X,
} from "lucide-react"
import { maskKey } from "@/lib/mask"
import { useToast } from "@/components/ui/toast"

export function KeyList() {
  const db = useStore((s) => s.db)
  const { searchQuery, filterGroupId, filterProvider, filterTestStatus, selectedKeyId, setSelectedKeyId, setShowAddForm, updateKey, deleteKey } = useStore()
  const [testing, setTesting] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null)
  const toast = useToast()

  if (!db) return null

  let keys = db.getApiKeys()
  if (searchQuery) keys = db.searchKeys(searchQuery)
  if (filterGroupId) {
    keys = filterGroupId === "__ungrouped__"
      ? keys.filter((k) => !k.group_id)
      : keys.filter((k) => k.group_id === filterGroupId)
  }
  if (filterProvider) keys = keys.filter((k) => k.provider === filterProvider)
  if (filterTestStatus) keys = keys.filter((k) => {
    if (filterTestStatus === "untested") return !k.test_status
    return k.test_status === filterTestStatus
  })

  // Deselect if the selected key is filtered out
  useEffect(() => {
    if (selectedKeyId && !keys.some((k) => k.id === selectedKeyId)) {
      setSelectedKeyId(null)
    }
  }, [selectedKeyId, keys])

  const groups = db.getGroups()
  const getGroup = (id: string | null) => groups.find((g) => g.id === id)

  const handleTest = async (key: ApiKey) => {
    setTesting(key.id)
    const result = await ApiTester.testKey(key)
    updateKey(key.id, {
      last_tested: new Date().toISOString(),
      test_status: result.success ? "success" : "failed",
      test_latency_ms: result.latency_ms ?? null,
    })
    setTesting(null)
    toast.add({
      title: result.success ? "Key available" : "Key test failed",
      description: result.success ? `${key.name} — ${result.latency_ms}ms` : (result.error || "Connection failed"),
      type: result.success ? "success" : "error",
      timeout: 3000,
    })
  }

  const handleCopy = async (keyValue: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(keyValue)
      setCopiedId(keyId)
      setTimeout(() => setCopiedId(null), 2000)
      setTimeout(() => navigator.clipboard.writeText(""), 15000)
      toast.add({ title: "Copied to clipboard", timeout: 2000 })
    } catch { /* clipboard unavailable */ }
  }

  const hasFilters = searchQuery || filterGroupId || filterProvider || filterTestStatus

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
          const isExpired = key.expires_at ? new Date(key.expires_at) < new Date() : false
          const isExpiringSoon = !isExpired && key.expires_at ? (new Date(key.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7 : false

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
                  <span className="text-sm font-medium text-ink-primary truncate">{key.name}</span>
                  {isExpired && <span className="shrink-0 size-1.5 rounded-full bg-danger" />}
                  {isExpiringSoon && !isExpired && <span className="shrink-0 size-1.5 rounded-full bg-warning" />}
                  {!isExpired && !isExpiringSoon && testOk && <span className="shrink-0 size-1.5 rounded-full bg-success-bright" />}
                  {!isExpired && !isExpiringSoon && testFail && <span className="shrink-0 size-1.5 rounded-full bg-danger" />}
                  {!isExpired && !isExpiringSoon && !key.test_status && <span className="shrink-0 size-1.5 rounded-full bg-ink-quaternary/30" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-ink-quaternary">
                  <span>{key.provider}</span>
                  <span className="text-divider">·</span>
                  <span className="font-mono">{maskKey(key.key)}</span>
                  {isExpired && <><span className="text-divider">·</span><span className="text-danger font-medium">Expired</span></>}
                  {!isExpired && testOk && key.test_latency_ms != null && (
                    <><span className="text-divider">·</span><span className="text-success-bright font-medium">{key.test_latency_ms}ms</span></>
                  )}
                  {!isExpired && testFail && <><span className="text-divider">·</span><span className="text-danger font-medium">Failed</span></>}
                </div>
              </div>

              {/* Actions */}
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletingKey(key)}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingKey} onOpenChange={(open) => { if (!open) setDeletingKey(null) }} modal>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingKey?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingKey) { deleteKey(deletingKey.id); toast.add({ title: `Deleted "${deletingKey.name}"`, timeout: 3000 }) } }}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ── Inline Edit Dialog ── */

export function EditKeyDialog({ editingKey, onClose, onSave }: {
  editingKey: ApiKey | null
  onClose: () => void
  onSave: (id: string, updates: Partial<ApiKey>) => void
}) {
  const db = useStore((s) => s.db)
  const toast = useToast()
  const [showKey, setShowKey] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showCalendar) return
    const handler = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showCalendar])

  const [form, setForm] = useState({
    name: editingKey?.name ?? "",
    key: editingKey?.key ?? "",
    provider: editingKey?.provider ?? "OpenAI",
    endpoint: editingKey?.endpoint ?? "",
    description: editingKey?.description ?? "",
    group_id: editingKey?.group_id ?? null as string | null,
    expires_at: editingKey?.expires_at ? new Date(editingKey.expires_at) : undefined as Date | undefined,
  })
  const [testState, setTestState] = useState<{ testing: boolean; result: { success: boolean; latency_ms: number; error?: string } | null }>({
    testing: false, result: null,
  })

  const settings = db?.getSettings()
  const providers = getProvidersForDropdown(settings)
  const defaultEndpoint = ENDPOINT_DEFAULTS[form.provider.toLowerCase()]
    ?? settings?.custom_providers?.find((cp) => cp.name === form.provider)?.endpoint

  const handleTest = async () => {
    if (!form.key) return
    setTestState({ testing: true, result: null })
    const result = await ApiTester.testRaw(form.provider, form.endpoint, form.key)
    setTestState({ testing: false, result })
  }

  const handleSave = () => {
    if (!editingKey || !form.name.trim()) return
    toast.add({ title: "Key updated", description: form.name.trim(), timeout: 3000 })
    onSave(editingKey.id, {
      name: form.name.trim(),
      key: form.key.trim(),
      provider: form.provider,
      endpoint: form.endpoint,
      description: form.description,
      group_id: form.group_id,
      expires_at: form.expires_at ? form.expires_at.toISOString() : null,
      last_tested: testState.result ? new Date().toISOString() : undefined,
      test_status: testState.result ? (testState.result.success ? "success" : "failed") : undefined,
      test_latency_ms: testState.result?.latency_ms ?? undefined,
    })

    // Auto-test on save
    if (settings?.auto_test_on_save) {
      const { provider, endpoint, key: keyValue } = form
      const keyId = editingKey.id
      ApiTester.testRaw(provider, endpoint, keyValue).then((result) => {
        useStore.getState().updateKey(keyId, {
          last_tested: new Date().toISOString(),
          test_status: result.success ? "success" : "failed",
          test_latency_ms: result.latency_ms ?? null,
        })
      })
    }
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
            <Select value={form.provider} onValueChange={(v) => {
              const ep = ENDPOINT_DEFAULTS[v.toLowerCase()]
                ?? settings?.custom_providers?.find((cp) => cp.name === v)?.endpoint
                ?? form.endpoint
              setForm((f) => ({ ...f, provider: v, endpoint: ep }))
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              Endpoint
              {defaultEndpoint && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, endpoint: defaultEndpoint }))}
                  className="text-ink-quaternary hover:text-accent-bright transition-colors"
                  title="Reset to default"
                >
                  <RotateCcw className="size-3" />
                </button>
              )}
            </Label>
            <Input value={form.endpoint} onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))} placeholder="https://api.openai.com/v1" className="font-mono text-xs" />
          </div>

          {/* Expiration */}
          <div className="relative" ref={calendarRef}>
            <Label className="text-xs">Expiration</Label>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className="mt-1.5 w-full inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-normal border border-line bg-transparent hover:bg-surface-4 hover:text-ink-primary transition-colors justify-start text-left"
            >
              <CalendarIcon className="size-3.5 shrink-0" />
              <span className={!form.expires_at ? "text-ink-quaternary" : "text-ink-secondary"}>
                {form.expires_at ? format(form.expires_at, "MMM d, yyyy") : "Pick a date"}
              </span>
              {form.expires_at && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, expires_at: undefined })) }}
                  className="ml-auto text-ink-quaternary hover:text-ink-secondary"
                >
                  <X className="size-3" />
                </span>
              )}
            </button>
            {showCalendar && (
              <div className="absolute top-full left-0 mt-1 z-50 rounded-lg border border-line bg-canvas-raised shadow-elevated">
                <DayPicker
                  value={form.expires_at}
                  onChange={(d) => { setForm((f) => ({ ...f, expires_at: d })); setShowCalendar(false) }}
                />
              </div>
            )}
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
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What's this key for?" />
          </div>

          {/* Test Result */}
          {testState.result && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
              testState.result.success
                ? "bg-success/10 text-success-bright"
                : "bg-danger/10 text-danger"
            }`}>
              {testState.result.success
                ? <CheckCircle2 className="size-3.5" />
                : <XCircle className="size-3.5" />}
              <span>
                {testState.result.success
                  ? `Available (${testState.result.latency_ms}ms)`
                  : testState.result.error || "Connection failed"}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" size="sm">Save Changes</Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!form.key || testState.testing}
            >
              {testState.testing
                ? <Loader2 className="size-3.5 animate-spin" />
                : <FlaskConical className="size-3.5" />}
              Test
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
