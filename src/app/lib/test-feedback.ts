import type { ConnectionCheck, ConnectionKind } from '../view/types';
import type { TestKind, TestResult } from './api-tester';

/** Label and hint for the action that triggers a check. */
export function getTestActionLabel(kind: TestKind): string {
  if (kind === 'unverifiable') return 'Cannot verify';
  return 'Test key';
}

export function getTestActionHint(kind: TestKind): string {
  if (kind === 'unverifiable') {
    return 'Keya cannot verify this provider from a browser.';
  }
  return 'Sends the key to a provider metadata endpoint.';
}

/** Toast copy for a finished check. */
export function describeTestResult(
  result: TestResult,
  subject?: string
): { title: string; description: string } {
  const latency = `${result.latency_ms}ms`;
  const forSubject = subject ? `${subject} — ` : '';

  if (result.kind === 'unverifiable') {
    return {
      title: 'Could not verify the credential',
      description: result.error ?? 'This provider cannot be verified here.',
    };
  }

  if (!result.success) {
    return {
      title: 'Connection test failed',
      description: result.error ?? 'Connection failed',
    };
  }

  return {
    title: 'Connection test succeeded',
    description: `${forSubject}${latency}`,
  };
}

/**
 * Map a check result onto the stored connection state. An inconclusive check is
 * not recorded as a failure: it leaves the key untested and keeps the reason.
 */
export function toConnectionCheck(
  result: TestResult,
  now: Date = new Date()
): ConnectionCheck {
  const checkedAt = now.toISOString();

  if (result.kind === 'unverifiable') {
    return {
      status: 'untested',
      checked_at: checkedAt,
      latency_ms: result.latency_ms ?? null,
      error_message: result.error ?? null,
      kind: 'unverifiable',
    };
  }

  return {
    status: result.success ? 'success' : 'failed',
    checked_at: checkedAt,
    latency_ms: result.latency_ms ?? null,
    error_message: result.success ? null : (result.error ?? null),
    kind: result.kind,
  };
}

/** Stored checks written before the kind field existed were credential checks. */
export function getStoredCheckKind(check: ConnectionCheck): ConnectionKind {
  return check.kind ?? 'credential';
}
