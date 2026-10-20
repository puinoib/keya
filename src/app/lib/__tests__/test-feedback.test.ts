import { describe, expect, it } from 'vitest';
import type { TestResult } from '../api-tester';
import {
  describeTestResult,
  getStoredCheckKind,
  getTestActionHint,
  getTestActionLabel,
  toConnectionCheck,
} from '../test-feedback';

function result(overrides: Partial<TestResult>): TestResult {
  return {
    success: true,
    latency_ms: 42,
    kind: 'credential',
    ...overrides,
  };
}

describe('test action labels', () => {
  it('distinguishes credential checks from endpoint checks', () => {
    expect(getTestActionLabel('credential')).toBe('Test key');
    expect(getTestActionLabel('reachability')).toBe('Check endpoint');
    expect(getTestActionLabel('unverifiable')).toBe('Cannot verify');
  });

  it('explains whether the key is sent', () => {
    expect(getTestActionHint('reachability')).toMatch(/key is not sent/);
    expect(getTestActionHint('credential')).toMatch(/Sends the key/);
  });
});

describe('describeTestResult', () => {
  it('reports a successful credential check with latency', () => {
    expect(describeTestResult(result({}), 'Prod key')).toEqual({
      title: 'Connection test succeeded',
      description: 'Prod key — 42ms',
    });
  });

  it('reports a successful reachability check without implying verification', () => {
    const feedback = describeTestResult(
      result({ kind: 'reachability' }),
      'Prod key'
    );
    expect(feedback.title).toBe('Endpoint reached');
    expect(feedback.description).toMatch(/key was not sent/);
  });

  it('reports unreachable endpoints', () => {
    const feedback = describeTestResult(
      result({
        success: false,
        kind: 'reachability',
        error: 'The endpoint could not be reached. The key was not sent.',
      })
    );
    expect(feedback.title).toBe('Endpoint unreachable');
    expect(feedback.description).toMatch(/could not be reached/);
  });

  it('reports unverifiable providers with their reason', () => {
    const feedback = describeTestResult(
      result({
        success: false,
        kind: 'unverifiable',
        error: 'This provider cannot be tested from the browser.',
      })
    );
    expect(feedback.title).toBe('Could not verify the credential');
    expect(feedback.description).toBe(
      'This provider cannot be tested from the browser.'
    );
  });
});

describe('toConnectionCheck', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');

  it('records a successful credential check', () => {
    expect(toConnectionCheck(result({}), now)).toEqual({
      status: 'success',
      checked_at: now.toISOString(),
      latency_ms: 42,
      error_message: null,
      kind: 'credential',
    });
  });

  it('records reachability separately from the credential', () => {
    expect(toConnectionCheck(result({ kind: 'reachability' }), now).kind).toBe(
      'reachability'
    );
  });

  it('records a credential failure', () => {
    expect(
      toConnectionCheck(result({ success: false, error: 'HTTP 401' }), now)
    ).toEqual({
      status: 'failed',
      checked_at: now.toISOString(),
      latency_ms: 42,
      error_message: 'HTTP 401',
      kind: 'credential',
    });
  });

  it('keeps an inconclusive check out of the failed state', () => {
    expect(
      toConnectionCheck(
        result({ success: false, kind: 'unverifiable', error: 'CORS' }),
        now
      )
    ).toEqual({
      status: 'untested',
      checked_at: now.toISOString(),
      latency_ms: 42,
      error_message: 'CORS',
      kind: 'unverifiable',
    });
  });
});

describe('getStoredCheckKind', () => {
  it('treats legacy records as credential checks', () => {
    expect(
      getStoredCheckKind({
        status: 'success',
        checked_at: '2026-01-01T00:00:00.000Z',
        latency_ms: 12,
        error_message: null,
      })
    ).toBe('credential');
  });

  it('returns the stored kind when present', () => {
    expect(
      getStoredCheckKind({
        status: 'untested',
        checked_at: null,
        latency_ms: null,
        error_message: null,
        kind: 'unverifiable',
      })
    ).toBe('unverifiable');
  });
});
