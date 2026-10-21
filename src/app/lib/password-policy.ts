/**
 * Password strength policy (§3.3).
 *
 * Shape first (cheap, pure), then one zxcvbn pass, which is loaded on demand so
 * the dictionaries stay out of the initial bundle. The policy is enforced at
 * creation and at password change; it never runs on unlock, because a file
 * written under an older policy must still open.
 */

import {
  MIN_ZXCVBN_SCORE,
  checkPasswordShape,
  passwordCodepoints,
  requiredPasswordCodepoints,
} from '../../core/payload/password';
import { loadZxcvbn } from './zxcvbn';

export type PasswordVerdict =
  | { ok: true; score: number; codepoints: number }
  | {
      ok: false;
      reason: 'malformed' | 'too_short' | 'weak';
      score?: number;
      codepoints: number;
      /** Minimum length that applied, so the message can state it. */
      required: number;
    };

export async function judgePassword(
  password: string
): Promise<PasswordVerdict> {
  const codepoints = passwordCodepoints(password);
  const required = requiredPasswordCodepoints(password);
  const shape = checkPasswordShape(password);
  if (shape) return { ok: false, reason: shape, codepoints, required };

  const estimate = await loadZxcvbn();
  const result = await estimate(password);
  if (result.score < MIN_ZXCVBN_SCORE) {
    return {
      ok: false,
      reason: 'weak',
      score: result.score,
      codepoints,
      required,
    };
  }

  return { ok: true, score: result.score, codepoints };
}

export function describePasswordVerdict(verdict: PasswordVerdict): string {
  if (verdict.ok) return `Strength ${verdict.score}/4`;
  switch (verdict.reason) {
    case 'malformed':
      return 'This password contains invalid characters.';
    case 'too_short':
      return `Use at least ${verdict.required} characters (${verdict.codepoints} so far).`;
    case 'weak':
      return 'This password is too easy to guess. Add length or use several unrelated words.';
  }
}
