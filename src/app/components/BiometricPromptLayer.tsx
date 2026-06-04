import { useStore } from '../store/useStore';
import { BiometricPrompt } from './vault/BiometricPrompt';

export function BiometricPromptLayer() {
  const prompt = useStore((s) => s.biometricPrompt);
  const setPrompt = useStore((s) => s.setBiometricPrompt);

  if (!prompt) return null;
  return (
    <BiometricPrompt
      vaultId={prompt.vaultId}
      password={prompt.password}
      onDone={() => setPrompt(null)}
    />
  );
}
