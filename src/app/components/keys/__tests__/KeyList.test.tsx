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
  runAutomaticCheck: (...args: unknown[]) =>
    (
      holder.api as { runAutomaticCheck: (...a: unknown[]) => unknown }
    ).runAutomaticCheck(...args),
}));

const { KeyList, EditKeyDialog } = await import('../KeyList');

let harness: ComponentHarness;

beforeEach(async () => {
  const payload = cloneFile();
  payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
  payload.keys.push(
    {
      ...structuredClone(payload.keys[0]),
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Retired key',
      secret: 'sk-retired',
      expiry: { kind: 'date', value: '2026-03-02' },
      archived_at: '2026-03-03T00:00:00.000Z',
    },
    {
      ...structuredClone(payload.keys[0]),
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Preset key',
      secret: 'sk-preset',
      provider_id: 'preset:openai',
      endpoint: 'https://api.openai.com/v1',
      expiry: null,
    }
  );
  harness = await buildComponentStore({ payload });
  holder.store = harness.api.useStore;
  holder.api = harness.api;
});

function rowElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-keya-row]'));
}

function rowNames(): string[] {
  return rowElements().map((element) => element.textContent ?? '');
}

describe('KeyList', () => {
  it('renders the live keys with their provider and expiry', () => {
    render(<KeyList />);

    expect(rowNames()).toHaveLength(2);
    expect(screen.getByText('Edge key')).toBeTruthy();
    expect(screen.getByText('Preset key')).toBeTruthy();
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    expect(screen.getByText('Expiring soon')).toBeTruthy();
  });

  it('shows archived keys only in the archive view', async () => {
    render(<KeyList />);

    expect(screen.queryByText('Retired key')).toBeNull();

    harness.api.useStore.getState().setShowArchived(true);
    await screen.findByText('Retired key');

    expect(rowNames()).toHaveLength(1);
    expect(screen.getByText(/Archived/)).toBeTruthy();
  });

  it('filters by provider label', async () => {
    render(<KeyList />);
    expect(rowNames()).toHaveLength(2);

    harness.api.useStore.getState().setFilterProvider('OpenAI');
    await vi.waitFor(() => expect(rowNames()).toHaveLength(1));
    expect(screen.getByText('Preset key')).toBeTruthy();
  });

  it('filters by check status', async () => {
    render(<KeyList />);

    harness.api.useStore.getState().setFilterTestStatus('success');
    await screen.findByText('No keys match your filters');

    harness.api.useStore.getState().setFilterTestStatus('untested');
    await vi.waitFor(() => expect(rowNames()).toHaveLength(2));
  });

  it('filters by expiry verdict', async () => {
    render(<KeyList />);

    harness.api.useStore.getState().setFilterExpiryStatus('expiring');
    await vi.waitFor(() => expect(rowNames()).toHaveLength(1));
    expect(screen.getByText('Edge key')).toBeTruthy();

    harness.api.useStore.getState().setFilterExpiryStatus('valid');
    await vi.waitFor(() => expect(rowNames()).toHaveLength(1));
    expect(screen.getByText('Preset key')).toBeTruthy();

    harness.api.useStore.getState().setFilterExpiryStatus('expired');
    await screen.findByText('No keys match your filters');
  });

  it('searches the name, the description and the provider label', async () => {
    render(<KeyList />);

    harness.api.useStore.getState().setSearchQuery('gateway');
    await vi.waitFor(() => expect(rowNames()).toHaveLength(1));
    expect(screen.getByText('Edge key')).toBeTruthy();

    harness.api.useStore.getState().setSearchQuery('staging');
    await vi.waitFor(() => expect(rowNames()).toHaveLength(1));

    harness.api.useStore.getState().setSearchQuery('nothing');
    await screen.findByText('No keys match your filters');
  });

  it('selects a key when its row is clicked', async () => {
    render(<KeyList />);

    fireEvent.click(rowElements()[0]);

    expect(harness.api.useStore.getState().selectedKeyId).toBe(IDS.key);
  });

  it('edits the secret, not a stray field', () => {
    const onSave = vi.fn(() => true);
    const key = cloneFile().keys[0];
    render(
      <EditKeyDialog
        editingKey={key}
        onClose={() => undefined}
        onSave={onSave}
      />
    );

    const input = screen.getByLabelText(
      'API Key or Token'
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'sk-rotated' } });
    expect(input.value).toBe('sk-rotated');
    // Every field is reachable by its label, not just by placeholder.
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByLabelText('Endpoint')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    expect(onSave).toHaveBeenCalledWith(
      key.id,
      expect.objectContaining({ secret: 'sk-rotated' })
    );
  });

  it('exposes the row selector by name', () => {
    render(<KeyList />);
    expect(
      screen.getByRole('button', { name: 'Select Edge key' })
    ).toBeTruthy();
  });
});
