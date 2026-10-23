/* @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneFile, IDS } from '../../../../core/__tests__/fixtures';
import {
  buildComponentStore,
  type ComponentHarness,
} from '../../__tests__/harness';

vi.mock('@/core/format/sodium', async () => {
  const { fakeSodium } = await import('@/test/fake-sodium');
  return {
    loadSodium: async () => fakeSodium,
    sodium: () => fakeSodium,
    isSodiumLoaded: () => true,
  };
});

vi.mock('@/app/components/vault/VaultSwitcher', () => ({
  VaultSwitcher: () => null,
}));

const navigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { pathname: '/keys' } }),
}));

const holder = vi.hoisted(() => ({
  store: null as unknown,
}));

vi.mock('../../../store/useStore', () => ({
  get useStore() {
    return holder.store;
  },
  flushSave: vi.fn(),
}));

const { Sidebar } = await import('../Sidebar');

vi.stubGlobal('__APP_VERSION__', 'test');

let harness: ComponentHarness;

beforeEach(async () => {
  navigate.mockClear();
  harness = await buildComponentStore({ payload: cloneFile() });
  holder.store = harness.api.useStore;
});

describe('Sidebar', () => {
  it('clears every filter when Keys is clicked', async () => {
    const store = harness.api.useStore;

    store.getState().setFilterGroupId(IDS.group);
    store.getState().setFilterProvider('OpenAI');
    store.getState().setFilterTestStatus('success');
    store.getState().setFilterExpiryStatus('valid');
    store.getState().setSearchQuery('edge');

    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /^Keys/ }));

    const state = store.getState();
    expect(state.filterGroupId).toBeNull();
    expect(state.filterProvider).toBeNull();
    expect(state.filterTestStatus).toBeNull();
    expect(state.filterExpiryStatus).toBeNull();
    expect(state.searchQuery).toBe('');
    expect(state.showArchived).toBe(false);
    expect(navigate).toHaveBeenCalledWith({ to: '/keys' });
  });

  it('drops the group selection when Archived becomes the active scope', () => {
    const store = harness.api.useStore;
    store.getState().setFilterGroupId(IDS.group);

    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /Archived/ }));

    const state = store.getState();
    expect(state.showArchived).toBe(true);
    expect(state.filterGroupId).toBeNull();
    expect(navigate).toHaveBeenCalledWith({
      to: '/keys',
      search: { view: 'archived' },
    });
  });

  it('puts the group filter in the URL and leaves the archived scope', () => {
    const store = harness.api.useStore;
    store.getState().setShowArchived(true);

    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /Production/ }));

    const state = store.getState();
    expect(state.showArchived).toBe(false);
    expect(state.filterGroupId).toBe(IDS.group);
    expect(navigate).toHaveBeenCalledWith({
      to: '/keys',
      search: { group: IDS.group },
    });
  });
});
