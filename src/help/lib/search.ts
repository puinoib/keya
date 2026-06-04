import { HelpDocument, SearchResult } from '../types'

interface SearchIndex {
  documents: HelpDocument[]
}

export function searchDocuments(
  index: SearchIndex,
  query: string
): SearchResult[] {
  if (!query.trim()) {
    return []
  }

  const terms = query.toLowerCase().split(/\s+/)
  const results: SearchResult[] = []

  for (const doc of index.documents) {
    const matches: string[] = []
    let score = 0

    const titleLower = doc.title.toLowerCase()
    const descLower = doc.description.toLowerCase()
    const contentLower = doc.content.toLowerCase()

    for (const term of terms) {
      if (titleLower.includes(term)) {
        score += 10
        matches.push(doc.title)
      }

      if (descLower.includes(term)) {
        score += 5
        matches.push(doc.description)
      }

      if (contentLower.includes(term)) {
        score += 1
        const sentences = doc.content.split(/[。！？.!?]/)
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(term) && matches.length < 5) {
            matches.push(sentence.trim())
          }
        }
      }
    }

    if (score > 0) {
      results.push({
        document: doc,
        matches: [...new Set(matches)],
        score
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

export function buildSearchIndex(documents: HelpDocument[]): SearchIndex {
  return { documents }
}
