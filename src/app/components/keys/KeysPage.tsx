import { Key, Lock } from "lucide-react"
import { useStore } from "../../store/useStore"
import { KeyList } from "../keys/KeyList"

export function KeysPage() {
  const db = useStore((s) => s.db)

  return (
    <>
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
          onClick={() => useStore.getState().lock()}
          className="btn-ghost text-xs"
        >
          <Lock className="size-3" />
          Lock
        </button>
      </div>

      <KeyList />
    </>
  )
}
