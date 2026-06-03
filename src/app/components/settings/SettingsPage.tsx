import { useStore } from "../../store/useStore"
import { Settings as SettingsIcon, Sun, Moon, Monitor } from "lucide-react"
import { Label } from "@/components/ui/label"

export function SettingsPage() {
  const { db, theme, setTheme } = useStore()
  const settings = db?.getSettings()

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
