/**
 * Test setup shared by the DOM tests.
 *
 * jsdom is missing a few browser APIs the component library reaches for; the
 * node tests never touch any of this.
 */

import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const scope = globalThis as unknown as Record<string, unknown>;
  scope.ResizeObserver ??= ResizeObserver;

  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  })) as unknown as typeof window.matchMedia;

  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.PointerEvent ??= window.MouseEvent as unknown as typeof PointerEvent;

  afterEach(async () => {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
  });
}
