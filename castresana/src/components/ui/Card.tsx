import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Nivel de elevación visual. */
  elevation?: 'flat' | 'raised';
  /** Aplica realce interactivo (hover) para tarjetas clicables. */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Card({
  elevation = 'flat',
  interactive = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        styles.card,
        styles[elevation],
        styles[`pad-${padding}`],
        interactive && styles.interactive,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
