/**
 * The settings navigation, in one place: the sidebar renders it and the layout
 * takes the page title from it, so a new page cannot appear in one and not the
 * other.
 */

import {
  Database,
  Folders,
  Gear,
  HardDrives,
  Keyboard,
  Lock,
  Question,
  type Icon,
} from '@phosphor-icons/react';

export interface SettingsNavItem {
  path: string;
  label: string;
  icon: Icon;
}

export interface SettingsNavGroup {
  id: string;
  label: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV: readonly SettingsNavGroup[] = [
  {
    id: 'preferences',
    label: 'Preferences',
    items: [
      { path: '/settings/general', label: 'General', icon: Gear },
      { path: '/settings/shortcuts', label: 'Shortcuts', icon: Keyboard },
    ],
  },
  {
    id: 'vault',
    label: 'Vault',
    items: [
      { path: '/settings/vault', label: 'Vault', icon: Lock },
      { path: '/settings/data', label: 'Data', icon: Database },
    ],
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      { path: '/settings/providers', label: 'Providers', icon: HardDrives },
      { path: '/settings/groups', label: 'Groups', icon: Folders },
    ],
  },
  {
    id: 'about',
    label: 'About',
    items: [{ path: '/settings/about', label: 'About', icon: Question }],
  },
];

export function settingsTitle(pathname: string): string {
  for (const group of SETTINGS_NAV) {
    const item = group.items.find((entry) => entry.path === pathname);
    if (item) return item.label;
  }
  return 'Settings';
}
