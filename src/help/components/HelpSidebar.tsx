import { useLocation, Link } from 'react-router-dom'
import type { HelpDocument } from '../types'
import { cn } from '@/lib/utils'

interface HelpSidebarProps {
  documents: HelpDocument[]
}

export function HelpSidebar({ documents }: HelpSidebarProps) {
  const location = useLocation()

  const isActive = (slug: string) => {
    return location.pathname === `/help/${slug}` ||
           (slug === 'index' && location.pathname === '/help')
  }

  return (
    <aside className="w-56 shrink-0 border-r border-line-subtle overflow-y-auto">
      <nav className="p-4 space-y-1">
        {documents.map((doc) => (
          <Link
            key={doc.slug}
            to={doc.slug === 'index' ? '/help' : `/help/${doc.slug}`}
            className={cn(
              'block px-3 py-2 rounded-md text-sm transition-colors',
              isActive(doc.slug)
                ? 'bg-accent-default/20 text-accent-bright font-medium'
                : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
            )}
          >
            {doc.title}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
