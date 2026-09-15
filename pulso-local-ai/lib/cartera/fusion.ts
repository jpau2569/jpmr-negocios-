// ============================================================================
//  Qué se toca y qué NO al sincronizar la cartera
// ----------------------------------------------------------------------------
//  Esta es la pieza delicada de la sincronización, así que vive aparte y es
//  PURA: entra lo leído de la web y lo que ya hay en la base, y sale un plan.
//  Sin red, sin base de datos, y por tanto probable de verdad.
//
//  Las cuatro reglas, por orden de importancia:
//
//  1. SI NO SE LEE NADA, NO SE TOCA NADA. Si la web cambia de plantilla, se
//     cae, o bloquea al servidor, el lector devuelve cero. Interpretar eso
//     como "la agencia no tiene pisos" vaciaría el escaparate un domingo por
//     la noche. Ante la duda, no hacer nada y avisar.
//
//  2. LO DADO DE ALTA A MANO NO SE TOCA JAMÁS. Es la captación de boca a boca:
//     no está en la web y nunca va a estarlo. Si la sincronización la pisara,
//     el trabajo de la agencia desaparecería sola.
//
//  3. LO QUE HA TOCADO LA AGENCIA MANDA sobre lo que dice la web. La web no
//     publica etiqueta energética, ni si el piso está reservado, ni la
//     dirección exacta. Eso lo pone la agencia en el panel y la sincronización
//     lo respeta.
//
//  4. NADA SE BORRA. Un inmueble que desaparece de la web se despublica, no se
//     elimina: casi siempre significa "vendido", y sus visitas, su QR impreso
//     y su analítica siguen valiendo.
// ============================================================================

import type { InmuebleLeido } from "./parseo";

/** Lo que hace falta saber de un inmueble ya guardado para decidir. */
export interface InmuebleGuardado {
  id: string;
  reference: string;
  source: "web" | "manual" | "portal";
  status: "draft" | "published" | "sold_out";
}

/** Campos que la sincronización puede refrescar. Los demás son de la agencia. */
export interface CamposDeLaWeb {
  title: string;
  description: string | null;
  operation: InmuebleLeido["operation"];
  kind: InmuebleLeido["kind"];
  price_cents: number | null;
  surface_built_m2: number | null;
  rooms: number | null;
  bathrooms: number | null;
  municipality: string | null;
  source_url: string;
}

export interface PlanSincronizacion {
  /** Inmuebles que no estaban: se crean publicados. */
  nuevos: InmuebleLeido[];
  /** Ya estaban y vienen de la web: se refresca lo que la web sí sabe. */
  actualizados: { id: string; reference: string; campos: CamposDeLaWeb }[];
  /** Estaban publicados, venían de la web, y ya no aparecen: se despublican. */
  retirados: { id: string; reference: string }[];
  /** Los de alta manual, intactos. Se listan para poder decirlo en el panel. */
  intocables: { id: string; reference: string }[];
  /** Si no es null, NO se ejecuta nada y esto es lo que se le enseña a Pau. */
  abortado: string | null;
}

/** Solo los campos que la web conoce de verdad. */
function camposDeLaWeb(leido: InmuebleLeido): CamposDeLaWeb {
  return {
    title: leido.title,
    description: leido.description,
    operation: leido.operation,
    kind: leido.kind,
    price_cents: leido.price_cents,
    surface_built_m2: leido.surface_built_m2,
    rooms: leido.rooms,
    bathrooms: leido.bathrooms,
    municipality: leido.municipality,
    source_url: leido.source_url,
  };
}

export function planificarSincronizacion(
  leidos: InmuebleLeido[],
  guardados: InmuebleGuardado[],
  opciones: { huboErrores?: boolean } = {},
): PlanSincronizacion {
  const vacio: PlanSincronizacion = {
    nuevos: [], actualizados: [], retirados: [], intocables: [], abortado: null,
  };

  // Regla 1. Cero inmuebles leídos nunca significa "la agencia no tiene
  // pisos": significa que no se ha podido leer. No se toca nada.
  if (leidos.length === 0) {
    return {
      ...vacio,
      abortado: guardados.length > 0
        ? "No se ha podido leer ni un inmueble de la web. No se ha tocado nada, "
          + "para no vaciar la cartera por un fallo de lectura."
        : "No se ha podido leer ni un inmueble de la web.",
    };
  }

  // Y si se leyó algo pero además hubo errores, tampoco se retira nada: puede
  // que la mitad de la cartera esté en la página que falló.
  const lecturaIncompleta = Boolean(opciones.huboErrores);

  const porReferencia = new Map(guardados.map((g) => [g.reference, g]));
  const leidasAhora = new Set(leidos.map((l) => l.reference));

  const plan: PlanSincronizacion = { ...vacio, abortado: null };

  for (const leido of leidos) {
    const guardado = porReferencia.get(leido.reference);
    if (!guardado) {
      plan.nuevos.push(leido);
      continue;
    }
    // Regla 2: lo de alta manual no se toca ni aunque coincida la referencia.
    if (guardado.source !== "web") {
      plan.intocables.push({ id: guardado.id, reference: guardado.reference });
      continue;
    }
    plan.actualizados.push({
      id: guardado.id,
      reference: guardado.reference,
      campos: camposDeLaWeb(leido),
    });
  }

  // Regla 4: lo que ya no está en la web se despublica, no se borra. Y solo
  // si la lectura ha sido completa.
  if (!lecturaIncompleta) {
    for (const guardado of guardados) {
      if (guardado.source !== "web") continue;
      if (guardado.status !== "published") continue;
      if (leidasAhora.has(guardado.reference)) continue;
      plan.retirados.push({ id: guardado.id, reference: guardado.reference });
    }
  }

  // Los manuales que ni siquiera aparecen en la web (lo normal) también se
  // cuentan como intocables, para poder decir en el panel cuántos hay.
  for (const guardado of guardados) {
    if (guardado.source === "web") continue;
    if (plan.intocables.some((i) => i.id === guardado.id)) continue;
    plan.intocables.push({ id: guardado.id, reference: guardado.reference });
  }

  return plan;
}

/** Resumen en una línea, para enseñárselo a quien pulsó el botón. */
export function resumenDelPlan(plan: PlanSincronizacion): string {
  if (plan.abortado) return plan.abortado;
  const trozos: string[] = [];
  if (plan.nuevos.length) trozos.push(`${plan.nuevos.length} nuevos`);
  if (plan.actualizados.length) trozos.push(`${plan.actualizados.length} actualizados`);
  if (plan.retirados.length) trozos.push(`${plan.retirados.length} retirados de la web`);
  if (plan.intocables.length) {
    trozos.push(`${plan.intocables.length} de alta manual, sin tocar`);
  }
  return trozos.length ? trozos.join(", ") : "No había nada que cambiar.";
}
