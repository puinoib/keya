/**
 * Class A validation: is this payload a legal `.keya` file?
 *
 * Only rules that depend on the file itself belong here. Whether the current
 * build understands a preset slug, or whether a browser can reach a provider,
 * are runtime capabilities (§6.1) and deliberately absent.
 *
 * The validator collects every issue instead of throwing on the first one, and
 * every issue carries a field path: the reader must tell the user all of them.
 */

import {
  MAX_AUTH_HEADER_NAME,
  MAX_GROUP_NAME,
  MAX_GROUP_ORDER,
  MAX_GROUPS,
  MAX_HEADER_NAME,
  MAX_HEADER_VALUE,
  MAX_ICON,
  MAX_KEY_DESCRIPTION,
  MAX_KEY_NAME,
  MAX_KEYS,
  MAX_PROVIDER_DESCRIPTION,
  MAX_PROVIDER_NAME,
  MAX_PROVIDERS,
  MAX_QUERY_PARAM,
  MAX_SECRET,
  MAX_STATIC_HEADERS,
  MAX_TARGET,
  MAX_URL,
  MAX_VAULT_NAME,
  MIN_SECRET,
} from './limits';
import {
  AUTH_KEYS,
  EXPIRY_KEYS,
  GROUP_KEYS,
  KEY_KEYS,
  PROBE_KEYS,
  PROVIDER_KEYS,
  STATIC_HEADER_KEYS,
  TOP_LEVEL_KEYS,
  VAULT_KEYS,
} from './types';
import type {
  Expiry,
  Group,
  Key,
  KeyaFile,
  Probe,
  ProbeAuth,
  Provider,
  StaticHeader,
} from './types';
import {
  foldAsciiCase,
  isCustomId,
  isForbiddenRequestHeader,
  isForbiddenStaticHeader,
  isHeaderToken,
  isPresetId,
  isQueryParamName,
  isStorableHeaderValue,
  isUuidV4,
} from './ids';
import {
  hasForbiddenControl,
  hasOuterWhitespace,
  isPrintableAscii,
  isWellFormedUtf16,
  utf8Length,
} from './text';
import { checkBaseUrl, checkTarget } from './url';
import { isCalendarDay, isTimestamp } from '../time/timestamps';

export type IssueCode =
  | 'bad_type'
  | 'unknown_field'
  | 'missing_field'
  | 'bad_enum'
  | 'too_long'
  | 'too_short'
  | 'bad_charset'
  | 'bad_uuid'
  | 'bad_timestamp'
  | 'bad_date'
  | 'bad_url'
  | 'out_of_range'
  | 'duplicate_id'
  | 'duplicate_name'
  | 'duplicate_header'
  | 'header_conflict'
  | 'forbidden_header'
  | 'dangling_reference';

export interface Issue {
  /** Field path, e.g. `keys[3].endpoint`. */
  path: string;
  code: IssueCode;
  detail?: string;
}

export type ValidationResult =
  | { ok: true; value: KeyaFile }
  | { ok: false; issues: Issue[] };

interface Ctx {
  issues: Issue[];
}

const add = (ctx: Ctx, path: string, code: IssueCode, detail?: string) => {
  ctx.issues.push({ path, code, detail });
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readObject(
  value: unknown,
  path: string,
  allowed: readonly string[],
  ctx: Ctx
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    add(ctx, path, 'bad_type', 'object');
    return null;
  }
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) add(ctx, `${path}.${key}`, 'unknown_field');
  }
  return value;
}

function requireKeys(
  object: Record<string, unknown>,
  path: string,
  keys: readonly string[],
  ctx: Ctx
): void {
  for (const key of keys) {
    if (!Object.hasOwn(object, key))
      add(ctx, `${path}.${key}`, 'missing_field');
  }
}

function readArray(
  value: unknown,
  path: string,
  max: number,
  ctx: Ctx
): unknown[] | null {
  if (!Array.isArray(value)) {
    add(ctx, path, 'bad_type', 'array');
    return null;
  }
  if (value.length > max) {
    add(ctx, path, 'too_long', `${value.length} > ${max}`);
    return null;
  }
  return value;
}

interface StringRule {
  min?: number;
  max: number;
  /** Reject C0 control characters other than tab/newline/CR. */
  freeText?: boolean;
  /** Only printable ASCII. */
  printableAscii?: boolean;
  /** Reject leading/trailing whitespace (the writer must have trimmed). */
  trimmed?: boolean;
}

function readString(
  value: unknown,
  path: string,
  rule: StringRule,
  ctx: Ctx
): string | undefined {
  if (typeof value !== 'string') {
    add(ctx, path, 'bad_type', 'string');
    return undefined;
  }
  if (!isWellFormedUtf16(value)) {
    add(ctx, path, 'bad_charset', 'lone surrogate');
    return undefined;
  }
  if (rule.freeText && hasForbiddenControl(value)) {
    add(ctx, path, 'bad_charset', 'control character');
    return undefined;
  }
  if (rule.printableAscii && !isPrintableAscii(value)) {
    add(ctx, path, 'bad_charset', 'non printable ascii');
    return undefined;
  }
  if (rule.trimmed && hasOuterWhitespace(value)) {
    add(ctx, path, 'bad_charset', 'outer whitespace');
    return undefined;
  }
  const length = utf8Length(value);
  const min = rule.min ?? 0;
  if (length < min) {
    add(ctx, path, 'too_short', `${length} < ${min}`);
    return undefined;
  }
  if (length > rule.max) {
    add(ctx, path, 'too_long', `${length} > ${rule.max}`);
    return undefined;
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  ctx: Ctx
): T | undefined {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    add(ctx, path, 'bad_enum', allowed.join('|'));
    return undefined;
  }
  return value as T;
}

function readInteger(
  value: unknown,
  path: string,
  min: number,
  max: number,
  ctx: Ctx
): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    add(ctx, path, 'bad_type', 'integer');
    return undefined;
  }
  if (value < min || value > max) {
    add(ctx, path, 'out_of_range', `${value} not in [${min}, ${max}]`);
    return undefined;
  }
  return value;
}

function readTimestamp(
  value: unknown,
  path: string,
  ctx: Ctx
): string | undefined {
  if (typeof value !== 'string') {
    add(ctx, path, 'bad_type', 'string');
    return undefined;
  }
  if (!isTimestamp(value)) {
    add(ctx, path, 'bad_timestamp');
    return undefined;
  }
  return value;
}

function readUuid(value: unknown, path: string, ctx: Ctx): string | undefined {
  if (typeof value !== 'string') {
    add(ctx, path, 'bad_type', 'string');
    return undefined;
  }
  if (!isUuidV4(value)) {
    add(ctx, path, 'bad_uuid');
    return undefined;
  }
  return value;
}

function readBaseUrl(
  value: unknown,
  path: string,
  ctx: Ctx
): string | undefined {
  const string = readString(
    value,
    path,
    { max: MAX_URL, freeText: true, trimmed: true },
    ctx
  );
  if (string === undefined) return undefined;
  const problem = checkBaseUrl(string);
  if (problem) {
    add(ctx, path, 'bad_url', problem.code);
    return undefined;
  }
  return string;
}

function readIcon(value: unknown, path: string, ctx: Ctx): string | undefined {
  // Readers validate bytes only: grapheme segmentation varies by engine.
  return readString(
    value,
    path,
    { max: MAX_ICON, freeText: true, trimmed: true },
    ctx
  );
}

function readProbeAuth(
  value: unknown,
  path: string,
  ctx: Ctx
): ProbeAuth | undefined {
  const object = readObject(value, path, ['mode', 'name', 'param'], ctx);
  if (!object) return undefined;

  const mode = readEnum(
    object.mode,
    `${path}.mode`,
    ['bearer', 'basic', 'header', 'query'],
    ctx
  );
  if (!mode) return undefined;

  for (const key of Object.keys(object)) {
    if (!AUTH_KEYS[mode].includes(key)) {
      add(ctx, `${path}.${key}`, 'unknown_field', `not allowed for ${mode}`);
    }
  }
  for (const key of AUTH_KEYS[mode]) {
    if (!Object.hasOwn(object, key))
      add(ctx, `${path}.${key}`, 'missing_field');
  }

  if (mode === 'bearer' || mode === 'basic') return { mode };

  if (mode === 'header') {
    const name = readString(
      object.name,
      `${path}.name`,
      { min: 1, max: MAX_AUTH_HEADER_NAME, trimmed: true },
      ctx
    );
    if (name === undefined) return undefined;
    if (!isHeaderToken(name)) {
      add(ctx, `${path}.name`, 'bad_charset', 'not a header token');
      return undefined;
    }
    if (isForbiddenRequestHeader(name)) {
      add(ctx, `${path}.name`, 'forbidden_header');
      return undefined;
    }
    return { mode, name };
  }

  const param = readString(
    object.param,
    `${path}.param`,
    { min: 1, max: MAX_QUERY_PARAM, trimmed: true },
    ctx
  );
  if (param === undefined) return undefined;
  if (!isQueryParamName(param)) {
    add(ctx, `${path}.param`, 'bad_charset', 'bad query parameter name');
    return undefined;
  }
  return { mode, param };
}

function readStaticHeaders(
  value: unknown,
  path: string,
  ctx: Ctx
): StaticHeader[] | undefined {
  const items = readArray(value, path, MAX_STATIC_HEADERS, ctx);
  if (!items) return undefined;

  const headers: StaticHeader[] = [];
  const seen = new Map<string, number>();

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    const object = readObject(item, itemPath, STATIC_HEADER_KEYS, ctx);
    if (!object) return;
    requireKeys(object, itemPath, STATIC_HEADER_KEYS, ctx);

    const name = readString(
      object.name,
      `${itemPath}.name`,
      { min: 1, max: MAX_HEADER_NAME, trimmed: true },
      ctx
    );
    const headerValue = readString(
      object.value,
      `${itemPath}.value`,
      {
        min: 1,
        max: MAX_HEADER_VALUE,
        printableAscii: true,
        trimmed: true,
      },
      ctx
    );
    if (name === undefined || headerValue === undefined) return;

    if (!isHeaderToken(name)) {
      add(ctx, `${itemPath}.name`, 'bad_charset', 'not a header token');
      return;
    }
    if (!isStorableHeaderValue(headerValue)) {
      add(ctx, `${itemPath}.value`, 'bad_charset', 'outer whitespace');
      return;
    }
    if (isForbiddenStaticHeader(name)) {
      add(ctx, `${itemPath}.name`, 'forbidden_header');
      return;
    }

    const folded = foldAsciiCase(name);
    const previous = seen.get(folded);
    if (previous !== undefined) {
      add(ctx, `${itemPath}.name`, 'duplicate_header', `same as [${previous}]`);
      return;
    }
    seen.set(folded, index);
    headers.push({ name, value: headerValue });
  });

  return headers;
}

function readProbe(
  value: unknown,
  path: string,
  ctx: Ctx
): Probe | null | undefined {
  if (value === null) return null;

  const object = readObject(value, path, PROBE_KEYS, ctx);
  if (!object) return undefined;
  requireKeys(object, path, PROBE_KEYS, ctx);

  const target = readString(
    object.target,
    `${path}.target`,
    { min: 1, max: MAX_TARGET, freeText: true, trimmed: true },
    ctx
  );
  if (target !== undefined) {
    const problem = checkTarget(target);
    if (problem) add(ctx, `${path}.target`, 'bad_url', problem.code);
  }

  const auth = readProbeAuth(object.auth, `${path}.auth`, ctx);
  const headers = readStaticHeaders(object.headers, `${path}.headers`, ctx);

  if (auth && headers) {
    const authName =
      auth.mode === 'header' ? foldAsciiCase(auth.name) : undefined;
    if (authName !== undefined) {
      headers.forEach((header, index) => {
        if (foldAsciiCase(header.name) === authName) {
          add(
            ctx,
            `${path}.headers[${index}].name`,
            'header_conflict',
            'same as auth.name'
          );
        }
      });
    }
  }

  // A query-mode credential must not silently overwrite a constant parameter:
  // the executor uses `searchParams.set`, so a collision would change what the
  // recipe appears to send.
  if (target !== undefined && auth?.mode === 'query') {
    const queryStart = target.indexOf('?');
    if (queryStart !== -1) {
      const params = new URLSearchParams(target.slice(queryStart + 1));
      if (params.has(auth.param)) {
        add(
          ctx,
          `${path}.auth.param`,
          'header_conflict',
          'target already carries this query parameter'
        );
      }
    }
  }

  if (target === undefined || !auth || !headers) return undefined;
  return { target, auth, headers };
}

function readProvider(
  value: unknown,
  path: string,
  ctx: Ctx
): Provider | undefined {
  const object = readObject(value, path, PROVIDER_KEYS, ctx);
  if (!object) return undefined;
  requireKeys(object, path, PROVIDER_KEYS, ctx);

  const id = readString(object.id, `${path}.id`, { max: 64 }, ctx);
  if (id !== undefined && !isCustomId(id)) {
    add(ctx, `${path}.id`, 'bad_uuid', 'expected custom:<uuidv4>');
  }

  const name = readString(
    object.name,
    `${path}.name`,
    { min: 1, max: MAX_PROVIDER_NAME, freeText: true, trimmed: true },
    ctx
  );
  const description = readString(
    object.description,
    `${path}.description`,
    { max: MAX_PROVIDER_DESCRIPTION, freeText: true },
    ctx
  );

  let defaultEndpoint: string | null | undefined;
  if (object.default_endpoint === null) {
    defaultEndpoint = null;
  } else {
    defaultEndpoint = readBaseUrl(
      object.default_endpoint,
      `${path}.default_endpoint`,
      ctx
    );
  }

  const probe = readProbe(object.probe, `${path}.probe`, ctx);

  if (
    id === undefined ||
    name === undefined ||
    description === undefined ||
    defaultEndpoint === undefined ||
    probe === undefined
  ) {
    return undefined;
  }

  return { id, name, description, default_endpoint: defaultEndpoint, probe };
}

function readGroup(value: unknown, path: string, ctx: Ctx): Group | undefined {
  const object = readObject(value, path, GROUP_KEYS, ctx);
  if (!object) return undefined;
  requireKeys(object, path, GROUP_KEYS, ctx);

  const id = readUuid(object.id, `${path}.id`, ctx);
  const name = readString(
    object.name,
    `${path}.name`,
    { min: 1, max: MAX_GROUP_NAME, freeText: true, trimmed: true },
    ctx
  );
  const icon = readIcon(object.icon, `${path}.icon`, ctx);
  const order = readInteger(
    object.order,
    `${path}.order`,
    0,
    MAX_GROUP_ORDER,
    ctx
  );

  if (
    id === undefined ||
    name === undefined ||
    icon === undefined ||
    order === undefined
  ) {
    return undefined;
  }
  return { id, name, icon, order };
}

function readExpiry(
  value: unknown,
  path: string,
  ctx: Ctx
): Expiry | null | undefined {
  if (value === null) return null;

  const object = readObject(value, path, ['kind', 'value'], ctx);
  if (!object) return undefined;

  const kind = readEnum(object.kind, `${path}.kind`, ['date', 'instant'], ctx);
  if (!kind) return undefined;

  for (const key of Object.keys(object)) {
    if (!EXPIRY_KEYS[kind].includes(key)) {
      add(ctx, `${path}.${key}`, 'unknown_field', `not allowed for ${kind}`);
    }
  }
  for (const key of EXPIRY_KEYS[kind]) {
    if (!Object.hasOwn(object, key))
      add(ctx, `${path}.${key}`, 'missing_field');
  }

  const raw = object.value;
  if (typeof raw !== 'string') {
    add(ctx, `${path}.value`, 'bad_type', 'string');
    return undefined;
  }

  if (kind === 'date') {
    if (!isCalendarDay(raw)) add(ctx, `${path}.value`, 'bad_date');
    return { kind, value: raw };
  }

  if (!isTimestamp(raw)) add(ctx, `${path}.value`, 'bad_timestamp');
  return { kind, value: raw };
}

function readKey(value: unknown, path: string, ctx: Ctx): Key | undefined {
  const object = readObject(value, path, KEY_KEYS, ctx);
  if (!object) return undefined;
  requireKeys(object, path, KEY_KEYS, ctx);

  const id = readUuid(object.id, `${path}.id`, ctx);
  const name = readString(
    object.name,
    `${path}.name`,
    { min: 1, max: MAX_KEY_NAME, freeText: true, trimmed: true },
    ctx
  );
  const description = readString(
    object.description,
    `${path}.description`,
    { max: MAX_KEY_DESCRIPTION, freeText: true },
    ctx
  );

  let providerId: string | null | undefined;
  if (object.provider_id === null) {
    providerId = null;
  } else {
    const raw = readString(
      object.provider_id,
      `${path}.provider_id`,
      {
        min: 1,
        max: 70,
      },
      ctx
    );
    if (raw === undefined) {
      providerId = undefined;
    } else if (isPresetId(raw) || isCustomId(raw)) {
      providerId = raw;
    } else {
      add(
        ctx,
        `${path}.provider_id`,
        'bad_enum',
        'preset:<slug> | custom:<uuid> | null'
      );
      providerId = undefined;
    }
  }

  let endpoint: string | null | undefined;
  if (object.endpoint === null) {
    endpoint = null;
  } else {
    endpoint = readBaseUrl(object.endpoint, `${path}.endpoint`, ctx);
  }

  const secret = readString(
    object.secret,
    `${path}.secret`,
    { min: MIN_SECRET, max: MAX_SECRET, freeText: true, trimmed: true },
    ctx
  );

  let groupId: string | null | undefined;
  if (object.group_id === null) {
    groupId = null;
  } else {
    groupId = readUuid(object.group_id, `${path}.group_id`, ctx);
  }

  const expiry = readExpiry(object.expiry, `${path}.expiry`, ctx);

  let archivedAt: string | null | undefined;
  if (object.archived_at === null) {
    archivedAt = null;
  } else {
    archivedAt = readTimestamp(object.archived_at, `${path}.archived_at`, ctx);
  }

  const createdAt = readTimestamp(object.created_at, `${path}.created_at`, ctx);
  const updatedAt = readTimestamp(
    object.content_updated_at,
    `${path}.content_updated_at`,
    ctx
  );

  if (
    id === undefined ||
    name === undefined ||
    description === undefined ||
    providerId === undefined ||
    endpoint === undefined ||
    secret === undefined ||
    groupId === undefined ||
    expiry === undefined ||
    archivedAt === undefined ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    return undefined;
  }

  return {
    id,
    name,
    description,
    provider_id: providerId,
    endpoint,
    secret,
    group_id: groupId,
    expiry,
    archived_at: archivedAt,
    created_at: createdAt,
    content_updated_at: updatedAt,
  };
}

interface Indexed<T> {
  index: number;
  value: T;
}

/** Report the first repeat of a derived key, using the original array index. */
function checkUniqueBy<T>(
  records: readonly Indexed<T>[],
  path: string,
  suffix: string,
  code: IssueCode,
  ctx: Ctx,
  keyOf: (record: T) => string
): void {
  const seen = new Map<string, number>();
  for (const record of records) {
    const key = keyOf(record.value);
    const previous = seen.get(key);
    if (previous !== undefined) {
      add(
        ctx,
        `${path}[${record.index}]${suffix}`,
        code,
        `same as [${previous}]`
      );
      continue;
    }
    seen.set(key, record.index);
  }
}

export function validateKeyaFile(input: unknown): ValidationResult {
  const ctx: Ctx = { issues: [] };

  const root = readObject(input, '$', TOP_LEVEL_KEYS, ctx);
  if (!root) return { ok: false, issues: ctx.issues };
  requireKeys(root, '$', TOP_LEVEL_KEYS, ctx);

  // vault
  let vault: KeyaFile['vault'] | undefined;
  const vaultObject = readObject(root.vault, 'vault', VAULT_KEYS, ctx);
  if (vaultObject) {
    requireKeys(vaultObject, 'vault', VAULT_KEYS, ctx);
    const id = readUuid(vaultObject.id, 'vault.id', ctx);
    const name = readString(
      vaultObject.name,
      'vault.name',
      { min: 1, max: MAX_VAULT_NAME, freeText: true, trimmed: true },
      ctx
    );
    const icon = readIcon(vaultObject.icon, 'vault.icon', ctx);
    const createdAt = readTimestamp(
      vaultObject.created_at,
      'vault.created_at',
      ctx
    );
    const updatedAt = readTimestamp(
      vaultObject.content_updated_at,
      'vault.content_updated_at',
      ctx
    );
    if (
      id !== undefined &&
      name !== undefined &&
      icon !== undefined &&
      createdAt !== undefined &&
      updatedAt !== undefined
    ) {
      vault = {
        id,
        name,
        icon,
        created_at: createdAt,
        content_updated_at: updatedAt,
      };
    }
  }

  // providers
  const providerRecords: Indexed<Provider>[] = [];
  const providerItems = readArray(
    root.providers,
    'providers',
    MAX_PROVIDERS,
    ctx
  );
  providerItems?.forEach((item, index) => {
    const provider = readProvider(item, `providers[${index}]`, ctx);
    if (provider) providerRecords.push({ index, value: provider });
  });

  // groups
  const groupRecords: Indexed<Group>[] = [];
  const groupItems = readArray(root.groups, 'groups', MAX_GROUPS, ctx);
  groupItems?.forEach((item, index) => {
    const group = readGroup(item, `groups[${index}]`, ctx);
    if (group) groupRecords.push({ index, value: group });
  });

  // keys
  const keyRecords: Indexed<Key>[] = [];
  const keyItems = readArray(root.keys, 'keys', MAX_KEYS, ctx);
  keyItems?.forEach((item, index) => {
    const key = readKey(item, `keys[${index}]`, ctx);
    if (key) keyRecords.push({ index, value: key });
  });

  // Uniqueness (against original indexes so reported paths stay meaningful).
  checkUniqueBy(
    providerRecords,
    'providers',
    '.id',
    'duplicate_id',
    ctx,
    (p) => p.id
  );
  checkUniqueBy(
    groupRecords,
    'groups',
    '.id',
    'duplicate_id',
    ctx,
    (g) => g.id
  );
  checkUniqueBy(keyRecords, 'keys', '.id', 'duplicate_id', ctx, (k) => k.id);
  checkUniqueBy(
    providerRecords,
    'providers',
    '.name',
    'duplicate_name',
    ctx,
    (p) => foldAsciiCase(p.name)
  );

  // Referential integrity (only rules that the file alone can decide).
  const groupIds = new Set(groupRecords.map((record) => record.value.id));
  const providerIds = new Set(providerRecords.map((record) => record.value.id));

  for (const record of keyRecords) {
    const { key, index } = { key: record.value, index: record.index };
    if (key.group_id !== null && !groupIds.has(key.group_id)) {
      add(ctx, `keys[${index}].group_id`, 'dangling_reference');
    }
    if (
      key.provider_id !== null &&
      isCustomId(key.provider_id) &&
      !providerIds.has(key.provider_id)
    ) {
      add(ctx, `keys[${index}].provider_id`, 'dangling_reference');
    }
  }

  const complete =
    vault !== undefined &&
    providerItems !== null &&
    groupItems !== null &&
    keyItems !== null &&
    providerRecords.length === (providerItems?.length ?? 0) &&
    groupRecords.length === (groupItems?.length ?? 0) &&
    keyRecords.length === (keyItems?.length ?? 0);

  if (ctx.issues.length > 0 || !complete || !vault) {
    return { ok: false, issues: ctx.issues };
  }

  return {
    ok: true,
    value: {
      vault,
      providers: providerRecords.map((record) => record.value),
      groups: groupRecords.map((record) => record.value),
      keys: keyRecords.map((record) => record.value),
    },
  };
}

/** First N issues as one line, for the reader's error message (§6.3). */
export function summarizeIssues(issues: readonly Issue[], limit = 10): string {
  const shown = issues
    .slice(0, limit)
    .map(
      (issue) =>
        `${issue.path}: ${issue.code}${issue.detail ? ` (${issue.detail})` : ''}`
    )
    .join('; ');
  return issues.length > limit ? `${shown}; …共 ${issues.length} 条` : shown;
}
