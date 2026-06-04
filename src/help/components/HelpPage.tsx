import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import type { HelpDocument } from '../types'
import { getDocument } from '../lib/manifest'
import { MarkdownContent } from './MarkdownContent'

export function HelpPage() {
  const { slug } = useParams<{ slug: string }>()
  const [document, setDocument] = useState<HelpDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDoc() {
      if (!slug) {
        setError('文档不存在')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const doc = await getDocument(slug)
        if (doc) {
          setDocument(doc)
        } else {
          setError('文档不存在')
        }
      } catch (err) {
        setError('加载文档失败')
      } finally {
        setLoading(false)
      }
    }

    loadDoc()
  }, [slug])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-ink-quaternary" />
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-ink-primary">文档不存在</h2>
        <p className="text-ink-secondary mt-2">
          您访问的文档不存在或已被移动
        </p>
      </div>
    )
  }

  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold text-ink-primary mb-4">
        {document.title}
      </h1>
      {document.description && (
        <p className="text-lg text-ink-secondary mb-8">
          {document.description}
        </p>
      )}
      <MarkdownContent content={document.content} />
    </article>
  )
}
