/**
 * Changing the master password, as a dialog rather than a form unfolded in the
 * settings list: it is one dangerous action, not a value the page holds.
 *
 * The password itself is used for this gesture only (I16): the store receives
 * it, rewrites the container, and keeps nothing afterwards.
 */

import { useState, useEffect, useDeferredValue } from 'react';
import { Eye, EyeSlash, Spinner } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { judgePassword, type PasswordVerdict } from '@/app/lib/password-policy';
import { PasswordStrengthMeter } from '@/app/components/ui/password-strength';

const EYE_BUTTON =
  'absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-ink-quaternary transition-colors hover:text-ink-secondary';

export function ChangePasswordDialog({
  open,
  onOpenChange,
  changePassword,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changePassword: (
    oldPassword: string,
    newPassword: string
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /**
   * Runs after a successful change, before the dialog closes. The caller uses
   * it to re-wrap whatever the old password protected on this device.
   */
  onChanged?: (newPassword: string) => Promise<void>;
}) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [verdict, setVerdict] = useState<PasswordVerdict | null>(null);

  const deferredNewPw = useDeferredValue(newPw);

  useEffect(() => {
    if (!deferredNewPw || !open) {
      setVerdict(null);
      return;
    }
    let cancelled = false;
    judgePassword(deferredNewPw).then((result) => {
      if (!cancelled) setVerdict(result);
    });
    return () => {
      cancelled = true;
    };
  }, [deferredNewPw, open]);

  const close = () => {
    setOldPw('');
    setNewPw('');
    setConfirmPw('');
    setError('');
    onOpenChange(false);
  };

  const ready = oldPw.length > 0 && newPw === confirmPw && verdict?.ok === true;

  const submit = async () => {
    if (!ready || loading) return;
    setLoading(true);
    setError('');
    try {
      const changed = await changePassword(oldPw, newPw);
      if (!changed.ok) {
        setError(changed.reason);
        return;
      }
      await onChanged?.(newPw);
      toast.success('Password changed');
      close();
    } catch (thrown) {
      setError(
        thrown instanceof Error ? thrown.message : 'Failed to change password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change master password</DialogTitle>
          <DialogDescription>
            This rewrites the vault file. Every device needs the new password,
            and older copies keep opening with the old one.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2">
          <div className="relative">
            <Input
              type={showOldPw ? 'text' : 'password'}
              placeholder="Current password"
              value={oldPw}
              onChange={(event) => {
                setOldPw(event.target.value);
                setError('');
              }}
              className="h-8 pr-8 text-xs"
              autoComplete="off"
              data-lpignore="true"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowOldPw((visible) => !visible)}
              className={EYE_BUTTON}
              aria-label={showOldPw ? 'Hide password' : 'Show password'}
            >
              {showOldPw ? (
                <EyeSlash className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>

          <div className="space-y-1">
            <div className="relative">
              <Input
                type={showNewPw ? 'text' : 'password'}
                placeholder="New password (min 12 characters)"
                value={newPw}
                onChange={(event) => {
                  setNewPw(event.target.value);
                  setError('');
                }}
                className="h-8 pr-8 text-xs"
                autoComplete="off"
                data-lpignore="true"
              />
              <button
                type="button"
                onClick={() => setShowNewPw((visible) => !visible)}
                className={EYE_BUTTON}
                aria-label={showNewPw ? 'Hide password' : 'Show password'}
              >
                {showNewPw ? (
                  <EyeSlash className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
            {newPw && <PasswordStrengthMeter verdict={verdict} />}
          </div>

          <div className="relative">
            <Input
              type={showConfirmPw ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPw}
              onChange={(event) => {
                setConfirmPw(event.target.value);
                setError('');
              }}
              className={`h-8 pr-8 text-xs ${confirmPw && newPw !== confirmPw ? 'border-danger/50' : ''}`}
              autoComplete="off"
              data-lpignore="true"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPw((visible) => !visible)}
              className={EYE_BUTTON}
              aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
            >
              {showConfirmPw ? (
                <EyeSlash className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
          {confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-danger">Passwords don't match</p>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <DialogFooter className="mt-4">
          <button
            type="button"
            onClick={submit}
            disabled={loading || !ready}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-bright disabled:opacity-50"
          >
            {loading ? <Spinner className="size-3.5 animate-spin" /> : 'Change'}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-md px-3 py-1.5 text-xs text-ink-quaternary transition-colors hover:text-ink-secondary"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
