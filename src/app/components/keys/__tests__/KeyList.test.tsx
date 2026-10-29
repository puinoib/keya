/* @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  navigate.mockReset();
  const payload = cloneFile();
  payload.keys[0].expiry = { kind: 'date', value: '2026-03-05' };
  payload.keys.push(
    {
      ...structuredClone(payload.keys[0]),
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Retired key',
      description: 'retired',
      secret: 'sk-retired',
      provider_id: 'preset:openai',
      endpoint: 'https://api.openai.com/v1',
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

  it('searches archived keys from the active list', async () => {
    render(<KeyList />);
    expect(screen.queryByText('Retired key')).toBeNull();

    harness.api.useStore.getState().setSearchQuery('retired');

    await screen.findByText('Retired key');
    expect(rowNames()).toHaveLength(1);
  });

  it('searches active keys from the archived list', async () => {
    harness.api.useStore.getState().setShowArchived(true);
    render(<KeyList />);
    expect(screen.queryByText('Edge key')).toBeNull();

    harness.api.useStore.getState().setSearchQuery('edge');

    await screen.findByText('Edge key');
    expect(rowNames()).toHaveLength(1);
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

  it('keeps typed input when the provider list is rebuilt', async () => {
    const key = cloneFile().keys[0];
    render(
      <EditKeyDialog
        editingKey={key}
        onClose={() => undefined}
        onSave={() => true}
      />
    );

    const name = screen.getByLabelText('Name') as HTMLInputElement;
    fireEvent.change(name, { target: { value: 'Typed while open' } });
    expect(name.value).toBe('Typed while open');

    harness.api.useStore.getState().updateSettings({
      providers: [{ name: 'Acme', endpoint: 'https://api.acme.test' }],
    });
    await vi.waitFor(() =>
      expect(
        harness.api.useStore
          .getState()
          .view?.file.providers.some((p) => p.name === 'Acme')
      ).toBe(true)
    );

    // A refresh rebuilt the provider list; the dialog must not reset itself.
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'Typed while open'
    );
  });

  it('exposes the row selector by name', () => {
    render(<KeyList />);
    expect(
      screen.getByRole('button', { name: 'Select Edge key' })
    ).toBeTruthy();
  });
});

describe('closing the detail panel', () => {
  it('leaves Escape to the add form while it is open', () => {
    render(<KeyList />);
    act(() => {
      harness.api.useStore.getState().setSelectedKeyId(IDS.key);
      harness.api.useStore.getState().beginAddKeyFlow();
    });

    // Escape closes the dialog. One press must not also drop the selection
    // behind it, or closing a dialog would silently take the reader back to a
    // list with no key open.
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });
    expect(harness.api.useStore.getState().selectedKeyId).toBe(IDS.key);

    act(() => {
      harness.api.useStore.getState().setShowAddForm(false);
    });
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });
    expect(harness.api.useStore.getState().selectedKeyId).toBeNull();
  });

  it('leaves Escape to a popup that is on screen', () => {
    render(<KeyList />);
    act(() => {
      harness.api.useStore.getState().setSelectedKeyId(IDS.key);
    });

    // A rendered popup owns the key.
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    document.body.append(menu);
    try {
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      });
      expect(harness.api.useStore.getState().selectedKeyId).toBe(IDS.key);
    } finally {
      menu.remove();
    }
  });

  it('ignores a closed popup that Base UI left mounted', () => {
    render(<KeyList />);
    act(() => {
      harness.api.useStore.getState().setSelectedKeyId(IDS.key);
    });

    // After its first open, a Base UI Select stays in the DOM under a hidden
    // ancestor. Counting roles alone would make Escape unusable for the rest
    // of the session once any filter had been opened.
    const wrapper = document.createElement('div');
    wrapper.hidden = true;
    const listbox = document.createElement('div');
    listbox.setAttribute('role', 'listbox');
    wrapper.append(listbox);
    document.body.append(wrapper);
    try {
      act(() => {
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      });
      expect(harness.api.useStore.getState().selectedKeyId).toBeNull();
    } finally {
      wrapper.remove();
    }
  });
});
