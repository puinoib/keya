import { useState, useCallback } from 'react';
import { getDocument } from '../lib/manifest';
import { MarkdownContent } from './MarkdownContent';
import { FaqContent } from './FaqContent';
import { TableOfContents } from './TableOfContents';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function HelpPage({ slug }: { slug: string }) {
  const document = getDocument(slug);
  const [headings, setHeadings] = useState<Heading[]>([]);

  const handleHeadings = useCallback((h: Heading[]) => setHeadings(h), []);

  if (!document) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-ink-primary">
          Document not found
        </h2>
        <p className="text-ink-secondary mt-2">
          The document you are looking for does not exist or has been moved
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-8">
      <article className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-ink-primary mb-2">
          {document.title}
        </h1>
        {document.updated && (
          <p className="text-xs text-ink-quaternary mb-5">
            Updated {document.updated}
          </p>
        )}
        {document.description && (
          <p className="text-sm text-ink-secondary mb-8 leading-relaxed border-l-2 border-accent pl-3">
            {document.description}
          </p>
        )}
        {slug === 'faq' ? (
          <FaqContent content={document.content} />
        ) : (
          <MarkdownContent content={document.content} onHeadings={handleHeadings} />
        )}
      </article>
      {!['faq', 'index'].includes(slug) && headings.length > 0 && (
        <div className="hidden lg:block sticky top-0 self-start">
          <TableOfContents headings={headings} />
        </div>
      )}
    </div>
  );
}
