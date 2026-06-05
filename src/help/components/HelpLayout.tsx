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
      <HelpSidebar
        documents={documents}
        currentSlug={currentSlug}
        onNavigate={handleNavigate}
      />

      <div className="flex flex-1 flex-col min-w-0 p-3 pl-0">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <header className="h-12 flex items-center px-4 shrink-0">
            <HelpSearch documents={documents} onNavigate={handleNavigate} />
          </header>
          <div className="flex-1 overflow-y-auto">
            <main className="p-8 max-w-4xl mx-auto w-full">
              {currentSlug ? <HelpPage slug={currentSlug} /> : <HelpIndex />}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
