'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MAIN_NAV, type NavEntry } from '@/lib/constants/nav';
import { cn } from '@/lib/utils/cn';
import {
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  InboxIcon,
  UsersIcon,
  type IconProps,
} from '@/components/shared/Icons';
import styles from './MobileNav.module.css';

const ICONS: Record<NavEntry['icon'], (p: IconProps) => React.ReactElement> = {
  inbox: InboxIcon,
  building: BuildingIcon,
  users: UsersIcon,
  chart: ChartIcon,
  calendar: CalendarIcon,
};

/** Navegación inferior para móvil (sustituye a la sidebar). */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.mobileNav} aria-label="Navegación inferior">
      {MAIN_NAV.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname.startsWith(item.href);

        if (item.disabled) {
          return (
            <span key={item.href} className={cn(styles.item, styles.itemDisabled)}>
              <Icon size={21} />
              <span className={styles.label}>{item.label}</span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(styles.item, active && styles.itemActive)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={21} />
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
