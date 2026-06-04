import { describe, it, expect } from 'vitest'
import { parseMarkdown, convertInternalLinks } from '../markdown'

describe('markdown', () => {
  it('should parse markdown to html', () => {
    const markdown = '# Hello\n\nThis is a **test**.'
    const html = parseMarkdown(markdown)
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('<strong>test</strong>')
  })

  it('should convert internal links', () => {
    const html = '<a href="/help/quick-start">快速开始</a>'
    const result = convertInternalLinks(html)
    expect(result.html).toContain('data-internal-link="/help/quick-start"')
    expect(result.internalLinks.has('quick-start')).toBe(true)
  })

  it('should not convert external links', () => {
    const html = '<a href="https://example.com">External</a>'
    const result = convertInternalLinks(html)
    expect(result.html).toBe(html)
    expect(result.internalLinks.size).toBe(0)
  })
})
