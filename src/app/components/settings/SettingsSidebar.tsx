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
    <nav className="w-[180px] shrink-0 border-r border-line bg-surface-2 p-3">
      <div className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent-bright font-medium'
                  : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
              }`}
            >
              <item.icon className="size-4" weight={isActive ? 'fill' : 'regular'} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}