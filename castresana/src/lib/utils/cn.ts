/**
 * cn — composición condicional de className sin dependencias.
 * @example cn('item', active && 'item--active')
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
