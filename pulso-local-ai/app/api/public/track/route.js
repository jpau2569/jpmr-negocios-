import { admin } from "@/lib/supabase/servidor";
import { esquemaEvento } from "@/lib/schemas/formularios";
import { hayBackend } from "@/lib/datos";
import { limitar, ipDe, negocioVigente, idDeQr, bien, error } from "@/lib/api";
// ============================================================================
//  Analítica — /api/public/track
// ----------------------------------------------------------------------------
//  No guarda un solo dato personal: ni IP, ni identificador de persona, ni
//  cookie. Solo el negocio, el tipo de evento, el QR de origen y una huella de
//  sesión que se genera en el navegador y muere con la pestaña. Por eso esta
//  web no necesita banner de consentimiento.
//
//  Nunca devuelve error al navegador aunque falle: medir no puede romper la
//  experiencia de alguien que está mirando la carta.
// ============================================================================
export const runtime = "nodejs";
// Un límite más generoso que el de los formularios: una sola visita genera
// varios eventos legítimos (entrada, carta, tres platos, clic a WhatsApp).
const MAXIMO_EVENTOS = 60;
export async function POST(peticion) {
    let bruto;
    try {
        bruto = await peticion.json();
    }
    catch {
        return bien();
    }
    const validado = esquemaEvento.safeParse(bruto);
    if (!validado.success)
        return bien();
    const ip = ipDe(peticion);
    if (!limitar(`track:${ip}:${validado.data.slug}`, MAXIMO_EVENTOS)) {
        return error("Demasiados eventos.", 429);
    }
    if (!hayBackend())
        return bien({ soloDemo: true });
    try {
        const negocio = await negocioVigente(validado.data.slug);
        if (!negocio)
            return bien();
        const qrId = await idDeQr(negocio.id, validado.data.qr);
        await admin().from("analytics_events").insert({
            business_id: negocio.id,
            event_type: validado.data.event_type,
            subject_id: validado.data.subject_id ?? null,
            qr_code_id: qrId,
            session_hash: validado.data.session?.slice(0, 64) || null,
            path: validado.data.path ?? null,
            referrer: peticion.headers.get("referer")?.slice(0, 200) ?? null,
        });
    }
    catch (e) {
        console.error("[pulso-local-ai] no se pudo registrar el evento:", e);
    }
    return bien();
}
