// ============================================================================
//  Demo de 7 días
// ----------------------------------------------------------------------------
//  La comprobación es SIEMPRE de servidor. Nunca se decide en el navegador si
//  una demo sigue viva: eso se salta con las herramientas de desarrollo en
//  cinco segundos. Y además está duplicada en RLS (business_is_live), así que
//  aunque alguien llame a la API a pelo, la base no devuelve nada.
//
//  Estados:
//    trial      → viva mientras trial_ends_at (UTC) esté en el futuro
//    active     → cliente de pago, siempre servida
//    suspended  → impago o petición del cliente: no se sirve
//    expired    → la demo se acabó: página elegante y CTA de reactivación
// ============================================================================

import type { Negocio } from "@/types/negocio";

export interface EstadoDemo {
  vivo: boolean;
  esDemo: boolean;
  diasRestantes: number | null;
  motivo: "activo" | "demo_viva" | "demo_caducada" | "suspendido";
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function estadoDemo(negocio: Pick<Negocio, "status" | "trial_ends_at">, ahora = new Date()): EstadoDemo {
  if (negocio.status === "active") {
    return { vivo: true, esDemo: false, diasRestantes: null, motivo: "activo" };
  }
  if (negocio.status === "suspended") {
    return { vivo: false, esDemo: false, diasRestantes: null, motivo: "suspendido" };
  }

  const fin = negocio.trial_ends_at ? new Date(negocio.trial_ends_at) : null;
  const valida = fin !== null && !Number.isNaN(fin.getTime());
  const restanteMs = valida ? fin.getTime() - ahora.getTime() : -1;

  if (negocio.status === "trial" && restanteMs > 0) {
    return {
      vivo: true,
      esDemo: true,
      // Se redondea hacia arriba: quedan "1 día" hasta el último minuto, que es
      // como lo cuenta la persona que la recibió.
      diasRestantes: Math.ceil(restanteMs / DIA_MS),
      motivo: "demo_viva",
    };
  }

  return { vivo: false, esDemo: true, diasRestantes: 0, motivo: "demo_caducada" };
}

/** "Demo activa: quedan 5 días." Solo se le enseña al administrador. */
export function avisoDemo(estado: EstadoDemo): string | null {
  if (!estado.esDemo || !estado.vivo || estado.diasRestantes === null) return null;
  const d = estado.diasRestantes;
  if (d <= 0) return "Demo activa: termina hoy.";
  return d === 1 ? "Demo activa: queda 1 día." : `Demo activa: quedan ${d} días.`;
}
