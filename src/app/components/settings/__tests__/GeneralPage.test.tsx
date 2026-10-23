/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneFile, IDS } from '../../../../core/__tests__/fixtures';
import {
  buildComponentStore,
  currentView,
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

// Device storage the page reads: the folder name, and the biometric record it
// deletes when the user forgets this device's data.
vi.mock('@/app/lib/storage', () => ({
  FileStorage: { getWorkspaceName: async () => 'Keya' },
}));

const biometric = vi.hoisted(() => ({
  removeBiometric: vi.fn(async () => undefined),
}));

vi.mock('@/app/lib/biometric', () => ({
  isBiometricSupported: () => true,
  isBiometricRegistered: async () => false,
  registerBiometric: async () => undefined,
  removeBiometric: biometric.removeBiometric,
}));

const holder = vi.hoisted(() => ({ store: null as unknown }));

vi.mock('../../../store/useStore', () => ({
  get useStore() {
    return holder.store;
  },
}));

const { GeneralPage } = await import('../GeneralPage');

let harness: ComponentHarness;

beforeEach(async () => {
  biometric.removeBiometric.mockClear();
  harness = await buildComponentStore({ payload: cloneFile() });
  holder.store = harness.api.useStore;
});

function nameField(): HTMLInputElement {
  return screen.getByPlaceholderText('My Vault') as HTMLInputElement;
}

describe('vault name field', () => {
  it('keeps the typed text while the view is rebuilt', async () => {
    render(<GeneralPage />);
    const input = nameField();
    expect(input.value).toBe('Work');

    fireEvent.focus(input);
    // The store republishes the view asynchronously, so a field bound straight
    // to it would flip back to the previous name after each of these.
    for (const value of ['W', 'Wo', 'Work 2']) {
      fireEvent.change(input, { target: { value } });
      expect(input.value).toBe(value);
    }

    fireEvent.blur(input);
    await waitFor(() =>
      expect(currentView(harness).file.vault.name).toBe('Work 2')
    );
    expect(input.value).toBe('Work 2');
  });

  it('shows the stored name again when the edit is refused', async () => {
    render(<GeneralPage />);
    const input = nameField();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    // An empty name never reaches the payload, so nothing re-renders it.
    expect(input.value).toBe('');

    fireEvent.blur(input);
    await waitFor(() => expect(input.value).toBe('Work'));
    expect(currentView(harness).file.vault.name).toBe('Work');
  });

  it('drops edge whitespace on blur, as the payload does', () => {
    render(<GeneralPage />);
    const input = nameField();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '  Work  ' } });
    fireEvent.blur(input);

    expect(currentView(harness).file.vault.name).toBe('Work');
    expect(input.value).toBe('Work');
  });
});

describe('where the vault lives', () => {
  it('names the folder and the file, not a path the browser cannot read', async () => {
    render(<GeneralPage />);
    expect(await screen.findByText('Keya / work.keya')).toBeTruthy();
  });
});

describe('changing the master password', () => {
  it('opens a dialog instead of unfolding a form in the list', async () => {
    render(<GeneralPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(await screen.findByText('Change master password')).toBeTruthy();
    expect(screen.getByPlaceholderText('Current password')).toBeTruthy();
    expect(screen.getByPlaceholderText('Confirm new password')).toBeTruthy();
  });
});

describe('forgetting this device', () => {
  it('drops the standing approval and the biometric binding, not the file', async () => {
    await harness.vault.local.putGrant({
      fingerprint: 'f'.repeat(64),
      vault_id: IDS.vault,
      origin: 'https://api.example.com',
      path: '/v1/models',
      approved_at: '2026-03-01T00:00:00.000Z',
    });

    render(<GeneralPage />);
    expect(await screen.findByText('Approved destinations')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Forget device data' })
    );

    await waitFor(async () => {
      expect(await harness.vault.local.listGrants()).toEqual([]);
    });
    expect(biometric.removeBiometric).toHaveBeenCalledWith(IDS.vault);
    // The payload is untouched: this is device state, not a delete.
    expect(currentView(harness).file).toEqual(
      harness.vault.opened.vault.getPayload()
    );
  });
});
