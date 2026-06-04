import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { HelpSidebar, HelpSearch } from './index'
import type { HelpDocument } from '../types'
import { loadManifest } from '../lib/manifest'

export function HelpLayout() {
  const [documents, setDocuments] = useState<HelpDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDocs() {
      try {
        const manifest = await loadManifest()
        setDocuments(manifest.documents)
      } catch (error) {
        console.error('Failed to load help documents:', error)
      } finally {
        setLoading(false)
      }
    }

    loadDocs()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-ink-quaternary">加载中...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <div className="flex flex-col w-56 shrink-0">
        <div className="p-4 border-b border-line-subtle">
          <HelpSearch documents={documents} />
        </div>

        <HelpSidebar documents={documents} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          <main className="p-8 max-w-4xl mx-auto w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
