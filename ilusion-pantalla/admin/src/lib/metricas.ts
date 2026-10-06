// Cálculos puros para las gráficas SVG de /metricas.

export interface FilaDiaria { dia: string; evento: string; eventos: number; instalaciones: number }

/** Suma de eventos por día (ordenado por fecha), ignorando filas rotas. */
export function eventosPorDia(filas: FilaDiaria[]): { dia: string; total: number }[] {
  const m = new Map<string, number>();
  for (const f of filas) {
    const n = Number(f.eventos);
    if (!f.dia || !Number.isFinite(n)) continue;
    m.set(f.dia, (m.get(f.dia) ?? 0) + n);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([dia, total]) => ({ dia, total }));
}

/** Longitud de barra 0..max; el mayor valor ocupa todo. Todo a 0 → todas 0 (sin NaN). */
export function escalar(valores: number[], max: number): number[] {
  const tope = Math.max(0, ...valores.map((v) => (Number.isFinite(v) ? v : 0)));
  if (tope === 0) return valores.map(() => 0);
  return valores.map((v) => (Number.isFinite(v) && v > 0 ? Math.max(1, Math.round((v / tope) * max)) : 0));
}

export function porcentaje(parte: number, total: number): string {
  if (!total || !Number.isFinite(parte) || !Number.isFinite(total)) return "—";
  return `${((100 * parte) / total).toFixed(1).replace(".", ",")} %`;
}
