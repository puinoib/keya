/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

const holder = vi.hoisted(() => ({
  store: null as unknown,
  api: null as unknown,
}));

vi.mock('../../../store/useStore', () => ({
  get useStore() {
    return holder.store;
  },
  exportVaultBytes: (...args: unknown[]) =>
    (
      holder.api as { exportVaultBytes: (...a: unknown[]) => unknown }
    ).exportVaultBytes(...args),
  flushSave: (...args: unknown[]) =>
    (holder.api as { flushSave: (...a: unknown[]) => unknown }).flushSave(
      ...args
    ),
  runManualCheck: (...args: unknown[]) =>
    (
      holder.api as { runManualCheck: (...a: unknown[]) => unknown }
    ).runManualCheck(...args),
}));

const { InboxPage } = await import('../InboxPage');

let harness: ComponentHarness;

beforeEach(async () => {
  navigate.mockReset();
  const payload = cloneFile();
  payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };

  harness = await buildComponentStore({ payload });
  holder.store = harness.api.useStore;
  holder.api = harness.api;
});

describe('InboxPage', () => {
  it('lists the reminders with their badge and context', () => {
    render(<InboxPage />);

    expect(screen.getByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('Untested')).toBeTruthy();
    expect(screen.getAllByText('Edge key')).toHaveLength(2);
    expect(screen.getByText(/expires in 4 days/)).toBeTruthy();
    expect(screen.getByText(/never tested/)).toBeTruthy();
  });

  it('archives a reminder and moves it to the archived list', async () => {
    const archive = vi.spyOn(
      harness.api.useStore.getState(),
      'setReminderDismissed'
    );
    render(<InboxPage />);
    const openBefore = screen.queryAllByText('View').length;

    const archiveButtons = screen
      .getAllByRole('button')
      .filter(
        (button) => !button.textContent?.trim() && button.querySelector('svg')
      );
    fireEvent.click(archiveButtons[archiveButtons.length - 1]);

    await waitFor(() =>
      expect(
        harness.api.useStore
          .getState()
          .view?.reminders.every((row) => !row.dismissed)
      ).toBe(false)
    );
    expect(archive).toHaveBeenCalledWith(
      expect.objectContaining({ dismissed: false }),
      true
    );
    expect(screen.queryAllByText('View').length).toBe(openBefore - 1);

    fireEvent.click(screen.getByRole('button', { name: /Archived/ }));
    await waitFor(() => expect(screen.getByText(/· Archived/)).toBeTruthy());
  });

  it('opens the key a reminder is about', async () => {
    render(<InboxPage />);

    fireEvent.click(screen.getAllByText('View')[0]);

    expect(harness.api.useStore.getState().selectedKeyId).toBeTruthy();
    expect(navigate).toHaveBeenCalledWith({ to: '/keys' });
  });
});
