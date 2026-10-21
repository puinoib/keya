/**
 * Password policy, the pure half (§3.3).
 *
 * The policy has to be enforced somewhere for the KDF parameters to mean
 * anything. Length is counted in code points, never UTF-8 bytes, and a lone
 * surrogate is rejected because `TextEncoder` would map it to U+FFFD — two
 * different passwords deriving the same key.
 */

export const MIN_PASSWORD_CODEPOINTS = 12;
/** zxcvbn under-estimates non-Latin passphrases, so they need more length. */
export const MIN_PASSWORD_CODEPOINTS_NON_ASCII = 16;
export const MIN_ZXCVBN_SCORE = 3;

export type PasswordShapeProblem = 'malformed' | 'too_short';

export function passwordCodepoints(password: string): number {
  return [...password].length;
}

export function isWellFormed(password: string): boolean {
  for (let index = 0; index < password.length; index += 1) {
    const code = password.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = password.charCodeAt(index + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/** Shape-only check, before any strength estimator runs. */
export function checkPasswordShape(
  password: string
): PasswordShapeProblem | null {
  if (!isWellFormed(password)) return 'malformed';

  const points = passwordCodepoints(password);
  const ascii = [...password].filter(
    (char) => char.charCodeAt(0) < 0x80
  ).length;
  const required =
    points > 0 && ascii * 2 < points
      ? MIN_PASSWORD_CODEPOINTS_NON_ASCII
      : MIN_PASSWORD_CODEPOINTS;

  return points < required ? 'too_short' : null;
}
