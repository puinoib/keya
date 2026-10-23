/* @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
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

const { GeneralPage } = await import('../GeneralPage');

let harness: ComponentHarness;

beforeEach(async () => {
  harness = await buildComponentStore({ payload: cloneFile() });
  holder.store = harness.api.useStore;
});

describe('appearance', () => {
  it('switches the theme from the settings page', async () => {
    render(<GeneralPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(harness.api.useStore.getState().theme).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(harness.api.useStore.getState().theme).toBe('system');
  });
});

describe('clipboard clearing', () => {
  it('shows the stored delay and offers to turn it off', () => {
    render(<GeneralPage />);

    expect(screen.getByText('15 secs')).toBeTruthy();
    expect(
      screen.getByText(/Remove a copied credential from the clipboard/)
    ).toBeTruthy();
  });
});
