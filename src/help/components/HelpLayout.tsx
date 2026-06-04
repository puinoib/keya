import { useLocation } from 'react-router-dom'
import { HelpSidebar, HelpSearch } from './index'
import { HelpIndex } from './HelpIndex'
import { HelpPage } from './HelpPage'
import { loadManifest } from '../lib/manifest'

export function HelpLayout() {
  const { documents } = loadManifest()
  const location = useLocation()

  const slug = location.pathname.replace('/help/', '').replace('/help', '') || null

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <div className="flex flex-col w-56 shrink-0">
        <div className="p-4 border-b border-line-subtle">
          <HelpSearch documents={documents} />
        </div>

        <HelpSidebar documents={documents} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-end px-6 py-3 border-b border-line-subtle shrink-0">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            Open App
          </a>
        </header>
        <div className="flex-1 overflow-y-auto">
          <main className="p-8 max-w-4xl mx-auto w-full">
            {slug ? <HelpPage slug={slug} /> : <HelpIndex />}
          </main>
        </div>
      </div>
    </div>
  )
}
