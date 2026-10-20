/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { UsageEntry } from '../../../lib/usage';
import { UsageCard } from '../UsageCard';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
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

describe('UsageCard', () => {
  it('offers a query instead of guessing when nothing was asked yet', async () => {
    const { view } = await render();

    expect(view.textContent).toContain('Check usage');
    expect(view.textContent).not.toMatch(/% used/);
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
    expect(view.textContent).toContain('Read from OpenCode Go just now');
    expect(view.textContent).toContain('Refresh');
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
    expect(view.textContent).toContain('OpenCode Go subscription required.');
    expect(view.textContent).not.toMatch(/% used/);
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
