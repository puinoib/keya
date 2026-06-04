import type { HelpDocument } from '../types'
import { cn } from '@/lib/utils'

interface HelpSidebarProps {
  documents: HelpDocument[]
  currentSlug: string | null
  onNavigate: (slug: string | null) => void
}

export function HelpSidebar({ documents, currentSlug, onNavigate }: HelpSidebarProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-line-subtle overflow-y-auto">
      <nav className="p-4 space-y-1">
        {documents.map((doc) => (
          <button
            key={doc.slug}
            onClick={() => onNavigate(doc.slug === 'index' ? null : doc.slug)}
            className={cn(
              'block w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
              (doc.slug === 'index' ? currentSlug === null : currentSlug === doc.slug)
                ? 'bg-accent-default/20 text-accent-bright font-medium'
                : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
            )}
          >
            {doc.title}
          </button>
        ))}
      </nav>
    </aside>
  )
}
