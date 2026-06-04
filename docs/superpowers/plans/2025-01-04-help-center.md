# 帮助中心实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 为 Keya 项目添加帮助文档功能，采用相对隔离的代码组织方式。

**架构：** 在 `src/help/` 目录创建独立的帮助模块，使用 React Router 嵌套路由，复用主应用的 UI 组件。

**技术栈：** React 19, TypeScript, React Router 7, Tailwind CSS, Base UI, marked (Markdown 解析), gray-matter (Frontmatter 解析)

---

## 文件结构

```
src/help/
├── components/
│   ├── HelpLayout.tsx          # 布局容器
│   ├── HelpSidebar.tsx         # 左侧导航
│   ├── HelpSearch.tsx          # 搜索组件
│   ├── HelpIndex.tsx           # 首页
│   ├── HelpPage.tsx            # 文档页面
│   └── MarkdownContent.tsx     # Markdown 渲染器
├── content/
│   ├── index.md                # 帮助中心首页
│   ├── quick-start.md          # 快速开始
│   ├── backup.md               # 备份恢复
│   ├── faq.md                  # 常见问题
│   └── security.md             # 安全说明
├── lib/
│   ├── search.ts               # 搜索逻辑
│   ├── markdown.ts             # Markdown 解析
│   └── manifest.ts             # 文档清单
├── HelpRoutes.tsx              # 路由配置
└── types.ts                    # 类型定义
```

---

## Task 1: 安装依赖

- [ ] **Step 1: 安装 marked 和 gray-matter**

```bash
npm install marked gray-matter
```

预期输出：依赖安装成功

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add marked and gray-matter for help center"
```

---

## Task 2: 创建目录结构

- [ ] **Step 1: 创建目录**

```bash
mkdir -p src/help/components src/help/content src/help/lib
```

- [ ] **Step 2: Commit**

```bash
git add src/help
git commit -m "feat: create help directory structure"
```

---

## Task 3: 实现类型定义

- [ ] **Step 1: 创建 types.ts**

```typescript
// src/help/types.ts

export interface HelpDocument {
  slug: string
  title: string
  description: string
  content: string
  order?: number
}

export interface SearchResult {
  document: HelpDocument
  matches: string[]
  score: number
}

export interface HelpManifest {
  documents: HelpDocument[]
  categories: {
    [key: string]: HelpDocument[]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/help/types.ts
git commit -m "feat: add help center type definitions"
```

---

## Task 4: 实现 manifest.ts

- [ ] **Step 1: 创建初始文档内容**

创建 `src/help/content/index.md`:
```markdown
---
title: 欢迎使用 Keya
description: Keya 帮助中心
order: 1
---

# 欢迎使用 Keya

Keya 是一个安全的 API 密钥管理工具。

## 快速链接

- [快速开始](/help/quick-start)
- [常见问题](/help/faq)
- [备份恢复](/help/backup)
```

创建 `src/help/content/quick-start.md`:
```markdown
---
title: 快速开始
description: 了解如何快速上手 Keya
order: 2
---

# 快速开始

## 创建第一个保险库

1. 点击"创建新保险库"
2. 设置主密码
3. 开始添加您的 API 密钥
```

创建 `src/help/content/faq.md`:
```markdown
---
title: 常见问题
description: 常见问题解答
order: 3
---

# 常见问题

## Keya 是免费的吗？

是的，Keya 完全免费开源。
```

创建 `src/help/content/backup.md`:
```markdown
---
title: 备份与恢复
description: 如何备份和恢复您的数据
order: 4
---

# 备份与恢复

## 备份

您的数据存储在本地，请定期备份保险库文件。
```

创建 `src/help/content/security.md`:
```markdown
---
title: 安全说明
description: 了解 Keya 的安全机制
order: 5
---

# 安全说明

## 加密

Keya 使用 libsodium 进行加密。
```

- [ ] **Step 2: 实现 manifest.ts**

```typescript
// src/help/lib/manifest.ts
import { HelpDocument, HelpManifest } from '../types'
import matter from 'gray-matter'

// 动态导入所有 markdown 文件
const contentModules = import.meta.glob('../content/*.md', { as: 'raw' })

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
```

- [ ] **Step 3: 添加测试文件**

```typescript
// src/help/lib/__tests__/manifest.test.ts
import { describe, it, expect } from 'vitest'
import { loadManifest, getDocument } from '../manifest'

describe('manifest', () => {
  it('should load manifest', async () => {
    const manifest = await loadManifest()
    expect(manifest.documents).toBeDefined()
    expect(manifest.documents.length).toBeGreaterThan(0)
  })

  it('should get document by slug', async () => {
    const doc = await getDocument('index')
    expect(doc).toBeDefined()
    expect(doc?.title).toBe('欢迎使用 Keya')
  })

  it('should return null for non-existent document', async () => {
    const doc = await getDocument('non-existent')
    expect(doc).toBeNull()
  })
})
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test
```

预期：所有测试通过

- [ ] **Step 5: Commit**

```bash
git add src/help/lib/manifest.ts src/help/lib/__tests__/manifest.test.ts src/help/content/*.md
git commit -m "feat: implement manifest loader with tests"
```

---

## Task 5: 实现 markdown.ts

- [ ] **Step 1: 创建 markdown.ts**

```typescript
// src/help/lib/markdown.ts
import { marked } from 'marked'
import { ReactNode } from 'react'

// 配置 marked
marked.setOptions({
  gfm: true, // GitHub 风格 Markdown
  breaks: true // 转换换行符
})

// 内部链接正则：匹配 /help/slug 格式的链接
const internalLinkRegex = /href="\/help\/([^"]+)"/g

export function parseMarkdown(content: string): string {
  return marked(content) as string
}

/**
 * 将内部链接转换为 React Router 需要的格式
 * 用于在 MarkdownContent 中处理
 */
export function convertInternalLinks(html: string): {
  html: string
  internalLinks: Set<string>
} {
  const internalLinks = new Set<string>()
  const converted = html.replace(internalLinkRegex, (match, slug) => {
    internalLinks.add(slug)
    return `data-internal-link="/help/${slug}"`
  })

  return {
    html: converted,
    internalLinks
  }
}
```

- [ ] **Step 2: 添加测试**

```typescript
// src/help/lib/__tests__/markdown.test.ts
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
```

- [ ] **Step 3: 运行测试验证通过**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/help/lib/markdown.ts src/help/lib/__tests__/markdown.test.ts
git commit -m "feat: implement markdown parser with tests"
```

---

## Task 6: 实现 search.ts

- [ ] **Step 1: 创建 search.ts**

```typescript
// src/help/lib/search.ts
import { HelpDocument, SearchResult } from '../types'

interface SearchIndex {
  documents: HelpDocument[]
}

/**
 * 简单的关键词搜索
 * 按相关度排序：标题匹配 > 描述匹配 > 内容匹配
 */
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
      // 标题匹配（权重最高）
      if (titleLower.includes(term)) {
        score += 10
        matches.push(doc.title)
      }

      // 描述匹配
      if (descLower.includes(term)) {
        score += 5
        matches.push(doc.description)
      }

      // 内容匹配
      if (contentLower.includes(term)) {
        score += 1
        // 提取包含关键词的句子作为匹配片段
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
        matches: [...new Set(matches)], // 去重
        score
      })
    }
  }

  // 按分数降序排序
  return results.sort((a, b) => b.score - a.score)
}

export function buildSearchIndex(documents: HelpDocument[]): SearchIndex {
  return { documents }
}
```

- [ ] **Step 2: 添加测试**

```typescript
// src/help/lib/__tests__/search.test.ts
import { describe, it, expect } from 'vitest'
import { searchDocuments, buildSearchIndex } from '../search'
import type { HelpDocument } from '../../types'

describe('search', () => {
  const mockDocuments: HelpDocument[] = [
    {
      slug: 'test1',
      title: '快速开始',
      description: '如何快速开始使用',
      content: '这是快速开始的内容',
      order: 1
    },
    {
      slug: 'test2',
      title: '常见问题',
      description: 'FAQ',
      content: '这是常见问题的内容',
      order: 2
    }
  ]

  it('should return empty results for empty query', () => {
    const index = buildSearchIndex(mockDocuments)
    const results = searchDocuments(index, '')
    expect(results).toEqual([])
  })

  it('should search by title', () => {
    const index = buildSearchIndex(mockDocuments)
    const results = searchDocuments(index, '快速')
    expect(results.length).toBe(1)
    expect(results[0].document.slug).toBe('test1')
    expect(results[0].score).toBeGreaterThan(0)
  })

  it('should rank title matches higher', () => {
    const index = buildSearchIndex(mockDocuments)
    const results = searchDocuments(index, '快速 开始')
    const topResult = results[0]
    expect(topResult.document.slug).toBe('test1')
    expect(topResult.score).toBeGreaterThanOrEqual(10) // 标题匹配权重
  })

  it('should search by content', () => {
    const index = buildSearchIndex(mockDocuments)
    const results = searchDocuments(index, '常见问题')
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 3: 运行测试验证通过**

```bash
npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/help/lib/search.ts src/help/lib/__tests__/search.test.ts
git commit -m "feat: implement search functionality with tests"
```

---

## Task 7: 实现 MarkdownContent 组件

- [ ] **Step 1: 创建 MarkdownContent.tsx**

```typescript
// src/help/components/MarkdownContent.tsx
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseMarkdown, convertInternalLinks } from '../lib/markdown'

export function MarkdownContent({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!containerRef.current) return

    const html = parseMarkdown(content)
    const { html: convertedHtml, internalLinks } = convertInternalLinks(html)

    containerRef.current.innerHTML = convertedHtml

    // 处理内部链接点击
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('[data-internal-link]')

      if (link) {
        e.preventDefault()
        const href = link.getAttribute('data-internal-link')
        if (href) {
          navigate(href)
        }
      }
    }

    containerRef.current.addEventListener('click', handleLinkClick)

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleLinkClick)
      }
    }
  }, [content, navigate])

  return (
    <div
      ref={containerRef}
      className="prose prose-sm max-w-none dark:prose-invert"
      style={{
        // Tailwind prose 样式
        lineHeight: '1.7'
      }}
    />
  )
}
```

- [ ] **Step 2: 在 index.ts 中导出**

```typescript
// src/help/components/index.ts
export { MarkdownContent } from './MarkdownContent'
```

- [ ] **Step 3: Commit**

```bash
git add src/help/components/MarkdownContent.tsx src/help/components/index.ts
git commit -m "feat: add MarkdownContent component"
```

---

## Task 8: 实现 HelpSidebar 组件

- [ ] **Step 1: 创建 HelpSidebar.tsx**

```typescript
// src/help/components/HelpSidebar.tsx
import { useLocation, Link } from 'react-router-dom'
import { HelpDocument } from '../types'
import { cn } from '@/lib/utils'

interface HelpSidebarProps {
  documents: HelpDocument[]
}

export function HelpSidebar({ documents }: HelpSidebarProps) {
  const location = useLocation()

  const isActive = (slug: string) => {
    return location.pathname === `/help/${slug}` ||
           (slug === 'index' && location.pathname === '/help')
  }

  return (
    <aside className="w-56 shrink-0 border-r border-line-subtle overflow-y-auto">
      <nav className="p-4 space-y-1">
        {documents.map((doc) => (
          <Link
            key={doc.slug}
            to={doc.slug === 'index' ? '/help' : `/help/${doc.slug}`}
            className={cn(
              'block px-3 py-2 rounded-md text-sm transition-colors',
              isActive(doc.slug)
                ? 'bg-accent-default/20 text-accent-bright font-medium'
                : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
            )}
          >
            {doc.title}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: 更新 index.ts**

```typescript
// src/help/components/index.ts
export { MarkdownContent } from './MarkdownContent'
export { HelpSidebar } from './HelpSidebar'
```

- [ ] **Step 3: Commit**

```bash
git add src/help/components/HelpSidebar.tsx src/help/components/index.ts
git commit -m "feat: add HelpSidebar component"
```

---

## Task 9: 实现 HelpSearch 组件

- [ ] **Step 1: 创建 HelpSearch.tsx**

```typescript
// src/help/components/HelpSearch.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { HelpDocument, SearchResult } from '../types'
import { searchDocuments, buildSearchIndex } from '../lib/search'
import { cn } from '@/lib/utils'

interface HelpSearchProps {
  documents: HelpDocument[]
  onClose?: () => void
}

export function HelpSearch({ documents, onClose }: HelpSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const searchIndex = buildSearchIndex(documents)

  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchDocuments(searchIndex, query)
      setResults(searchResults)
      setIsOpen(true)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query, searchIndex])

  const handleSelectResult = (slug: string) => {
    setQuery('')
    setIsOpen(false)
    onClose?.()
    navigate(slug === 'index' ? '/help' : `/help/${slug}`)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-quaternary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索帮助文档..."
          className={cn(
            'w-full pl-10 pr-4 py-2 rounded-md border border-line-subtle',
            'bg-surface-2 text-ink-primary text-sm',
            'placeholder:text-ink-quaternary',
            'focus:outline-none focus:ring-1 focus:ring-accent-bright',
            'transition-all duration-150'
          )}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-canvas-base border border-line-subtle rounded-md shadow-lg overflow-hidden z-10">
          <div className="max-h-96 overflow-y-auto">
            {results.map((result) => (
              <button
                key={result.document.slug}
                onClick={() => handleSelectResult(result.document.slug)}
                className="w-full text-left px-4 py-3 hover:bg-surface-3 transition-colors border-b border-line-subtle last:border-b-0"
              >
                <div className="font-medium text-ink-primary text-sm">
                  {result.document.title}
                </div>
                <div className="text-xs text-ink-secondary mt-1">
                  {result.document.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-canvas-base border border-line-subtle rounded-md shadow-lg p-4 text-sm text-ink-secondary">
          没有找到匹配的结果
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 更新 index.ts**

```typescript
// src/help/components/index.ts
export { MarkdownContent } from './MarkdownContent'
export { HelpSidebar } from './HelpSidebar'
export { HelpSearch } from './HelpSearch'
```

- [ ] **Step 3: Commit**

```bash
git add src/help/components/HelpSearch.tsx src/help/components/index.ts
git commit -m "feat: add HelpSearch component"
```

---

## Task 10: 实现 HelpIndex 组件

- [ ] **Step 1: 创建 HelpIndex.tsx**

```typescript
// src/help/components/HelpIndex.tsx
import { HelpDocument } from '../types'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HelpIndexProps {
  documents: HelpDocument[]
}

export function HelpIndex({ documents }: HelpIndexProps) {
  // 排除首页本身
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
```

- [ ] **Step 2: 更新 index.ts**

```typescript
// src/help/components/index.ts
export { MarkdownContent } from './MarkdownContent'
export { HelpSidebar } from './HelpSidebar'
export { HelpSearch } from './HelpSearch'
export { HelpIndex } from './HelpIndex'
```

- [ ] **Step 3: Commit**

```bash
git add src/help/components/HelpIndex.tsx src/help/components/index.ts
git commit -m "feat: add HelpIndex component"
```

---

## Task 11: 实现 HelpPage 组件

- [ ] **Step 1: 创建 HelpPage.tsx**

```typescript
// src/help/components/HelpPage.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { HelpDocument } from '../types'
import { getDocument } from '../lib/manifest'
import { MarkdownContent } from './MarkdownContent'

export function HelpPage() {
  const { slug } = useParams<{ slug: string }>()
  const [document, setDocument] = useState<HelpDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDocument() {
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

    loadDocument()
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
```

- [ ] **Step 2: 更新 index.ts**

```typescript
// src/help/components/index.ts
export { MarkdownContent } from './MarkdownContent'
export { HelpSidebar } from './HelpSidebar'
export { HelpSearch } from './HelpSearch'
export { HelpIndex } from './HelpIndex'
export { HelpPage } from './HelpPage'
```

- [ ] **Step 3: Commit**

```bash
git add src/help/components/HelpPage.tsx src/help/components/index.ts
git commit -m "feat: add HelpPage component"
```

---

## Task 12: 实现 HelpLayout 组件

- [ ] **Step 1: 创建 HelpLayout.tsx**

```typescript
// src/help/components/HelpLayout.tsx
import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { HelpSidebar, HelpSearch } from './index'
import { HelpDocument } from '../types'
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
      {/* Left Sidebar */}
      <div className="flex flex-col w-56 shrink-0">
        {/* Search */}
        <div className="p-4 border-b border-line-subtle">
          <HelpSearch documents={documents} />
        </div>

        {/* Navigation */}
        <HelpSidebar documents={documents} />
      </div>

      {/* Main Content */}
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
```

- [ ] **Step 2: 更新 index.ts**

```typescript
// src/help/components/index.ts
export { MarkdownContent } from './MarkdownContent'
export { HelpSidebar } from './HelpSidebar'
export { HelpSearch } from './HelpSearch'
export { HelpIndex } from './HelpIndex'
export { HelpPage } from './HelpPage'
export { HelpLayout } from './HelpLayout'
```

- [ ] **Step 3: Commit**

```bash
git add src/help/components/HelpLayout.tsx src/help/components/index.ts
git commit -m "feat: add HelpLayout component"
```

---

## Task 13: 实现 HelpRoutes 路由配置

- [ ] **Step 1: 创建 HelpRoutes.tsx**

```typescript
// src/help/HelpRoutes.tsx
import { Routes, Route } from 'react-router-dom'
import { HelpLayout, HelpIndex, HelpPage } from './components'

export function HelpRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HelpLayout />}>
        <Route index element={<HelpIndex />} />
        <Route path=":slug" element={<HelpPage />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/help/HelpRoutes.tsx
git commit -m "feat: add HelpRoutes configuration"
```

---

## Task 14: 集成到主应用路由

- [ ] **Step 1: 修改 App.tsx**

在 `src/app/App.tsx` 中添加帮助路由：

```typescript
// 在现有的 import 下方添加
import { HelpRoutes } from "../help/HelpRoutes"

// 在 AppRoutes 函数的 Routes 组件中添加帮助路由
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeGuard />} />
      <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
        <Route path="/keys" element={<KeysPage />} />
      </Route>
      <Route element={<AuthGuard><SettingsLayout /></AuthGuard>}>
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      {/* 添加帮助路由 - 无需认证 */}
      <Route path="/help/*" element={<HelpRoutes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 2: 测试路由**

启动开发服务器测试：

```bash
npm run dev
```

访问 http://localhost:5173/help 验证帮助中心可访问

- [ ] **Step 3: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat: integrate help routes into main app"
```

---

## Task 15: 添加 Sidebar 入口

- [ ] **Step 1: 修改 Sidebar.tsx**

在 `src/app/components/layout/Sidebar.tsx` 的 Footer 部分添加帮助链接：

```typescript
// 在 Footer div 中，现有的 Keya 链接上方添加
<div className="px-3 py-2 border-t border-line-subtle space-y-2">
  <a
    href="/help"
    className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors flex items-center justify-center gap-1"
  >
    帮助中心
  </a>
  <a
    href="https://github.com/puinoib/keya"
    target="_blank"
    rel="noopener noreferrer"
    className="text-xs text-ink-quaternary hover:text-ink-tertiary transition-colors flex items-center justify-center gap-1"
  >
    Keya v1.0
  </a>
</div>
```

- [ ] **Step 2: 测试链接**

启动应用，点击侧边栏底部的"帮助中心"链接，验证跳转正确

- [ ] **Step 3: Commit**

```bash
git add src/app/components/layout/Sidebar.tsx
git commit -m "feat: add help center link to sidebar"
```

---

## Task 16: 添加 Settings 页面入口

- [ ] **Step 1: 修改 SettingsPage.tsx**

在 `src/app/components/settings/SettingsPage.tsx` 中添加帮助部分：

```typescript
// 在设置项列表的最后添加
<section className="space-y-3">
  <h2 className="text-lg font-semibold text-ink-primary">帮助与支持</h2>
  <div className="space-y-2">
    <button
      onClick={() => navigate('/help')}
      className="w-full flex items-center justify-between p-3 rounded-lg border border-line-subtle bg-surface-2 hover:bg-surface-4 transition-colors"
    >
      <div>
        <div className="font-medium text-ink-primary">查看帮助文档</div>
        <div className="text-sm text-ink-secondary">
          快速开始、常见问题、安全说明
        </div>
      </div>
      <ArrowRight className="size-5 text-ink-quaternary" />
    </button>
  </div>
</section>
```

同时确保 import ArrowRight：

```typescript
import { ArrowRight } from "lucide-react"
```

- [ ] **Step 2: 测试入口**

导航到设置页面，点击"查看帮助文档"按钮，验证跳转正确

- [ ] **Step 3: Commit**

```bash
git add src/app/components/settings/SettingsPage.tsx
git commit -m "feat: add help center entry in settings page"
```

---

## Task 17: 完善 Markdown 样式

- [ ] **Step 1: 添加 Tailwind Typography 插件（可选）**

如果需要更好的 Markdown 渲染效果，安装 Tailwind Typography：

```bash
npm install -D @tailwindcss/typography
```

- [ ] **Step 2: 更新 Tailwind 配置**

在 `tailwind.config.js` 或 `vite.config.ts` 的 Tailwind 配置中添加插件：

```javascript
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    // ... 现有配置
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

- [ ] **Step 3: 更新 MarkdownContent 使用 prose 类**

已在 Task 7 中添加 `prose` 类，无需修改

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts 或 tailwind.config.js
git commit -m "style: add tailwind typography for markdown rendering"
```

---

## Task 18: 验证完整功能

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试所有功能**

1. 访问 `/help` - 查看首页
2. 点击侧边栏的各个文档链接 - 验证导航
3. 使用搜索功能 - 输入"快速"或"备份"
4. 点击搜索结果 - 验证跳转
5. 测试内部链接 - 在文档中点击链接跳转到其他文档
6. 从 Sidebar 底部点击"帮助中心"
7. 从 Settings 页面点击"查看帮助文档"
8. 访问不存在的文档 `/help/non-existent` - 验证 404 页面
9. 测试主题切换 - 验证明暗模式适配

- [ ] **Step 3: 运行所有测试**

```bash
npm test
```

- [ ] **Step 4: 运行类型检查**

```bash
npm run typecheck
```

- [ ] **Step 5: 运行 Lint**

```bash
npm run lint
```

---

## Task 19: 构建验证

- [ ] **Step 1: 构建生产版本**

```bash
npm run build
```

- [ ] **Step 2: 预览生产构建**

```bash
npm run preview
```

- [ ] **Step 3: 在预览中测试关键功能**

1. 访问帮助中心
2. 测试导航
3. 测试搜索
4. 验证样式正常

---

## 完成检查清单

在提交 PR 之前，确认以下所有项已完成：

- [ ] 所有单元测试通过
- [ ] 类型检查通过（无 TypeScript 错误）
- [ ] ESLint 检查通过
- [ ] 生产构建成功
- [ ] 功能测试完成（导航、搜索、404、主题切换）
- [ ] 代码已提交，commit 信息清晰
- [ ] 文档内容完整（至少包含：首页、快速开始、FAQ、备份、安全说明）

---

**计划完成！** 所有任务已定义，可以开始实施。
