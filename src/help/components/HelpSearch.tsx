import { useState, useEffect } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import type { HelpDocument, SearchResult } from '../types';
import { searchDocuments, buildSearchIndex } from '../lib/search';
import { cn } from '@/lib/utils';

interface HelpSearchProps {
  documents: HelpDocument[];
  onNavigate: (slug: string | null) => void;
}

export function HelpSearch({ documents, onNavigate }: HelpSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const searchIndex = buildSearchIndex(documents);

  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchDocuments(searchIndex, query);
      setResults(searchResults);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, searchIndex]);

  const handleSelectResult = (slug: string) => {
    setQuery('');
    setIsOpen(false);
    onNavigate(slug === 'index' ? null : slug);
  };

  return (
    <div className="relative w-full max-w-sm">
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-quaternary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help docs..."
          className={cn(
            'w-full pl-9 pr-3 py-1.5 rounded-md border border-line-subtle',
            'bg-surface-2 text-ink-primary text-xs',
            'placeholder:text-ink-quaternary',
            'focus:outline-none focus:ring-1 focus:ring-accent-bright',
            'transition-all duration-150'
          )}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-canvas-base border border-line-subtle rounded-md shadow-lg overflow-hidden z-10">
          <div className="max-h-96 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.document.slug}
                onClick={() => handleSelectResult(result.document.slug)}
                className="w-full text-left px-4 py-3 hover:bg-surface-3 transition-colors border-b border-line-subtle last:border-b-0"
              >
                <div className="font-medium text-ink-primary text-sm">
                  {result.document.title}
                </div>
                <div className="text-xs text-ink-secondary mt-1">
                  {result.document.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-canvas-base border border-line-subtle rounded-md shadow-lg p-4 text-sm text-ink-secondary">
          No matching results
        </div>
      )}
    </div>
  );
}
