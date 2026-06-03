import { useStore } from "../../store/useStore"
import { Settings as SettingsIcon, Sun, Moon, Monitor, Palette } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useState } from "react"

const PRESET_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4',
  '#0ea5e9', '#64748b',
]

const PRESET_ICONS = [
  '🔒', '🔑', '🗝️', '🛡️', '🔐',
  '📦', '🚀', '⚡', '🎯', '💎',
  '🏠', '🏢', '🌐', '☁️', '🤖',
]

export function SettingsPage() {
  const { db, theme, setTheme, updateMeta } = useStore()
  const settings = db?.getSettings()
  const data = db?.getData()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  if (!data) return null

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <SettingsIcon className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">Settings</h1>
          <p className="text-xs text-ink-quaternary">Manage your preferences</p>
        </div>
      </div>

      <div className="space-y-6 max-w-sm">
        {/* Vault Meta */}
        <div className="space-y-4 pb-6 border-b border-line-subtle">
          <div className="flex items-center gap-2">
            <Palette className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Vault</span>
          </div>

          {/* Icon + Color Row */}
          <div className="flex items-start gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Icon</Label>
              <div className="relative">
                <button
                  onClick={() => setIconPickerOpen(!iconPickerOpen)}
                  className="size-9 rounded-md border border-line bg-surface-2 flex items-center justify-center text-base hover:bg-surface-3 transition-colors"
                  style={{ backgroundColor: `${data.color}20`, color: data.color }}
                >
                  {data.icon || '🔒'}
                </button>
                {iconPickerOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-canvas-panel border border-line rounded-md shadow-lg p-2 grid grid-cols-5 gap-1">
                    {PRESET_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => { updateMeta({ icon: emoji }); setIconPickerOpen(false) }}
                        className={`size-8 rounded flex items-center justify-center text-sm hover:bg-surface-3 transition-colors
                          ${data.icon === emoji ? 'bg-accent/15 ring-1 ring-accent' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateMeta({ color: c })}
                    className={`size-6 rounded-full transition-all ${data.color === c ? 'ring-2 ring-offset-1 ring-accent scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={data.name}
              onChange={(e) => updateMeta({ name: e.target.value })}
              placeholder="My Vault"
              className="h-9"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={data.description}
              onChange={(e) => updateMeta({ description: e.target.value })}
              placeholder="Optional description..."
              className="h-9"
            />
          </div>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <Label className="text-xs">Theme</Label>
          <div className="flex gap-2">
            {([
              { value: "system" as const, icon: Monitor, label: "System" },
              { value: "light" as const, icon: Sun, label: "Light" },
              { value: "dark" as const, icon: Moon, label: "Dark" },
            ]).map(({ value, icon: Icon, label }) => (
              <button key={value} onClick={() => setTheme(value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs transition-colors
                        ${theme === value ? "bg-accent text-white" : "bg-surface-2 border border-line text-ink-secondary hover:bg-surface-5"}`}>
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Lock */}
        <div className="space-y-2">
          <Label className="text-xs">Auto Lock (minutes)</Label>
          <select
            value={settings?.auto_lock_minutes ?? 5}
            onChange={(e) => db?.updateSettings({ auto_lock_minutes: Number(e.target.value) })}
            className="flex h-9 w-32 rounded-md bg-surface-2 border border-line px-3 py-2
                       text-sm text-ink-primary focus-visible:outline-none focus-visible:ring-1
                       focus-visible:ring-accent-bright appearance-none"
          >
            {[1, 2, 5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>

        {/* Min Password Length */}
        <div className="space-y-2">
          <Label className="text-xs">Minimum Password Length</Label>
          <select
            value={settings?.min_password_length ?? 8}
            onChange={(e) => db?.updateSettings({ min_password_length: Number(e.target.value) })}
            className="flex h-9 w-32 rounded-md bg-surface-2 border border-line px-3 py-2
                       text-sm text-ink-primary focus-visible:outline-none focus-visible:ring-1
                       focus-visible:ring-accent-bright appearance-none"
          >
            {[6, 8, 10, 12, 16].map((n) => (
              <option key={n} value={n}>{n} characters</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )
}
