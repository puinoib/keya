import { useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MainPage } from "./components/layout/MainPage"
import { WelcomePage } from "./components/welcome/WelcomePage"
import { useStore } from "./store/useStore"

export default function App() {
  const workspaceState = useStore((s) => s.workspaceState)
  const theme = useStore((s) => s.theme)

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement
    const applyTheme = (t: string) => {
      if (t === "light") {
        root.classList.add("light")
      } else if (t === "dark") {
        root.classList.remove("light")
      } else {
        // system
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

  return (
    <TooltipProvider delayDuration={300}>
      {workspaceState === "unlocked" ? <MainPage /> : <WelcomePage />}
    </TooltipProvider>
  )
}
