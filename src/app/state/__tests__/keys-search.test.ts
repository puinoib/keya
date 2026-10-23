import { describe, expect, it } from 'vitest';
import {
  groupIdFromSearch,
  groupSearchValue,
  keysSearch,
} from '../keys-search';

describe('keys search state', () => {
  it('maps the ungrouped filter to a readable URL value', () => {
    expect(groupSearchValue('__ungrouped__')).toBe('ungrouped');
    expect(groupIdFromSearch('ungrouped')).toBe('__ungrouped__');
  });

  it('round-trips real group ids', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(groupSearchValue(id)).toBe(id);
    expect(groupIdFromSearch(id)).toBe(id);
  });

  it('treats an absent or unknown value as no group filter', () => {
    expect(groupIdFromSearch(undefined)).toBeNull();
    expect(groupIdFromSearch('')).toBeNull();
    expect(groupSearchValue(null)).toBeUndefined();
    expect(groupSearchValue('')).toBeUndefined();
  });

  it('writes the archived scope without a group', () => {
    expect(
      keysSearch({
        archived: true,
        groupId: '11111111-1111-4111-8111-111111111111',
      })
    ).toEqual({ view: 'archived' });
  });

  it('writes only the selected view, group and selection', () => {
    expect(
      keysSearch({
        groupId: '__ungrouped__',
        select: '22222222-2222-4222-8222-222222222222',
      })
    ).toEqual({
      group: 'ungrouped',
      select: '22222222-2222-4222-8222-222222222222',
    });
    expect(keysSearch({})).toEqual({});
  });
});
