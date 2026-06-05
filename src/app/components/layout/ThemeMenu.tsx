import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, Monitor, Moon, Sun } from '@phosphor-icons/react';
import { useStore } from '../../store/useStore';

/** Theme picker (light / dark / system). Used by TopBar and MinimalTopBar. */
export function ThemeMenu({ className = '' }: { className?: string }) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Theme"
          className={
            'inline-flex items-center justify-center size-7 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors duration-150 ' +
            className
          }
        >
          {theme === 'dark' ? (
            <Moon className="size-3.5" />
          ) : theme === 'light' ? (
            <Sun className="size-3.5" />
          ) : (
            <Monitor className="size-3.5" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-36">
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <Moon className="size-3.5" /> Dark
          </span>
          {theme === 'dark' ? <Check className="size-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <Sun className="size-3.5" /> Light
          </span>
          {theme === 'light' ? <Check className="size-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="justify-between"
        >
          <span className="inline-flex items-center gap-2">
            <Monitor className="size-3.5" /> System
          </span>
          {theme === 'system' ? <Check className="size-3.5" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
