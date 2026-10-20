import { describe, expect, it } from 'vitest';
import {
  buildCustomCheckRequest,
  describeCustomCheck,
  resolveCheckUrl,
  validateCustomCheck,
} from '../custom-check';

describe('resolveCheckUrl', () => {
  it('returns the endpoint when no path is configured', () => {
    expect(resolveCheckUrl('https://api.example.com/v1/')).toBe(
      'https://api.example.com/v1'
    );
  });

  it('appends relative paths to the endpoint', () => {
    expect(resolveCheckUrl('https://api.example.com', '/v1/models')).toBe(
      'https://api.example.com/v1/models'
    );
    expect(resolveCheckUrl('https://api.example.com/v1', 'models')).toBe(
      'https://api.example.com/v1/models'
    );
  });

  it('keeps absolute check URLs unchanged', () => {
    expect(
      resolveCheckUrl('https://api.example.com', 'https://auth.example.com/me')
    ).toBe('https://auth.example.com/me');
  });
});

describe('buildCustomCheckRequest', () => {
  it('uses a bearer token', () => {
    expect(
      buildCustomCheckRequest(
        { auth: 'bearer', path: '/me' },
        'https://api.example.com',
        'secret'
      )
    ).toEqual({
      url: 'https://api.example.com/me',
      headers: { Authorization: 'Bearer secret' },
    });
  });

  it('uses the x-api-key header', () => {
    expect(
      buildCustomCheckRequest(
        { auth: 'x-api-key' },
        'https://api.example.com',
        'secret'
      )
    ).toEqual({
      url: 'https://api.example.com',
      headers: { 'x-api-key': 'secret' },
    });
  });

  it('uses a custom header name', () => {
    expect(
      buildCustomCheckRequest(
        { auth: 'header', header_name: 'X-Custom-Key' },
        'https://api.example.com',
        'secret'
      ).headers
    ).toEqual({ 'X-Custom-Key': 'secret' });
  });

  it('appends a query parameter', () => {
    const request = buildCustomCheckRequest(
      { auth: 'query', query_param: 'api_key', path: '/me?verbose=1' },
      'https://api.example.com',
      'se cret'
    );

    expect(request.url).toBe(
      'https://api.example.com/me?verbose=1&api_key=se+cret'
    );
    expect(request.headers).toEqual({});
  });
});

describe('describeCustomCheck', () => {
  it('describes reachability and each credential mode', () => {
    expect(describeCustomCheck(undefined)).toBe('Reachability only');
    expect(describeCustomCheck({ auth: 'bearer', path: '/me' })).toBe(
      'Credential check · GET /me · Bearer token'
    );
    expect(describeCustomCheck({ auth: 'x-api-key' })).toBe(
      'Credential check · GET endpoint · x-api-key header'
    );
    expect(describeCustomCheck({ auth: 'header', header_name: 'X-Key' })).toBe(
      'Credential check · GET endpoint · X-Key header'
    );
    expect(describeCustomCheck({ auth: 'query', query_param: 'api_key' })).toBe(
      'Credential check · GET endpoint · api_key query parameter'
    );
  });
});

describe('validateCustomCheck', () => {
  it('accepts paths and absolute URLs', () => {
    expect(
      validateCustomCheck({ auth: 'bearer', path: '/v1/models' })
    ).toBeNull();
    expect(
      validateCustomCheck({ auth: 'bearer', path: 'https://x.example.com/me' })
    ).toBeNull();
  });

  it('rejects relative paths without a leading slash', () => {
    expect(validateCustomCheck({ auth: 'bearer', path: 'v1/models' })).toMatch(
      /must start with/
    );
  });

  it('requires a header or query parameter name', () => {
    expect(validateCustomCheck({ auth: 'header' })).toMatch(/Header name/);
    expect(
      validateCustomCheck({ auth: 'header', header_name: 'bad name' })
    ).toMatch(/invalid characters/);
    expect(validateCustomCheck({ auth: 'query' })).toMatch(
      /Query parameter name/
    );
    expect(
      validateCustomCheck({ auth: 'query', query_param: 'api key' })
    ).toMatch(/invalid characters/);
  });
});
