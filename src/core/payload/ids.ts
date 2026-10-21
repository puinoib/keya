/**
 * Identifier and header-name grammars.
 *
 * UUIDs are accepted in exactly one shape: lowercase, version 4, RFC 4122/9562
 * variant. Checking only the version nibble would let non-variant values in.
 */

import { hasOuterWhitespace } from './text';

export const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV4(value: string): boolean {
  return UUID_V4_RE.test(value);
}

/** Preset slugs are frozen once published; new ones must match this shape. */
export const PRESET_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const PRESET_ID_PREFIX = 'preset:';
export const CUSTOM_ID_PREFIX = 'custom:';

export function isPresetId(value: string): boolean {
  return (
    value.startsWith(PRESET_ID_PREFIX) &&
    PRESET_SLUG_RE.test(value.slice(PRESET_ID_PREFIX.length))
  );
}

export function isCustomId(value: string): boolean {
  return (
    value.startsWith(CUSTOM_ID_PREFIX) &&
    isUuidV4(value.slice(CUSTOM_ID_PREFIX.length))
  );
}

export function customIdFromUuid(uuid: string): string {
  return `${CUSTOM_ID_PREFIX}${uuid}`;
}

export function uuidFromCustomId(id: string): string {
  return id.slice(CUSTOM_ID_PREFIX.length);
}

/**
 * RFC 7230 token. This is what may appear as a header *name*; validating it
 * here (rather than relying on `fetch` to throw) is what keeps CRLF injection
 * out of the request.
 */
export const HEADER_TOKEN_RE = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;

export function isHeaderToken(value: string): boolean {
  return HEADER_TOKEN_RE.test(value);
}

/** Query parameter names we are willing to put the secret into. */
export const QUERY_PARAM_RE = /^[A-Za-z0-9._~-]+$/;

export function isQueryParamName(value: string): boolean {
  return QUERY_PARAM_RE.test(value);
}

/**
 * Headers `fetch` refuses to send. Values here are dropped silently, so a
 * recipe that used one would be "authorized" for bytes that never leave the
 * browser. `authorization` is special-cased: forbidden for *static* headers
 * (the credential belongs in `auth`), allowed as `auth.name`.
 */
const FORBIDDEN_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via',
]);

export function isForbiddenRequestHeader(name: string): boolean {
  const lower = name.toLowerCase();
  if (FORBIDDEN_HEADERS.has(lower)) return true;
  return lower.startsWith('proxy-') || lower.startsWith('sec-');
}

/** Static headers additionally may not claim the credential slot. */
export function isForbiddenStaticHeader(name: string): boolean {
  return (
    name.toLowerCase() === 'authorization' || isForbiddenRequestHeader(name)
  );
}

/** ASCII-only case folding, so uniqueness never depends on the locale. */
export function foldAsciiCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

/** A header value that survived validation: printable, no outer whitespace. */
export function isStorableHeaderValue(value: string): boolean {
  return value.length > 0 && !hasOuterWhitespace(value);
}
