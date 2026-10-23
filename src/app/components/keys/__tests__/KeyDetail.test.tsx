/* @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
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

const { KeyDetail } = await import('../KeyDetail');

let harness: ComponentHarness;

beforeEach(async () => {
  const payload = cloneFile();
  // A provider that has a usage source, so the panel's variable block renders.
  payload.keys[0].provider_id = 'preset:opencode-go';
  payload.keys[0].endpoint = 'https://opencode.ai/zen/go/v1';
  harness = await buildComponentStore({ payload });
  holder.store = harness.api.useStore;
  holder.api = harness.api;
  harness.api.useStore.getState().setSelectedKeyId(IDS.key);
});

function scrollArea(): HTMLElement {
  const node = document.querySelector<HTMLElement>(
    '[class*="overflow-y-auto"]'
  );
  if (!node) throw new Error('detail panel has no scroll area');
  return node;
}

describe('KeyDetail layout', () => {
  it('keeps the identity out of the scrolling details', () => {
    render(<KeyDetail />);

    expect(scrollArea().contains(screen.getByText('Edge key'))).toBe(false);
    expect(screen.getByText('OpenCode Go')).toBeTruthy();
  });

  it('puts the provider-specific usage block after the stable fields', () => {
    render(<KeyDetail />);
    const body = scrollArea().textContent ?? '';

    expect(body).toContain('Endpoint');
    expect(body).toContain('Check usage');
    expect(body.indexOf('Endpoint')).toBeLessThan(body.indexOf('Check usage'));
    // The actions stay pinned below the scroll area.
    expect(scrollArea().contains(screen.getByText(/Test key/))).toBe(false);
  });
});

describe('KeyDetail field structure', () => {
  async function recordCheck() {
    const binding = currentView(harness).bindings.get(IDS.key)?.binding;
    expect(binding).toBeTruthy();
    await harness.vault.local.recordObservation({
      observation_id: 'obs-detail-1',
      vault_id: harness.vault.payload.vault.id,
      key_id: IDS.key,
      binding: binding as string,
      kind: 'request',
      outcome: 'ok',
      detail_code: null,
      http_status: 200,
      latency_ms: 231,
      started_at: '2026-02-28T10:00:00.000Z',
      finished_at: '2026-02-28T10:00:00.000Z',
    });
    await harness.api.useStore.getState().refresh();
  }

  it('marks the key with the same status dot the list uses', async () => {
    await recordCheck();

    render(<KeyDetail />);

    // The verdict moved out of the header badges and into the dot's tooltip.
    // The preset proves reachability, not credential validity.
    const dot = screen.getByRole('button', { name: /^Reachable/ });
    expect(dot.textContent).toBe('');
    expect(dot.firstElementChild?.className).toContain('bg-success-bright');
    expect(screen.queryByText(/Reachable/)).toBeNull();
  });

  it('explains an unchecked key on its dot', () => {
    render(<KeyDetail />);

    expect(
      screen.getByRole('button', { name: /^Untested: no check has run/ })
    ).toBeTruthy();
  });

  it('keeps when the check ran and how long it took as fields', async () => {
    await recordCheck();

    render(<KeyDetail />);

    expect(screen.getByText('Last tested')).toBeTruthy();
    expect(screen.getByText('Latency')).toBeTruthy();
    expect(screen.getByText('231ms')).toBeTruthy();
    // Timestamps stay in the field list rather than behind a disclosure.
    expect(screen.getByText('Created')).toBeTruthy();
    expect(screen.getByText('Updated')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Details/ })).toBeNull();
  });

  it('copies the endpoint from its own field', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<KeyDetail />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy endpoint' }));

    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('https://opencode.ai/zen/go/v1')
    );
  });

  it('filters the list by the group and closes the panel', () => {
    render(<KeyDetail />);
    fireEvent.click(screen.getByRole('button', { name: /Production/ }));

    expect(harness.api.useStore.getState().filterGroupId).toBe(IDS.group);
    expect(harness.api.useStore.getState().selectedKeyId).toBeNull();
  });

  it('filters the list by the provider from the same row', () => {
    render(<KeyDetail />);
    fireEvent.click(screen.getByRole('button', { name: /OpenCode Go/ }));

    expect(harness.api.useStore.getState().filterProvider).toBe('OpenCode Go');
    expect(harness.api.useStore.getState().selectedKeyId).toBeNull();
  });

  it('keeps an ungrouped key reachable through the same row', async () => {
    const payload = cloneFile();
    payload.keys[0].provider_id = 'preset:opencode-go';
    payload.keys[0].endpoint = 'https://opencode.ai/zen/go/v1';
    payload.keys[0].group_id = null;
    const fresh = await buildComponentStore({ payload });
    holder.store = fresh.api.useStore;
    holder.api = fresh.api;
    fresh.api.useStore.getState().setSelectedKeyId(IDS.key);

    render(<KeyDetail />);
    fireEvent.click(screen.getByRole('button', { name: /Ungrouped/ }));

    expect(fresh.api.useStore.getState().filterGroupId).toBe('__ungrouped__');
    expect(fresh.api.useStore.getState().selectedKeyId).toBeNull();
  });
});
