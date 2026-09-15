import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Aviso } from "@/components/ui/aviso";
import { TarjetaMetrica } from "@/components/panel/metricas";
import { GraficoBarras, GraficoEvolucion, type PuntoSerie } from "@/components/panel/graficos";
import type { ResumenNegocio, TipoEvento } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analítica" };

const NOMBRE_EVENTO: Partial<Record<TipoEvento, string>> = {
  qr_landing_view: "Entradas por QR",
  public_landing_view: "Visitas a la landing",
  property_list_view: "Catálogo abierto",
  property_view: "Fichas de inmueble",
  property_gallery_view: "Galerías abiertas",
  property_tour_click: "Tours virtuales",
  service_view: "Servicios",
  whatsapp_click: "Clics a WhatsApp",
  call_click: "Clics a llamar",
  directions_click: "Cómo llegar",
  valuation_start: "Valoración empezada",
  valuation_submit: "Valoración enviada",
  buyer_request_start: "Búsqueda empezada",
  buyer_request_submit: "Búsqueda enviada",
  visit_request_start: "Visita empezada",
  visit_request_submit: "Visita solicitada",
  feedback_start: "Opinión empezada",
  feedback_submit: "Opinión enviada",
  google_review_click: "Clics a Google",
  lead_submit: "Contactos captados",
  ai_chat_open: "Asistente abierto",
  ai_question_submit: "Preguntas al asistente",
};

/**
 * Analítica del negocio.
 *
 * Todo lo que se ve aquí sale de eventos anónimos: no hay ningún dato personal
 * en `analytics_events` y no se puede reconstruir quién hizo qué. Lo que sí se
 * puede saber es qué cartel funciona y qué inmueble genera interés, que es para
 * lo que sirve.
 */
export default async function PanelAnalitica({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const sesion = await requerirSesionPanel();
  const { dias } = await searchParams;
  const periodo = [7, 30, 90].includes(Number(dias)) ? Number(dias) : 30;
  const desde = new Date(Date.now() - periodo * 86_400_000).toISOString();

  const supabase = await clienteServidor();

  const [{ data: resumen }, { data: serie }, { data: ranking }, { data: qr }, { data: eventos }] = await Promise.all([
    supabase.rpc("resumen_negocio", { p_business_id: sesion.negocio.id, p_desde: desde }),
    supabase.rpc("serie_eventos", { p_business_id: sesion.negocio.id, p_dias: periodo }),
    supabase.rpc("ranking_inmuebles", { p_business_id: sesion.negocio.id, p_dias: periodo, p_limite: 10 }),
    supabase.rpc("rendimiento_qr", { p_business_id: sesion.negocio.id, p_dias: periodo }),
    supabase
      .from("analytics_events")
      .select("event_type, device_kind, utm_source, utm_campaign")
      .eq("business_id", sesion.negocio.id)
      .gte("created_at", desde)
      .limit(20000),
  ]);

  const m = (resumen as ResumenNegocio | null) ?? null;
  const filas = (eventos as { event_type: TipoEvento; device_kind: string | null; utm_source: string | null; utm_campaign: string | null }[] | null) ?? [];

  function contar<T extends string>(clave: (f: (typeof filas)[number]) => T | null | undefined) {
    const mapa = new Map<string, number>();
    for (const fila of filas) {
      const valor = clave(fila);
      if (!valor) continue;
      mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }

  const porTipo = contar((f) => f.event_type).map(([tipo, total]) => ({
    etiqueta: NOMBRE_EVENTO[tipo as TipoEvento] ?? tipo,
    valor: total,
  }));
  const porDispositivo = contar((f) => f.device_kind).map(([d, total]) => ({ etiqueta: d, valor: total }));
  const porFuente = contar((f) => f.utm_source).map(([s, total]) => ({ etiqueta: s, valor: total }));
  const porCampana = contar((f) => f.utm_campaign).map(([c, total]) => ({ etiqueta: c, valor: total }));

  const puntos = ((serie as { dia: string; vistas: number; leads: number; whatsapp: number }[] | null) ?? []).map(
    (p): PuntoSerie => ({
      dia: new Date(p.dia).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      vistas: Number(p.vistas),
      leads: Number(p.leads),
      whatsapp: Number(p.whatsapp),
    }),
  );

  const visitas = m?.visitas_unicas ?? 0;
  const conversion = (valor: number) => (visitas > 0 ? `${Math.round((valor / visitas) * 100)} % de las visitas` : undefined);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analítica</h1>
          <p className="text-sm text-[var(--texto-suave)]">Últimos {periodo} días.</p>
        </div>
        <nav className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <a
              key={d}
              href={`/dashboard/analitica?dias=${d}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                periodo === d
                  ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                  : "border-[var(--borde)]"
              }`}
            >
              {d} días
            </a>
          ))}
        </nav>
      </header>

      <Aviso tono="info" titulo="Analítica sin datos personales">
        Los eventos no guardan nombres, teléfonos ni textos escritos por el visitante. La sesión es un
        identificador aleatorio que desaparece al cerrar la pestaña.
      </Aviso>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetrica titulo="Visitas únicas" valor={visitas} icono="usuarios" />
        <TarjetaMetrica titulo="Escaneos de QR" valor={m?.escaneos_qr ?? 0} icono="qr" />
        <TarjetaMetrica
          titulo="Conversión a WhatsApp"
          valor={m?.clics_whatsapp ?? 0}
          detalle={conversion(m?.clics_whatsapp ?? 0)}
          icono="whatsapp"
        />
        <TarjetaMetrica
          titulo="Conversión a contacto"
          valor={m?.leads ?? 0}
          detalle={conversion(m?.leads ?? 0)}
          icono="usuarios"
          tono="bueno"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolución</CardTitle>
        </CardHeader>
        <CardContent>
          <GraficoEvolucion serie={puntos} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Qué hace la gente</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoBarras datos={porTipo.slice(0, 12)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inmuebles con más interés</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoBarras
              datos={((ranking as { titulo: string; vistas: number; leads: number }[] | null) ?? []).map((r) => ({
                etiqueta: r.titulo,
                valor: Number(r.vistas),
                secundario: Number(r.leads),
              }))}
              etiquetaValor="vistas"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rendimiento por QR</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoBarras
              datos={((qr as { etiqueta: string; escaneos: number; leads: number }[] | null) ?? []).map((r) => ({
                etiqueta: r.etiqueta,
                valor: Number(r.escaneos),
                secundario: Number(r.leads),
              }))}
              etiquetaValor="escaneos"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispositivos, fuentes y campañas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--texto-suave)]">Dispositivo</p>
              <GraficoBarras datos={porDispositivo} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--texto-suave)]">Fuente</p>
              <GraficoBarras datos={porFuente} />
            </div>
            {porCampana.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-[var(--texto-suave)]">Campaña</p>
                <GraficoBarras datos={porCampana} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
