import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ENDPOINT_DEFAULTS, type ApiKey } from "../../../core/types"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, Eye, EyeOff, Wand2 } from "lucide-react"

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
  category_id: string | null
  tag_ids: string[]
}

const empty: FormData = {
  name: "",
  key_value: "",
  provider: "OpenAI",
  service: "ChatGPT",
  endpoint: "",
  description: "",
  category_id: null,
  tag_ids: [],
}

export function KeyForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addKey, db } = useStore()
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
      category_id: form.category_id,
      tag_ids: form.tag_ids,
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

        {/* Category */}
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-xs">Category</Label>
          <select
            id="category"
            value={form.category_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value || null }))}
            className="flex h-9 w-full rounded-md bg-white/[0.02] border border-white/[0.08] px-3 py-2
                       text-sm text-ink-primary
                       focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright
                       transition-colors duration-150 appearance-none"
          >
            <option value="" className="bg-canvas-raised">Uncategorized</option>
            {db?.getCategories().map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-canvas-raised">{cat.icon} {cat.name}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        {db && db.getTags().length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {db.getTags().map((tag) => {
                const selected = form.tag_ids.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      tag_ids: selected ? f.tag_ids.filter((id) => id !== tag.id) : [...f.tag_ids, tag.id],
                    }))}
                    className="px-2 py-0.5 text-2xs font-medium rounded-full border transition-colors"
                    style={{
                      color: selected ? tag.color : "var(--ink-quaternary)",
                      borderColor: selected ? tag.color + "60" : "var(--border-subtle)",
                      backgroundColor: selected ? tag.color + "10" : "transparent",
                    }}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

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
