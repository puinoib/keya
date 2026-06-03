import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { KeyForm } from "../keys/KeyForm"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useStore } from "../../store/useStore"

export function AppLayout() {
  const { showAddForm, setShowAddForm, db } = useStore()

  return (
    <div className="flex h-screen bg-canvas-base text-ink-primary overflow-hidden">
      <Sidebar />
      <Separator orientation="vertical" />

      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />

        <ScrollArea className="flex-1">
          <main className="p-6 max-w-4xl mx-auto w-full">
            <Outlet />
          </main>
        </ScrollArea>

        <footer className="h-7 flex items-center justify-between px-4 text-2xs text-ink-quaternary border-t border-line-subtle bg-canvas-panel shrink-0">
          <span>{db ? `${db.getApiKeys().length} keys` : "No vault"}</span>
          <span>Keya v1.0</span>
        </footer>
      </div>

      <KeyForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  )
}
