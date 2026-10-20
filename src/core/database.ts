import type {
  KeyaDatabase,
  ApiKey,
  Group,
  InboxItem,
  NewApiKey,
} from './types';
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

  getActiveApiKeys(): ApiKey[] {
    return this.data.api_keys.filter((key) => !key.archived_at);
  }

  getArchivedApiKeys(): ApiKey[] {
    return this.data.api_keys
      .filter((key) => Boolean(key.archived_at))
      .sort((a, b) => {
        const archivedDelta =
          new Date(b.archived_at ?? 0).getTime() -
          new Date(a.archived_at ?? 0).getTime();
        if (archivedDelta !== 0) return archivedDelta;
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });
  }

  getApiKey(id: string): ApiKey | undefined {
    return this.data.api_keys.find((k) => k.id === id);
  }

  hasDuplicateApiKeyValue(keyValue: string, excludeId?: string): boolean {
    return this.data.api_keys.some(
      (key) => !key.archived_at && key.key === keyValue && key.id !== excludeId
    );
  }

  addApiKey(key: NewApiKey): ApiKey {
    if (this.hasDuplicateApiKeyValue(key.key)) {
      throw new Error('DUPLICATE_API_KEY');
    }
    const now = new Date().toISOString();
    const newKey: ApiKey = {
      ...key,
      id: crypto.randomUUID(),
      archived_at: key.archived_at ?? null,
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
    // Archived keys are read-only; lifecycle changes use archive/restore.
    if (this.data.api_keys[idx].archived_at) return null;
    const nextKeyValue = updates.key ?? this.data.api_keys[idx].key;
    if (this.hasDuplicateApiKeyValue(nextKeyValue, id)) {
      throw new Error('DUPLICATE_API_KEY');
    }
    const sanitized = { ...updates };
    delete sanitized.archived_at;
    delete sanitized.id;
    this.data.api_keys[idx] = {
      ...this.data.api_keys[idx],
      ...sanitized,
      id,
      updated_at: new Date().toISOString(),
    };
    this.touch();
    return this.data.api_keys[idx];
  }

  archiveApiKey(id: string, at: Date = new Date()): ApiKey | null {
    const key = this.data.api_keys.find((k) => k.id === id);
    if (!key) return null;
    if (key.archived_at) return key;
    const nowIso = at.toISOString();
    key.archived_at = nowIso;
    key.updated_at = nowIso;
    this.touch();
    return key;
  }

  restoreApiKey(id: string): ApiKey | null {
    const key = this.data.api_keys.find((k) => k.id === id);
    if (!key) return null;
    if (!key.archived_at) return key;
    key.archived_at = null;
    key.updated_at = new Date().toISOString();
    this.touch();
    return key;
  }

  deleteApiKey(id: string): boolean {
    const idx = this.data.api_keys.findIndex((k) => k.id === id);
    if (idx === -1) return false;
    this.data.api_keys.splice(idx, 1);
    this.touch();
    return true;
  }

  searchKeys(query: string, keys: ApiKey[] = this.data.api_keys): ApiKey[] {
    const q = query.toLowerCase();
    return keys.filter(
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

  /** Remove all inbox items for a key, used when its lifecycle state changes. */
  removeInboxItemsForEntity(entityId: string): number {
    const before = this.data.inbox.length;
    this.data.inbox = this.data.inbox.filter(
      (item) => item.entity_id !== entityId
    );
    const removed = before - this.data.inbox.length;
    if (removed > 0) this.touch();
    return removed;
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
