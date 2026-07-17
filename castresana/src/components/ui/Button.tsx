import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Icono a la izquierda del texto. */
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Botón cuadrado solo-icono. */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  iconOnly = false,
  fullWidth = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        iconOnly && styles.iconOnly,
        fullWidth && styles.fullWidth,
        className,
      )}
      {...rest}
    >
      {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      {children && <span className={styles.label}>{children}</span>}
      {iconRight && <span className={styles.icon}>{iconRight}</span>}
    </button>
  );
}
