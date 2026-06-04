import { useState, useEffect } from 'react'
import { Fingerprint, Spinner, X } from "@phosphor-icons/react"
import { registerBiometric, isBiometricSupported, isBiometricRegistered } from '@/app/lib/biometric'

interface BiometricPromptProps {
  vaultId: string
  password: string
  onDone: () => void
}

export function BiometricPrompt({ vaultId, password, onDone }: BiometricPromptProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!isBiometricSupported()) {
      onDone()
      return
    }
    isBiometricRegistered(vaultId).then((registered) => {
      if (registered) onDone()
    })
  }, [vaultId, onDone])

  if (!visible) return null

  const handleSkip = () => {
    setVisible(false)
    onDone()
  }

  const handleEnable = async () => {
    setLoading(true)
    setError('')
    try {
      await registerBiometric(vaultId, password)
      onDone()
    } catch (e) {
      console.error('Biometric registration failed:', e)
      setError(e instanceof Error ? e.message : 'Registration failed. You can try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-canvas-panel border border-line rounded-lg p-5 w-80 shadow-dialog">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Fingerprint className="size-5 text-accent" />
            <h3 className="text-sm font-medium text-ink-primary">Enable Biometric Unlock</h3>
          </div>
          <button onClick={handleSkip} className="text-ink-quaternary hover:text-ink-secondary transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <p className="text-xs text-ink-tertiary mb-4">
          Use fingerprint or face recognition to unlock this vault quickly next time.
        </p>
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
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-bright transition-colors disabled:opacity-50"
          >
            {loading ? <Spinner className="size-3.5 animate-spin" /> : <Fingerprint className="size-3.5" />}
            Enable
          </button>
        </div>
      </div>
    </div>
  )
}
