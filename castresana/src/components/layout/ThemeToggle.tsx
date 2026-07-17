'use client';

import { useTheme } from '@/hooks/useTheme';
import { IconButton } from '@/components/shared';
import { MoonIcon, SunIcon } from '@/components/shared/Icons';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <IconButton
      label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={toggle}
    >
      {isDark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </IconButton>
  );
}
