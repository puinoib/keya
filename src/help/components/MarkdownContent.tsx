import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { parseMarkdown, convertInternalLinks } from '../lib/markdown';

interface Heading {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function addHeadingIds(html: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const result = html.replace(/<h([2-3])([^>]*)>(.*?)<\/h[2-3]>/gi, (_match, level, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    const id = slugify(text);
    headings.push({ id, text, level: Number(level) });
    return `<h${level} id="${id}"${attrs}>${inner}</h${level}>`;
  });
  return { html: result, headings };
}

export function MarkdownContent({
  content,
  onHeadings,
}: {
  content: string;
  onHeadings?: (headings: Heading[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;

    const html = parseMarkdown(content);
    const { html: convertedHtml } = convertInternalLinks(html);
    const { html: finalHtml, headings } = addHeadingIds(convertedHtml);

    containerRef.current.innerHTML = finalHtml;
    onHeadings?.(headings);

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('[data-internal-link]');

      if (link) {
        e.preventDefault();
        const href = link.getAttribute('data-internal-link');
        if (href) {
          if (href.startsWith('/help/')) {
            const slug = href.replace('/help/', '');
            navigate({ to: '/help/$slug', params: { slug } });
          } else {
            navigate({ to: href as any });
          }
        }
      }
    };

    containerRef.current.addEventListener('click', handleLinkClick);

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleLinkClick);
      }
    };
  }, [content, navigate, onHeadings]);

  return (
    <div
      ref={containerRef}
      className="prose prose-sm max-w-none dark:prose-invert"
      style={{
        lineHeight: '1.7',
      }}
    />
  );
}
