/**
 * cn — utilidad mínima para componer className condicionalmente.
 * Evita añadir dependencias (clsx/classnames) para algo tan simple.
 *
 * @example cn('card', isActive && 'card--active', undefined)
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
