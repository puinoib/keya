import { Link, useRouterState } from '@tanstack/react-router';
import {
  Gear,
  Key,
  HardDrives,
  Keyboard,
  Folders,
  Question,
} from '@phosphor-icons/react';

const navItems = [
  { path: '/settings/general', label: 'General', icon: Gear },
  { path: '/settings/keys', label: 'Keys', icon: Key },
  { path: '/settings/providers', label: 'Providers', icon: HardDrives },
  { path: '/settings/shortcuts', label: 'Shortcuts', icon: Keyboard },
  { path: '/settings/groups', label: 'Groups', icon: Folders },
  { path: '/settings/about', label: 'About', icon: Question },
];

export function SettingsSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside className="w-48 shrink-0 flex flex-col bg-canvas-panel px-2 pt-3 pb-2">
      <div className="space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                isActive
                  ? 'bg-accent/35 text-accent-bright font-medium'
                  : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-3'
              }`}
            >
              <item.icon
                className="size-3.5"
                weight={isActive ? 'fill' : 'regular'}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
