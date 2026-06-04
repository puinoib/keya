import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ENDPOINT_DEFAULTS } from "../../../core/types"
import { ApiTester } from "../../lib/api-tester"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Key, Eye, EyeOff, RotateCcw, FlaskConical, CheckCircle2, XCircle, Loader2 } from "lucide-react"

const PROVIDERS = [
  "OpenAI", "Anthropic", "Google", "Groq", "DeepSeek", "Moonshot",
  "Zhipu", "Baidu", "Mistral", "Cohere", "Together", "OpenRouter",
  "SiliconFlow", "Azure OpenAI", "Custom",
]

interface FormData {
  name: string
  key_value: string
  provider: string
  endpoint: string
  description: string
  group_id: string | null
}

interface TestState {
  testing: boolean
  result: { success: boolean; latency_ms: number; error?: string } | null
}

const empty: FormData = {
  name: "",
  key_value: "",
  provider: "OpenAI",
  endpoint: "",
  description: "",
  group_id: null,
}

export function KeyForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addKey, db } = useStore()
  const [form, setForm] = useState<FormData>(empty)
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<TestState>({ testing: false, result: null })

  const defaultEndpoint = ENDPOINT_DEFAULTS[form.provider.toLowerCase()]

  const handleProviderChange = (provider: string) => {
    const endpoint = ENDPOINT_DEFAULTS[provider.toLowerCase()]
    setForm((f) => ({ ...f, provider, endpoint: endpoint ?? "" }))
    setTestState({ testing: false, result: null })
  }

  const handleResetEndpoint = () => {
    if (defaultEndpoint) {
      setForm((f) => ({ ...f, endpoint: defaultEndpoint }))
    }
  }

  const handleTest = async () => {
    if (!form.key_value) return
    setTestState({ testing: true, result: null })
    const result = await ApiTester.testRaw(form.provider, form.endpoint, form.key_value)
    setTestState({ testing: false, result })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.key_value) return

    addKey({
      name: form.name,
      key: form.key_value,
      provider: form.provider,
      endpoint: form.endpoint,
      description: form.description,
      group_id: form.group_id,
      last_tested: testState.result ? new Date().toISOString() : null,
      test_status: testState.result?.success ? "success" : (testState.result ? "failed" : null),
      test_latency_ms: testState.result?.latency_ms ?? null,
    })
    setForm(empty)
    setTestState({ testing: false, result: null })
    onClose()
  }

  const handleClose = () => {
    setForm(empty)
    setTestState({ testing: false, result: null })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New API Key</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Name <span className="text-red-500">*</span></Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Production OpenAI"
              required
            />
          </div>

          {/* Key Value */}
          <div className="space-y-1.5">
            <Label htmlFor="key_value" className="text-xs">API Key <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                id="key_value"
                type={showKey ? "text" : "password"}
                value={form.key_value}
                onChange={(e) => { setForm((f) => ({ ...f, key_value: e.target.value })); setTestState({ testing: false, result: null }) }}
                placeholder="sk-..."
                className="pr-9 font-mono text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center
                           rounded text-ink-quaternary hover:text-ink-secondary transition-colors"
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <Label htmlFor="provider" className="text-xs">Provider</Label>
            <Select value={form.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <Label htmlFor="endpoint" className="text-xs flex items-center gap-1.5">
              Endpoint
              {defaultEndpoint && (
                <button
                  type="button"
                  onClick={handleResetEndpoint}
                  className="text-ink-quaternary hover:text-accent-bright transition-colors"
                  title="Reset to default"
                >
                  <RotateCcw className="size-3" />
                </button>
              )}
            </Label>
            <Input
              id="endpoint"
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              placeholder={defaultEndpoint || "https://api.example.com/v1"}
              className="font-mono text-xs"
            />
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label htmlFor="group" className="text-xs">Group</Label>
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
            <Label htmlFor="description" className="text-xs">Description (optional)</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What's this key for?"
            />
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
            <Button type="submit" size="sm">
              <Key className="size-3.5" />
              Save Key
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!form.key_value || testState.testing}
            >
              {testState.testing
                ? <Loader2 className="size-3.5 animate-spin" />
                : <FlaskConical className="size-3.5" />}
              Test
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
