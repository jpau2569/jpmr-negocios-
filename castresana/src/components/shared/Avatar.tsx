import { cn } from '@/lib/utils/cn';
import { initials } from '@/lib/utils/initials';
import styles from './Avatar.module.css';

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span className={cn(styles.avatar, styles[size], className)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
