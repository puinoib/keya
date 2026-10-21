/**
 * String-level primitives shared by validation and normalization.
 *
 * The format bans C0 control characters (except tab/newline/CR) in free text:
 * JSON escapes the rest as six-byte `\u00XX` sequences, which would break the
 * worst-case file size derivation, and NUL has no legitimate place in a secret.
 */

const encoder = new TextEncoder();

/** UTF-8 byte length — the unit every field limit is expressed in. */
export function utf8Length(value: string): number {
  return encoder.encode(value).length;
}

/**
 * True when the string contains a lone surrogate. `TextEncoder` would map it to
 * U+FFFD, so two different strings could produce the same bytes.
 */
export function isWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/**
 * True when the string contains a C0 control character other than tab, newline
 * or carriage return.
 */
export function hasForbiddenControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      return true;
    }
  }
  return false;
}

/** Printable ASCII only (0x20..0x7E). Used for header values. */
export function isPrintableAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

/** Leading or trailing ASCII whitespace, which the writer must strip. */
export function hasOuterWhitespace(value: string): boolean {
  return /^[ \t\r\n]|[ \t\r\n]$/.test(value);
}

/** Trim ASCII whitespace from both ends (the only normalization allowed). */
export function trimAsciiWhitespace(value: string): string {
  return value.replace(/^[ \t\r\n]+/, '').replace(/[ \t\r\n]+$/, '');
}

/**
 * Number of grapheme clusters. Only used by writers (icons); readers validate
 * byte length alone, because cluster segmentation varies across engines.
 */
export function graphemeCount(value: string): number {
  if (!value) return 0;
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(value)) count += 1;
  return count;
}
