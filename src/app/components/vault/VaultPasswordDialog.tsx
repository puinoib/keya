import { useState, useEffect, useDeferredValue, useRef } from 'react';
import {
  Spinner,
  ArrowRight,
  Lock,
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
import { toast } from 'sonner';
interface VaultPasswordDialogProps {
  mode: 'unlock' | 'new';
  vaultName: string;
  vaultIcon?: string;
  fileName?: string;
  vaultId?: string;
  onSubmit: (password: string, signal: AbortSignal) => Promise<void>;
  onCancel: () => void;
  /** §6.3 escape hatch: decrypt raw bytes after double confirmation. */
  onExportRaw?: (password: string) => Promise<Uint8Array>;
}

const STRENGTH_CONFIG = {
  0: { label: 'Very Weak', color: 'bg-red-500' },
  1: { label: 'Weak', color: 'bg-red-500' },
  2: { label: 'Fair', color: 'bg-orange-500' },
  3: { label: 'Good', color: 'bg-yellow-500' },
  4: { label: 'Strong', color: 'bg-emerald-500' },
} as const;

export function VaultPasswordDialog({
  mode,
  vaultName,
  vaultIcon,
  fileName,
  vaultId,
  onSubmit,
  onCancel,
  onExportRaw,
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

  return (
    <div className="space-y-3">
      {!isCreate && (
        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
            {vaultIcon || <Lock className="size-4" />}
          </div>
          <div>
            <p className="text-sm font-medium text-ink-primary">
              Unlock: {vaultName}
            </p>
            {fileName && (
              <p className="text-xs text-ink-quaternary">{fileName}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-ink-tertiary">Master Password</Label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            name={isCreate ? 'vault-new-secret' : 'vault-unlock-secret'}
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isCreate ? 'Choose a strong password...' : 'Enter password...'
            }
            className="pr-10"
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-quaternary transition-colors hover:text-ink-secondary"
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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex gap-1">
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
        <div className="space-y-1.5">
          <Label className="text-xs text-ink-tertiary">Confirm Password</Label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              name="vault-confirm-secret"
              autoComplete="off"
              data-form-type="other"
              data-lpignore="true"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password..."
              className={`pr-10 ${
                confirm && password !== confirm ? 'border-red-500/50' : ''
              }`}
              onKeyDown={(e) =>
                e.key === 'Enter' && canSubmit && handleSubmit()
              }
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-quaternary transition-colors hover:text-ink-secondary"
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
      {error && <p className="text-xs text-danger">{error}</p>}
      {openError &&
        fileName &&
        onExportRaw &&
        (openError.failure === 'invalid_payload' ||
          openError.failure === 'payload_corrupt') && (
          <button
            type="button"
            onClick={handleExportRaw}
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-xs text-ink-secondary hover:bg-surface-3 transition-colors"
          >
            Export decrypted raw text (not a backup)
          </button>
        )}

      {showBiometric && !isCreate && (
        <button
          onClick={handleBiometric}
          disabled={bioLoading}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-surface-2 border border-line px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-3 transition-colors disabled:opacity-50"
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
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Spinner className="size-4 animate-spin" />
        ) : (
          <ArrowRight className="size-4" />
        )}
        {isCreate ? 'Create' : 'Unlock'}
      </button>

      <button
        onClick={handleCancel}
        className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1"
      >
        ← Back
      </button>
    </div>
  );
}
