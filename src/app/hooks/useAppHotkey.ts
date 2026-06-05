import { useHotkeys } from 'react-hotkeys-hook';
import { useStore } from '@/app/store/useStore';
import { getShortcutKeys, type ShortcutActionId } from '@/app/lib/shortcuts';

export function useAppHotkey(
  actionId: ShortcutActionId,
  callback: (event: KeyboardEvent) => void,
  options: { enabled?: boolean; enableOnFormTags?: boolean } = {}
) {
  const shortcuts = useStore((s) => s.db?.getSettings().keyboard_shortcuts);
  const keys = getShortcutKeys(shortcuts, actionId);
  const enabled = (options.enabled ?? true) && keys.trim().length > 0;

  useHotkeys(
    keys || '__disabled_shortcut__',
    (event) => callback(event),
    {
      enabled,
      enableOnFormTags: options.enableOnFormTags ?? false,
      enableOnContentEditable: false,
      preventDefault: true,
    },
    [callback, enabled, options.enableOnFormTags, keys]
  );
}
