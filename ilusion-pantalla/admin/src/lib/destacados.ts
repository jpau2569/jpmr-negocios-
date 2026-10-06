// Orden de destacados y listas ordenables (categorías).

export interface ConOrden {
  id: string;
  titulo?: string;
  destacado_orden: number | null;
}

/** Texto de un input → entero ≥ 0, o null si no es válido/vacío. */
export function parseOrden(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/** Solo los destacados (orden no nulo), por orden y, a igualdad, por título e id (estable). */
export function ordenarDestacados<T extends ConOrden>(filas: T[]): T[] {
  return filas
    .filter((f) => f.destacado_orden !== null && f.destacado_orden !== undefined)
    .sort(
      (a, b) =>
        (a.destacado_orden as number) - (b.destacado_orden as number) ||
        (a.titulo ?? "").localeCompare(b.titulo ?? "", "es") ||
        a.id.localeCompare(b.id),
    );
}

/** Intercambia con el vecino. Fuera de rango → misma lista (sin copiar mal). */
export function mover<T>(lista: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (!Number.isInteger(i) || i < 0 || i >= lista.length || j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  const a = copia[i] as T;
  copia[i] = copia[j] as T;
  copia[j] = a;
  return copia;
}

/** Posiciones 1..n sin huecos; devuelve solo lo que cambia respecto a `antes`. */
export function cambiosDeOrden(antes: { id: string; orden: number | null }[], despues: { id: string }[]): { id: string; orden: number }[] {
  const previo = new Map(antes.map((x) => [x.id, x.orden]));
  const cambios: { id: string; orden: number }[] = [];
  despues.forEach((x, idx) => {
    if (previo.get(x.id) !== idx + 1) cambios.push({ id: x.id, orden: idx + 1 });
  });
  return cambios;
}
