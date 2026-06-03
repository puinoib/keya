import { Lock } from "lucide-react"
import { useStore } from "../../store/useStore"
import { KeyList } from "../keys/KeyList"
import { KeyDetail } from "../keys/KeyDetail"

export function KeysPage() {
  const { db, selectedKeyId } = useStore()

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 px-6 py-5 overflow-y-auto">
        <div className="w-full max-w-4xl mx-auto">
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
        </div>
      </div>

      {/* Detail wrapper: animates width so flex naturally shifts the list */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                    ${selectedKeyId ? "w-72" : "w-0"}`}
      >
        <KeyDetail />
      </div>
    </div>
  )
}
