import { describe, expect, it } from 'vitest';
import { formatShortcut, formatShortcutCompact } from '../shortcuts';

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
