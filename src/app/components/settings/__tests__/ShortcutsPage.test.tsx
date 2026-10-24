/* @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneFile } from '../../../../core/__tests__/fixtures';
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

const holder = vi.hoisted(() => ({ store: null as unknown }));

vi.mock('../../../store/useStore', () => ({
  get useStore() {
    return holder.store;
  },
}));

const { ShortcutsPage } = await import('../ShortcutsPage');

let harness: ComponentHarness;

beforeEach(async () => {
  harness = await buildComponentStore({ payload: cloneFile() });
  holder.store = harness.api.useStore;
});

function recorder(actionLabel: string): HTMLElement {
  return screen.getByRole('button', {
    name: `Change ${actionLabel} shortcut`,
  });
}

describe('ShortcutsPage', () => {
  it('draws a shortcut as one keycap per key', () => {
    render(<ShortcutsPage />);

    // jsdom reports no Apple platform, so the labels are spelled out.
    const lock = recorder('Lock Vault');
    expect(within(lock).getByText('Ctrl')).toBeTruthy();
    expect(within(lock).getByText('Shift')).toBeTruthy();
    expect(within(lock).getByText('L')).toBeTruthy();
  });

  it('records only once every key is released', () => {
    render(<ShortcutsPage />);
    const lock = recorder('Lock Vault');

    fireEvent.click(lock);
    expect(within(lock).getByText('Press keys...')).toBeTruthy();

    // Holding Ctrl and pressing K is not a finished shortcut yet: nothing is
    // written back, and the row does not flicker through a partial binding.
    fireEvent.keyDown(window, { key: 'Control', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(
      harness.api.useStore.getState().keyboardShortcuts['vault.lock']
    ).toBe(undefined);
    expect(within(lock).getByText('Press keys...')).toBeTruthy();

    // The key comes up while Ctrl is still down: still not finished.
    fireEvent.keyUp(window, { key: 'k', ctrlKey: true });
    expect(
      harness.api.useStore.getState().keyboardShortcuts['vault.lock']
    ).toBe(undefined);

    fireEvent.keyUp(window, { key: 'Control' });
    expect(
      harness.api.useStore.getState().keyboardShortcuts['vault.lock']
    ).toBe('mod+k');

    const updated = recorder('Lock Vault');
    expect(within(updated).getByText('Ctrl')).toBeTruthy();
    expect(within(updated).getByText('K')).toBeTruthy();
  });

  it('refuses a combination another action already uses', () => {
    render(<ShortcutsPage />);
    const lock = recorder('Lock Vault');

    fireEvent.click(lock);
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyUp(window, { key: 'n' });

    // `n` opens the add form, so the row reports the clash and keeps the old
    // binding instead of silently taking it away.
    expect(screen.getByText('Already used by Add Key')).toBeTruthy();
    expect(
      harness.api.useStore.getState().keyboardShortcuts['vault.lock']
    ).toBe(undefined);
    expect(within(recorder('Lock Vault')).getByText('Ctrl')).toBeTruthy();
  });
});
