import { TooltipProvider } from "@/components/ui/tooltip"
import { MainPage } from "./components/layout/MainPage"
import { WelcomePage } from "./components/welcome/WelcomePage"
import { useStore } from "./store/useStore"

export default function App() {
  const workspaceState = useStore((s) => s.workspaceState)

  return (
    <TooltipProvider delayDuration={300}>
      {workspaceState === "unlocked" ? <MainPage /> : <WelcomePage />}
    </TooltipProvider>
  )
}
