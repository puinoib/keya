import { useState } from "react"
import { useStore } from "../../store/useStore"
import { ApiTester } from "../../lib/api-tester"
import type { ApiKey } from "../../../core/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Copy, MoreHorizontal, FlaskConical, Trash2, ExternalLink } from "lucide-react"

export function KeyList() {
  const db = useStore((s) => s.db)
  const { searchQuery, selectedTagIds, setShowAddForm, updateKey, deleteKey } = useStore()
  const [testing, setTesting] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (!db) return null

  let keys = db.getApiKeys()

  if (searchQuery) {
    keys = db.searchKeys(searchQuery)
  }

  if (selectedTagIds.length > 0) {
    keys = keys.filter((k) => k.tag_ids.some((tid) => selectedTagIds.includes(tid)))
  }

  const categories = db.getCategories()
  const tags = db.getTags()
  const getCategory = (id: string | null) => categories.find((c) => c.id === id)
  const getTag = (id: string) => tags.find((t) => t.id === id)

  const handleTest = async (key: ApiKey) => {
    setTesting(key.id)
    const result = await ApiTester.testKey(key)
    updateKey(key.id, {
      last_tested: new Date().toISOString(),
      test_status: result.success ? "success" : "failed",
    })
    setTesting(null)
  }

  const handleCopy = async (keyValue: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(keyValue)
      setCopiedId(keyId)
      setTimeout(() => setCopiedId(null), 2000)
      // Clear clipboard after 15s
      setTimeout(() => {
        navigator.clipboard.writeText("")
      }, 15000)
    } catch {
      // clipboard unavailable
    }
  }

  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex items-center justify-center size-12 rounded-xl bg-white/[0.03] border border-white/[0.05] mb-4">
          <FlaskConical className="size-5 text-ink-quaternary" />
        </div>
        <h3 className="text-sm font-medium text-ink-secondary mb-1">No API Keys yet</h3>
        <p className="text-xs text-ink-quaternary mb-5">Add your first key to get started</p>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-bright transition-colors"
        >
          Add your first key
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {keys.map((key) => {
        const cat = getCategory(key.category_id)
        const isTesting = testing === key.id
        const testOk = key.test_status === "success"
        const testFail = key.test_status === "failed"

        return (
          <div
            key={key.id}
            className="group flex items-center gap-4 px-4 py-3 rounded-lg
                       bg-white/[0.01] border border-white/[0.06]
                       hover:bg-white/[0.03] hover:border-white/[0.10]
                       transition-all duration-150"
          >
            {/* ── Icon ── */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center justify-center size-9 rounded-lg shrink-0 text-base"
                  style={{
                    backgroundColor: (cat?.color ?? "#5e6ad2") + "18",
                    color: cat?.color ?? "#7170ff",
                  }}
                >
                  {cat?.icon ?? "🔑"}
                </div>
              </TooltipTrigger>
              <TooltipContent>{cat?.name ?? "Uncategorized"}</TooltipContent>
            </Tooltip>

            {/* ── Info ── */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-primary truncate">
                  {key.name}
                </span>
                {testOk && (
                  <span className="shrink-0 size-1.5 rounded-full bg-success-bright" />
                )}
                {testFail && (
                  <span className="shrink-0 size-1.5 rounded-full bg-danger" />
                )}
                {!key.test_status && (
                  <span className="shrink-0 size-1.5 rounded-full bg-ink-quaternary/30" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-quaternary">
                <span>{key.provider}</span>
                {key.service && (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span>{key.service}</span>
                  </>
                )}
                {key.test_status === "success" && key.test_latency_ms != null && (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span className="text-success-bright font-medium">
                      {key.test_latency_ms}ms
                    </span>
                  </>
                )}
                {testFail && (
                  <>
                    <span className="text-white/[0.12]">·</span>
                    <span className="text-danger font-medium">Failed</span>
                  </>
                )}
              </div>
            </div>

            {/* ── Tags ── */}
            <div className="hidden md:flex items-center gap-1 shrink-0">
              {key.tag_ids.slice(0, 2).map((tid) => {
                const tag = getTag(tid)
                if (!tag) return null
                return (
                  <span
                    key={tid}
                    className="px-2 py-0.5 text-2xs font-medium rounded-full border"
                    style={{
                      color: tag.color,
                      borderColor: tag.color + "40",
                      backgroundColor: tag.color + "10",
                    }}
                  >
                    {tag.name}
                  </span>
                )
              })}
              {key.tag_ids.length > 2 && (
                <span className="text-2xs text-ink-quaternary">
                  +{key.tag_ids.length - 2}
                </span>
              )}
            </div>

            {/* ── Actions ── */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleTest(key)}
                    disabled={isTesting}
                    className="inline-flex items-center justify-center size-7 rounded-md
                               text-ink-quaternary hover:text-ink-primary hover:bg-white/[0.05]
                               transition-colors disabled:opacity-50"
                  >
                    {isTesting ? (
                      <span className="size-3.5 border-2 border-ink-tertiary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FlaskConical className="size-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isTesting ? "Testing..." : "Test key"}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleCopy(key.key, key.id)}
                    className="inline-flex items-center justify-center size-7 rounded-md
                               text-ink-quaternary hover:text-ink-primary hover:bg-white/[0.05]
                               transition-colors"
                  >
                    {copiedId === key.id ? (
                      <span className="text-xs text-success-bright font-medium">✓</span>
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{copiedId === key.id ? "Copied!" : "Copy to clipboard"}</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center justify-center size-7 rounded-md
                                     text-ink-quaternary hover:text-ink-primary hover:bg-white/[0.05]
                                     transition-colors">
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => handleCopy(key.key, key.id)}>
                    <Copy className="size-3.5" />
                    Copy Key
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTest(key)}>
                    <FlaskConical className="size-3.5" />
                    Test Key
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <ExternalLink className="size-3.5" />
                    Open Endpoint
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm("Delete this key?")) deleteKey(key.id)
                    }}
                    className="text-danger focus:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      })}
    </div>
  )
}
