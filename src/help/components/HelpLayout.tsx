import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { HelpSidebar, HelpSearch } from './index';
import { HelpIndex } from './HelpIndex';
import { HelpPage } from './HelpPage';
import { loadManifest } from '../lib/manifest';

function getSlugFromPath(pathname: string): string | null {
  const slug = pathname.replace('/help/', '').replace('/help', '');
  return slug || null;
}

export function HelpLayout() {
  const { documents } = loadManifest();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentSlug, setCurrentSlug] = useState<string | null>(() =>
    getSlugFromPath(location.pathname)
  );

  // sync state when browser nav (back/forward)
  useEffect(() => {
    setCurrentSlug(getSlugFromPath(location.pathname));
  }, [location.pathname]);

  const handleNavigate = (slug: string | null) => {
    setCurrentSlug(slug);
    navigate({
      to: slug ? '/help/$slug' : '/help',
      params: slug ? { slug } : undefined,
    });
  };

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <div className="flex flex-col w-56 shrink-0">
        <div className="p-4 border-b border-line-subtle">
          <HelpSearch documents={documents} onNavigate={handleNavigate} />
        </div>

        <HelpSidebar
          documents={documents}
          currentSlug={currentSlug}
          onNavigate={handleNavigate}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-end px-6 py-3 border-b border-line-subtle shrink-0">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            Open App
          </a>
        </header>
        <div className="flex-1 overflow-y-auto">
          <main className="p-8 max-w-4xl mx-auto w-full">
            {currentSlug ? <HelpPage slug={currentSlug} /> : <HelpIndex />}
          </main>
        </div>
      </div>
    </div>
  );
}
