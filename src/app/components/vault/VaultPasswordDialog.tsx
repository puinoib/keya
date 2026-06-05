import { useState, useEffect, useDeferredValue } from 'react';
import { Spinner, ArrowRight, Lock, Fingerprint } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  isBiometricSupported,
  isBiometricRegistered,
  unlockWithBiometric,
} from '@/app/lib/biometric';
import '@/app/lib/zxcvbn';
import { zxcvbnAsync } from '@zxcvbn-ts/core';
import type { ZxcvbnResult } from '@zxcvbn-ts/core';

interface VaultPasswordDialogProps {
  mode: 'unlock' | 'new';
  vaultName: string;
  vaultIcon?: string;
  fileName?: string;
  vaultId?: string;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
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
}: VaultPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [zxcvbnResult, setZxcvbnResult] = useState<ZxcvbnResult | null>(null);

  const isCreate = mode === 'new';
  const canSubmit = isCreate
    ? password.length >= 8 && password === confirm
    : password.length > 0;

  // Use deferred value for async zxcvbn check (React 19)
  const deferredPassword = useDeferredValue(password);

  useEffect(() => {
    if (!deferredPassword || !isCreate) {
      setZxcvbnResult(null);
      return;
    }
    zxcvbnAsync(deferredPassword).then(setZxcvbnResult);
  }, [deferredPassword, isCreate]);

  const strength = zxcvbnResult
    ? STRENGTH_CONFIG[zxcvbnResult.score as keyof typeof STRENGTH_CONFIG]
    : null;

  useEffect(() => {
    if (isCreate || !vaultId) return;
    isBiometricSupported() &&
      isBiometricRegistered(vaultId).then(setShowBiometric);
  }, [isCreate, vaultId]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(password);
    } catch {
      setError(
        isCreate ? 'Failed to create vault.' : 'Wrong password. Try again.'
      );
    }
    setLoading(false);
  };

  const handleBiometric = async () => {
    if (!vaultId) return;
    setBioLoading(true);
    setError('');
    try {
      const pw = await unlockWithBiometric(vaultId);
      await onSubmit(pw);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('cancelled')
          ? ''
          : 'Biometric unlock failed. Use password instead.'
      );
    } finally {
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
        <Input
          type="password"
          name={isCreate ? 'vault-new-secret' : 'vault-unlock-secret'}
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            isCreate ? 'Choose a strong password...' : 'Enter password...'
          }
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
        />
        {isCreate && password && (
          <div className="space-y-1">
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
            {zxcvbnResult?.feedback.warning && (
              <p className="text-xs text-danger">
                {zxcvbnResult.feedback.warning}
              </p>
            )}
            {zxcvbnResult &&
              zxcvbnResult.feedback.suggestions &&
              zxcvbnResult.feedback.suggestions.length > 0 && (
                <p className="text-xs text-ink-quaternary">
                  {zxcvbnResult.feedback.suggestions[0]}
                </p>
              )}
          </div>
        )}
      </div>

      {isCreate && (
        <div className="space-y-1.5">
          <Label className="text-xs text-ink-tertiary">Confirm Password</Label>
          <Input
            type="password"
            name="vault-confirm-secret"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password..."
            className={
              confirm && password !== confirm ? 'border-red-500/50' : ''
            }
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
          />
          {confirm && password !== confirm && (
            <p className="text-xs text-danger">Passwords don't match</p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

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
        onClick={onCancel}
        className="w-full text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors py-1"
      >
        ← Back
      </button>
    </div>
  );
}
