import Link from "next/link";
import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { TarjetaMetrica } from "@/components/panel/metricas";
import { GraficoBarras, GraficoEvolucion, type PuntoSerie } from "@/components/panel/graficos";
import { Aviso } from "@/components/ui/aviso";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResumenNegocio } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resumen" };

export default async function Resumen() {
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const [{ data: resumen }, { data: serie }, { data: ranking }, { data: qr }] = await Promise.all([
    supabase.rpc("resumen_negocio", { p_business_id: sesion.negocio.id }),
    supabase.rpc("serie_eventos", { p_business_id: sesion.negocio.id, p_dias: 30 }),
    supabase.rpc("ranking_inmuebles", { p_business_id: sesion.negocio.id, p_dias: 30, p_limite: 5 }),
    supabase.rpc("rendimiento_qr", { p_business_id: sesion.negocio.id, p_dias: 30 }),
  ]);

  const m = (resumen as ResumenNegocio | null) ?? null;
  const puntos = ((serie as { dia: string; vistas: number; leads: number; whatsapp: number }[] | null) ?? []).map(
    (p): PuntoSerie => ({
      dia: new Date(p.dia).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
      vistas: Number(p.vistas),
      leads: Number(p.leads),
      whatsapp: Number(p.whatsapp),
    }),
  );

  const inmuebles = ((ranking as { titulo: string; vistas: number; leads: number }[] | null) ?? []).map((r) => ({
    etiqueta: r.titulo,
    valor: Number(r.vistas),
    secundario: Number(r.leads),
  }));

  const codigos = ((qr as { etiqueta: string; escaneos: number; leads: number }[] | null) ?? []).map((r) => ({
    etiqueta: r.etiqueta,
    valor: Number(r.escaneos),
    secundario: Number(r.leads),
  }));

  const conversionLead = m && m.visitas_unicas > 0 ? Math.round((m.leads / m.visitas_unicas) * 100) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Resumen</h1>
        <p className="text-sm text-[var(--texto-suave)]">Últimos 30 días de {sesion.negocio.name}.</p>
      </header>

      {sesion.negocio.is_demo_data ? (
        <Aviso tono="aviso" titulo="Este espacio contiene datos de demostración">
          Los inmuebles, contactos y métricas marcados como demo son ficticios y sirven para enseñar cómo queda el
          panel. No son datos reales del negocio.
        </Aviso>
      ) : null}

      <section aria-label="Métricas principales" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetrica titulo="Escaneos de QR" valor={m?.escaneos_qr ?? 0} icono="qr" />
        <TarjetaMetrica titulo="Visitas únicas" valor={m?.visitas_unicas ?? 0} icono="usuarios" />
        <TarjetaMetrica titulo="Fichas de inmueble vistas" valor={m?.fichas_vistas ?? 0} icono="casa" />
        <TarjetaMetrica
          titulo="Leads captados"
          valor={m?.leads ?? 0}
          detalle={conversionLead !== null ? `${conversionLead} % de las visitas` : undefined}
          icono="usuarios"
          tono="bueno"
        />
        <TarjetaMetrica titulo="Clics a WhatsApp" valor={m?.clics_whatsapp ?? 0} icono="whatsapp" />
        <TarjetaMetrica titulo="Clics a llamada" valor={m?.clics_llamada ?? 0} icono="telefono" />
        <TarjetaMetrica
          titulo="Visitas solicitadas"
          valor={m?.visitas_solicitadas ?? 0}
          detalle={m?.visitas_pendientes ? `${m.visitas_pendientes} sin confirmar` : undefined}
          icono="calendario"
          tono={m?.visitas_pendientes ? "atencion" : "neutro"}
        />
        <TarjetaMetrica titulo="Valoraciones pedidas" valor={m?.valoraciones ?? 0} icono="euro" />
        <TarjetaMetrica
          titulo="Opiniones"
          valor={m?.opiniones ?? 0}
          detalle={m?.nota_media ? `Nota media ${m.nota_media}` : undefined}
          icono="estrella"
        />
        <TarjetaMetrica
          titulo="Opiniones por revisar"
          valor={m?.opiniones_bajas ?? 0}
          icono="aviso"
          tono={m?.opiniones_bajas ? "atencion" : "neutro"}
        />
        <TarjetaMetrica titulo="Clics a reseña de Google" valor={m?.clics_resena ?? 0} icono="estrella" />
        <TarjetaMetrica titulo="Inmuebles publicados" valor={m?.inmuebles_publicados ?? 0} icono="casa" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Evolución de los últimos 30 días</CardTitle>
        </CardHeader>
        <CardContent>
          <GraficoEvolucion serie={puntos} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inmuebles más consultados</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoBarras datos={inmuebles} etiquetaValor="vistas" />
            <Link href="/dashboard/inmuebles" className="mt-4 inline-block text-sm underline underline-offset-4">
              Gestionar inmuebles
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rendimiento por QR</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoBarras datos={codigos} etiquetaValor="escaneos" />
            <Link href="/dashboard/qr" className="mt-4 inline-block text-sm underline underline-offset-4">
              Gestionar códigos QR
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
