import { Outlet, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

export function SettingsLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <div className="flex flex-1 flex-col min-w-0 p-3">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <header className="h-12 flex items-center gap-3 px-4 shrink-0 border-b border-line-subtle">
            <button onClick={() => navigate("/keys")}
                    className="btn-ghost text-xs">
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </button>
          </header>

          <div className="flex-1 overflow-auto">
            <main className="p-6 max-w-4xl mx-auto w-full">
              <Outlet />
            </main>
          </div>

          <footer className="h-7 flex items-center justify-between px-4 text-2xs text-ink-quaternary border-t border-line-subtle shrink-0">
            <span />
            <span>Keya v1.0</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
