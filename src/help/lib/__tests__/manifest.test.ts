import { describe, it, expect } from 'vitest';
import { loadManifest, getDocument } from '../manifest';

describe('manifest', () => {
  it('loads every guide in frontmatter order', async () => {
    const manifest = await loadManifest();
    expect(manifest.documents.map((doc) => doc.slug)).toEqual([
      'index',
      'quick-start',
      'inbox',
      'security',
      'backup',
      'faq',
    ]);
    for (const doc of manifest.documents) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.content.length).toBeGreaterThan(0);
    }
  });

  it('should get document by slug', async () => {
    const doc = await getDocument('index');
    expect(doc).toBeDefined();
    expect(doc?.title).toBe('Welcome to Keya');
  });

  it('should return null for non-existent document', async () => {
    const doc = await getDocument('non-existent');
    expect(doc).toBeNull();
  });
});
