'use client';

import { useCallback, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/constants/nav';

export type Theme = 'dark' | 'light';

/**
 * useTheme — lee/aplica el tema sobre <html data-theme> y lo persiste.
 * El valor inicial lo aplica un script inline en el layout (anti-FOUC);
 * aquí solo lo sincronizamos y exponemos el toggle.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'light') setTheme('light');
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* almacenamiento no disponible: el tema sigue funcionando en sesión */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
