import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ENDPOINT_DEFAULTS, type ApiKey } from "../../../core/types"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Key, Eye, EyeOff, Wand2 } from "lucide-react"

const PROVIDERS = [
  "OpenAI", "Anthropic", "Google", "Groq", "DeepSeek", "Moonshot",
  "Zhipu", "Baidu", "Mistral", "Cohere", "Together", "Custom",
]

interface FormData {
  name: string
  key_value: string
  provider: string
  endpoint: string
  description: string
  group_id: string | null
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

  const handleProviderChange = (provider: string) => {
    const endpoint = ENDPOINT_DEFAULTS[provider.toLowerCase()]
    setForm((f) => ({
      ...f,
      provider,
      endpoint: endpoint ?? f.endpoint,
    }))
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
      status: "active",
      notes: "",
      last_tested: null,
      test_status: null,
      test_latency_ms: null,
    })
    setForm(empty)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
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
              onChange={(e) => setForm((f) => ({ ...f, key_value: e.target.value }))}
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
            <button
              type="button"
              onClick={() => {
                const ep = ENDPOINT_DEFAULTS[form.provider.toLowerCase()]
                if (ep) setForm((f) => ({ ...f, endpoint: ep }))
              }}
              className="text-accent-bright hover:text-accent-hover transition-colors"
            >
              <Wand2 className="size-3" />
            </button>
          </Label>
          <Input
            id="endpoint"
            value={form.endpoint}
            onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
            placeholder="https://api.openai.com/v1/chat/completions"
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

        {/* Submit */}
        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" size="sm">
            <Key className="size-3.5" />
            Save Key
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  )
}
