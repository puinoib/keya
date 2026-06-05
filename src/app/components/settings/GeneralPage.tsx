import { useStore } from '../../store/useStore';
import {
  Palette,
  Fingerprint,
  Spinner,
  Shield,
  LockOpen,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect, useRef, useDeferredValue } from 'react';
import { EmojiPicker } from '@ferrucc-io/emoji-picker';
import { toast } from 'sonner';
import {
  isBiometricSupported,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
} from '@/app/lib/biometric';
import '@/app/lib/zxcvbn';
import { zxcvbnAsync } from '@zxcvbn-ts/core';
import type { ZxcvbnResult } from '@zxcvbn-ts/core';

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

const STRENGTH_CONFIG = {
  0: { label: 'Very Weak', color: 'bg-red-500' },
  1: { label: 'Weak', color: 'bg-red-500' },
  2: { label: 'Fair', color: 'bg-orange-500' },
  3: { label: 'Good', color: 'bg-yellow-500' },
  4: { label: 'Strong', color: 'bg-emerald-500' },
} as const;

export function GeneralPage() {
  const { db, password, updateMeta, updateSettings, changePassword } =
    useStore();
  const settings = db?.getSettings();
  const data = db?.getData();
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState('');

  // Change password state
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [zxcvbnResult, setZxcvbnResult] = useState<ZxcvbnResult | null>(null);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const bioSupported = isBiometricSupported();
  const vaultId = data?.vault_id;
  const strength = zxcvbnResult
    ? STRENGTH_CONFIG[zxcvbnResult.score as keyof typeof STRENGTH_CONFIG]
    : null;

  const deferredNewPw = useDeferredValue(newPw);
  useEffect(() => {
    if (!deferredNewPw || !showPwForm) {
      setZxcvbnResult(null);
      return;
    }
    zxcvbnAsync(deferredNewPw).then(setZxcvbnResult);
  }, [deferredNewPw, showPwForm]);

  const canChangePw =
    oldPw.length > 0 && newPw.length >= 8 && newPw === confirmPw;

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
      <h1 className="text-base font-semibold tracking-tight text-ink-primary mb-6">
        General
      </h1>

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
            {/* Change Master Password */}
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LockOpen className="size-4 text-ink-quaternary" />
                  <p className="text-xs font-medium text-ink-primary">
                    Master Password
                  </p>
                </div>
                {!showPwForm && (
                  <button
                    onClick={() => setShowPwForm(true)}
                    className="text-xs text-accent-bright hover:text-accent transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
              {showPwForm && (
                <div className="mt-3 space-y-2">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={oldPw}
                    onChange={(e) => {
                      setOldPw(e.target.value);
                      setPwError('');
                    }}
                    className="h-7 text-xs"
                    autoComplete="off"
                    data-lpignore="true"
                  />
                  <div className="space-y-1">
                    <Input
                      type="password"
                      placeholder="New password (min 8 chars)"
                      value={newPw}
                      onChange={(e) => {
                        setNewPw(e.target.value);
                        setPwError('');
                      }}
                      className="h-7 text-xs"
                      autoComplete="off"
                      data-lpignore="true"
                    />
                    {newPw && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex gap-1">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                zxcvbnResult && i <= zxcvbnResult.score
                                  ? STRENGTH_CONFIG[
                                      zxcvbnResult.score as keyof typeof STRENGTH_CONFIG
                                    ].color
                                  : 'bg-surface-3'
                              }`}
                            />
                          ))}
                        </div>
                        {strength && (
                          <span className="text-xs text-ink-quaternary">
                            {strength.label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPw}
                    onChange={(e) => {
                      setConfirmPw(e.target.value);
                      setPwError('');
                    }}
                    className={`h-7 text-xs ${confirmPw && newPw !== confirmPw ? 'border-red-500/50' : ''}`}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                  {confirmPw && newPw !== confirmPw && (
                    <p className="text-xs text-danger">Passwords don't match</p>
                  )}
                  {pwError && <p className="text-xs text-danger">{pwError}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={async () => {
                        if (!canChangePw) return;
                        setPwLoading(true);
                        setPwError('');
                        try {
                          await changePassword(oldPw, newPw);
                          // Re-register biometrics if previously registered
                          if (bioRegistered && vaultId) {
                            await registerBiometric(vaultId, newPw);
                          }
                          toast.success('Password changed');
                          setShowPwForm(false);
                          setOldPw('');
                          setNewPw('');
                          setConfirmPw('');
                        } catch (e) {
                          setPwError(
                            e instanceof Error
                              ? e.message
                              : 'Failed to change password'
                          );
                        } finally {
                          setPwLoading(false);
                        }
                      }}
                      disabled={pwLoading || !canChangePw}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
                    >
                      {pwLoading ? (
                        <Spinner className="size-3.5 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowPwForm(false);
                        setOldPw('');
                        setNewPw('');
                        setConfirmPw('');
                        setPwError('');
                      }}
                      className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
