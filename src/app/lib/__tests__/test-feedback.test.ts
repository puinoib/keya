import { describe, expect, it } from 'vitest';
import type { TestResult } from '../api-tester';
import {
  describeTestResult,
  getTestActionHint,
  getTestActionLabel,
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
  it('separates a check that verifies the key from one that cannot', () => {
    expect(getTestActionLabel('credential')).toBe('Test key');
    expect(getTestActionLabel('request')).toBe('Test key');
    expect(getTestActionLabel('unverifiable')).toBe('Cannot verify');
  });

  it('explains whether the key is sent', () => {
    expect(getTestActionHint('credential')).toMatch(/Sends the key/);
    expect(getTestActionHint('unverifiable')).toMatch(/cannot verify/i);
  });
});

describe('describeTestResult', () => {
  it('reports a successful credential check with latency', () => {
    expect(describeTestResult(result({}), 'Prod key')).toEqual({
      title: 'Connection test succeeded',
      description: 'Prod key — 42ms',
    });
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

  it('reports a failed check with the outcome', () => {
    const feedback = describeTestResult(
      result({ success: false, error: 'HTTP 401' })
    );
    expect(feedback.title).toBe('Connection test failed');
    expect(feedback.description).toBe('HTTP 401');
  });
});
