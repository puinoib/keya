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

const { ProvidersPage } = await import('../ProvidersPage');

let harness: ComponentHarness;

beforeEach(async () => {
  const payload = cloneFile();
  // The form only accepts a `/`-prefixed or absolute check path, so the fixture
  // starts without a probe; the check editor is exercised by its own tests.
  payload.providers[0].probe = null;
  harness = await buildComponentStore({ payload });
  holder.store = harness.api.useStore;
  holder.api = harness.api;
});

function providerNames(): string[] {
  return (
    harness.api.useStore.getState().view?.file.providers.map((p) => p.name) ??
    []
  );
}

async function submitCustomForm(name: string, endpoint: string) {
  fireEvent.change(screen.getByPlaceholderText('Service name'), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText('https://api.example.com/v1'), {
    target: { value: endpoint },
  });

  const cancel = screen.getByRole('button', { name: /Cancel/ });
  const row = cancel.parentElement!;
  const submit = row.querySelector('button')!;
  fireEvent.click(submit);
}

describe('ProvidersPage', () => {
  it('lists the presets and the vault custom provider', () => {
    render(<ProvidersPage />);

    expect(screen.getByText('OpenAI')).toBeTruthy();
    expect(screen.getByText('Edge Gateway')).toBeTruthy();
    expect(screen.getByText(/Custom Providers/i)).toBeTruthy();
    expect(screen.getByText('No check configured')).toBeTruthy();
  });

  it('shows the base endpoint of presets and custom providers', () => {
    render(<ProvidersPage />);

    // A preset's address comes from its recipe; a custom one from the vault.
    expect(screen.getByText('https://api.openai.com/v1')).toBeTruthy();
    expect(screen.getByText('https://edge.example.com/v1')).toBeTruthy();
  });

  it('adds a custom provider through the form', async () => {
    render(<ProvidersPage />);

    fireEvent.click(
      screen.getByRole('button', { name: /Add Custom Provider/ })
    );
    await submitCustomForm('Local probe', 'http://127.0.0.1:8799');

    await waitFor(() => expect(providerNames()).toContain('Local probe'));
    const added = harness.api.useStore
      .getState()
      .view?.file.providers.find((provider) => provider.name === 'Local probe');
    expect(added?.default_endpoint).toBe('http://127.0.0.1:8799');
    expect(added?.probe).toBeNull();
  });

  it('renames a custom provider without changing its id', async () => {
    render(<ProvidersPage />);
    const before = harness.api.useStore
      .getState()
      .view?.file.providers.find(
        (provider) => provider.name === 'Edge Gateway'
      );
    expect(before?.id).toBe(IDS.providerId);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Edge Gateway' }));
    const nameInput = screen.getByDisplayValue('Edge Gateway');
    fireEvent.change(nameInput, { target: { value: 'Edge Gateway v2' } });

    const cancel = screen.getByRole('button', { name: /Cancel/ });
    fireEvent.click(cancel.parentElement!.querySelector('button')!);

    await waitFor(() => expect(providerNames()).toContain('Edge Gateway v2'));
    const after = harness.api.useStore
      .getState()
      .view?.file.providers.find(
        (provider) => provider.name === 'Edge Gateway v2'
      );
    expect(after?.id).toBe(IDS.providerId);
    expect(providerNames()).not.toContain('Edge Gateway');
  });

  it('gives every provider switch an accessible name', () => {
    render(<ProvidersPage />);

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
    // The row carries no <label>, so an unnamed switch is announced as just
    // "switch" twenty-odd times in a row.
    for (const control of switches) {
      expect(control.getAttribute('aria-label')).toMatch(/ provider$/);
    }
    expect(
      screen.getByRole('switch', { name: 'OpenAI provider' })
    ).toBeTruthy();
  });
});
