import { describe, it, expect } from 'vitest';
import { parseMarkdown, convertInternalLinks, sanitizeHtml } from '../markdown';

describe('markdown', () => {
  it('should parse markdown to html', () => {
    const markdown = '# Hello\n\nThis is a **test**.';
    const html = parseMarkdown(markdown);
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('<strong>test</strong>');
  });

  it('drops script blocks and inline event handlers', () => {
    const html = parseMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">'
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });

  it('neutralises a script-bearing link target', () => {
    const html = parseMarkdown('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('keeps ordinary markup intact', () => {
    expect(sanitizeHtml('<p>Plain <em>text</em></p>')).toBe(
      '<p>Plain <em>text</em></p>'
    );
  });

  it('should convert internal links', () => {
    const html = '<a href="/docs/quick-start">快速开始</a>';
    const result = convertInternalLinks(html);
    expect(result.html).toContain('data-internal-link="/docs/quick-start"');
    expect(result.html).toContain('href="/docs/quick-start"');
    expect(result.internalLinks.has('quick-start')).toBe(true);
  });

  it('should not convert external links', () => {
    const html = '<a href="https://example.com">External</a>';
    const result = convertInternalLinks(html);
    expect(result.html).toBe(html);
    expect(result.internalLinks.size).toBe(0);
  });
});
