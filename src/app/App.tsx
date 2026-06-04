import { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ToastProvider } from "@/components/ui/toast"
import { Spinner } from "@phosphor-icons/react"
import { AppLayout } from "./components/layout/AppLayout"
import { SettingsLayout } from "./components/layout/SettingsLayout"
import { WelcomePage } from "./components/welcome/WelcomePage"
import { KeysPage } from "./components/keys/KeysPage"
import { SettingsPage } from "./components/settings/SettingsPage"
import { BiometricPrompt } from "./components/vault/BiometricPrompt"
import { HelpRoutes } from "../help/HelpRoutes"
import { HelpIndex } from "../help/components/HelpIndex"
import { HelpPage } from "../help/components/HelpPage"
import { useStore } from "./store/useStore"
import { useAutoLock } from "./hooks/useAutoLock"
import { loadSession, clearSession } from "./lib/session"
import { FileStorage } from "./lib/storage"

function AuthGuard({ children }: { children: React.ReactNode }) {
  const workspaceState = useStore((s) => s.workspaceState)
  const location = useLocation()

  if (workspaceState !== "unlocked") {
    return <Navigate to="/" state={{ from: location }} replace />
  }
  return <>{children}</>
}

function WelcomeGuard() {
  const workspaceState = useStore((s) => s.workspaceState)
  if (workspaceState === "unlocked") {
    return <Navigate to="/keys" replace />
  }
  return <WelcomePage />
}

function ThemeSync() {
  const theme = useStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    const applyTheme = (t: string) => {
      if (t === "light") {
        root.classList.add("light")
      } else if (t === "dark") {
        root.classList.remove("light")
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        if (prefersDark) root.classList.remove("light")
        else root.classList.add("light")
      }
    }
    applyTheme(theme)

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)")
      const handler = () => applyTheme("system")
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    }
  }, [theme])

  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeGuard />} />
      <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
        <Route path="/keys" element={<KeysPage />} />
      </Route>
      <Route element={<AuthGuard><SettingsLayout /></AuthGuard>}>
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="/help" element={<HelpRoutes />}>
        <Route index element={<HelpIndex />} />
        <Route path=":slug" element={<HelpPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function BiometricPromptLayer() {
  const prompt = useStore((s) => s.biometricPrompt)
  const setPrompt = useStore((s) => s.setBiometricPrompt)

  if (!prompt) return null
  return (
    <BiometricPrompt
      vaultId={prompt.vaultId}
      password={prompt.password}
      onDone={() => setPrompt(null)}
    />
  )
}

function SessionRestore({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const session = loadSession()
    if (!session) { setReady(true); return }

    const { fileName, password } = session
    FileStorage.openVault(fileName, password)
      .then((db) => {
        useStore.getState().unlock(db, password, fileName)
      })
      .catch(() => {
        clearSession()
      })
      .finally(() => setReady(true))
  }, [])

  useAutoLock()

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas-deepest">
        <Spinner className="size-6 animate-spin text-ink-quaternary" />
      </div>
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <SessionRestore>
        <ToastProvider>
          <TooltipProvider delayDuration={300}>
            <AppRoutes />
            <BiometricPromptLayer />
          </TooltipProvider>
        </ToastProvider>
      </SessionRestore>
    </BrowserRouter>
  )
}
