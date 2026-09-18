import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import styles from './IconButton.module.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Etiqueta accesible obligatoria (el botón solo muestra un icono). */
  label: string;
  size?: 'sm' | 'md';
  active?: boolean;
  children: ReactNode;
}

export function IconButton({
  label,
  size = 'md',
  active,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(styles.iconButton, styles[size], active && styles.active, className)}
      {...rest}
    >
      {children}
    </button>
  );
}
