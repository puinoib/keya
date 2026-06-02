import type { KeyaDatabase, ApiKey, Category, Tag } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './types';

export function createEmptyDatabase(): KeyaDatabase {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    file_id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    api_keys: [],
    categories: DEFAULT_CATEGORIES.map((c, i) => ({
      ...c,
      id: crypto.randomUUID(),
      order: i + 1,
    })),
    tags: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export class Database {
  private data: KeyaDatabase;

  constructor(data?: KeyaDatabase) {
    this.data = data ?? createEmptyDatabase();
  }

  getData(): KeyaDatabase {
    return this.data;
  }

  /* ──── API Keys ──── */

  getApiKeys(): ApiKey[] {
    return this.data.api_keys;
  }

  getApiKey(id: string): ApiKey | undefined {
    return this.data.api_keys.find((k) => k.id === id);
  }

  addApiKey(key: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>): ApiKey {
    const now = new Date().toISOString();
    const newKey: ApiKey = { ...key, id: crypto.randomUUID(), created_at: now, updated_at: now };
    this.data.api_keys.push(newKey);
    this.touch();
    return newKey;
  }

  updateApiKey(id: string, updates: Partial<ApiKey>): ApiKey | null {
    const idx = this.data.api_keys.findIndex((k) => k.id === id);
    if (idx === -1) return null;
    this.data.api_keys[idx] = {
      ...this.data.api_keys[idx],
      ...updates,
      id,
      updated_at: new Date().toISOString(),
    };
    this.touch();
    return this.data.api_keys[idx];
  }

  deleteApiKey(id: string): boolean {
    const idx = this.data.api_keys.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.data.api_keys.splice(idx, 1);
    this.touch();
    return true;
  }

  searchKeys(query: string): ApiKey[] {
    const q = query.toLowerCase();
    return this.data.api_keys.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.description.toLowerCase().includes(q) ||
        k.provider.toLowerCase().includes(q) ||
        k.service.toLowerCase().includes(q),
    );
  }

  /* ──── Categories ──── */

  getCategories(): Category[] {
    return [...this.data.categories].sort((a, b) => a.order - b.order);
  }

  addCategory(cat: Omit<Category, 'id'>): Category {
    const newCat: Category = { ...cat, id: crypto.randomUUID() };
    this.data.categories.push(newCat);
    this.touch();
    return newCat;
  }

  updateCategory(id: string, updates: Partial<Category>): Category | null {
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.data.categories[idx] = { ...this.data.categories[idx], ...updates, id };
    this.touch();
    return this.data.categories[idx];
  }

  deleteCategory(id: string): boolean {
    const idx = this.data.categories.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.data.categories.splice(idx, 1);
    // Unassign keys in this category
    this.data.api_keys.forEach((k) => {
      if (k.category_id === id) k.category_id = null;
    });
    this.touch();
    return true;
  }

  /* ──── Tags ──── */

  getTags(): Tag[] {
    return this.data.tags;
  }

  addTag(tag: Omit<Tag, 'id'>): Tag {
    const newTag: Tag = { ...tag, id: crypto.randomUUID() };
    this.data.tags.push(newTag);
    this.touch();
    return newTag;
  }

  updateTag(id: string, updates: Partial<Tag>): Tag | null {
    const idx = this.data.tags.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.data.tags[idx] = { ...this.data.tags[idx], ...updates, id };
    this.touch();
    return this.data.tags[idx];
  }

  deleteTag(id: string): boolean {
    const idx = this.data.tags.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.data.tags.splice(idx, 1);
    // Remove tag from all keys
    this.data.api_keys.forEach((k) => {
      k.tag_ids = k.tag_ids.filter((tid) => tid !== id);
    });
    this.touch();
    return true;
  }

  /* ──── Settings ──── */

  getSettings() {
    return this.data.settings;
  }

  updateSettings(updates: Partial<typeof this.data.settings>) {
    this.data.settings = { ...this.data.settings, ...updates };
    this.touch();
  }

  /* ──── Helpers ──── */

  private touch(): void {
    this.data.updated_at = new Date().toISOString();
  }
}
