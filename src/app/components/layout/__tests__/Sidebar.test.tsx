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

/** Every direct child that is not the icon or the label. */
function countParts(button: HTMLElement): HTMLElement[] {
  return [...button.children].filter(
    (child) => child.tagName === 'SPAN' && /^\d+$/.test(child.textContent ?? '')
  ) as HTMLElement[];
}

describe('Sidebar', () => {
  it('keeps the Inbox and Keys shortcut hints out of the way until hover', () => {
    render(<Sidebar />);

    const inbox = screen.getByRole('button', { name: /Inbox/ });
    const hint = inbox.querySelector('kbd');
    expect(hint?.textContent).toBe('Ctrl+2');
    // Present for the layout, revealed by `group-hover` rather than by state.
    expect(hint?.className).toContain('invisible');

    const keys = screen.getByRole('button', { name: /Keys/ });
    const keysHint = keys.querySelector('kbd');
    expect(keysHint?.textContent).toBe('Ctrl+1');

    // Order is label, hint, then the count on the row's right edge.
    const parts = [...keys.children].map((child) =>
      child.tagName === 'KBD' ? 'kbd' : (child.textContent ?? '')
    );
    expect(parts.indexOf('kbd')).toBe(parts.length - 2);
    expect(
      [...countParts(keys)].at(-1)?.className,
      'the count owns the right edge'
    ).toContain('ml-auto');
  });

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
