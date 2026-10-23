/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { UsageEntry } from '../../../lib/usage';
import { UsageCard } from '../UsageCard';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function entry(overrides: Partial<UsageEntry> = {}): UsageEntry {
  return {
    state: 'ok',
    vault_id: 'vault-1',
    checked_at: new Date().toISOString(),
    ...overrides,
  };
}

async function render(
  props: Partial<React.ComponentProps<typeof UsageCard>> = {}
) {
  const onRefresh = vi.fn();
  await act(async () => {
    root.render(
      <UsageCard
        provider="OpenCode Go"
        entry={undefined}
        onRefresh={onRefresh}
        {...props}
      />
    );
  });
  return { view: container, onRefresh };
}

async function expand(view: HTMLElement) {
  const toggle = view.querySelector('button[aria-expanded]');
  expect(toggle).toBeTruthy();
  expect(toggle?.getAttribute('aria-expanded')).toBe('false');
  await act(async () => {
    toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(toggle?.getAttribute('aria-expanded')).toBe('true');
}

describe('UsageCard', () => {
  it('offers a query instead of guessing when nothing was asked yet', async () => {
    const { view } = await render();

    expect(view.textContent).toContain('Check usage');
    expect(view.textContent).not.toMatch(/% used/);
    expect(view.textContent).toContain('Nothing read yet');

    await expand(view);
    expect(view.textContent).toMatch(/Nothing is stored in this vault/);
  });

  it('renders the allowance windows the provider reported', async () => {
    const { view } = await render({
      now: new Date('2026-10-20T12:00:00.000Z'),
      entry: entry({
        checked_at: '2026-10-20T12:00:00.000Z',
        snapshot: {
          provider: 'OpenCode Go',
          checked_at: '2026-10-20T12:00:00.000Z',
          windows: [
            {
              id: 'weekly',
              label: '7 days',
              percent_used: 62,
              resets_at: '2026-10-20T14:00:00.000Z',
            },
          ],
        },
      }),
    });

    expect(view.textContent).toContain('7 days');
    expect(view.textContent).toContain('62% used');
    expect(view.textContent).toContain('resets in 2h');
    expect(view.textContent).toContain('Refresh');

    await expand(view);
    expect(view.textContent).toContain('Read from OpenCode Go just now');
  });

  it('shows a cached figure as history once it is old', async () => {
    const checkedAt = '2026-10-20T09:00:00.000Z';
    const { view } = await render({
      now: new Date('2026-10-20T12:00:00.000Z'),
      entry: entry({
        checked_at: checkedAt,
        snapshot: {
          provider: 'OpenCode Go',
          checked_at: checkedAt,
          windows: [
            {
              id: 'weekly',
              label: '7 days',
              percent_used: 88,
              resets_at: null,
            },
          ],
        },
      }),
    });

    expect(view.textContent).toContain('88% used');
    // A stale figure keeps no fresh colour claim, even before expanding.
    expect(view.innerHTML).not.toContain('text-danger');

    await expand(view);
    expect(view.textContent).toContain('Last checked 3h ago');
    expect(view.textContent).toMatch(/may have moved since/);
  });

  it('shows why a reply could not be used rather than zero usage', async () => {
    const { view } = await render({
      entry: entry({
        state: 'failed',
        failure: {
          kind: 'forbidden',
          message: 'OpenCode Go subscription required.',
        },
      }),
    });

    expect(view.textContent).toContain('This key cannot read usage');
    expect(view.textContent).not.toMatch(/% used/);

    await expand(view);
    expect(view.textContent).toContain('OpenCode Go subscription required.');
  });

  it('asks the provider only when the query button is pressed', async () => {
    const { view, onRefresh } = await render();
    const button = view.querySelector('button')!;

    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables the button while a query is in flight', async () => {
    const { view } = await render({ entry: entry({ state: 'loading' }) });
    const button = view.querySelector('button') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(view.textContent).toContain('Checking');
  });

  it('explains a provider that has no usage endpoint', async () => {
    const { view } = await render({ provider: 'OpenCode Zen' });

    expect(view.textContent).toContain('Usage');
    expect(view.textContent).toMatch(/no usage or balance endpoint/i);
    expect(view.querySelector('button')).toBeNull();
  });

  it('stays out of the way for providers Keya knows nothing about', async () => {
    const { view } = await render({ provider: 'OpenAI' });
    expect(view.textContent).toBe('');
  });
});

describe('UsageCard disclosure', () => {
  it('keeps the per-window detail behind the summary', async () => {
    const { view } = await render({
      now: new Date('2026-10-20T12:00:00.000Z'),
      entry: entry({
        checked_at: '2026-10-20T12:00:00.000Z',
        snapshot: {
          provider: 'OpenCode Go',
          checked_at: '2026-10-20T12:00:00.000Z',
          windows: [
            {
              id: 'weekly',
              label: '7 days',
              percent_used: 62,
              resets_at: '2026-10-20T14:00:00.000Z',
            },
            {
              id: 'monthly',
              label: 'Month',
              percent_used: 10,
              resets_at: null,
            },
          ],
        },
      }),
    });

    // The detail is mounted for the height animation, but hidden from readers
    // and clipped to nothing until the disclosure is opened.
    const detail = view.querySelector('[data-usage-detail]');
    expect(detail?.getAttribute('aria-hidden')).toBe('true');
    expect(detail?.className).toContain('grid-rows-[0fr]');

    await expand(view);
    expect(detail?.getAttribute('aria-hidden')).toBe('false');
    expect(detail?.className).toContain('grid-rows-[1fr]');
    expect(view.textContent).toContain('10% used');
    expect(view.textContent).toContain('7 days is closest to its limit');
  });
});
