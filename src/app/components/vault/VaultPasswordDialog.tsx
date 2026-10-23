import { useState, useEffect, useDeferredValue, useRef } from 'react';
import {
  Spinner,
  LockSimpleOpen,
  Fingerprint,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  isBiometricSupported,
  isBiometricRegistered,
  unlockWithBiometric,
} from '@/app/lib/biometric';
import {
  describePasswordVerdict,
  judgePassword,
  type PasswordVerdict,
} from '@/app/lib/password-policy';
import { VaultOpenError } from '@/app/lib/storage';
import { describeOpenFailure } from '@/app/state/presentation';
import { downloadBytes } from '@/app/lib/download';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VaultPasswordDialogProps {
  mode: 'unlock' | 'new';
  fileName?: string;
  vaultId?: string;
  onSubmit: (password: string, signal: AbortSignal) => Promise<void>;
  onCancel: () => void;
  /** §6.3 escape hatch: decrypt raw bytes after double confirmation. */
  onExportRaw?: (password: string) => Promise<Uint8Array>;
  /** Dialog callers close with the X, so the text link is only inline. */
  showBack?: boolean;
  /** Focus the password field on mount (off when another field comes first). */
  autoFocus?: boolean;
}

const STRENGTH_CONFIG = {
  0: { label: 'Very Weak', color: 'bg-red-500' },
  1: { label: 'Weak', color: 'bg-red-500' },
  2: { label: 'Fair', color: 'bg-orange-500' },
  3: { label: 'Good', color: 'bg-yellow-500' },
  4: { label: 'Strong', color: 'bg-emerald-500' },
} as const;

const EYE_BUTTON =
  'absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-quaternary transition-colors hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright';

const SECONDARY_BUTTON =
  'flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright disabled:pointer-events-none disabled:opacity-50';

export function VaultPasswordDialog({
  mode,
  fileName,
  vaultId,
  onSubmit,
  onCancel,
  onExportRaw,
  showBack = true,
  autoFocus = true,
}: VaultPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verdict, setVerdict] = useState<PasswordVerdict | null>(null);
  const [openError, setOpenError] = useState<VaultOpenError | null>(null);
  const submitController = useRef<AbortController | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const isCreate = mode === 'new';
  const canSubmit = isCreate
    ? verdict?.ok === true && password === confirm
    : password.length > 0;

  // Use deferred value for the async policy check (React 19)
  const deferredPassword = useDeferredValue(password);

  useEffect(() => {
    if (!deferredPassword || !isCreate) {
      setVerdict(null);
      return;
    }
    let cancelled = false;
    judgePassword(deferredPassword).then((result) => {
      if (!cancelled) setVerdict(result);
    });
    return () => {
      cancelled = true;
    };
  }, [deferredPassword, isCreate]);

  const estimate = verdict?.estimate ?? null;
  const strength = estimate
    ? STRENGTH_CONFIG[estimate.score as keyof typeof STRENGTH_CONFIG]
    : null;

  useEffect(() => {
    if (isCreate || !vaultId) return;
    isBiometricSupported() &&
      isBiometricRegistered(vaultId).then(setShowBiometric);
  }, [isCreate, vaultId]);

  // Opening a dialog to type a password should not require a second click.
  useEffect(() => {
    if (autoFocus) passwordRef.current?.focus();
  }, [autoFocus]);

  // Unmounting while Argon2 runs (dialog dismissed by X or Esc) must terminate
  // the Worker, otherwise the vault can still open after the dialog is gone.
  useEffect(() => {
    return () => submitController.current?.abort();
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const controller = new AbortController();
    submitController.current = controller;
    setLoading(true);
    setError('');
    setOpenError(null);
    try {
      await onSubmit(password, controller.signal);
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (caught instanceof VaultOpenError) {
        setError(describeOpenFailure(caught.failure, caught.issues));
        setOpenError(caught);
      } else {
        setError(
          isCreate
            ? 'Failed to create vault.'
            : caught instanceof Error
              ? caught.message
              : 'The vault could not be opened.'
        );
      }
    } finally {
      if (submitController.current === controller)
        submitController.current = null;
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Cancelling while Argon2 runs must terminate the Worker; otherwise the
    // vault can still open after the dialog is gone.
    submitController.current?.abort();
    onCancel();
  };

  const handleExportRaw = async () => {
    if (!openError || !fileName || !onExportRaw) return;
    const confirmed = window.confirm(
      'This writes the decrypted contents of this vault as plain text, including every secret.\n\n' +
        'It is not an encrypted backup. Delete the file when you are done.\n\n' +
        'Continue?'
    );
    if (!confirmed) return;
    const really = window.confirm(
      'Last confirmation: the file will contain plaintext secrets and is not protected by your password.'
    );
    if (!really) return;
    try {
      const bytes = await onExportRaw(password);
      downloadBytes(bytes, `${fileName}.plaintext.txt`);
      toast.success('Exported decrypted raw contents');
    } catch (caught) {
      setError(
        caught instanceof VaultOpenError
          ? describeOpenFailure(caught.failure, caught.issues)
          : 'The raw contents could not be exported.'
      );
    }
  };

  const handleBiometric = async () => {
    if (!vaultId) return;
    setBioLoading(true);
    setError('');
    const controller = new AbortController();
    submitController.current = controller;
    try {
      const pw = await unlockWithBiometric(vaultId);
      await onSubmit(pw, controller.signal);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof VaultOpenError
          ? describeOpenFailure(e.failure, e.issues)
          : e instanceof Error && e.message.includes('cancelled')
            ? ''
            : 'Biometric unlock failed. Use password instead.'
      );
    } finally {
      if (submitController.current === controller)
        submitController.current = null;
      setBioLoading(false);
    }
  };

  const submitClassName = cn(
    'flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-bright',
    loading && 'bg-accent text-white/90 cursor-progress',
    !loading &&
      (canSubmit
        ? 'bg-accent text-white hover:bg-accent-hover'
        : 'border border-line bg-surface-4 text-ink-quaternary')
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label
          htmlFor={isCreate ? 'vault-new-secret' : 'vault-unlock-secret'}
          className="text-[13px] font-medium text-ink-secondary"
        >
          Master Password
        </Label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id={isCreate ? 'vault-new-secret' : 'vault-unlock-secret'}
            type={showPassword ? 'text' : 'password'}
            name={isCreate ? 'vault-new-secret' : 'vault-unlock-secret'}
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            aria-invalid={!!error}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isCreate ? 'Choose a strong password...' : undefined}
            className={cn(
              'pr-10',
              error && 'border-danger/60 focus-visible:ring-danger/60'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className={EYE_BUTTON}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeSlash className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>
        {isCreate && password && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      estimate && i <= estimate.score
                        ? STRENGTH_CONFIG[
                            estimate.score as keyof typeof STRENGTH_CONFIG
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
            {verdict && !verdict.ok && (
              <p className="text-xs text-danger">
                {describePasswordVerdict(verdict)}
              </p>
            )}
            {estimate?.feedback.warning && (
              <p className="text-xs text-danger">{estimate.feedback.warning}</p>
            )}
            {estimate?.feedback.suggestions &&
              estimate.feedback.suggestions.length > 0 && (
                <p className="text-xs text-ink-quaternary">
                  {estimate.feedback.suggestions[0]}
                </p>
              )}
          </div>
        )}
      </div>

      {isCreate && (
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="vault-confirm-secret"
            className="text-[13px] font-medium text-ink-secondary"
          >
            Confirm Password
          </Label>
          <div className="relative">
            <Input
              id="vault-confirm-secret"
              type={showConfirmPassword ? 'text' : 'password'}
              name="vault-confirm-secret"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              aria-invalid={!!confirm && password !== confirm}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password..."
              className={`pr-10 ${
                confirm && password !== confirm ? 'border-danger/60' : ''
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              className={EYE_BUTTON}
              aria-label={
                showConfirmPassword ? 'Hide password' : 'Show password'
              }
            >
              {showConfirmPassword ? (
                <EyeSlash className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
          {confirm && password !== confirm && (
            <p className="text-xs text-danger">Passwords don't match</p>
          )}
        </div>
      )}

      {isCreate && (
        <p className="text-[11px] leading-relaxed text-ink-quaternary">
          There is no recovery path: if this password is lost, the file cannot
          be opened.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {openError &&
        fileName &&
        onExportRaw &&
        (openError.failure === 'invalid_payload' ||
          openError.failure === 'payload_corrupt') && (
          <button
            type="button"
            onClick={handleExportRaw}
            className={cn(SECONDARY_BUTTON, 'py-2 text-xs')}
          >
            Export decrypted raw text (not a backup)
          </button>
        )}

      {showBiometric && !isCreate && (
        <button
          type="button"
          onClick={handleBiometric}
          disabled={bioLoading}
          className={SECONDARY_BUTTON}
        >
          {bioLoading ? (
            <Spinner className="size-4 animate-spin" />
          ) : (
            <Fingerprint className="size-4" />
          )}
          Unlock with Biometrics
        </button>
      )}

      <button
        type="submit"
        disabled={loading || !canSubmit}
        aria-busy={loading}
        className={submitClassName}
      >
        {loading ? (
          <Spinner className="size-4 animate-spin" />
        ) : (
          !isCreate && <LockSimpleOpen className="size-4" />
        )}
        {isCreate ? 'Create' : 'Unlock'}
      </button>

      {showBack && (
        <button
          type="button"
          onClick={handleCancel}
          className="-mt-1 w-full py-1 text-xs text-ink-quaternary transition-colors hover:text-ink-tertiary"
        >
          ← Back
        </button>
      )}
    </form>
  );
}
