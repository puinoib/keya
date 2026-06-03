import type { CachedVaultMeta } from '../../lib/storage'

interface VaultCardProps {
  fileName: string
  meta?: CachedVaultMeta
  onClick: () => void
}

export function VaultCard({ fileName, meta, onClick }: VaultCardProps) {
  const displayName = meta?.name || fileName.replace(/\.keya$/, '')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md bg-surface-2 border border-line hover:bg-surface-3 hover:border-line-subtle transition-colors text-left"
    >
      <div
        className="flex items-center justify-center size-8 rounded-lg text-sm shrink-0"
        style={{ backgroundColor: `${meta?.color ?? '#3b82f6'}20`, color: meta?.color ?? '#3b82f6' }}
      >
        {meta?.icon ?? '🔐'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-primary truncate">{displayName}</p>
        <p className="text-2xs text-ink-quaternary">
          {meta
            ? `${meta.keyCount} keys · Updated ${new Date(meta.updatedAt).toLocaleDateString()}`
            : fileName}
        </p>
      </div>
    </button>
  )
}
