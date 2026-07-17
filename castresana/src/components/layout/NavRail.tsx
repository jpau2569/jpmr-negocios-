'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import {
  BrandMark,
  DashboardIcon,
  ExplorerIcon,
  InboxIcon,
  LeadsIcon,
  PropertyIcon,
  SettingsIcon,
} from '@/components/icons';
import { Avatar } from '@/components/ui';
import styles from './NavRail.module.css';

interface NavItem {
  href: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  /** Coincidencia por prefijo para rutas con detalle (/properties/[id]). */
  match?: string;
  badge?: number;
}

const primaryNav: NavItem[] = [
  { href: '/inbox', label: 'Inbox', Icon: InboxIcon, badge: 3 },
  { href: '/explorer', label: 'Explorer', Icon: ExplorerIcon },
  { href: '/dashboard', label: 'Panel', Icon: DashboardIcon },
  { href: '/properties/CAS-0421', label: 'Propiedades', Icon: PropertyIcon, match: '/properties' },
  { href: '/leads/l-001', label: 'Leads', Icon: LeadsIcon, match: '/leads' },
];

export function NavRail() {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    const base = item.match ?? item.href;
    return pathname === base || pathname.startsWith(`${base}/`) || pathname === item.href;
  };

  return (
    <nav className={styles.rail} aria-label="Navegación principal">
      <Link href="/inbox" className={styles.brand} aria-label="Castresana — inicio">
        <BrandMark size={30} />
      </Link>

      <ul className={styles.list}>
        {primaryNav.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(styles.item, active && styles.itemActive)}
                aria-current={active ? 'page' : undefined}
                data-tooltip={item.label}
              >
                <span className={styles.itemIcon}>
                  <item.Icon size={21} />
                </span>
                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                <span className={styles.tooltip}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.footer}>
        <Link href="/dashboard" className={styles.item} data-tooltip="Ajustes">
          <span className={styles.itemIcon}>
            <SettingsIcon size={21} />
          </span>
          <span className={styles.tooltip}>Ajustes</span>
        </Link>
        <button className={styles.avatarButton} aria-label="Tu cuenta">
          <Avatar initials="PC" size="sm" status="success" />
        </button>
      </div>
    </nav>
  );
}
