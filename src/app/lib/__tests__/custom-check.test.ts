import { describe, expect, it } from 'vitest';
import { describeCustomCheck, validateCustomCheck } from '../custom-check';

describe('custom check validation', () => {
  it('accepts a relative path, a slash path and an absolute URL', () => {
    expect(validateCustomCheck({ auth: 'bearer' })).toBeNull();
    expect(validateCustomCheck({ auth: 'bearer', path: '/me' })).toBeNull();
    expect(
      validateCustomCheck({
        auth: 'bearer',
        path: 'https://auth.example.com/me',
      })
    ).toBeNull();
  });

  it('refuses a bare relative path', () => {
    expect(validateCustomCheck({ auth: 'bearer', path: 'me' })).toMatch(
      /start with \//
    );
  });

  it('requires a usable header name', () => {
    expect(validateCustomCheck({ auth: 'header' })).toMatch(/Header name/);
    expect(
      validateCustomCheck({ auth: 'header', header_name: 'bad header' })
    ).toMatch(/invalid characters/);
    expect(
      validateCustomCheck({ auth: 'header', header_name: 'x-api-key' })
    ).toBeNull();
  });

  it('requires a usable query parameter name', () => {
    expect(validateCustomCheck({ auth: 'query' })).toMatch(/Query parameter/);
    expect(
      validateCustomCheck({ auth: 'query', query_param: 'key' })
    ).toBeNull();
  });

  it('checks Basic auth without any extra field', () => {
    expect(validateCustomCheck({ auth: 'basic' })).toBeNull();
  });
});

describe('custom check copy', () => {
  it('says when a provider has no check at all', () => {
    expect(describeCustomCheck(undefined)).toBe('No check configured');
  });

  it('names the carrier and the path', () => {
    expect(describeCustomCheck({ auth: 'bearer', path: '/me' })).toBe(
      'Credential check · GET /me · Bearer token'
    );
    expect(
      describeCustomCheck({ auth: 'header', header_name: 'x-api-key' })
    ).toBe('Credential check · GET endpoint · x-api-key header');
  });
});
