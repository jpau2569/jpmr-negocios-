import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { SearchIcon } from './Icons';
import styles from './SearchInput.module.css';

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export function SearchInput({ wrapperClassName, className, ...rest }: SearchInputProps) {
  return (
    <div className={cn(styles.wrapper, wrapperClassName)}>
      <span className={styles.icon}>
        <SearchIcon size={16} />
      </span>
      <input type="search" className={cn(styles.input, className)} {...rest} />
    </div>
  );
}
