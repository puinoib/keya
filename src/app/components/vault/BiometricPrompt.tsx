import { useState, useEffect, useRef } from 'react';
import { Fingerprint, Spinner, X } from '@phosphor-icons/react';
import {
  registerBiometric,
  isBiometricSupported,
  isBiometricRegistered,
} from '@/app/lib/biometric';
import { Input } from '@/components/ui/input';
import { useStore } from '@/app/store/useStore';

interface BiometricPromptProps {
  vaultId: string;
  onDone: () => void;
}

export function BiometricPrompt({ vaultId, onDone }: BiometricPromptProps) {
  const verifyPassword = useStore((s) => s.verifyPassword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(true);
  const [password, setPassword] = useState('');
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isBiometricSupported()) {
      onDone();
      return;
    }
    isBiometricRegistered(vaultId).then((registered) => {
      if (registered) onDone();
    });
  }, [vaultId, onDone]);

  // Focus the password field and let Escape dismiss, so the overlay behaves
  // like the dialogs it looks like.
  useEffect(() => {
    if (!visible) return;
    passwordRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setVisible(false);
        onDone();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDone]);

  if (!visible) return null;

  const handleSkip = () => {
    setVisible(false);
    onDone();
  };

  const handleEnable = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      // The password is used for this gesture only: verify it, wrap it with the
      // PRF key, then drop it. It is never stored in the app state (I16).
      if (!(await verifyPassword(password))) {
        setError('That is not the current master password.');
        return;
      }
      await registerBiometric(vaultId, password);
      setPassword('');
      onDone();
    } catch (e) {
      // Never log the raw exception: provider or authenticator messages can
      // carry values that do not belong in a console.
      setError(
        e instanceof Error
          ? e.message
          : 'Registration failed. You can try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="biometric-prompt-title"
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 animate-fade-in"
    >
      <div className="bg-canvas-panel border border-line rounded-lg p-5 w-80 shadow-dialog">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="size-5 text-accent" />
            <h3
              id="biometric-prompt-title"
              className="text-sm font-medium text-ink-primary"
            >
              Enable Biometric Unlock
            </h3>
          </div>
          <button
            onClick={handleSkip}
            aria-label="Close"
            className="text-ink-quaternary hover:text-ink-secondary transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-xs text-ink-tertiary mb-2">
          Use fingerprint or face recognition to unlock this vault quickly next
          time.
        </p>
        <p className="text-xs text-ink-quaternary mb-3">
          Make sure you remember your vault password — if this device's passkey
          is deleted, biometric unlock will stop working.
        </p>
        <label
          htmlFor="biometric-confirm-password"
          className="mb-1 block text-xs text-ink-tertiary"
        >
          Confirm your master password
        </label>
        <Input
          id="biometric-confirm-password"
          ref={passwordRef}
          type="password"
          autoComplete="off"
          data-lpignore="true"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && password && !loading) {
              void handleEnable();
            }
          }}
          placeholder="Master password"
          className="mb-3 h-8 text-xs"
        />
        {error && <p className="text-xs text-danger mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            className="flex-1 rounded-md bg-surface-2 border border-line px-3 py-2 text-xs text-ink-secondary hover:bg-surface-3 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleEnable}
            disabled={loading || !password}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Spinner className="size-3.5 animate-spin" />
            ) : (
              <Fingerprint className="size-3.5" />
            )}
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
