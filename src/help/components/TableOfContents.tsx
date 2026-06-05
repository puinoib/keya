import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav className="w-40 shrink-0">
      <p className="text-[11px] font-medium text-ink-quaternary uppercase tracking-wider mb-3">
        On this page
      </p>
      <ul className="space-y-1 border-l border-line-subtle">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={cn(
                'block text-xs leading-relaxed py-1 transition-colors',
                h.level === 3 ? 'pl-5' : 'pl-3',
                activeId === h.id
                  ? 'text-accent-bright font-medium border-l-2 -ml-px border-accent-bright'
                  : 'text-ink-tertiary hover:text-ink-secondary'
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
