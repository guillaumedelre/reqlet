import { useEffect, useState } from 'react';

export type ThemeSetting = 'light' | 'dark' | 'system';

function readSetting(): ThemeSetting {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('reqlet-theme') as ThemeSetting | null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolveTheme(setting: ThemeSetting): 'light' | 'dark' {
  if (setting !== 'system') return setting;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeSetting>(readSetting);

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme);
      const html = document.documentElement;
      if (resolved === 'dark') html.classList.add('dark');
      else html.classList.remove('dark');
    };

    apply();
    localStorage.setItem('reqlet-theme', theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => {
      if (t === 'light') return 'dark';
      if (t === 'dark') return 'system';
      return 'light';
    });

  return { theme, setTheme, toggleTheme, isDark: resolveTheme(theme) === 'dark' };
}
