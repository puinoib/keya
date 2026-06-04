import { useStore } from "../../store/useStore"
import { Gear, Palette, Fingerprint, Spinner, Flask, HardDrives, Shield, CaretRight, Question } from "@phosphor-icons/react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect, useRef } from "react"
import { EmojiPicker } from "@ferrucc-io/emoji-picker"
import { isBiometricSupported, isBiometricRegistered, registerBiometric, removeBiometric } from "@/app/lib/biometric"
import { ManageProvidersDialog } from "./ManageProvidersDialog"

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200
        ${checked ? 'bg-accent' : 'bg-surface-3'}`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function SettingsPage() {
  const { db, password, updateMeta, updateSettings } = useStore()
  const settings = db?.getSettings()
  const data = db?.getData()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [bioRegistered, setBioRegistered] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [bioError, setBioError] = useState('')
  const [showProviders, setShowProviders] = useState(false)
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
          <Gear className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">Settings</h1>
          <p className="text-xs text-ink-quaternary">Manage your preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Vault ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Vault</span>
          </div>
          <div className="flex items-center gap-3">
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
            <Input
              value={data.name}
              onChange={(e) => updateMeta({ name: e.target.value })}
              placeholder="My Vault"
              className="h-8 text-xs"
            />
          </div>
        </section>

        {/* ── Security ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Security</span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            {bioSupported && vaultId && (
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="size-4 text-ink-quaternary" />
                  <div>
                    <p className="text-xs font-medium text-ink-primary">Biometric Unlock</p>
                    {bioError && <p className="text-xs text-danger mt-0.5">{bioError}</p>}
                  </div>
                </div>
                {bioLoading
                  ? <Spinner className="size-4 animate-spin text-ink-quaternary" />
                  : (
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
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors
                        ${bioRegistered
                          ? 'text-ink-quaternary hover:text-danger hover:bg-danger/10'
                          : 'text-accent hover:bg-accent/10'}`}
                    >
                      {bioRegistered ? 'Remove' : 'Enable'}
                    </button>
                  )
                }
              </div>
            )}
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">Auto Lock</p>
                <p className="text-xs text-ink-quaternary mt-0.5">Lock after inactivity</p>
              </div>
              <Select
                value={String(settings?.auto_lock_minutes ?? 5)}
                onValueChange={(v) => updateSettings({ auto_lock_minutes: Number(v) })}
              >
                <SelectTrigger className="w-24 h-7 text-xs">
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
        </section>

        {/* ── Keys ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Flask className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Keys</span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">Auto-Test on Save</p>
                <p className="text-xs text-ink-quaternary mt-0.5">Test keys after saving</p>
              </div>
              <Toggle
                checked={!!settings?.auto_test_on_save}
                onChange={() => updateSettings({ auto_test_on_save: !settings?.auto_test_on_save })}
              />
            </div>
            <button
              onClick={() => setShowProviders(true)}
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors rounded-b-lg"
            >
              <div className="flex items-center gap-2.5">
                <HardDrives className="size-4 text-ink-quaternary" />
                <p className="text-xs font-medium text-ink-primary">Providers</p>
              </div>
              <CaretRight className="size-3.5 text-ink-quaternary" />
            </button>
          </div>
        </section>

        {/* ── Help & Support ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Question className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">Help & Support</span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2">
            <a
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 w-full text-left hover:bg-surface-3 transition-colors"
            >
              <div>
                <p className="text-xs font-medium text-ink-primary">Help Center</p>
                <p className="text-xs text-ink-quaternary mt-0.5">Quick start, FAQ, and security</p>
              </div>
              <CaretRight className="size-3.5 text-ink-quaternary" />
            </a>
          </div>
        </section>
      </div>

      <ManageProvidersDialog open={showProviders} onClose={() => setShowProviders(false)} />
    </>
  )
}
