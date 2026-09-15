import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/servidor";
import { registrarEvento, tipoDispositivo } from "@/lib/analitica";
import { enlaceWhatsapp } from "@/lib/formato";
import { entornoPublico } from "@/lib/entorno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * URL corta de los QR impresos: `/q/<code>`.
 *
 * Pasar por el servidor tiene dos ventajas frente a imprimir la URL final:
 *   · se cuenta el escaneo antes de redirigir;
 *   · el destino del cartel se puede cambiar desde el panel sin reimprimirlo,
 *     que es justo lo que pasa cuando un piso se vende.
 */
export async function GET(peticion: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = clienteAdmin();

  const { data } = await supabase
    .from("qr_codes")
    .select(
      "id, business_id, target_type, target_url, whatsapp_message, property_id, is_active, utm_source, utm_medium, utm_campaign, businesses(slug, status, trial_ends_at, whatsapp_phone), properties(slug)",
    )
    .eq("code", code)
    .is("deleted_at", null)
    .maybeSingle();

  const base = entornoPublico.urlApp;
  if (!data) return NextResponse.redirect(new URL("/", base));

  const qr = data as unknown as {
    id: string;
    business_id: string;
    target_type: string;
    target_url: string | null;
    whatsapp_message: string | null;
    is_active: boolean;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    businesses: { slug: string; status: string; trial_ends_at: string | null; whatsapp_phone: string | null } | null;
    properties: { slug: string } | null;
  };

  const negocio = qr.businesses;
  if (!negocio) return NextResponse.redirect(new URL("/", base));

  const activo =
    negocio.status === "active" ||
    (negocio.status === "trial" && negocio.trial_ends_at !== null && new Date(negocio.trial_ends_at) > new Date());

  if (!activo) {
    return NextResponse.redirect(new URL(`/trial-expired/${negocio.slug}`, base));
  }

  // El escaneo se cuenta aunque después falle la redirección: es el dato que
  // dice si el cartel del escaparate sirve para algo.
  await Promise.all([
    supabase.from("qr_scan_events").insert({
      business_id: qr.business_id,
      qr_id: qr.id,
      device_kind: tipoDispositivo(peticion.headers.get("user-agent")),
      referrer_host: (() => {
        try {
          return peticion.headers.get("referer") ? new URL(peticion.headers.get("referer")!).host : null;
        } catch {
          return null;
        }
      })(),
    }),
    supabase.rpc("registrar_escaneo_qr", { p_qr_id: qr.id }),
    registrarEvento({
      businessId: qr.business_id,
      tipo: "qr_landing_view",
      qrId: qr.id,
      deviceKind: tipoDispositivo(peticion.headers.get("user-agent")),
      utm: { source: qr.utm_source, medium: qr.utm_medium, campaign: qr.utm_campaign },
    }),
  ]);

  if (!qr.is_active) {
    return NextResponse.redirect(new URL(`/b/${negocio.slug}`, base));
  }

  if (qr.target_type === "whatsapp") {
    const destino = enlaceWhatsapp(negocio.whatsapp_phone, qr.whatsapp_message ?? undefined);
    if (destino) return NextResponse.redirect(destino);
  }

  if (qr.target_type === "url_personalizada" && qr.target_url) {
    try {
      return NextResponse.redirect(new URL(qr.target_url));
    } catch {
      // URL inválida guardada en el panel: mejor la landing que un error.
    }
  }

  const rutas: Record<string, string> = {
    landing: `/b/${negocio.slug}`,
    valoracion: `/b/${negocio.slug}/valoracion`,
    buscar_vivienda: `/b/${negocio.slug}/buscar-vivienda`,
    servicios: `/b/${negocio.slug}/servicios`,
    administracion_fincas: `/b/${negocio.slug}/servicios?area=administracion_fincas`,
    opinion: `/b/${negocio.slug}/opinion`,
    inmueble: qr.properties?.slug
      ? `/b/${negocio.slug}/inmuebles/${qr.properties.slug}`
      : `/b/${negocio.slug}/inmuebles`,
  };

  const destino = new URL(rutas[qr.target_type] ?? `/b/${negocio.slug}`, base);
  destino.searchParams.set("qr", code);
  if (qr.utm_source) destino.searchParams.set("utm_source", qr.utm_source);
  if (qr.utm_medium) destino.searchParams.set("utm_medium", qr.utm_medium);
  if (qr.utm_campaign) destino.searchParams.set("utm_campaign", qr.utm_campaign);

  return NextResponse.redirect(destino);
}
