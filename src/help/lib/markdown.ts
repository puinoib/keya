import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const internalLinkRegex = /href="\/docs\/([^"]+)"/g;

export function parseMarkdown(content: string): string {
  return marked(content) as string;
}

export function convertInternalLinks(html: string): {
  html: string;
  internalLinks: Set<string>;
} {
  const internalLinks = new Set<string>();
  const converted = html.replace(internalLinkRegex, (_match, slug) => {
    internalLinks.add(slug);
    // Keep a real href so the link stays focusable and copyable; the click
    // handler intercepts it for client-side navigation.
    return `href="/docs/${slug}" data-internal-link="/docs/${slug}"`;
  });

  return {
    html: converted,
    internalLinks,
  };
}
