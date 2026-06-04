import type { HelpDocument } from '../types'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HelpIndexProps {
  documents: HelpDocument[]
}

export function HelpIndex({ documents }: HelpIndexProps) {
  const docs = documents.filter(doc => doc.slug !== 'index')

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-ink-primary">
          欢迎使用 Keya
        </h1>
        <p className="text-ink-secondary text-lg">
          安全、简单的 API 密钥管理工具
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <a
            key={doc.slug}
            href={`/help/${doc.slug}`}
            className={cn(
              'group block p-6 rounded-lg border border-line-subtle',
              'bg-surface-2 hover:bg-surface-4',
              'transition-all duration-150'
            )}
          >
            <h3 className="font-semibold text-ink-primary group-hover:text-accent-bright transition-colors">
              {doc.title}
            </h3>
            <p className="text-sm text-ink-secondary mt-2">
              {doc.description}
            </p>
            <div className="mt-4 flex items-center text-sm text-accent-bright">
              <span>查看详情</span>
              <ArrowRight className="ml-1 size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
