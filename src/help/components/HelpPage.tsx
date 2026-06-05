import { getDocument } from '../lib/manifest';
import { MarkdownContent } from './MarkdownContent';

export function HelpPage({ slug }: { slug: string }) {
  const document = getDocument(slug);

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
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold text-ink-primary mb-4">
        {document.title}
      </h1>
      {document.description && (
        <p className="text-lg text-ink-secondary mb-8">
          {document.description}
        </p>
      )}
      {document.updated && (
        <p className="text-xs text-ink-quaternary mb-8">
          Updated {document.updated}
        </p>
      )}
      <MarkdownContent content={document.content} />
    </article>
  );
}
