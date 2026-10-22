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
