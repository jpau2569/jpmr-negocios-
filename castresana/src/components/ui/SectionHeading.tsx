import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './SectionHeading.module.css';

export interface SectionHeadingProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Acciones alineadas a la derecha (botones, filtros…). */
  actions?: ReactNode;
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.text}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className={styles.title}>{title}</h2>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
