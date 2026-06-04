import { useEffect } from 'react';
import { useStore } from '../store/useStore';

export function ThemeSync() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (t: string) => {
      if (t === 'light') {
        root.classList.add('light');
      } else if (t === 'dark') {
        root.classList.remove('light');
      } else {
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches;
        if (prefersDark) root.classList.remove('light');
        else root.classList.add('light');
      }
    };
    applyTheme(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  return null;
}
