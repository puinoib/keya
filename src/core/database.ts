import type { KeyaDatabase, ApiKey, Group, InboxItem } from './types';
import { DEFAULT_GROUPS, DEFAULT_SETTINGS } from './types';

export function createEmptyDatabase(
  name?: string,
  icon?: string
): KeyaDatabase {
  const now = new Date().toISOString();
  return {
    vault_id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    name: name ?? '',
    icon: icon ?? '',
    api_keys: [],
    groups: DEFAULT_GROUPS.map((g, i) => ({
      ...g,
      id: crypto.randomUUID(),
      order: i + 1,
    })),
    settings: { ...DEFAULT_SETTINGS },
    inbox: [],
  };
}

export class Database {
  private data: KeyaDatabase;

  constructor(
    data?: KeyaDatabase,
    meta?: { name?: string; icon?: string; color?: string }
  ) {
    this.data = data ?? createEmptyDatabase(meta?.name, meta?.icon);
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

  hasDuplicateApiKeyValue(keyValue: string, excludeId?: string): boolean {
    return this.data.api_keys.some(
      (key) => key.key === keyValue && key.id !== excludeId
    );
  }

  addApiKey(key: Omit<ApiKey, 'id' | 'created_at' | 'updated_at'>): ApiKey {
    if (this.hasDuplicateApiKeyValue(key.key)) {
      throw new Error('DUPLICATE_API_KEY');
    }
    const now = new Date().toISOString();
    const newKey: ApiKey = {
      ...key,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };
    this.data.api_keys.push(newKey);
    this.touch();
    return newKey;
  }

  updateApiKey(id: string, updates: Partial<ApiKey>): ApiKey | null {
    const idx = this.data.api_keys.findIndex((k) => k.id === id);
    if (idx === -1) return null;
    const nextKeyValue = updates.key ?? this.data.api_keys[idx].key;
    if (this.hasDuplicateApiKeyValue(nextKeyValue, id)) {
      throw new Error('DUPLICATE_API_KEY');
    }
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
        k.provider.toLowerCase().includes(q)
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

  /* ──── Inbox ──── */

  getInboxItems(): InboxItem[] {
    return [...this.data.inbox];
  }

  getOpenInboxItems(): InboxItem[] {
    return this.data.inbox.filter((item) => item.status === 'open');
  }

  archiveInboxItem(id: string, reason: InboxItem['archive_reason'] = 'user') {
    const item = this.data.inbox.find((entry) => entry.id === id);
    if (!item) return null;
    item.status = 'archived';
    item.archive_reason = reason;
    item.archived_at = new Date().toISOString();
    item.updated_at = item.archived_at;
    this.touch();
    return item;
  }

  /* ──── Vault Meta ──── */

  updateMeta(updates: Partial<Pick<KeyaDatabase, 'name' | 'icon'>>) {
    Object.assign(this.data, updates);
    this.touch();
  }

  /* ──── Helpers ──── */

  private touch(): void {
    this.data.updated_at = new Date().toISOString();
  }
}
