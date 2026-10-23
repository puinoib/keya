import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from '@phosphor-icons/react';
import type { HelpManifest } from '../types';
import { cn } from '@/lib/utils';

interface HelpSidebarProps {
  categories: HelpManifest['categories'];
  currentSlug: string | null;
  onNavigate: (slug: string | null) => void;
}

export function HelpSidebar({
  categories,
  currentSlug,
  onNavigate,
}: HelpSidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-canvas-panel px-2 pt-3 pb-2">
      <button
        type="button"
        onClick={() => navigate({ to: '/start' })}
        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 mb-3 text-xs text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        <span>Back to app</span>
      </button>

      <nav className="flex-1 overflow-y-auto space-y-3">
        {Object.entries(categories)
          .filter(([name]) => name !== 'all')
          .map(([name, documents]) => (
            <div key={name}>
              <p className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-quaternary">
                {name}
              </p>
              <div className="space-y-0.5">
                {documents.map((doc) => {
                  const isCurrent =
                    doc.slug === 'index'
                      ? currentSlug === null
                      : currentSlug === doc.slug;
                  return (
                    <button
                      key={doc.slug}
                      type="button"
                      onClick={() =>
                        onNavigate(doc.slug === 'index' ? null : doc.slug)
                      }
                      className={cn(
                        'flex items-center w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors',
                        isCurrent
                          ? 'bg-accent/35 text-accent-bright font-medium'
                          : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3'
                      )}
                    >
                      {doc.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </nav>
    </aside>
  );
}
