import type { KeyaDatabase, ApiKey, Group } from './types';
import { DEFAULT_GROUPS, DEFAULT_SETTINGS } from './types';

export function createEmptyDatabase(): KeyaDatabase {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    file_id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    api_keys: [],
    groups: DEFAULT_GROUPS.map((g, i) => ({
      ...g,
      id: crypto.randomUUID(),
      order: i + 1,
    })),
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

  /* ──── Groups ──── */

  getGroups(): Group[] {
    return [...this.data.groups].sort((a, b) => a.order - b.order);
  }

  addGroup(group: Omit<Group, 'id'>): Group {
    const newGroup: Group = { ...group, id: crypto.randomUUID() };
    this.data.groups.push(newGroup);
    this.touch();
    return newGroup;
  }

  updateGroup(id: string, updates: Partial<Group>): Group | null {
    const idx = this.data.groups.findIndex((g) => g.id === id);
    if (idx === -1) return null;
    this.data.groups[idx] = { ...this.data.groups[idx], ...updates, id };
    this.touch();
    return this.data.groups[idx];
  }

  deleteGroup(id: string): boolean {
    const idx = this.data.groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    this.data.groups.splice(idx, 1);
    // Unassign keys in this group
    this.data.api_keys.forEach((k) => {
      if (k.group_id === id) k.group_id = null;
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
