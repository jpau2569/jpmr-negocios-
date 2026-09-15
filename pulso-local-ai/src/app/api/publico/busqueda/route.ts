import { clienteAdmin } from "@/lib/supabase/servidor";
import { manejarFormulario, ok } from "@/lib/api";
import { crearLead, deducirFuente, negocioParaCaptacion } from "@/lib/captacion";
import { esquemaBusqueda } from "@/lib/validaciones/formularios";

export const runtime = "nodejs";

/** Demanda de comprador o inquilino: «avísame cuando entre algo así». */
export async function POST(peticion: Request) {
  return manejarFormulario(peticion, esquemaBusqueda, { ambito: "busqueda", limite: 5 }, async (datos) => {
    const negocio = await negocioParaCaptacion(datos.businessSlug);
    const zonas = (datos.zonas ?? "")
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean)
      .slice(0, 8);

    const { leadId } = await crearLead({
      negocio,
      tipo: datos.operacion === "alquiler" ? "tenant" : "buyer",
      fuente: deducirFuente(datos.contexto?.qrCode),
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      mensaje: datos.mensaje,
      qrCode: datos.contexto?.qrCode,
      sessionId: datos.contexto?.sessionId,
      path: datos.contexto?.path,
      metadata: { operacion: datos.operacion, zonas: zonas.length, presupuesto: datos.presupuestoMax ?? null },
      peticion,
      eventoAnalitico: "buyer_request_submit",
    });

    await clienteAdmin().from("buyer_requests").insert({
      business_id: negocio.id,
      lead_id: leadId,
      operation_type: datos.operacion,
      property_types: datos.tiposInmueble,
      zones: zonas,
      budget_max: datos.presupuestoMax ?? null,
      min_bedrooms: datos.habitacionesMin ?? null,
      must_have: datos.imprescindibles,
      timeframe: datos.plazo ?? null,
      notes: datos.mensaje ?? null,
    });

    return ok({ leadId, mensaje: "Anotado. Te avisamos en cuanto entre algo que encaje con lo que buscas." });
  });
}
