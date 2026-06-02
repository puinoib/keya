import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ENDPOINT_DEFAULTS, type ApiKey } from "../../../core/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, ArrowLeft, Eye, EyeOff, Wand2 } from "lucide-react"

const PROVIDERS = [
  "OpenAI", "Anthropic", "Google", "Groq", "DeepSeek", "Moonshot",
  "Zhipu", "Baidu", "Mistral", "Cohere", "Together", "Custom",
]

interface FormData {
  name: string
  key_value: string
  provider: string
  service: string
  endpoint: string
  description: string
}

const empty: FormData = {
  name: "",
  key_value: "",
  provider: "OpenAI",
  service: "ChatGPT",
  endpoint: "",
  description: "",
}

export function KeyForm() {
  const { setShowAddForm, addKey, db } = useStore()
  const [form, setForm] = useState<FormData>(empty)
  const [showKey, setShowKey] = useState(false)

  const handleProviderChange = (provider: string) => {
    const defaults = ENDPOINT_DEFAULTS[provider]
    setForm((f) => ({
      ...f,
      provider,
      endpoint: defaults?.endpoint ?? f.endpoint,
      service: defaults?.service ?? f.service,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.key_value) return

    addKey({
      name: form.name,
      key: form.key_value,
      provider: form.provider,
      service: form.service,
      endpoint: form.endpoint,
      description: form.description,
      category_id: db?.getCategories()[0]?.id ?? null,
      tag_ids: [],
    })
  }

  return (
    <div className="max-w-lg">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setShowAddForm(false)}
          className="inline-flex items-center justify-center size-7 rounded-md
                     text-ink-quaternary hover:text-ink-primary hover:bg-white/[0.05]
                     transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-7 rounded-md bg-accent/15 text-accent-bright">
            <Key className="size-3.5" />
          </div>
          <h2 className="text-sm font-semibold text-ink-primary">New API Key</h2>
        </div>
      </div>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs">Name</Label>
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
          <Label htmlFor="key_value" className="text-xs">API Key</Label>
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

        {/* Provider & Service */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="provider" className="text-xs">Provider</Label>
            <select
              id="provider"
              value={form.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="flex h-9 w-full rounded-md bg-white/[0.02] border border-white/[0.08] px-3 py-2
                         text-sm text-ink-primary
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright
                         transition-colors duration-150 appearance-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p} className="bg-canvas-raised">{p}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service" className="text-xs">Service</Label>
            <Input
              id="service"
              value={form.service}
              onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
              placeholder="e.g. ChatGPT"
            />
          </div>
        </div>

        {/* Endpoint */}
        <div className="space-y-1.5">
          <Label htmlFor="endpoint" className="text-xs flex items-center gap-1.5">
            Endpoint
            <button
              type="button"
              onClick={() => {
                const defaults = ENDPOINT_DEFAULTS[form.provider]
                if (defaults) setForm((f) => ({ ...f, endpoint: defaults.endpoint }))
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
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
