import Link from "next/link";
import { admin } from "@/lib/supabase/servidor";
import { hayBackend, slugsConocidos, leerEspacio } from "@/lib/datos";
import { Resumen, type Metricas } from "@/components/dashboard/resumen";
import { Tarjeta } from "@/components/ui/basicos";
import type { TipoEventoAnalitica } from "@/types/negocio";

// ============================================================================
//  Resumen — /dashboard
// ----------------------------------------------------------------------------
//  Con base de datos: cuenta de verdad los eventos de los últimos 30 días.
//  Sin base de datos: enseña una muestra CLARAMENTE MARCADA como tal, para
//  poder explicar el panel a un cliente sin fingir que son sus números.
// ============================================================================

export const dynamic = "force-dynamic";

const MUESTRA: Metricas = {
  escaneos: 243,
  visitasUnicas: 198,
  vistasCarta: 176,
  vistasMenuDia: 121,
  clicsWhatsapp: 34,
  llamadas: 19,
  reservas: 18,
  grupos: 4,
  opiniones: 11,
  clicsResena: 7,
  contactos: 26,
  porQr: [
    { etiqueta: "Mesas", escaneos: 128 },
    { etiqueta: "Barra", escaneos: 54 },
    { etiqueta: "Escaparate", escaneos: 38 },
    { etiqueta: "Ticket", escaneos: 23 },
  ],
  platosMasVistos: [
    { nombre: "Cachopo especial «Taberna»", vistas: 46 },
    { nombre: "Jamón ibérico (100 g)", vistas: 31 },
    { nombre: "Calamares fritos de potera", vistas: 27 },
    { nombre: "Torrija de Baileys con helado", vistas: 22 },
  ],
};

async function medir(slug: string): Promise<Metricas | null> {
  const db = admin();
  const { data: negocio } = await db.from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (!negocio) return null;

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: eventos } = await db
    .from("analytics_events")
    .select("event_type, qr_code_id, subject_id, session_hash")
    .eq("business_id", negocio.id)
    .gte("created_at", desde);

  const filas = eventos ?? [];
  const cuantos = (tipo: TipoEventoAnalitica) => filas.filter((e) => e.event_type === tipo).length;

  const [qrs, reservas, grupos, opiniones, contactos] = await Promise.all([
    db.from("qr_codes").select("id, label").eq("business_id", negocio.id),
    db.from("reservations").select("id", { count: "exact", head: true }).eq("business_id", negocio.id).gte("created_at", desde),
    db.from("group_requests").select("id", { count: "exact", head: true }).eq("business_id", negocio.id).gte("created_at", desde),
    db.from("feedback").select("id", { count: "exact", head: true }).eq("business_id", negocio.id).gte("created_at", desde),
    db.from("leads").select("id", { count: "exact", head: true }).eq("business_id", negocio.id).gte("created_at", desde),
  ]);

  const etiquetaDeQr = new Map((qrs.data ?? []).map((q) => [q.id, q.label]));
  const porQr = new Map<string, number>();
  for (const e of filas) {
    if (e.event_type !== "qr_landing_view" || !e.qr_code_id) continue;
    const etiqueta = etiquetaDeQr.get(e.qr_code_id) ?? "Sin etiquetar";
    porQr.set(etiqueta, (porQr.get(etiqueta) ?? 0) + 1);
  }

  // Los platos más mirados: se cuentan los dish_view y se traducen los ids a
  // nombres con una sola consulta.
  const vistasPlato = new Map<string, number>();
  for (const e of filas) {
    if (e.event_type !== "dish_view" || !e.subject_id) continue;
    vistasPlato.set(e.subject_id, (vistasPlato.get(e.subject_id) ?? 0) + 1);
  }
  let platosMasVistos: { nombre: string; vistas: number }[] = [];
  if (vistasPlato.size > 0) {
    const { data: platos } = await db
      .from("menu_items")
      .select("id, name")
      .in("id", [...vistasPlato.keys()]);
    platosMasVistos = (platos ?? [])
      .map((p) => ({ nombre: p.name, vistas: vistasPlato.get(p.id) ?? 0 }))
      .sort((a, b) => b.vistas - a.vistas)
      .slice(0, 6);
  }

  return {
    escaneos: cuantos("qr_landing_view"),
    visitasUnicas: new Set(filas.map((e) => e.session_hash).filter(Boolean)).size,
    vistasCarta: cuantos("menu_view"),
    vistasMenuDia: cuantos("daily_menu_view"),
    clicsWhatsapp: cuantos("whatsapp_click"),
    llamadas: cuantos("call_click"),
    clicsResena: cuantos("google_review_click"),
    reservas: reservas.count ?? 0,
    grupos: grupos.count ?? 0,
    opiniones: opiniones.count ?? 0,
    contactos: contactos.count ?? 0,
    porQr: [...porQr.entries()]
      .map(([etiqueta, escaneos]) => ({ etiqueta, escaneos }))
      .sort((a, b) => b.escaneos - a.escaneos),
    platosMasVistos,
  };
}

export default async function PaginaPanel({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>;
}) {
  const { negocio } = await searchParams;
  const slugs = slugsConocidos();
  const slug = negocio && slugs.includes(negocio) ? negocio : (slugs[0] ?? "");
  const espacio = slug ? await leerEspacio(slug) : null;

  const reales = hayBackend() && slug ? await medir(slug) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">
            {espacio?.negocio.name ?? "Resumen"}
          </h1>
          <p className="text-xs text-white/50">Últimos 30 días</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => (
            <Link
              key={s}
              href={`/dashboard?negocio=${s}`}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                s === slug ? "border-[#d4a03c] text-[#d4a03c]" : "border-white/15 text-white/60"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <Resumen metricas={reales ?? MUESTRA} demo={reales === null} />

      {espacio ? (
        <Tarjeta className="mt-6 p-4">
          <p className="text-sm text-white/65">
            Espacio público:{" "}
            <Link href={`/b/${slug}`} className="underline underline-offset-4">/b/{slug}</Link>
            {" · "}
            <Link href={`/dashboard/qr?negocio=${slug}`} className="underline underline-offset-4">
              Generar sus QR
            </Link>
          </p>
        </Tarjeta>
      ) : null}
    </>
  );
}
