# 帮助中心设计文档

## 概述

为 Keya 项目添加帮助文档功能，采用相对隔离的代码组织方式，与主应用一起部署但保持清晰的边界。

## 需求

- 主要内容：FAQ 和使用说明（快速开始、备份恢复、常见问题等）
- 使用 Markdown 组织内容
- 提供搜索功能
- 左侧导航 + 右侧内容的布局
- 代码相对隔离，但复用现有 UI 组件

## 技术方案

采用 **React Router 嵌套路由** 方案：
- URL 结构清晰，支持直接分享链接
- 与现有路由体系一致
- 支持浏览器前进后退
- 实现简单，维护成本低

## 目录结构

```
src/help/
├── components/
│   ├── HelpLayout.tsx          # 布局容器（左侧导航 + 右侧内容）
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
│   ├── markdown.ts             # Markdown 解析和内部链接处理
│   └── manifest.ts             # 文档清单（目录和搜索索引）
├── HelpRoutes.tsx              # 路由配置
└── types.ts                    # 类型定义
```

## 路由设计

```typescript
// 在 src/app/App.tsx 中添加
<Route path="/help/*" element={<HelpRoutes />} />

// HelpRoutes.tsx 内部
<Routes>
  <Route path="/" element={<HelpLayout />}>
    <Route index element={<HelpIndex />} />
    <Route path=":slug" element={<HelpPage />} />
  </Route>
</Routes>
```

**URL 结构：**
- `/help` - 帮助中心首页
- `/help/quick-start` - 快速开始
- `/help/backup` - 备份恢复
- `/help/faq` - 常见问题

## 组件架构

### HelpLayout

顶层容器，负责布局和导航。

```
├── HelpSearch (搜索框)
├── HelpSidebar (左侧导航)
└── Content Area (右侧内容区)
    └── <Outlet /> (React Router Outlet)
```

### HelpSidebar

左侧导航组件，显示文档目录。
- 从 `manifest.ts` 读取文档结构
- 高亮当前页面
- 支持折叠/展开分组（可选）

### HelpSearch

搜索组件，提供搜索功能。
- 输入框 + 实时搜索
- 从 `search.ts` 获取结果
- 点击结果导航到对应文档

### MarkdownContent

Markdown 渲染器。
- 使用 `marked` 或 `react-markdown` 解析
- 自定义 renderer 处理内部链接
- 支持代码高亮（可选）

## 数据流

```
User Search Input
    ↓
search.ts (在 manifest 和内容中搜索)
    ↓
HelpSearch (显示结果)
    ↓
Click Result → React Router Navigate → HelpPage
```

**内容加载：**
1. `manifest.ts` 扫描 `content/` 目录
2. 生成文档清单（标题、描述、slug）
3. 运行时动态导入对应的 `.md` 文件

## Markdown 处理

**文件加载：**
```typescript
const contentFiles = import.meta.glob('../content/*.md', { as: 'raw' })
```

**Frontmatter 支持：**
```markdown
---
title: 快速开始
description: 了解如何快速上手 Keya
order: 10
---

# 快速开始

...
```

从 Frontmatter 提取元数据用于目录和搜索。

**内部链接处理：**
- 将 `[快速开始](/help/quick-start)` 转换为 React Router Link
- 外部链接保持原样

## 搜索实现

**搜索范围：**
- 文档标题（Frontmatter `title`）
- 文档描述（Frontmatter `description`）
- 文档内容（Markdown body）

**搜索算法：**
1. 分词（按空格分词）
2. 在所有文档中查找匹配项
3. 按相关度排序（标题匹配 > 描述匹配 > 内容匹配）
4. 返回结果列表

**后续可扩展：**
- 模糊搜索
- 高亮匹配文本
- 搜索历史

## 入口集成

**A. Sidebar 底部链接：**
在 `Sidebar.tsx` 的 Footer 区域添加帮助中心链接。

**B. Settings 页面入口：**
在 `SettingsPage.tsx` 中添加"帮助与支持"部分。

## 样式和主题

- 复用现有主题系统（`useStore` 获取当前主题）
- 自动适配明暗模式
- 使用现有的 Tailwind color tokens
- 复用 `@/components/ui/*` 组件

## 错误处理

**错误场景：**
- 文档不存在 → 404 页面
- Markdown 解析失败 → 显示错误提示
- 搜索无结果 → 显示"无匹配结果"

## 测试策略

**单元测试：**
- `search.ts` - 搜索逻辑测试
- `markdown.ts` - Markdown 解析测试

**组件测试：**
- `HelpSearch` - 搜索交互测试
- `MarkdownContent` - 渲染测试

**E2E 测试（可选）：**
- 导航到帮助页面
- 搜索功能
- 文档链接跳转

## 依赖

需要添加的依赖：
- `marked` 或 `react-markdown` - Markdown 解析
- `gray-matter` - Frontmatter 解析（可选）

## 实施顺序

1. 创建目录结构和基础文件
2. 实现 `manifest.ts` 和 `markdown.ts`
3. 实现基础组件（HelpLayout, HelpSidebar, MarkdownContent）
4. 实现路由集成
5. 添加搜索功能
6. 添加入口点
7. 编写测试
8. 添加初始文档内容
