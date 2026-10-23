import { describe, it, expect } from 'vitest';
import {
  HELP_CATEGORY_ORDER,
  groupDocuments,
  loadManifest,
  getDocument,
} from '../manifest';
import type { HelpDocument } from '../../types';

const EXPECTED_SLUGS = [
  'index',
  'quick-start',
  'keys',
  'checks',
  'providers',
  'inbox',
  'vaults',
  'settings',
  'security',
  'backup',
  'faq',
];

describe('manifest', () => {
  it('loads every guide in frontmatter order', async () => {
    const manifest = await loadManifest();
    expect(manifest.documents.map((doc) => doc.slug)).toEqual(EXPECTED_SLUGS);
    for (const doc of manifest.documents) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.content.length).toBeGreaterThan(0);
    }
  });

  it('groups guides in sidebar order', async () => {
    const { categories } = await loadManifest();
    expect(Object.keys(categories)).toEqual(['all', ...HELP_CATEGORY_ORDER]);
    expect(categories['Getting started'].map((doc) => doc.slug)).toEqual([
      'index',
      'quick-start',
      'vaults',
    ]);
    expect(categories['Daily use'].map((doc) => doc.slug)).toEqual([
      'keys',
      'checks',
      'providers',
      'inbox',
    ]);
    expect(categories['Security & data'].map((doc) => doc.slug)).toEqual([
      'security',
      'backup',
    ]);
    expect(categories['Settings & help'].map((doc) => doc.slug)).toEqual([
      'settings',
      'faq',
    ]);
  });

  it('puts uncategorised guides in Other without losing them', () => {
    const documents: HelpDocument[] = [
      {
        slug: 'known',
        title: 'Known',
        description: '',
        content: 'x',
        category: 'Daily use',
      },
      { slug: 'new', title: 'New', description: '', content: 'x' },
    ];
    const categories = groupDocuments(documents);
    expect(categories['Daily use'].map((doc) => doc.slug)).toEqual(['known']);
    expect(categories.Other.map((doc) => doc.slug)).toEqual(['new']);
  });

  it('every /docs link points at a guide that exists', async () => {
    const manifest = await loadManifest();
    const slugs = new Set(manifest.documents.map((doc) => doc.slug));

    for (const doc of manifest.documents) {
      const links = doc.content.matchAll(/\]\((\/docs\/[^)\s#?]+)/g);
      for (const [, href] of links) {
        const slug = href.replace('/docs/', '');
        expect(
          slugs.has(slug),
          `${doc.slug} links to missing /docs/${slug}`
        ).toBe(true);
      }
    }
  });

  it('does not reintroduce removed behaviour or copy', async () => {
    const manifest = await loadManifest();
    for (const doc of manifest.documents) {
      expect(doc.content).not.toContain('save: dirty');
      expect(doc.content).not.toContain('Always allow this destination');
      expect(doc.content).not.toContain('approved destinations');
    }
  });

  it('should get document by slug', async () => {
    const doc = await getDocument('index');
    expect(doc).toBeDefined();
    expect(doc?.title).toBe('Welcome to Keya');
    expect(doc?.category).toBe('Getting started');
  });

  it('should return null for non-existent document', async () => {
    const doc = await getDocument('non-existent');
    expect(doc).toBeNull();
  });
});
