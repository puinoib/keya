/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneFile } from '../../../../core/__tests__/fixtures';
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

vi.mock('@/app/lib/biometric', () => ({
  isBiometricSupported: () => true,
  isBiometricRegistered: async () => false,
  registerBiometric: async () => undefined,
  removeBiometric: async () => undefined,
}));

const holder = vi.hoisted(() => ({ store: null as unknown }));

vi.mock('../../../store/useStore', () => ({
  get useStore() {
    return holder.store;
  },
}));

const { VaultPage } = await import('../VaultPage');

let harness: ComponentHarness;

beforeEach(async () => {
  harness = await buildComponentStore({ payload: cloneFile() });
  holder.store = harness.api.useStore;
});

function nameField(): HTMLInputElement {
  return screen.getByPlaceholderText('My Vault') as HTMLInputElement;
}

describe('vault name field', () => {
  it('keeps the typed text while the view is rebuilt', async () => {
    render(<VaultPage />);
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
    render(<VaultPage />);
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
    render(<VaultPage />);
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
    render(<VaultPage />);
    expect(await screen.findByText('Keya/work.keya')).toBeTruthy();
  });
});

describe('changing the master password', () => {
  it('opens a dialog instead of unfolding a form in the list', async () => {
    render(<VaultPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(await screen.findByText('Change master password')).toBeTruthy();
    // The password boxes have no visible label, so each needs an aria-label;
    // the placeholder alone is not an accessible name.
    expect(screen.getByLabelText('Current password')).toBeTruthy();
    expect(screen.getByLabelText('New password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm new password')).toBeTruthy();
  });
});
