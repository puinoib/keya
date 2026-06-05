export type ShortcutActionId =
  | 'search.focus'
  | 'key.add'
  | 'vault.lock'
  | 'shortcuts.help'
  | 'nav.keys'
  | 'nav.inbox'
  | 'nav.settings'
  | 'key.next'
  | 'key.previous'
  | 'key.open'
  | 'key.copy'
  | 'key.edit'
  | 'key.test'
  | 'key.reveal'
  | 'key.delete'
  | 'key.closeDetail';

export type ShortcutScope = 'global' | 'navigation' | 'keys';

export interface ShortcutDefinition {
  id: ShortcutActionId;
  label: string;
  description: string;
  scope: ShortcutScope;
  defaultKeys: string;
  customizable: boolean;
}

export type ShortcutMap = Partial<Record<ShortcutActionId, string>>;

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: 'search.focus',
    label: 'Focus Search',
    description: 'Move focus to the key search box',
    scope: 'global',
    defaultKeys: 'slash',
    customizable: true,
  },
  {
    id: 'key.add',
    label: 'Add Key',
    description: 'Open the add API key form',
    scope: 'global',
    defaultKeys: 'n',
    customizable: true,
  },
  {
    id: 'vault.lock',
    label: 'Lock Vault',
    description: 'Lock the current vault',
    scope: 'global',
    defaultKeys: 'mod+shift+l',
    customizable: true,
  },
  {
    id: 'shortcuts.help',
    label: 'Keyboard Shortcuts',
    description: 'Show this shortcut reference',
    scope: 'global',
    defaultKeys: 'shift+slash',
    customizable: true,
  },
  {
    id: 'nav.keys',
    label: 'Go to Keys',
    description: 'Navigate to the keys page',
    scope: 'navigation',
    defaultKeys: 'mod+1',
    customizable: true,
  },
  {
    id: 'nav.inbox',
    label: 'Go to Inbox',
    description: 'Navigate to the inbox page',
    scope: 'navigation',
    defaultKeys: 'mod+2',
    customizable: true,
  },
  {
    id: 'nav.settings',
    label: 'Go to Settings',
    description: 'Navigate to settings',
    scope: 'navigation',
    defaultKeys: 'mod+3',
    customizable: true,
  },
  {
    id: 'key.next',
    label: 'Next Key',
    description: 'Select the next visible key',
    scope: 'keys',
    defaultKeys: 'j,down',
    customizable: true,
  },
  {
    id: 'key.previous',
    label: 'Previous Key',
    description: 'Select the previous visible key',
    scope: 'keys',
    defaultKeys: 'k,up',
    customizable: true,
  },
  {
    id: 'key.open',
    label: 'Open Key Detail',
    description: 'Open the selected key detail panel',
    scope: 'keys',
    defaultKeys: 'enter',
    customizable: true,
  },
  {
    id: 'key.copy',
    label: 'Copy Selected Key',
    description: 'Copy the selected API key value',
    scope: 'keys',
    defaultKeys: 'c',
    customizable: true,
  },
  {
    id: 'key.edit',
    label: 'Edit Selected Key',
    description: 'Open the edit form for the selected key',
    scope: 'keys',
    defaultKeys: 'e',
    customizable: true,
  },
  {
    id: 'key.test',
    label: 'Test Selected Key',
    description: 'Run a connection test for the selected key',
    scope: 'keys',
    defaultKeys: 't',
    customizable: true,
  },
  {
    id: 'key.reveal',
    label: 'Reveal Selected Key',
    description: 'Toggle the selected key value in the detail panel',
    scope: 'keys',
    defaultKeys: 'v',
    customizable: true,
  },
  {
    id: 'key.delete',
    label: 'Delete Selected Key',
    description: 'Ask to delete the selected key',
    scope: 'keys',
    defaultKeys: 'delete',
    customizable: true,
  },
  {
    id: 'key.closeDetail',
    label: 'Close Detail',
    description: 'Close the key detail panel',
    scope: 'keys',
    defaultKeys: 'esc',
    customizable: true,
  },
];

export const DEFAULT_SHORTCUTS = SHORTCUT_DEFINITIONS.reduce<
  Record<ShortcutActionId, string>
>(
  (acc, shortcut) => {
    acc[shortcut.id] = shortcut.defaultKeys;
    return acc;
  },
  {} as Record<ShortcutActionId, string>
);

export function getShortcutKeys(
  shortcuts: ShortcutMap | undefined,
  actionId: ShortcutActionId
): string {
  return shortcuts?.[actionId] ?? DEFAULT_SHORTCUTS[actionId];
}

export function getResolvedShortcuts(
  shortcuts: ShortcutMap | undefined
): Record<ShortcutActionId, string> {
  return SHORTCUT_DEFINITIONS.reduce<Record<ShortcutActionId, string>>(
    (acc, shortcut) => {
      acc[shortcut.id] = getShortcutKeys(shortcuts, shortcut.id);
      return acc;
    },
    {} as Record<ShortcutActionId, string>
  );
}

export function formatShortcut(keys: string): string {
  if (!keys) return 'Disabled';
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform);

  return keys
    .split(',')
    .map((combo) => {
      const trimmedCombo = combo.trim();
      if (trimmedCombo === 'shift+slash') return '?';
      return trimmedCombo
        .split('+')
        .map((part) => formatShortcutPart(part, isMac))
        .join(isMac ? '' : '+');
    })
    .join(' / ');
}

function formatShortcutPart(part: string, isMac: boolean): string {
  const normalized = part.toLowerCase();
  if (normalized === 'mod') return isMac ? '⌘' : 'Ctrl';
  if (normalized === 'ctrl') return isMac ? '⌃' : 'Ctrl';
  if (normalized === 'shift') return isMac ? '⇧' : 'Shift';
  if (normalized === 'alt') return isMac ? '⌥' : 'Alt';
  if (normalized === 'meta') return isMac ? '⌘' : 'Meta';
  if (normalized === 'enter') return 'Enter';
  if (normalized === 'esc') return 'Esc';
  if (normalized === 'delete') return 'Delete';
  if (normalized === 'backspace') return 'Backspace';
  if (normalized === 'up') return '↑';
  if (normalized === 'down') return '↓';
  if (normalized === 'left') return '←';
  if (normalized === 'right') return '→';
  if (normalized === 'slash') return '/';
  return part.length === 1 ? part.toUpperCase() : part;
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  const key = normalizeKey(event.key);
  if (!key) return null;

  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push('mod');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  parts.push(key);

  return parts.join('+');
}

function normalizeKey(key: string): string | null {
  if (key === ' ') return 'space';
  if (key === 'Escape') return 'esc';
  if (key === 'ArrowUp') return 'up';
  if (key === 'ArrowDown') return 'down';
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  if (key === 'Delete') return 'delete';
  if (key === 'Backspace') return 'backspace';
  if (key === 'Enter') return 'enter';
  if (key === 'Tab') return 'tab';
  if (key === '/' || key === '?') return 'slash';
  if (key.length === 1) return key.toLowerCase();
  if (/^F\d{1,2}$/.test(key)) return key.toLowerCase();
  return null;
}

export function findShortcutConflict(
  actionId: ShortcutActionId,
  keys: string,
  shortcuts: ShortcutMap | undefined
): ShortcutDefinition | null {
  if (!keys) return null;
  const normalized = new Set(keys.split(',').map((key) => key.trim()));
  const resolved = getResolvedShortcuts(shortcuts);

  return (
    SHORTCUT_DEFINITIONS.find((definition) => {
      if (definition.id === actionId) return false;
      return resolved[definition.id]
        .split(',')
        .some((key) => normalized.has(key.trim()));
    }) ?? null
  );
}
