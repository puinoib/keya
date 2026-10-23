/**
 * Static header canonical form.
 *
 * Order is semantically irrelevant, but the file must be byte-deterministic
 * ("same state, same bytes"), so writers store headers sorted by lowercased
 * name and then value. The fingerprint encoder sorts the same way, which is why
 * reordering headers in the UI cannot invalidate an approval.
 */

import type { StaticHeader } from './types';

export function canonicalizeHeaders(
  headers: readonly StaticHeader[]
): StaticHeader[] {
  return [...headers].sort((left, right) => {
    const leftName = left.name.toLowerCase();
    const rightName = right.name.toLowerCase();
    if (leftName !== rightName) return leftName < rightName ? -1 : 1;
    if (left.value === right.value) return 0;
    return left.value < right.value ? -1 : 1;
  });
}
