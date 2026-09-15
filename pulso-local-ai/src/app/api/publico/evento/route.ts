import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/servidor";
import { error, manejarFormulario, ok } from "@/lib/api";
import { negocioParaCaptacion, qrPorCodigo } from "@/lib/captacion";
import { registrarEvento, tipoDispositivo } from "@/lib/analitica";
import { esquemaEvento } from "@/lib/validaciones/formularios";
import type { TipoEvento } from "@/types/dominio";

export const runtime = "nodejs";

const EVENTOS_PERMITIDOS = new Set<TipoEvento>([
  "qr_landing_view", "public_landing_view", "service_view", "property_list_view",
  "property_view", "property_gallery_view", "property_tour_click",
  "whatsapp_click", "call_click", "directions_click",
  "valuation_start", "buyer_request_start", "visit_request_start", "feedback_start",
  "google_review_click", "review_intent", "ai_chat_open", "qr_download", "qr_print_preview",
]);

/**
 * Registro de eventos desde el navegador.
 *
 * Solo acepta tipos de la lista blanca, y nunca los de envío (`*_submit`): esos
 * los escribe el servidor cuando la escritura ocurre de verdad, para que nadie
 * pueda inflar las conversiones desde la consola del navegador.
 */
export async function POST(peticion: Request) {
  return manejarFormulario(
    peticion,
    esquemaEvento,
    { ambito: "evento", limite: 120, ventanaSegundos: 600 },
    async (datos): Promise<NextResponse> => {
      if (!EVENTOS_PERMITIDOS.has(datos.tipo as TipoEvento)) {
        return error("Tipo de evento no admitido", 422);
      }
      const negocio = await negocioParaCaptacion(datos.businessSlug);
      const qrId = await qrPorCodigo(negocio.id, datos.qrCode);

      await registrarEvento({
        businessId: negocio.id,
        tipo: datos.tipo as TipoEvento,
        qrId,
        propertyId: datos.propertyId ?? null,
        sessionId: datos.sessionId ?? null,
        path: datos.path ?? null,
        deviceKind: tipoDispositivo(peticion.headers.get("user-agent")),
        metadata: datos.metadata,
      });

      if (datos.tipo === "property_view" && datos.propertyId) {
        await clienteAdmin().rpc("registrar_visita_inmueble", { p_property_id: datos.propertyId });
      }

      return ok({ registrado: true });
    },
  );
}
