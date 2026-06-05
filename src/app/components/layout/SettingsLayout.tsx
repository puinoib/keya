import { useState } from 'react';
import { Outlet } from '@tanstack/react-router';
import { Sun, Moon, Monitor, Check } from '@phosphor-icons/react';
import { useGlobalShortcuts } from '@/app/hooks/useGlobalShortcuts';
import { KeyboardShortcutsDialog } from '@/app/components/KeyboardShortcutsDialog';
import { SettingsSidebar } from '@/app/components/settings/SettingsSidebar';
import { useStore } from '@/app/store/useStore';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

export function SettingsLayout() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { theme, setTheme } = useStore();
  useGlobalShortcuts(() => setShowShortcuts(true));

  const CurrentIcon =
    themeOptions.find((o) => o.value === theme)?.icon ?? Monitor;

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <SettingsSidebar />

      <div className="flex flex-1 flex-col min-w-0 p-3 pl-0">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <header className="h-12 flex items-center justify-end px-4 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md text-ink-quaternary hover:text-ink-secondary hover:bg-surface-3 transition-colors">
                <CurrentIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {themeOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className="text-xs"
                  >
                    <opt.icon className="size-3.5" />
                    <span>{opt.label}</span>
                    {theme === opt.value && (
                      <Check className="size-3.5 ml-auto text-accent-bright" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <div className="flex-1 overflow-auto">
            <main className="p-6 max-w-2xl mx-auto w-full">
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      <KeyboardShortcutsDialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}
