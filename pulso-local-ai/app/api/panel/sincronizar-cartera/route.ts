import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/supabase/servidor";
import { escribir } from "@/lib/panel";
import { esquemaSincronizar } from "@/lib/schemas/panel";
import { obtenerCartera, fuenteInmoweb, slugDeInmueble } from "@/lib/cartera";
import { planificarSincronizacion, resumenDelPlan, type InmuebleGuardado } from "@/lib/cartera/fusion";

// ============================================================================
//  Sincronizar la cartera — /api/panel/sincronizar-cartera
// ----------------------------------------------------------------------------
//  Lee la web oficial de la agencia y trae los inmuebles. Corre EN EL SERVIDOR
//  porque desde el navegador no se puede (CORS) y porque la web de la agencia
//  no tiene por qué saber nada de esto.
//
//  Lo que decide qué se toca vive en lib/cartera/fusion.ts, que es puro y está
//  probado aparte. Aquí solo se ejecuta el plan. Las reglas, en corto:
//  si no se lee nada NO se toca nada; lo de alta manual no se toca jamás; la
//  agencia manda sobre la web; y nada se borra, se despublica.
//
//  Este endpoint pasa por el middleware, así que exige sesión de panel.
// ============================================================================

export const runtime = "nodejs";
// Leer dos páginas de un sitio ajeno y escribir en lote da de sí.
export const maxDuration = 60;

export async function POST(peticion: Request) {
  return escribir(peticion, esquemaSincronizar, "sincronizar-cartera", async ({ datos, negocio }) => {
    const db = admin();

    // La web de la agencia sale de sus propios ajustes: así el endpoint sirve
    // igual para la siguiente inmobiliaria sin tocar una línea.
    const { data: ajustes } = await db
      .from("business_settings")
      .select("website")
      .eq("business_id", negocio.id)
      .maybeSingle();

    const web = ajustes?.website;
    if (!web) {
      return NextResponse.json({
        ok: false,
        error: "Este negocio no tiene web configurada, así que no hay de dónde leer la cartera.",
      }, { status: 400 });
    }

    const { inmuebles: leidos, errores } = await obtenerCartera(fuenteInmoweb(web));

    const { data: filas } = await db
      .from("properties")
      .select("id, reference, source, status")
      .eq("business_id", negocio.id);

    const plan = planificarSincronizacion(
      leidos,
      (filas ?? []) as InmuebleGuardado[],
      { huboErrores: errores.length > 0 },
    );

    if (plan.abortado) {
      // No es un error del servidor: es una negativa deliberada a hacer daño.
      return NextResponse.json({
        ok: false,
        error: plan.abortado,
        detalle: errores,
      }, { status: 409 });
    }

    // --- Altas -------------------------------------------------------------
    // Nacen PUBLICADAS porque ya están publicadas en la web de la agencia: no
    // se está revelando nada que no fuera público. Y con el certificado
    // energético en "pendiente", que es la verdad.
    if (plan.nuevos.length > 0) {
      const { data: creados, error: fallo } = await db
        .from("properties")
        .insert(plan.nuevos.map((n, i) => ({
          business_id: negocio.id,
          reference: n.reference,
          slug: slugDeInmueble(n.title, n.reference),
          title: n.title,
          description: n.description,
          operation: n.operation,
          kind: n.kind,
          price_cents: n.price_cents,
          price_on_request: n.price_cents === null,
          surface_built_m2: n.surface_built_m2,
          rooms: n.rooms,
          bathrooms: n.bathrooms,
          municipality: n.municipality,
          energy_status: "pendiente",
          status: "published",
          visibility: "publico",
          source: "web",
          source_url: n.source_url,
          synced_at: new Date().toISOString(),
          position: i,
        })))
        .select("id, reference");
      if (fallo) throw fallo;

      // La foto de portada, si la web la daba. Una sola: las demás están en la
      // ficha del inmueble y eso es otra lectura, para otro día.
      const conFoto = plan.nuevos
        .map((n) => {
          const creado = (creados ?? []).find((c) => c.reference === n.reference);
          return creado && n.foto ? { property_id: creado.id, url: n.foto, is_cover: true, position: 0 } : null;
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);
      if (conFoto.length > 0) {
        const { error: falloFoto } = await db.from("property_photos").insert(conFoto);
        // Una foto que no entra no debe tumbar la sincronización entera.
        if (falloFoto) console.error("[pulso-local-ai] fotos de la sincronización:", falloFoto);
      }
    }

    // --- Actualizaciones ---------------------------------------------------
    // Uno a uno y filtrando por business_id: aquí se escribe con service_role,
    // que salta RLS, así que el aislamiento es responsabilidad de este código.
    for (const act of plan.actualizados) {
      const { error: fallo } = await db
        .from("properties")
        .update({
          ...act.campos,
          price_on_request: act.campos.price_cents === null,
          synced_at: new Date().toISOString(),
        })
        .eq("id", act.id)
        .eq("business_id", negocio.id);
      if (fallo) throw fallo;
    }

    // --- Retirados ---------------------------------------------------------
    // Despublicar, NUNCA borrar: sus visitas, su QR impreso y su analítica
    // siguen valiendo, y casi siempre "ha desaparecido de la web" significa
    // "se ha vendido".
    for (const ret of plan.retirados) {
      const { error: fallo } = await db
        .from("properties")
        .update({ status: "draft" })
        .eq("id", ret.id)
        .eq("business_id", negocio.id);
      if (fallo) throw fallo;
    }

    revalidatePath(`/b/${datos.slug}`);
    revalidatePath(`/b/${datos.slug}/inmuebles`);

    return NextResponse.json({
      ok: true,
      resumen: resumenDelPlan(plan),
      nuevos: plan.nuevos.length,
      actualizados: plan.actualizados.length,
      retirados: plan.retirados.length,
      intocables: plan.intocables.length,
      errores,
    });
  });
}
