import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
          navigate(href);
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
