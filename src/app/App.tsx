import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "./components/layout/AppLayout"
import { SettingsLayout } from "./components/layout/SettingsLayout"
import { WelcomePage } from "./components/welcome/WelcomePage"
import { KeysPage } from "./components/keys/KeysPage"
import { SettingsPage } from "./components/settings/SettingsPage"
import { useStore } from "./store/useStore"

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <TooltipProvider delayDuration={300}>
        <AppRoutes />
      </TooltipProvider>
    </BrowserRouter>
  )
}
