import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatShortcut,
  formatShortcutCompact,
  readShortcutMap,
} from '../shortcuts';

class MemoryStorage {
  private map = new Map<string, string>();
  constructor(seed?: Record<string, string>) {
    for (const [key, value] of Object.entries(seed ?? {})) {
      this.map.set(key, value);
    }
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatShortcutCompact', () => {
  it('uses Apple modifier symbols on macOS', () => {
    expect(formatShortcutCompact('mod+shift+l', true)).toBe('⌘⇧L');
  });

  it('spells modifiers out elsewhere so the hint stays readable', () => {
    expect(formatShortcutCompact('mod+shift+l', false)).toBe('Ctrl+Shift+L');
  });

  it('describes only the first binding', () => {
    expect(formatShortcutCompact('j,down', true)).toBe('J');
  });

  it('keeps the shortcuts-help exception', () => {
    expect(formatShortcutCompact('shift+slash', true)).toBe('?');
  });

  it('reports a cleared binding instead of printing an empty hint', () => {
    expect(formatShortcutCompact('', true)).toBe('Disabled');
  });
});

describe('formatShortcut', () => {
  it('still renders the full multi-binding description', () => {
    expect(formatShortcut('j,down')).toContain(' / ');
  });
});

describe('readShortcutMap', () => {
  it('drops values that are not bindings instead of crashing the shell', () => {
    vi.stubGlobal(
      'localStorage',
      new MemoryStorage({
        'keya-shortcuts': JSON.stringify({
          'search.focus': 5,
          'not.an.action': 'x',
          'vault.lock': 'mod+l',
        }),
      })
    );

    expect(readShortcutMap()).toEqual({ 'vault.lock': 'mod+l' });
  });

  it('ignores unreadable JSON', () => {
    vi.stubGlobal(
      'localStorage',
      new MemoryStorage({ 'keya-shortcuts': '{not json' })
    );
    expect(readShortcutMap()).toEqual({});
  });
});
