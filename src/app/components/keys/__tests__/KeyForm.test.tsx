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

const testDraft = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api-tester', async () => {
  const actual = await vi.importActual<typeof import('@/app/lib/api-tester')>(
    '@/app/lib/api-tester'
  );
  // Only the draft path is replaced: `checkKind` decides the button label.
  return { ...actual, ApiTester: { testDraft } };
});

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  })
);

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const holder = vi.hoisted(() => ({ store: null as unknown }));

vi.mock('../../../store/useStore', () => ({
  get useStore() {
    return holder.store;
  },
}));

const { KeyForm } = await import('../KeyForm');

let harness: ComponentHarness;

beforeEach(async () => {
  testDraft.mockReset();
  toastMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  harness = await buildComponentStore({ payload: cloneFile() });
  holder.store = harness.api.useStore;
});

function secretField(): HTMLElement {
  // The label also names the field's wrapper, so ask for the control itself.
  return screen.getByLabelText(/API Key or Token/, { selector: 'textarea' });
}

function testButton(): HTMLElement {
  return screen.getByRole('button', { name: /Test key/ });
}

describe('testing a draft before it is saved', () => {
  it('reports a result that still describes the form', async () => {
    testDraft.mockResolvedValue({
      success: false,
      latency_ms: 12,
      error: 'credential_rejected',
      kind: 'request',
    });

    render(<KeyForm open onClose={() => undefined} />);
    fireEvent.change(secretField(), { target: { value: 'sk-synthetic' } });
    fireEvent.click(testButton());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(testDraft).toHaveBeenCalledWith(
      expect.objectContaining({ secret: 'sk-synthetic' })
    );
  });

  it('drops a result whose credential changed while the request was out', async () => {
    let release!: (value: unknown) => void;
    testDraft.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    render(<KeyForm open onClose={() => undefined} />);
    fireEvent.change(secretField(), { target: { value: 'sk-first' } });
    fireEvent.click(testButton());

    // The user rotates the credential while the request is in flight.
    fireEvent.change(secretField(), { target: { value: 'sk-second' } });
    release({
      success: false,
      latency_ms: 12,
      error: 'credential_rejected',
      kind: 'request',
    });

    // The spinner clears, so the late answer was handled …
    await waitFor(() =>
      expect(testButton().hasAttribute('disabled')).toBe(false)
    );
    // … but it must not be announced: it describes `sk-first`, and the form
    // now holds `sk-second`.
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
