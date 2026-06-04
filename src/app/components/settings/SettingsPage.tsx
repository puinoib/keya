import { useStore } from "../../store/useStore"
import { Settings as SettingsIcon, Palette, Fingerprint, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect, useRef } from "react"
import { EmojiPicker } from "@ferrucc-io/emoji-picker"
import { isBiometricSupported, isBiometricRegistered, registerBiometric, removeBiometric } from "@/app/lib/biometric"

export function SettingsPage() {
  const { db, password, updateMeta, updateSettings } = useStore()
  const settings = db?.getSettings()
  const data = db?.getData()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [bioRegistered, setBioRegistered] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [bioError, setBioError] = useState('')
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const bioSupported = isBiometricSupported()
  const vaultId = data?.vault_id

  useEffect(() => {
    if (!iconPickerOpen) return
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setIconPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [iconPickerOpen])

  useEffect(() => {
    if (!bioSupported || !vaultId) return
    isBiometricRegistered(vaultId).then(setBioRegistered)
  }, [bioSupported, vaultId])

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

          {/* Icon + Name Row */}
          <div className="flex items-start gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Icon</Label>
              <div className="relative">
                <button
                  onClick={() => setIconPickerOpen(!iconPickerOpen)}
                  className="size-9 rounded-md border border-line bg-surface-2 flex items-center justify-center text-base hover:bg-surface-3 transition-colors"
                >
                  {data.icon || '🔒'}
                </button>
                {iconPickerOpen && (
                  <div ref={emojiPickerRef} className="absolute left-0 top-full mt-1.5 z-50 rounded-lg bg-canvas-panel border border-line shadow-dialog">
                    <EmojiPicker
                      onEmojiSelect={(emoji) => {
                        updateMeta({ icon: emoji })
                        setIconPickerOpen(false)
                      }}
                      emojisPerRow={12}
                      emojiSize={28}
                      className="border-none"
                    >
                      <EmojiPicker.Header>
                        <EmojiPicker.Input
                          placeholder="Search emoji..."
                          hideIcon
                          className="w-full px-2 py-1.5 text-xs rounded-md bg-surface-2 border border-line text-ink-primary placeholder:text-ink-quaternary outline-none focus:ring-1 focus:ring-accent/50 mb-1.5"
                        />
                      </EmojiPicker.Header>
                      <EmojiPicker.Group>
                        <EmojiPicker.List containerHeight={220} />
                      </EmojiPicker.Group>
                    </EmojiPicker>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={data.name}
                onChange={(e) => updateMeta({ name: e.target.value })}
                placeholder="My Vault"
                className="h-9"
              />
            </div>
          </div>
        </div>

        {/* Biometric */}
        {bioSupported && vaultId && (
          <div className="space-y-2">
            <Label className="text-xs">Biometric Unlock</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setBioLoading(true)
                  setBioError('')
                  try {
                    if (bioRegistered) {
                      await removeBiometric(vaultId)
                      setBioRegistered(false)
                    } else {
                      await registerBiometric(vaultId, password!)
                      setBioRegistered(true)
                    }
                  } catch (e) {
                    setBioError(e instanceof Error ? e.message : 'Failed')
                  } finally {
                    setBioLoading(false)
                  }
                }}
                disabled={bioLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs transition-colors
                  ${bioRegistered
                    ? 'bg-surface-2 border border-line text-ink-secondary hover:bg-surface-5'
                    : 'bg-accent text-white hover:bg-accent-bright'}
                  disabled:opacity-50`}
              >
                {bioLoading
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Fingerprint className="size-3.5" />}
                {bioRegistered ? 'Remove' : 'Enable'}
              </button>
              {bioRegistered && (
                <span className="text-xs text-emerald-500">Enabled</span>
              )}
            </div>
            {bioError && <p className="text-xs text-danger">{bioError}</p>}
          </div>
        )}
        {/* Auto Lock */}
        <div className="space-y-2">
          <Label className="text-xs">Auto Lock (minutes)</Label>
          <Select
            value={String(settings?.auto_lock_minutes ?? 5)}
            onValueChange={(v) => updateSettings({ auto_lock_minutes: Number(v) })}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 5, 10, 15, 30].map((m) => (
                <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )
}
