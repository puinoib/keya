/**
 * Application preferences that belong to this browser, not to a vault.
 *
 * Theme is the only one left here: everything else that used to live beside it
 * (auto-lock, clipboard detection, hidden presets) now belongs to the v2
 * device-local state.
 */

import { create } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'keya-theme';

function initialTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
}

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useUi = create<UiState>()((set) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage may be unavailable; the theme still applies for this session.
    }
    set({ theme });
  },
}));
