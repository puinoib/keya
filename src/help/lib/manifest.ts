import type { HelpDocument, HelpManifest } from '../types'
import matter from 'gray-matter'

const contentModules = import.meta.glob('../content/*.md', { query: '?raw', import: 'default' })

async function loadDocument(slug: string): Promise<HelpDocument | null> {
  try {
    const path = `../content/${slug}.md`
    const loader = contentModules[path]

    if (!loader) {
      return null
    }

    const raw = await loader()
    const { data, content } = matter(raw)

    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      content,
      order: data.order || 999
    }
  } catch {
    return null
  }
}

export async function loadManifest(): Promise<HelpManifest> {
  const slugs = Object.keys(contentModules)
    .map(path => path.replace('../content/', '').replace('.md', ''))

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
