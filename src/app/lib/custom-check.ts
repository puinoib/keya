import type { CustomProviderCheck } from '../view/types';

export type CustomCheckAuth = CustomProviderCheck['auth'];

const ABSOLUTE_URL = /^https?:\/\//i;
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/** Human-readable summary used in settings and hints. */
export function describeCustomCheck(
  check: CustomProviderCheck | undefined
): string {
  if (!check) return 'Reachability only';

  const path = check.path?.trim() || 'endpoint';
  const extra = check.headers?.length
    ? ` · ${check.headers.length} header${check.headers.length === 1 ? '' : 's'}`
    : '';

  if (check.auth === 'bearer') {
    return `Credential check · GET ${path} · Bearer token${extra}`;
  }
  if (check.auth === 'basic') {
    return `Credential check · GET ${path} · Basic auth${extra}`;
  }
  if (check.auth === 'x-api-key') {
    return `Credential check · GET ${path} · x-api-key header${extra}`;
  }
  if (check.auth === 'header') {
    return `Credential check · GET ${path} · ${check.header_name} header${extra}`;
  }
  return `Credential check · GET ${path} · ${check.query_param} query parameter${extra}`;
}

/** Return an error message for an unusable check, or null when it is valid. */
export function validateCustomCheck(check: CustomProviderCheck): string | null {
  const path = check.path?.trim();
  if (
    path &&
    path !== '.' &&
    !path.startsWith('/') &&
    !ABSOLUTE_URL.test(path)
  ) {
    return 'Check path must start with / or be an absolute URL.';
  }

  if (check.auth === 'header') {
    const name = check.header_name?.trim() ?? '';
    if (!name) return 'Header name is required for a custom header.';
    if (!NAME_PATTERN.test(name))
      return 'Header name contains invalid characters.';
  }

  if (check.auth === 'query') {
    const name = check.query_param?.trim() ?? '';
    if (!name) return 'Query parameter name is required.';
    if (!NAME_PATTERN.test(name)) {
      return 'Query parameter name contains invalid characters.';
    }
  }

  return null;
}
