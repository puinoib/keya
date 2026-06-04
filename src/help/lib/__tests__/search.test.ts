import { describe, it, expect } from 'vitest';
import { searchDocuments, buildSearchIndex } from '../search';
import type { HelpDocument } from '../../types';

describe('search', () => {
  const mockDocuments: HelpDocument[] = [
    {
      slug: 'test1',
      title: '快速开始',
      description: '如何快速开始使用',
      content: '这是快速开始的内容',
      order: 1,
    },
    {
      slug: 'test2',
      title: '常见问题',
      description: 'FAQ',
      content: '这是常见问题的内容',
      order: 2,
    },
  ];

  it('should return empty results for empty query', () => {
    const index = buildSearchIndex(mockDocuments);
    const results = searchDocuments(index, '');
    expect(results).toEqual([]);
  });

  it('should search by title', () => {
    const index = buildSearchIndex(mockDocuments);
    const results = searchDocuments(index, '快速');
    expect(results.length).toBe(1);
    expect(results[0].document.slug).toBe('test1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('should rank title matches higher', () => {
    const index = buildSearchIndex(mockDocuments);
    const results = searchDocuments(index, '快速 开始');
    const topResult = results[0];
    expect(topResult.document.slug).toBe('test1');
    expect(topResult.score).toBeGreaterThanOrEqual(10);
  });

  it('should search by content', () => {
    const index = buildSearchIndex(mockDocuments);
    const results = searchDocuments(index, '常见问题');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
