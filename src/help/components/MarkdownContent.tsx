import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { parseMarkdown, convertInternalLinks } from '../lib/markdown';

export function MarkdownContent({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;

    const html = parseMarkdown(content);
    const { html: convertedHtml } = convertInternalLinks(html);

    containerRef.current.innerHTML = convertedHtml;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('[data-internal-link]');

      if (link) {
        e.preventDefault();
        const href = link.getAttribute('data-internal-link');
        if (href) {
          // Check if it's a help link
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
  }, [content, navigate]);

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
