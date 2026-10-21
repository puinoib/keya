/**
 * §16.3 — serialization determinism and the write closure.
 *
 * The property test is the important one: whatever an edit sequence produces,
 * the bytes must be readable again and describe the same payload. That is the
 * invariant that keeps a user from ending up with a file they cannot open.
 */

import { describe, expect, it } from 'vitest';
import {
  deleteGroup,
  deleteKey,
  deleteProvider,
  reorderGroups,
  setArchived,
  updateVaultMeta,
  upsertGroup,
  upsertKey,
  upsertProvider,
} from '../payload/edits';
import { normalizeKeyaFile } from '../payload/normalize';
import { parsePayload, serializePayload } from '../payload/serialize';
import { validateKeyaFile } from '../payload/validate';
import { MAX_GROUPS } from '../payload/limits';
import { cloneFile } from './fixtures';

const NOW = '2026-04-01T00:00:00.000Z';
const LATER = '2026-04-02T00:00:00.000Z';

const roundTrip = (file: ReturnType<typeof cloneFile>) => {
  const bytes = serializePayload(file);
  const parsed = parsePayload(bytes);
  const result = validateKeyaFile(parsed);
  return { bytes, parsed, result };
};

describe('§16.3 serialization', () => {
  it('same state produces the same bytes', () => {
    const file = cloneFile();
    expect(serializePayload(file)).toEqual(serializePayload(cloneFile()));
    expect(serializePayload(file)).toEqual(serializePayload(file));
  });

  it('header order in the input does not change the bytes', () => {
    const one = cloneFile();
    const two = cloneFile();
    one.providers[0].probe!.headers = [
      { name: 'x-a', value: '1' },
      { name: 'x-b', value: '2' },
    ];
    two.providers[0].probe!.headers = [
      { name: 'X-B', value: '2' },
      { name: 'X-A', value: '1' },
    ];

    expect(serializePayload(normalizeKeyaFile(one))).toEqual(
      serializePayload(normalizeKeyaFile(two))
    );
  });

  it('writes fields in the documented order', () => {
    const text = new TextDecoder().decode(serializePayload(cloneFile()));
    expect(text.indexOf('"vault"')).toBeLessThan(text.indexOf('"providers"'));
    expect(text.indexOf('"providers"')).toBeLessThan(text.indexOf('"groups"'));
    expect(text.indexOf('"groups"')).toBeLessThan(text.indexOf('"keys"'));
    expect(text).not.toContain('\n');
  });

  it('round-trips through bytes and validation', () => {
    const { result, parsed } = roundTrip(cloneFile());
    expect(result.ok).toBe(true);
    if (result.ok) expect(parsed).toEqual(result.value);
  });
});

describe('§16.3 edit transactions', () => {
  it('a no-op edit changes nothing, including timestamps', () => {
    const file = cloneFile();
    const same = upsertKey(file, { ...file.keys[0] }, LATER);
    expect(same).toMatchObject({ ok: true, changed: false });
    expect(same.ok && same.value.vault.content_updated_at).toBe(
      file.vault.content_updated_at
    );

    const sameName = updateVaultMeta(file, { name: file.vault.name }, LATER);
    expect(sameName).toMatchObject({ ok: true, changed: false });
  });

  it('a real edit moves both timestamps', () => {
    const file = cloneFile();
    const result = upsertKey(file, { ...file.keys[0], name: 'Renamed' }, LATER);
    expect(result.ok && result.changed).toBe(true);
    if (!result.ok) return;
    expect(result.value.keys[0].content_updated_at).toBe(LATER);
    expect(result.value.vault.content_updated_at).toBe(LATER);
    // created_at is immutable.
    expect(result.value.keys[0].created_at).toBe(file.keys[0].created_at);
  });

  it('the key cap rejects the edit and leaves the previous state intact', () => {
    const file = cloneFile();
    file.keys = Array.from({ length: 1000 }, (_, index) => ({
      ...file.keys[0],
      id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
    }));

    const added = upsertKey(
      file,
      { ...file.keys[0], id: '99999999-0000-4000-8000-000000000000' },
      LATER
    );
    expect(added).toEqual({ ok: false, reason: 'key_limit' });
    // The original payload is untouched.
    expect(file.keys).toHaveLength(1000);
    expect(roundTrip(file).result.ok).toBe(true);
  });

  it('the group cap rejects the edit', () => {
    const file = cloneFile();
    file.groups = Array.from({ length: MAX_GROUPS }, (_, index) => ({
      ...file.groups[0],
      id: `${String(index).padStart(8, '0')}-0000-4000-8000-000000000000`,
      order: index,
    }));
    file.keys[0].group_id = null;

    const added = upsertGroup(
      file,
      { ...file.groups[0], id: '99999999-0000-4000-8000-000000000000' },
      LATER
    );
    expect(added).toEqual({ ok: false, reason: 'group_limit' });
  });

  it('archiving is idempotent and reversible', () => {
    const file = cloneFile();
    const archived = setArchived(file, file.keys[0].id, true, LATER);
    expect(archived.ok && archived.changed).toBe(true);
    if (!archived.ok) return;
    expect(archived.value.keys[0].archived_at).toBe(LATER);

    const again = setArchived(
      archived.value,
      archived.value.keys[0].id,
      true,
      NOW
    );
    expect(again).toMatchObject({ ok: true, changed: false });

    const restored = setArchived(
      archived.value,
      archived.value.keys[0].id,
      false,
      NOW
    );
    expect(restored.ok && restored.value.keys[0].archived_at).toBe(null);
  });

  it('deleting a group unbinds its keys instead of deleting them', () => {
    const file = cloneFile();
    const result = deleteGroup(file, file.groups[0].id, LATER);
    expect(result.ok && result.changed).toBe(true);
    if (!result.ok) return;
    expect(result.value.groups).toHaveLength(0);
    expect(result.value.keys).toHaveLength(1);
    expect(result.value.keys[0].group_id).toBe(null);
  });

  it('a provider still in use cannot be deleted', () => {
    const file = cloneFile();
    expect(deleteProvider(file, file.providers[0].id, LATER)).toEqual({
      ok: false,
      reason: 'provider_in_use',
    });

    const unlinked = upsertKey(
      file,
      { ...file.keys[0], provider_id: null },
      LATER
    );
    expect(unlinked.ok).toBe(true);
    if (!unlinked.ok) return;
    expect(deleteProvider(unlinked.value, file.providers[0].id, LATER).ok).toBe(
      true
    );
  });

  it('provider names stay unique regardless of ASCII case', () => {
    const file = cloneFile();
    const clash = upsertProvider(
      file,
      { ...file.providers[0], id: '55555555-5555-4555-8555-555555555555' },
      LATER
    );
    expect(clash).toEqual({ ok: false, reason: 'duplicate_provider_name' });
  });

  it('reordering groups rewrites order densely every time', () => {
    let file = cloneFile();
    const ids = ['33333333-0000-4000-8000-000000000001'];
    file = {
      ...file,
      groups: [file.groups[0], { ...file.groups[0], id: ids[0] }],
    };

    const order = [ids[0], file.groups[0].id];
    for (let round = 0; round < 5; round += 1) {
      const result = reorderGroups(file, order, LATER);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      file = result.value;
      expect(file.groups.map((group) => group.order)).toEqual([0, 1]);

      // Re-applying the same order is a no-op.
      const again = reorderGroups(file, order, NOW);
      expect(again).toMatchObject({ ok: true, changed: false });
    }
  });

  it('every successful edit leaves a readable file (property test)', () => {
    // Deterministic PRNG so failures are reproducible.
    let seed = 0x2f6e2b1;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T =>
      items[Math.floor(random() * items.length)];

    let file = cloneFile();
    let clock = 0;
    const tick = () =>
      new Date(Date.UTC(2026, 3, 1, 0, 0, clock++)).toISOString();

    for (let step = 0; step < 150; step += 1) {
      const operation = Math.floor(random() * 7);
      const key = file.keys.length > 0 ? pick(file.keys) : null;

      let result = null as ReturnType<typeof upsertKey> | null;

      if (operation === 0) {
        result = upsertKey(
          file,
          {
            ...cloneFile().keys[0],
            id: `${String(step).padStart(8, '0')}-0000-4000-8000-000000000000`,
            group_id: file.groups.length > 0 ? pick(file.groups).id : null,
            expiry:
              random() > 0.5 ? null : { kind: 'date', value: '2026-12-01' },
          },
          tick()
        );
      } else if (operation === 1 && key) {
        result = upsertKey(file, { ...key, name: `k${step}` }, tick());
      } else if (operation === 2 && key) {
        result = setArchived(file, key.id, random() > 0.5, tick());
      } else if (operation === 3 && key) {
        result = deleteKey(file, key.id, tick());
      } else if (operation === 4) {
        result = upsertGroup(
          file,
          {
            id: `${String(step).padStart(8, '0')}-1111-4111-8111-111111111111`,
            name: `g${step}`,
            icon: '',
            order: file.groups.length,
          },
          tick()
        );
      } else if (operation === 5 && file.groups.length > 0) {
        result = deleteGroup(file, pick(file.groups).id, tick());
      } else if (file.groups.length > 1) {
        const shuffled = [...file.groups]
          .map((group) => ({ group, sort: random() }))
          .sort((left, right) => left.sort - right.sort)
          .map((entry) => entry.group.id);
        result = reorderGroups(file, shuffled, tick());
      }

      if (!result) continue;
      if (!result.ok) {
        // A rejection must not mutate what we hold.
        expect(roundTrip(file).result.ok).toBe(true);
        continue;
      }

      file = result.value;
      const { bytes, parsed, result: validated } = roundTrip(file);
      expect(validated.ok, `step ${step}`).toBe(true);
      // Determinism: serializing the re-read payload produces identical bytes.
      if (validated.ok) {
        expect(serializePayload(validated.value)).toEqual(bytes);
        expect(parsed).toEqual(validated.value);
      }
    }
  });
});
