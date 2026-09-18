/** Navegación principal. Las rutas futuras están declaradas ya para que el
 *  layout no cambie cuando existan; hoy solo /inbox tiene página real. */
export interface NavEntry {
  href: string;
  label: string;
  icon: 'inbox' | 'compass' | 'building' | 'users' | 'chart' | 'calendar';
  disabled?: boolean;
}

export const MAIN_NAV: NavEntry[] = [
  { href: '/inbox', label: 'Inbox', icon: 'inbox' },
  { href: '/explorer', label: 'Explorer', icon: 'compass' },
  { href: '/dashboard', label: 'Panel', icon: 'chart' },
  { href: '/properties', label: 'Propiedades', icon: 'building', disabled: true },
  { href: '/agenda', label: 'Agenda', icon: 'calendar', disabled: true },
];

export const THEME_STORAGE_KEY = 'castresana-theme';
