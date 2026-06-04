import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true
})

const internalLinkRegex = /href="\/help\/([^"]+)"/g

export function parseMarkdown(content: string): string {
  return marked(content) as string
}

export function convertInternalLinks(html: string): {
  html: string
  internalLinks: Set<string>
} {
  const internalLinks = new Set<string>()
  const converted = html.replace(internalLinkRegex, (_match, slug) => {
    internalLinks.add(slug)
    return `data-internal-link="/help/${slug}"`
  })

  return {
    html: converted,
    internalLinks
  }
}
