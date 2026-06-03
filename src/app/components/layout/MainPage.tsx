import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { KeyList } from "../keys/KeyList"
import { KeyForm } from "../keys/KeyForm"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useStore } from "../../store/useStore"
import { FileStorage } from "../../lib/storage"
import { Key, Lock } from "lucide-react"

export function MainPage() {
  const { showAddForm, setShowAddForm, db } = useStore()

  return (
    <div className="flex h-screen bg-canvas-base text-ink-primary overflow-hidden">
      {/* ── Sidebar ── */}
      <Sidebar />

      <Separator orientation="vertical" />

      {/* ── Main Area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopBar />

        <ScrollArea className="flex-1">
          <main className="p-6 max-w-4xl mx-auto w-full">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-8 rounded-lg bg-accent/15 text-accent-bright">
                  <Key className="size-4" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold tracking-tight text-ink-primary">API Keys</h1>
                  <p className="text-xs text-ink-quaternary">
                    {db?.getApiKeys().length ?? 0} keys stored
                  </p>
                </div>
              </div>

              <button
                onClick={async () => {
                  await FileStorage.lock()
                  useStore.getState().setWorkspaceState("locked")
                }}
                className="btn-ghost text-xs"
              >
                <Lock className="size-3" />
                Lock
              </button>
            </div>

            {/* ── Content ── */}
            <KeyList />
          </main>
        </ScrollArea>

        {/* ── Status Bar ── */}
        <footer className="h-7 flex items-center justify-between px-4 text-2xs text-ink-quaternary border-t border-white/[0.05] bg-canvas-panel shrink-0">
          <span>{db ? `${db.getApiKeys().length} keys` : "No vault"}</span>
          <span>Keya v1.0</span>
        </footer>
      </div>

      <KeyForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  )
}
