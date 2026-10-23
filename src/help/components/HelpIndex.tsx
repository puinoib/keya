import { Link } from '@tanstack/react-router';
import { ArrowRight } from '@phosphor-icons/react';
import { getDocument, loadManifest } from '../lib/manifest';
import { MarkdownContent } from './MarkdownContent';
import { cn } from '@/lib/utils';

export function HelpIndex() {
  const { categories } = loadManifest();
  const intro = getDocument('index');

  return (
    <div className="space-y-8">
      {intro && (
        <div>
          <h1 className="text-3xl font-bold text-ink-primary mb-2">
            {intro.title}
          </h1>
          <p className="text-ink-secondary text-lg mb-6">{intro.description}</p>
          <MarkdownContent content={intro.content} />
        </div>
      )}

      {Object.entries(categories)
        .filter(([name]) => name !== 'all')
        .map(([name, documents]) => (
          <section key={name}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-ink-quaternary">
              {name}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {documents
                .filter((doc) => doc.slug !== 'index')
                .map((doc) => (
                  <Link
                    key={doc.slug}
                    to="/docs/$slug"
                    params={{ slug: doc.slug }}
                    className={cn(
                      'group block p-6 rounded-lg border border-line-subtle',
                      'bg-surface-2 hover:bg-surface-4',
                      'transition-all duration-150'
                    )}
                  >
                    <h3 className="font-semibold text-ink-primary group-hover:text-accent-bright transition-colors">
                      {doc.title}
                    </h3>
                    <p className="text-sm text-ink-secondary mt-2">
                      {doc.description}
                    </p>
                    <div className="mt-4 flex items-center text-sm text-accent-bright">
                      <span>Read more</span>
                      <ArrowRight className="ml-1 size-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        ))}
    </div>
  );
}
