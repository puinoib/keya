/**
 * The `/keys` state that belongs in the URL.
 *
 * Opening a row stays in the store, because it is not a navigation. The scope
 * and the group filter decide which list is on screen, so they live in the
 * location: back, forward, refresh and copied links all agree.
 *
 * The two scopes are exclusive, so an archived view never carries a group.
 */

export type KeysView = 'active' | 'archived';

export interface KeysSearch {
  select?: string;
  view?: KeysView;
  group?: string;
}

const UNGROUPED_SEARCH_VALUE = 'ungrouped';
const UNGROUPED_FILTER_ID = '__ungrouped__';

/** The filter id in the URL, or undefined when no group filter is active. */
export function groupSearchValue(
  groupId: string | null | undefined
): string | undefined {
  if (!groupId) return undefined;
  return groupId === UNGROUPED_FILTER_ID ? UNGROUPED_SEARCH_VALUE : groupId;
}

/** The store filter id for a URL value. */
export function groupIdFromSearch(value: string | undefined): string | null {
  if (!value) return null;
  return value === UNGROUPED_SEARCH_VALUE ? UNGROUPED_FILTER_ID : value;
}

/** Build the search object for a navigation to `/keys`. */
export function keysSearch(input: {
  archived?: boolean;
  groupId?: string | null;
  select?: string;
}): KeysSearch {
  const search: KeysSearch = {};
  if (input.select) search.select = input.select;
  if (input.archived) {
    search.view = 'archived';
  } else {
    const group = groupSearchValue(input.groupId);
    if (group) search.group = group;
  }
  return search;
}
