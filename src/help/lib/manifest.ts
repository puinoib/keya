import type { HelpDocument, HelpManifest } from '../types'
import matter from 'gray-matter'

// eager: true loads all files at import time as raw strings
const contentModules = import.meta.glob<string>('../content/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
})

async function loadDocument(slug: string): Promise<HelpDocument | null> {
  try {
    // Find the key that ends with /{slug}.md
    const entry = Object.entries(contentModules).find(([key]) =>
      key === `../content/${slug}.md`
    )

    if (!entry) return null

    const raw = entry[1]
    const { data, content } = matter(raw)

    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      content,
      order: data.order || 999
    }
  } catch (err) {
    console.error(`Failed to load document "${slug}":`, err)
    return null
  }
}

export async function loadManifest(): Promise<HelpManifest> {
  const slugs = Object.keys(contentModules)
    .map(path => {
      const match = path.match(/([^/]+)\.md$/)
      return match ? match[1] : null
    })
    .filter((s): s is string => s !== null)

  const documents = await Promise.all(
    slugs.map(slug => loadDocument(slug))
  )

  const validDocs = documents.filter((doc): doc is HelpDocument => doc !== null)
    .sort((a, b) => (a.order || 999) - (b.order || 999))

  return {
    documents: validDocs,
    categories: {
      all: validDocs,
    }
  }
}

export async function getDocument(slug: string): Promise<HelpDocument | null> {
  return loadDocument(slug)
}
