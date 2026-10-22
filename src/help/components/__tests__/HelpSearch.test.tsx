/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { HelpSearch } from '../HelpSearch';
import type { HelpDocument } from '../../types';

const documents: HelpDocument[] = [
  {
    slug: 'security',
    title: 'Security',
    description: 'Encryption and limits',
    content: 'Encryption protects stored vault contents.',
    order: 1,
  },
  {
    slug: 'backup',
    title: 'Backup',
    description: 'Recovery',
    content: 'Keep encrypted copies.',
    order: 2,
  },
];

let container: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  consoleError.mockRestore();
  vi.unstubAllGlobals();
});

describe('HelpSearch', () => {
  it('does not enter an infinite update loop on initial render', async () => {
    await act(async () => {
      root.render(<HelpSearch documents={documents} onNavigate={vi.fn()} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const messages = consoleError.mock.calls.map((call: unknown[]) =>
      String(call[0])
    );
    expect(
      messages.some((message: unknown) =>
        String(message).includes('Maximum update depth')
      )
    ).toBe(false);
    expect(container.querySelector('input')).not.toBeNull();
  });

  it('shows matching documents when the query changes', async () => {
    await act(async () => {
      root.render(<HelpSearch documents={documents} onNavigate={vi.fn()} />);
    });

    const input = container.querySelector('input')!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )!.set!;

    await act(async () => {
      valueSetter.call(input, 'security');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(container.textContent).toContain('Security');
    expect(
      consoleError.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('Maximum update depth')
      )
    ).toBe(false);
  });

  it('navigates to the chosen document and clears the query', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root.render(<HelpSearch documents={documents} onNavigate={onNavigate} />);
    });

    const input = container.querySelector('input')!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )!.set!;
    await act(async () => {
      valueSetter.call(input, 'security');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const result = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Security')
    );
    expect(result).toBeTruthy();
    await act(async () => {
      result!.click();
    });

    expect(onNavigate).toHaveBeenCalledWith('security');
    expect(input.value).toBe('');
  });

  it('shows an empty state when nothing matches', async () => {
    await act(async () => {
      root.render(<HelpSearch documents={documents} onNavigate={vi.fn()} />);
    });

    const input = container.querySelector('input')!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )!.set!;
    await act(async () => {
      valueSetter.call(input, 'zzzzz');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('No matching results');
  });
});
