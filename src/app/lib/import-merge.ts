/**
 * Merge an imported vault payload into the current database.
 *
 * Imported keys keep their grouping by matching existing groups on name and
 * creating missing ones. Duplicate key values are skipped instead of aborting
 * the whole import. All input is normalized before anything is mutated.
 */
import type { ConnectionCheck, Group, NewApiKey } from '../../core/types';
import type { Database } from '../../core/database';

export interface ImportSource {
  api_keys?: unknown;
  groups?: unknown;
}

export interface ImportMergeResult {
  addedKeys: number;
  skippedDuplicateKeys: number;
  invalidKeys: number;
  createdGroups: number;
}

interface NormalizedImportKey {
  name: string;
  key: string;
  provider: string;
  endpoint: string;
  description: string;
  groupId: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  connectionCheck: ConnectionCheck;
}

interface NormalizedImportGroup {
  sourceId: string;
  name: string;
  icon: string;
}

type GroupTarget =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; tempId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeConnectionCheck(value: unknown): ConnectionCheck {
  const fallback: ConnectionCheck = {
    status: 'untested',
    checked_at: null,
    latency_ms: null,
    error_message: null,
  };
  if (!isRecord(value)) return fallback;

  const status =
    value.status === 'success' ||
    value.status === 'failed' ||
    value.status === 'untested'
      ? value.status
      : 'untested';

  return {
    status,
    checked_at: typeof value.checked_at === 'string' ? value.checked_at : null,
    latency_ms: typeof value.latency_ms === 'number' ? value.latency_ms : null,
    error_message:
      typeof value.error_message === 'string' ? value.error_message : null,
  };
}

function normalizeKeys(rawKeys: unknown): {
  keys: NormalizedImportKey[];
  invalidKeys: number;
} {
  if (!Array.isArray(rawKeys)) return { keys: [], invalidKeys: 0 };

  let invalidKeys = 0;
  const keys: NormalizedImportKey[] = [];

  for (const raw of rawKeys) {
    if (!isRecord(raw) || typeof raw.key !== 'string' || !raw.key.trim()) {
      invalidKeys += 1;
      continue;
    }

    keys.push({
      name: asString(raw.name).trim() || 'Imported Key',
      key: raw.key,
      provider: asString(raw.provider).trim() || 'Custom',
      endpoint: asString(raw.endpoint),
      description: asString(raw.description),
      groupId: typeof raw.group_id === 'string' ? raw.group_id : null,
      expiresAt: typeof raw.expires_at === 'string' ? raw.expires_at : null,
      archivedAt:
        typeof raw.archived_at === 'string' && raw.archived_at
          ? raw.archived_at
          : null,
      connectionCheck: normalizeConnectionCheck(raw.connection_check),
    });
  }

  return { keys, invalidKeys };
}

function normalizeGroups(rawGroups: unknown): NormalizedImportGroup[] {
  if (!Array.isArray(rawGroups)) return [];

  const groups: NormalizedImportGroup[] = [];
  const seenIds = new Set<string>();

  for (const raw of rawGroups) {
    if (!isRecord(raw)) continue;
    const sourceId = asString(raw.id);
    const name = asString(raw.name).trim();
    if (!sourceId || !name || seenIds.has(sourceId)) continue;

    seenIds.add(sourceId);
    groups.push({
      sourceId,
      name,
      icon: asString(raw.icon) || '📦',
    });
  }

  return groups;
}

export function mergeImportedData(
  current: Database,
  imported: ImportSource
): ImportMergeResult {
  const currentData = current.getData();
  const { keys, invalidKeys } = normalizeKeys(imported.api_keys);
  const importedGroups = normalizeGroups(imported.groups);

  const existingByName = new Map<string, Group>();
  for (const group of currentData.groups) {
    if (!existingByName.has(group.name)) existingByName.set(group.name, group);
  }

  const groupPlan = new Map<string, GroupTarget>();
  const plannedByName = new Map<string, GroupTarget>();
  const groupsToCreate: NormalizedImportGroup[] = [];

  for (const group of importedGroups) {
    const existing = existingByName.get(group.name);
    if (existing) {
      groupPlan.set(group.sourceId, { kind: 'existing', id: existing.id });
      continue;
    }

    const planned = plannedByName.get(group.name);
    if (planned) {
      groupPlan.set(group.sourceId, planned);
      continue;
    }

    const target: GroupTarget = { kind: 'new', tempId: group.sourceId };
    plannedByName.set(group.name, target);
    groupPlan.set(group.sourceId, target);
    groupsToCreate.push(group);
  }

  const existingKeyValues = new Set(
    currentData.api_keys.filter((key) => !key.archived_at).map((key) => key.key)
  );
  const keysToAdd: NormalizedImportKey[] = [];
  let skippedDuplicateKeys = 0;

  for (const key of keys) {
    if (existingKeyValues.has(key.key)) {
      skippedDuplicateKeys += 1;
      continue;
    }
    existingKeyValues.add(key.key);
    keysToAdd.push(key);
  }

  // All validation is complete; start mutating the current database.
  const nextOrder =
    Math.max(0, ...currentData.groups.map((group) => group.order)) + 1;
  const createdGroupIds = new Map<string, string>();

  for (const [index, group] of groupsToCreate.entries()) {
    const created = current.addGroup({
      name: group.name,
      icon: group.icon,
      order: nextOrder + index,
    });
    createdGroupIds.set(group.sourceId, created.id);
  }

  for (const key of keysToAdd) {
    const target = key.groupId ? groupPlan.get(key.groupId) : undefined;
    const groupId =
      target?.kind === 'existing'
        ? target.id
        : target?.kind === 'new'
          ? (createdGroupIds.get(target.tempId) ?? null)
          : null;

    const apiKey: NewApiKey = {
      name: key.name,
      key: key.key,
      provider: key.provider,
      endpoint: key.endpoint,
      description: key.description,
      group_id: groupId,
      expires_at: key.expiresAt,
      archived_at: key.archivedAt,
      connection_check: key.connectionCheck,
    };
    current.addApiKey(apiKey);
  }

  return {
    addedKeys: keysToAdd.length,
    skippedDuplicateKeys,
    invalidKeys,
    createdGroups: groupsToCreate.length,
  };
}
