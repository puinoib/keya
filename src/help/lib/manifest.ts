import type { HelpDocument, HelpManifest } from '../types';

const contentModules = import.meta.glob<string>('../content/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

// lightweight frontmatter parser (no Node.js deps)
function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return { data: {}, content: raw };
  }

  const end = trimmed.indexOf('---', 3);
  if (end === -1) {
    return { data: {}, content: raw };
  }

  const frontmatter = trimmed.slice(3, end).trim();
  const content = trimmed.slice(end + 3).trimStart();

  const data: Record<string, unknown> = {};
  for (const line of frontmatter.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    data[key] = Number.isNaN(Number(value)) ? value : Number(value);
  }

  return { data, content };
}

function loadDocument(slug: string, raw: string): HelpDocument | null {
  try {
    const { data, content } = parseFrontmatter(raw);
    return {
      slug,
      title: (data.title as string) || slug,
      description: (data.description as string) || '',
      content,
      updated: (data.updated as string) || undefined,
      order: (data.order as number) || 999,
    };
  } catch {
    return null;
  }
}

export function loadManifest(): HelpManifest {
  const documents = Object.entries(contentModules)
    .map(([path, raw]) => {
      const match = path.match(/([^/]+)\.md/);
      const slug = match ? match[1] : null;
      if (!slug || typeof raw !== 'string') return null;
      return loadDocument(slug, raw);
    })
    .filter((doc): doc is HelpDocument => doc !== null)
    .sort((a, b) => (a.order || 999) - (b.order || 999));

  return {
    documents,
    categories: { all: documents },
  };
}

export function getDocument(slug: string): HelpDocument | null {
  const entry = Object.entries(contentModules).find(
    ([key]) => key === `../content/${slug}.md`
  );
  if (!entry || typeof entry[1] !== 'string') return null;
  return loadDocument(slug, entry[1]);
}
