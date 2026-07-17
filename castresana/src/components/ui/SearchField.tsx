import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { SearchIcon } from '@/components/icons';
import styles from './SearchField.module.css';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export function SearchField({ wrapperClassName, className, ...rest }: SearchFieldProps) {
  return (
    <div className={cn(styles.wrapper, wrapperClassName)}>
      <span className={styles.icon}>
        <SearchIcon size={16} />
      </span>
      <input
        type="search"
        className={cn(styles.input, className)}
        placeholder="Buscar…"
        {...rest}
      />
    </div>
  );
}
