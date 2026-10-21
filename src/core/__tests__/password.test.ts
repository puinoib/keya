/**
 * §3.3 — password shape rules that must hold before any strength estimator runs.
 */

import { describe, expect, it } from 'vitest';
import { checkPasswordShape, passwordCodepoints } from '../payload/password';

describe('password shape', () => {
  it('counts code points, not UTF-8 bytes', () => {
    // Seven CJK characters: 21 bytes, seven code points.
    expect(passwordCodepoints('中文密码四个字')).toBe(7);
    expect(checkPasswordShape('中文密码四个字')).toBe('too_short');
  });

  it('rejects a password that is too short', () => {
    expect(checkPasswordShape('short pass')).toBe('too_short');
    expect(checkPasswordShape('a long enough synthetic passphrase')).toBeNull();
  });

  it('demands more length when non-ASCII dominates', () => {
    // 12 code points, all CJK: the English-centric estimator would overrate it.
    const twelve = '中文密码足够长了呀哈哈嘿';
    expect(passwordCodepoints(twelve)).toBeGreaterThanOrEqual(12);
    expect(checkPasswordShape(twelve)).toBe('too_short');

    const sixteen = '中文密码足够长了呀哈哈嘿再加几个字啊';
    expect(passwordCodepoints(sixteen)).toBeGreaterThanOrEqual(16);
    expect(checkPasswordShape(sixteen)).toBeNull();
  });

  it('rejects lone surrogates, which TextEncoder would collapse to U+FFFD', () => {
    expect(checkPasswordShape('a long synthetic \uD800 passphrase')).toBe(
      'malformed'
    );
    expect(
      checkPasswordShape('a long synthetic \u{1F511} passphrase')
    ).toBeNull();
  });
});
