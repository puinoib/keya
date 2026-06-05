import { useStore } from '../../store/useStore';
import { Palette, Fingerprint, Spinner, Shield } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { EmojiPicker } from '@ferrucc-io/emoji-picker';
import {
  isBiometricSupported,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
} from '@/app/lib/biometric';

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200
        ${checked ? 'bg-accent' : 'bg-surface-3'}
        ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

export function GeneralPage() {
  const { db, password, updateMeta, updateSettings } = useStore();
  const settings = db?.getSettings();
  const data = db?.getData();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const bioSupported = isBiometricSupported();
  const vaultId = data?.vault_id;

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!iconPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setIconPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [iconPickerOpen]);

  // Check biometric registration status
  useEffect(() => {
    if (!bioSupported || !vaultId) return;
    isBiometricRegistered(vaultId)
      .then(setBioRegistered)
      .catch(() => setBioRegistered(false));
  }, [bioSupported, vaultId]);

  if (!data) return null;

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
          <Palette className="size-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
            General
          </h1>
          <p className="text-xs text-ink-quaternary">
            Vault and basic settings
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Vault Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Palette className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Vault
            </span>
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
                <div
                  ref={emojiPickerRef}
                  className="absolute left-0 top-full mt-1.5 z-50 rounded-lg bg-canvas-panel border border-line shadow-dialog"
                >
                  <EmojiPicker
                    onEmojiSelect={(emoji) => {
                      updateMeta({ icon: emoji });
                      setIconPickerOpen(false);
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

        {/* Security Section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              Security
            </span>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 divide-y divide-line">
            {bioSupported && vaultId && (
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5">
                  <Fingerprint className="size-4 text-ink-quaternary" />
                  <div>
                    <p className="text-xs font-medium text-ink-primary">
                      Biometric Unlock
                    </p>
                    {bioError && (
                      <p className="text-xs text-danger mt-0.5">{bioError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {bioLoading && (
                    <Spinner className="size-4 animate-spin text-ink-quaternary" />
                  )}
                  <Toggle
                    checked={bioRegistered}
                    disabled={bioLoading}
                    onChange={async () => {
                      if (!password) return;
                      setBioLoading(true);
                      setBioError('');
                      try {
                        if (bioRegistered) {
                          await removeBiometric(vaultId);
                          setBioRegistered(false);
                        } else {
                          await registerBiometric(vaultId, password);
                          setBioRegistered(true);
                        }
                      } catch (e) {
                        setBioError(e instanceof Error ? e.message : 'Failed');
                      } finally {
                        setBioLoading(false);
                      }
                    }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Auto Lock
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Lock after inactivity
                </p>
              </div>
              <Select
                value={String(settings?.auto_lock_minutes ?? 5)}
                onValueChange={(v) =>
                  updateSettings({ auto_lock_minutes: Number(v) })
                }
              >
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 5, 10, 15, 30].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
