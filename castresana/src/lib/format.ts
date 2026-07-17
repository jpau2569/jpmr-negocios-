/* Formateadores localizados (España). Centralizados para mantener coherencia. */

const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return eur.format(value);
}

export function formatArea(m2: number): string {
  return `${new Intl.NumberFormat('es-ES').format(m2)} m²`;
}

/**
 * Tiempo relativo compacto en español ("ahora", "12 min", "3 h", "ayer", "24 abr").
 * Pensado para listas densas tipo inbox.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const min = Math.round(diffMs / 60000);

  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;

  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `${days} d`;

  return then.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
