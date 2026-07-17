'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MAIN_NAV, type NavEntry } from '@/lib/constants/nav';
import { cn } from '@/lib/utils/cn';
import { Wordmark } from '@/components/branding/Wordmark';
import { Avatar } from '@/components/shared';
import {
  BuildingIcon,
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  InboxIcon,
  SettingsIcon,
  UsersIcon,
  type IconProps,
} from '@/components/shared/Icons';
import styles from './Sidebar.module.css';

const ICONS: Record<NavEntry['icon'], (p: IconProps) => React.ReactElement> = {
  inbox: InboxIcon,
  compass: CompassIcon,
  building: BuildingIcon,
  users: UsersIcon,
  chart: ChartIcon,
  calendar: CalendarIcon,
};

/** Sidebar fija de escritorio: marca, navegación principal y cuenta. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar} aria-label="Navegación principal">
      <div className={styles.brand}>
        <Link href="/inbox" className={styles.brandLink} aria-label="Castresana — inicio">
          <Wordmark />
        </Link>
      </div>

      <nav className={styles.nav}>
        <span className={cn('eyebrow', styles.navLabel)}>Trabajo</span>
        <ul className={styles.list}>
          {MAIN_NAV.map((item) => {
            const Icon = ICONS[item.icon];
            const active = pathname.startsWith(item.href);

            if (item.disabled) {
              return (
                <li key={item.href}>
                  <span className={cn(styles.item, styles.itemDisabled)} title="Próximamente">
                    <Icon size={19} />
                    <span className={styles.itemLabel}>{item.label}</span>
                    <span className={styles.soon}>Pronto</span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(styles.item, active && styles.itemActive)}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={19} />
                  <span className={styles.itemLabel}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.footer}>
        <button className={styles.account} type="button">
          <Avatar name="Pau Castresana" size="sm" />
          <span className={styles.accountText}>
            <span className={styles.accountName}>Pau</span>
            <span className={styles.accountRole}>Asesoría Castresana</span>
          </span>
          <SettingsIcon size={17} className={styles.accountIcon} />
        </button>
      </div>
    </aside>
  );
}
