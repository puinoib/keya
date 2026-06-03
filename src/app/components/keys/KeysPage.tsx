import { Lock } from "lucide-react"
import { useStore } from "../../store/useStore"
import { KeyList } from "../keys/KeyList"

export function KeysPage() {
  const db = useStore((s) => s.db)

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-semibold tracking-tight text-ink-primary">
          Keys
          <span className="ml-1.5 text-xs font-normal text-ink-quaternary tabular-nums">
            {db?.getApiKeys().length ?? 0}
          </span>
        </h1>

        <button
          onClick={() => useStore.getState().lock()}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs text-ink-quaternary hover:text-ink-tertiary hover:bg-surface-3 transition-colors duration-150"
        >
          <Lock className="size-3" />
          Lock
        </button>
      </div>

      <KeyList />
    </>
  )
}
