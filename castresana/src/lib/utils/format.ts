/* Formateadores localizados (es-ES), centralizados para coherencia visual. */

const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return eur.format(value);
}

/** Rango de presupuesto compacto: "180–220 mil €" / "hasta 900 €/mes". */
export function formatBudget(min?: number, max?: number, rent = false): string {
  const unit = rent ? ' €/mes' : ' €';
  if (min && max) return `${compact(min)}–${compact(max)}${unit}`;
  if (max) return `hasta ${compact(max)}${unit}`;
  if (min) return `desde ${compact(min)}${unit}`;
  return 'Sin definir';
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil`;
  return `${n}`;
}

export function formatArea(m2: number): string {
  return `${new Intl.NumberFormat('es-ES').format(m2)} m²`;
}

/** Tiempo relativo compacto para listas densas: "ahora", "38 min", "3 h", "ayer", "12 jul". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const min = Math.round((now.getTime() - then.getTime()) / 60000);

  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;

  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `${days} d`;

  return then.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Hora corta para mensajes: "09:42". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/** Fecha legible para timeline: "mar 15 jul". */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
