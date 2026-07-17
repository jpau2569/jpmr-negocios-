'use client';

import { cn } from '@/lib/utils/cn';
import styles from './SegmentedControl.module.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Contador opcional a la derecha de la etiqueta. */
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Etiqueta accesible del grupo. */
  label: string;
  className?: string;
}

/** Grupo de pestañas segmentadas (filtros). Scrollable en horizontal si no cabe. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cn(styles.group, className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            className={cn(styles.segment, active && styles.active)}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
            {typeof opt.count === 'number' && <span className={styles.count}>{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
