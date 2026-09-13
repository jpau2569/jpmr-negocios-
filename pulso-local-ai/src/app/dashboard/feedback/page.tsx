import Link from "next/link";
import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso } from "@/components/ui/aviso";
import { TarjetaMetrica } from "@/components/panel/metricas";
import { FichaOpinion } from "@/components/panel/ficha-opinion";
import type { Opinion } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Opiniones" };

export default async function PanelOpiniones() {
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const [{ data }, { data: ajustes }, { data: clics }] = await Promise.all([
    supabase
      .from("feedback")
      .select("*")
      .eq("business_id", sesion.negocio.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("business_settings").select("google_review_url").eq("business_id", sesion.negocio.id).maybeSingle(),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", sesion.negocio.id)
      .eq("event_type", "google_review_click"),
  ]);

  const opiniones = (data as Opinion[] | null) ?? [];
  const urlResenas = (ajustes as { google_review_url: string | null } | null)?.google_review_url ?? null;
  const media = opiniones.length
    ? Math.round((opiniones.reduce((s, o) => s + o.rating, 0) / opiniones.length) * 10) / 10
    : null;
  const bajas = opiniones.filter((o) => o.rating <= 3 && o.status !== "resuelto");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Opiniones y reputación</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          Lo que te cuentan en privado, antes de que acabe en una reseña pública.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <TarjetaMetrica titulo="Opiniones recibidas" valor={opiniones.length} icono="estrella" />
        <TarjetaMetrica titulo="Nota media" valor={media ?? "—"} icono="estrella" tono="bueno" />
        <TarjetaMetrica
          titulo="Por atender"
          valor={bajas.length}
          icono="aviso"
          tono={bajas.length ? "atencion" : "neutro"}
        />
        <TarjetaMetrica titulo="Clics hacia Google" valor={clics?.length ?? 0} icono="flecha" />
      </section>

      {!urlResenas ? (
        <Aviso tono="aviso" titulo="Falta tu enlace de reseñas de Google">
          Sin él, el formulario de opinión recoge el comentario privado pero no puede ofrecer el paso a la reseña
          pública.{" "}
          <Link href="/dashboard/configuracion" className="underline underline-offset-4">
            Configúralo aquí
          </Link>
          .
        </Aviso>
      ) : null}

      <Aviso tono="info" titulo="Cómo funciona la solicitud de reseñas">
        El enlace de Google se ofrece a todo el mundo, con cualquier puntuación, y nunca se ofrece nada a cambio.
        Filtrar quién lo ve según la nota está prohibido por Google y es ilegal en varios países, así que no es
        configurable.
      </Aviso>

      {opiniones.length ? (
        <div className="space-y-3">
          {opiniones.map((opinion) => (
            <FichaOpinion key={opinion.id} opinion={opinion} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--texto-suave)]">
          Todavía no hay opiniones. Reparte el QR de opinión al terminar una visita o una gestión.
        </p>
      )}
    </div>
  );
}
