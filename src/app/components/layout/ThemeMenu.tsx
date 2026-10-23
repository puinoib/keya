import { Sun, Moon, Monitor, Check } from '@phosphor-icons/react';
import { useStore } from '@/app/store/useStore';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

/**
 * Theme is app-wide, so it lives in the app chrome (top bar, settings header)
 * instead of inside the vault menu, where it would be a submenu about
 * something other than the vault.
 */
export function ThemeMenu({ className }: { className?: string }) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const CurrentIcon =
    themeOptions.find((option) => option.value === theme)?.icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Theme"
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-quaternary transition-colors duration-150 hover:bg-surface-3 hover:text-ink-secondary',
          className
        )}
      >
        <CurrentIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-36">
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
          >
            <option.icon className="size-3.5" />
            <span>{option.label}</span>
            {theme === option.value && (
              <Check className="ml-auto size-3.5 text-accent-bright" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
