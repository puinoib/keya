import { useNavigate } from '@tanstack/react-router';
import { useStore } from '@/app/store/useStore';
import { useAppHotkey } from './useAppHotkey';

export function useGlobalShortcuts(openShortcutHelp: () => void) {
  const navigate = useNavigate();
  const workspaceState = useStore((s) => s.workspaceState);
  const setShowAddForm = useStore((s) => s.setShowAddForm);
  const lock = useStore((s) => s.lock);
  const enabled = workspaceState === 'unlocked';

  useAppHotkey(
    'search.focus',
    () => {
      const input = document.querySelector<HTMLInputElement>(
        '[data-keya-search="true"]'
      );
      input?.focus();
      input?.select();
    },
    { enabled }
  );

  useAppHotkey(
    'key.add',
    () => {
      navigate({ to: '/keys' });
      setShowAddForm(true);
    },
    { enabled }
  );
  useAppHotkey('vault.lock', () => lock(), { enabled });
  useAppHotkey('shortcuts.help', () => openShortcutHelp(), { enabled });

  useAppHotkey(
    'nav.keys',
    () => {
      navigate({ to: '/keys' });
    },
    { enabled }
  );

  useAppHotkey(
    'nav.inbox',
    () => {
      navigate({ to: '/inbox' });
    },
    { enabled }
  );

  useAppHotkey(
    'nav.settings',
    () => {
      navigate({ to: '/settings' });
    },
    { enabled }
  );
}
