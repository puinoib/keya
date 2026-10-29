/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  runManualCheck: (...args: unknown[]) =>
    (
      holder.api as { runManualCheck: (...a: unknown[]) => unknown }
    ).runManualCheck(...args),
  runManualChecks: (...args: unknown[]) =>
    (
      holder.api as { runManualChecks: (...a: unknown[]) => unknown }
    ).runManualChecks(...args),
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
  it('shows an upcoming expiry with its fact, and no chores as attention', () => {
    render(<InboxPage />);

    expect(screen.getByText('Due soon')).toBeTruthy();
    expect(screen.getByText(/expires in 4 days/)).toBeTruthy();
    // Never verified is housekeeping, not an alert.
    expect(screen.queryByText('Untested')).toBeNull();
    expect(screen.getByRole('button', { name: /Housekeeping/ })).toBeTruthy();
  });

  it('offers only Open and Archive, not a second way to edit the date', () => {
    render(<InboxPage />);

    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Extend 30 days' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear date' })).toBeNull();
  });

  it('archiving from the row clears it', async () => {
    render(<InboxPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() =>
      expect(harness.api.useStore.getState().view?.attention).toEqual([])
    );
    const key = harness.api.useStore
      .getState()
      .view?.file.keys.find((entry) => entry.id === IDS.key);
    expect(key?.archived_at).not.toBeNull();
  });

  it('listing housekeeping is quiet and offers a check', () => {
    render(<InboxPage />);

    fireEvent.click(screen.getByRole('button', { name: /Housekeeping/ }));

    expect(screen.getByText(/never verified on this device/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check all' })).toBeTruthy();
  });

  it('opens the key the row is about', () => {
    render(<InboxPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(harness.api.useStore.getState().selectedKeyId).toBe(IDS.key);
    expect(navigate).toHaveBeenCalledWith({ to: '/keys' });
  });

  it('shows a rejection only for a result the service answered', async () => {
    const bindings = await harness.vault.opened.session.bindings();
    const binding = bindings.get(IDS.key);
    expect(binding).toBeDefined();

    await harness.vault.local.recordObservation({
      observation_id: 'obs-rejected',
      vault_id: IDS.vault,
      key_id: IDS.key,
      binding: binding!.binding,
      kind: 'request',
      outcome: 'auth_failed',
      detail_code: 'credential_rejected',
      http_status: 401,
      latency_ms: 12,
      started_at: '2026-03-01T11:00:00.000Z',
      finished_at: '2026-03-01T11:00:00.012Z',
    });
    await harness.api.useStore.getState().refresh();

    render(<InboxPage />);

    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(screen.getByText(/rejected the credential/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check now' })).toBeTruthy();
  });

  it('explains why a row is shown and what clears it', () => {
    render(<InboxPage />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Why am I seeing this?' })
    );

    expect(screen.getByText(/Rule: expiry · fact: 2026-03-05/)).toBeTruthy();
    expect(screen.getByText(/archive the key/)).toBeTruthy();
  });
});
