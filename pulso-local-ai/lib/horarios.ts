// ============================================================================
//  Horarios: abierto o cerrado
// ----------------------------------------------------------------------------
//  Regla del producto: el estado "Abierto ahora" SOLO se enseña si el negocio
//  ha configurado un horario real. Sin horario, la función devuelve
//  "desconocido" y la página no dice nada. Decirle a alguien que un sitio está
//  abierto cuando está cerrado es peor que no decir nada: se planta en la
//  puerta y ya no vuelve.
//
//  Se contempla lo que pasa de verdad en hostelería: tramos que cruzan la
//  medianoche ("11:00-01:00" un viernes). Un tramo así sigue contando como
//  abierto a la 00:30 del sábado.
// ============================================================================

import type { DiaHorario, Tramo } from "@/types/negocio";

export type EstadoApertura =
  | { estado: "desconocido" }
  | { estado: "abierto"; cierraA: string }
  | { estado: "cerrado"; abreA: string | null; diaQueAbre: string | null };

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

export function aMinutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function tramosDe(horario: DiaHorario[], dow: number): Tramo[] {
  return horario.find((d) => Number(d.dow) === dow)?.ranges ?? [];
}

/**
 * Estado en un instante dado.
 * @param ahora minutos desde medianoche del día en curso
 * @param dow día de la semana (0 domingo … 6 sábado)
 */
export function estadoEn(horario: DiaHorario[], dow: number, ahora: number): EstadoApertura {
  if (!Array.isArray(horario) || horario.length === 0) return { estado: "desconocido" };

  // 1. ¿Algún tramo de HOY nos cubre?
  for (const [desde, hasta] of tramosDe(horario, dow)) {
    const a = aMinutos(desde);
    const b = aMinutos(hasta);
    if (a === null || b === null) continue;
    if (b > a) {
      if (ahora >= a && ahora < b) return { estado: "abierto", cierraA: hasta };
    } else {
      // Cruza medianoche: abierto desde `a` hasta el final del día.
      if (ahora >= a) return { estado: "abierto", cierraA: hasta };
    }
  }

  // 2. ¿Un tramo de AYER que cruzaba la medianoche sigue vivo?
  const ayer = (dow + 6) % 7;
  for (const [desde, hasta] of tramosDe(horario, ayer)) {
    const a = aMinutos(desde);
    const b = aMinutos(hasta);
    if (a === null || b === null || b > a) continue;
    if (ahora < b) return { estado: "abierto", cierraA: hasta };
  }

  // 3. Cerrado. ¿Cuándo vuelve a abrir? Se mira hoy y los siete días siguientes.
  const deHoy = tramosDe(horario, dow)
    .map(([desde]) => ({ desde, min: aMinutos(desde) }))
    .filter((t): t is { desde: string; min: number } => t.min !== null && t.min > ahora)
    .sort((x, y) => x.min - y.min);
  if (deHoy.length > 0) {
    return { estado: "cerrado", abreA: deHoy[0]!.desde, diaQueAbre: null };
  }

  for (let salto = 1; salto <= 7; salto += 1) {
    const dia = (dow + salto) % 7;
    const tramos = tramosDe(horario, dia)
      .map(([desde]) => ({ desde, min: aMinutos(desde) }))
      .filter((t): t is { desde: string; min: number } => t.min !== null)
      .sort((x, y) => x.min - y.min);
    if (tramos.length > 0) {
      return {
        estado: "cerrado",
        abreA: tramos[0]!.desde,
        diaQueAbre: salto === 1 ? "mañana" : DIAS[dia]!,
      };
    }
  }

  return { estado: "cerrado", abreA: null, diaQueAbre: null };
}

/** Estado ahora mismo, en la zona horaria del navegador o del servidor. */
export function estadoAhora(horario: DiaHorario[], fecha = new Date()): EstadoApertura {
  return estadoEn(horario, fecha.getDay(), fecha.getHours() * 60 + fecha.getMinutes());
}

/** Frase corta para la cabecera. null = no se pinta nada. */
export function textoApertura(estado: EstadoApertura): string | null {
  switch (estado.estado) {
    case "abierto":
      return `Abierto ahora · cierra a las ${estado.cierraA}`;
    case "cerrado":
      if (!estado.abreA) return "Cerrado ahora";
      return estado.diaQueAbre
        ? `Cerrado ahora · abre ${estado.diaQueAbre} a las ${estado.abreA}`
        : `Cerrado ahora · abre a las ${estado.abreA}`;
    default:
      return null;
  }
}

/** El horario en texto, para el pie. Vacío si no hay horario configurado. */
export function horarioLegible(horario: DiaHorario[]): string[] {
  if (!Array.isArray(horario) || horario.length === 0) return [];
  return [0, 1, 2, 3, 4, 5, 6]
    .map((dow) => {
      const tramos = tramosDe(horario, dow);
      const dia = DIAS[dow]!;
      const nombre = dia.charAt(0).toUpperCase() + dia.slice(1);
      if (tramos.length === 0) return `${nombre}: cerrado`;
      return `${nombre}: ${tramos.map(([a, b]) => `${a}-${b}`).join(" y ")}`;
    });
}
