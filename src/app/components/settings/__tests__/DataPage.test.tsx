/* @vitest-environment jsdom */
import type { ReactNode } from 'react';
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

const biometric = vi.hoisted(() => ({
  removeBiometric: vi.fn(async () => undefined),
}));

vi.mock('@/app/lib/biometric', () => ({
  isBiometricSupported: () => true,
  isBiometricRegistered: async () => false,
  registerBiometric: async () => undefined,
  removeBiometric: biometric.removeBiometric,
}));

const linkTo = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', async () => {
  const { createElement } = await import('react');
  return {
    Link: (props: {
      to: string;
      params?: Record<string, string>;
      children?: ReactNode;
      [key: string]: unknown;
    }) => {
      linkTo({ to: props.to, params: props.params });
      const href = props.to.replace('$slug', props.params?.slug ?? '');
      const { to: _to, params: _params, children, ...rest } = props;
      return createElement('a', { ...rest, href }, children);
    },
  };
});

const holder = vi.hoisted(() => ({ store: null as unknown }));

vi.mock('../../../store/useStore', () => ({
  get useStore() {
    return holder.store;
  },
}));

const { DataPage } = await import('../DataPage');

let harness: ComponentHarness;

beforeEach(async () => {
  biometric.removeBiometric.mockClear();
  harness = await buildComponentStore({ payload: cloneFile() });
  holder.store = harness.api.useStore;
});

describe('forgetting this device', () => {
  it('drops the check results and the biometric binding, not the file', async () => {
    const binding = (await harness.vault.session.bindings()).get(IDS.key);
    expect(binding).toBeTruthy();
    await harness.vault.local.recordObservation({
      observation_id: 'obs-forget',
      vault_id: IDS.vault,
      key_id: IDS.key,
      binding: (binding as { binding: string }).binding,
      kind: 'request',
      outcome: 'ok',
      detail_code: null,
      http_status: 200,
      latency_ms: 1,
      started_at: '2026-03-01T12:00:00.000Z',
      finished_at: '2026-03-01T12:00:00.000Z',
    });
    await harness.api.useStore.getState().refresh();

    render(<DataPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Forget device data' })
    );

    await waitFor(async () => {
      expect(
        await harness.vault.local.listObservations(IDS.vault, IDS.key)
      ).toEqual([]);
    });
    expect(biometric.removeBiometric).toHaveBeenCalledWith(IDS.vault);
    // The payload is untouched: this is device state, not a delete.
    expect(harness.api.useStore.getState().hasUnsavedChanges).toBe(false);
    expect(currentView(harness).file.vault.name).toBe('Work');
  });
});

describe('leaving for the help pages', () => {
  it('navigates in-app instead of reloading the unlocked vault away', () => {
    linkTo.mockClear();
    render(<DataPage />);

    // A plain `<a href>` would reload the document, and no unlocked session
    // survives a reload: the reader would come back to the welcome screen and
    // have to type the master password again.
    expect(linkTo).toHaveBeenCalledWith({
      to: '/docs/$slug',
      params: { slug: 'backup' },
    });
    const link = screen.getByRole('link', { name: 'Backup & Restore' });
    expect(link.getAttribute('href')).toBe('/docs/backup');
  });
});
