/* @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
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
