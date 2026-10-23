import { useStore } from '../../store/useStore';
import {
  FolderSimple,
  Palette,
  Spinner,
  Shield,
  Warning,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { EmojiPickerPanel } from '@/app/components/ui/emoji-picker-popover';
import { toast } from 'sonner';
import {
  isBiometricSupported,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
} from '@/app/lib/biometric';
import { FileStorage } from '@/app/lib/storage';
import { describeAge } from '@/app/state/presentation';
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { MAX_VAULT_NAME } from '@/core/payload/limits';
import { ChangePasswordDialog } from './ChangePasswordDialog';

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
  const {
    view,
    updateMeta,
    updateSettings,
    changePassword,
    verifyPassword,
    forgetDeviceState,
    activeVaultFileName,
    storageMode,
  } = useStore();
  const preferences = view?.preferences;
  const data = view?.file.vault;
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  // The view is rebuilt asynchronously, so binding the field straight to
  // `data.name` re-renders it with the previous name after every keystroke and
  // the caret jumps to the end. Keep the text local while it is being typed.
  const [nameDraft, setNameDraft] = useState('');
  const editingName = useRef(false);
  const [bioRegistered, setBioRegistered] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState('');
  // Enrollment re-asks for the password instead of keeping it in the session.
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollPw, setEnrollPw] = useState('');

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  // The folder's name is all a browser exposes; the path is not readable.
  const [folderName, setFolderName] = useState<string | null>(null);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const bioSupported = isBiometricSupported();
  const vaultId = data?.id;
  const vaultName = data?.name ?? '';

  // Outside an edit, the field follows the payload: a different vault, a
  // refused rename, or an edit made elsewhere all land here.
  useEffect(() => {
    if (!editingName.current) setNameDraft(vaultName);
  }, [vaultName]);

  // A vault that was opened from bytes has no folder to name.
  useEffect(() => {
    if (storageMode !== 'folder') {
      setFolderName(null);
      return;
    }
    let cancelled = false;
    FileStorage.getWorkspaceName()
      .then((name) => {
        if (!cancelled) setFolderName(name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storageMode, activeVaultFileName]);

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

  const now = new Date();

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
                  <EmojiPickerPanel
                    onSelect={(emoji) => {
                      updateMeta({ icon: emoji });
                      setIconPickerOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
            <Input
              value={nameDraft}
              onChange={(event) => {
                const next = event.target.value;
                setNameDraft(next);
                // An empty name is refused by the payload (min length 1). Keep
                // the text in the field; blur shows what actually landed.
                if (next.trim().length === 0) return;
                updateMeta({ name: next });
              }}
              onFocus={() => {
                editingName.current = true;
              }}
              onBlur={() => {
                editingName.current = false;
                // The payload keeps the name trimmed, and only an empty one is
                // refused; show the form that actually landed.
                const trimmed = nameDraft.trim();
                setNameDraft(trimmed.length === 0 ? vaultName : trimmed);
              }}
              maxLength={MAX_VAULT_NAME}
              placeholder="My Vault"
              className="h-8 text-xs"
            />
          </div>
          {/* A browser exposes the folder's name and nothing more, so this is
              deliberately not a path and carries no click target. */}
          <div className="mt-3 space-y-1 text-[11px] text-ink-quaternary">
            <p className="flex items-center gap-1.5">
              <FolderSimple className="size-3.5 shrink-0" />
              {storageMode === 'folder' ? (
                <span className="truncate font-mono">
                  {folderName ? `${folderName} / ` : ''}
                  {activeVaultFileName ?? 'unnamed file'}
                </span>
              ) : (
                <span>
                  Not saved to a folder — export a .keya copy to keep one
                </span>
              )}
            </p>
            <p>
              Created {describeAge(data.created_at, now)}, last changed{' '}
              {describeAge(data.content_updated_at, now)}
            </p>
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
                <div>
                  <p className="text-xs font-medium text-ink-primary">
                    Biometric Unlock
                  </p>
                  <p className="text-xs text-ink-quaternary mt-0.5">
                    Unlock this vault with your device's biometrics instead of
                    typing the master password.
                  </p>
                  {bioError && (
                    <p className="text-xs text-danger mt-0.5">{bioError}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {bioLoading && (
                    <Spinner className="size-4 animate-spin text-ink-quaternary" />
                  )}
                  <Toggle
                    checked={bioRegistered}
                    disabled={bioLoading}
                    onChange={async () => {
                      if (bioLoading) return;
                      setBioError('');
                      if (bioRegistered) {
                        setBioLoading(true);
                        try {
                          await removeBiometric(vaultId);
                          setBioRegistered(false);
                        } catch (e) {
                          setBioError(
                            e instanceof Error ? e.message : 'Failed'
                          );
                        } finally {
                          setBioLoading(false);
                        }
                        return;
                      }
                      // Enabling needs the password again; it is used for this
                      // gesture only and never written to the store.
                      setEnrollPw('');
                      setEnrollOpen(true);
                    }}
                  />
                </div>
              </div>
            )}
            {enrollOpen && !bioRegistered && (
              <div className="p-3 space-y-2">
                <p className="text-xs text-ink-secondary">
                  Confirm the master password to enable biometric unlock.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    autoComplete="off"
                    value={enrollPw}
                    onChange={(e) => setEnrollPw(e.target.value)}
                    placeholder="Master password"
                    className="h-7 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!enrollPw || bioLoading}
                    onClick={async () => {
                      if (!vaultId || !enrollPw) return;
                      setBioLoading(true);
                      setBioError('');
                      try {
                        if (!(await verifyPassword(enrollPw))) {
                          setBioError(
                            'That is not the current master password.'
                          );
                          return;
                        }
                        await registerBiometric(vaultId, enrollPw);
                        setBioRegistered(true);
                        setEnrollOpen(false);
                        setEnrollPw('');
                      } catch (e) {
                        setBioError(e instanceof Error ? e.message : 'Failed');
                      } finally {
                        setBioLoading(false);
                      }
                    }}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
                  >
                    Enable
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollOpen(false);
                      setEnrollPw('');
                      setBioError('');
                    }}
                    className="rounded-md px-3 py-1.5 text-xs text-ink-quaternary hover:text-ink-secondary transition-colors"
                  >
                    Cancel
                  </button>
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
                value={String(preferences?.auto_lock_minutes ?? 5)}
                onValueChange={(v) =>
                  updateSettings({ auto_lock_minutes: Number(v) })
                }
              >
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue>
                    {preferences?.auto_lock_minutes ?? 5}
                    {(preferences?.auto_lock_minutes ?? 5) > 1
                      ? ' mins'
                      : ' min'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 5, 10, 15, 30].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m}
                      {m > 1 ? ' mins' : ' min'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Change Master Password */}
            <div className="flex items-center justify-between p-3">
              <div>
                <p className="text-xs font-medium text-ink-primary">
                  Master Password
                </p>
                <p className="text-xs text-ink-quaternary mt-0.5">
                  Change the password that encrypts this vault file. Every
                  device needs the new password.
                </p>
              </div>
              <button
                onClick={() => setPasswordOpen(true)}
                className="text-xs text-accent-bright hover:text-accent transition-colors"
              >
                Change
              </button>
            </div>
          </div>
        </section>

        {/* Device state only: the file is not touched, so the wording is
            careful not to read as "delete this vault". */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Warning className="size-3.5 text-ink-quaternary" />
            <span className="text-xs font-medium text-ink-secondary">
              This device
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 p-3">
            <div>
              <p className="text-xs font-medium text-ink-primary">
                Forget this device's data
              </p>
              <p className="text-xs text-ink-quaternary mt-0.5">
                Deletes this device's check results, cached allowances and
                biometric binding for this vault. The .keya file is not touched.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmForget(true)}
              disabled={forgetting}
              className="shrink-0 rounded-md border border-danger/30 px-2.5 py-1.5 text-xs text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
            >
              Forget
            </button>
          </div>
        </section>
      </div>

      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        changePassword={changePassword}
        onChanged={async (newPassword) => {
          // The biometric record wrapped the old password, so the store dropped
          // it. Re-register with the new one; a cancel means "biometrics off"
          // rather than a failed password change.
          if (!bioRegistered || !vaultId) return;
          try {
            await registerBiometric(vaultId, newPassword);
          } catch {
            setBioRegistered(false);
            setBioError(
              'Password changed. Enable biometric unlock again to use it.'
            );
          }
        }}
      />

      <AlertDialogRoot open={confirmForget} onOpenChange={setConfirmForget}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forget this device's data?</AlertDialogTitle>
            <AlertDialogDescription>
              Check results, cached allowances and the biometric binding for
              this vault are deleted from this device. The .keya file stays
              exactly as it is, and nothing is sent anywhere.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setForgetting(true);
                try {
                  await forgetDeviceState();
                  setBioRegistered(false);
                  toast.success('Device data forgotten');
                } catch (error) {
                  toast.error('Could not forget this device\u2019s data', {
                    description:
                      error instanceof Error ? error.message : undefined,
                  });
                } finally {
                  setForgetting(false);
                }
              }}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Forget device data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </>
  );
}
