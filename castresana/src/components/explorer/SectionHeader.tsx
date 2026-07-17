import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRightIcon } from '@/components/shared/Icons';
import styles from './SectionHeader.module.css';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Enlace "Ver todo" opcional. */
  href?: string;
  /** Acciones extra (flechas del rail se inyectan aquí). */
  actions?: ReactNode;
}

/** Cabecera editorial de sección: título serif + subtítulo + acción. */
export function SectionHeader({ title, subtitle, href, actions }: SectionHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={styles.side}>
        {href && (
          <Link href={href} className={styles.link}>
            Ver todo <ArrowRightIcon size={14} />
          </Link>
        )}
        {actions}
      </div>
    </header>
  );
}
