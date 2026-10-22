import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const internalLinkRegex = /href="\/docs\/([^"]+)"/g;

/**
 * Help content ships with the app, so this is defence in depth rather than a
 * trust boundary: raw HTML is dropped, event handlers are stripped, and
 * script-bearing URLs are replaced. Keep the allowlist in mind when adding a
 * tag to the guides.
 */
const DANGEROUS_BLOCKS =
  /<(script|style|iframe|object|embed|form|link|meta)\b[\s\S]*?(<\/\1\s*>|$)/gi;
const EVENT_ATTRIBUTE = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URL =
  /\s(href|src)\s*=\s*("|')?\s*(?:javascript|data|vbscript):[^"'\s>]*/gi;

export function sanitizeHtml(html: string): string {
  return html
    .replace(DANGEROUS_BLOCKS, '')
    .replace(EVENT_ATTRIBUTE, '')
    .replace(DANGEROUS_URL, ' $1="#"');
}

export function parseMarkdown(content: string): string {
  return sanitizeHtml(marked(content) as string);
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
