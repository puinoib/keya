import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import type { HelpDocument } from '../types';
import { cn } from '@/lib/utils';

interface HelpSidebarProps {
  documents: HelpDocument[];
  currentSlug: string | null;
  onNavigate: (slug: string | null) => void;
}

export function HelpSidebar({
  documents,
  currentSlug,
  onNavigate,
}: HelpSidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-canvas-panel px-2 pt-3 pb-2">
      <button
        type="button"
        onClick={() => navigate({ to: '/keys' })}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 mb-3 text-xs text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to app</span>
      </button>

      <nav className="flex-1 overflow-y-auto space-y-0.5">
        {documents.map((doc) => (
          <button
            key={doc.slug}
            onClick={() => onNavigate(doc.slug === 'index' ? null : doc.slug)}
            className={cn(
              'flex items-center w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors',
              (
                doc.slug === 'index'
                  ? currentSlug === null
                  : currentSlug === doc.slug
              )
                ? 'bg-accent/35 text-accent-bright font-medium'
                : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3'
            )}
          >
            {doc.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
