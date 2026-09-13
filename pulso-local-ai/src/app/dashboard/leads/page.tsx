import Link from "next/link";
import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilaLead } from "@/components/panel/fila-lead";
import { ETIQUETA_ESTADO_LEAD, ETIQUETA_TIPO_LEAD } from "@/lib/etiquetas";
import type { EstadoLead, Lead } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contactos" };

const ESTADOS: EstadoLead[] = ["nuevo", "contactado", "cualificado", "visita_agendada", "cerrado", "descartado"];

export default async function PaginaLeads({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string; q?: string }>;
}) {
  const sesion = await requerirSesionPanel();
  const filtros = await searchParams;
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("leads")
    .select("*, properties(title, slug)")
    .eq("business_id", sesion.negocio.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filtros.estado) consulta = consulta.eq("status", filtros.estado);
  if (filtros.tipo) consulta = consulta.eq("lead_type", filtros.tipo);
  if (filtros.q) consulta = consulta.or(`name.ilike.%${filtros.q}%,phone.ilike.%${filtros.q}%`);

  const [{ data }, { data: miembros }] = await Promise.all([
    consulta,
    supabase
      .from("business_members")
      .select("id, display_name, role")
      .eq("business_id", sesion.negocio.id)
      .eq("is_active", true),
  ]);

  const leads = (data as (Lead & { properties: { title: string; slug: string } | null })[] | null) ?? [];
  const equipo = ((miembros as { id: string; display_name: string | null; role: string }[] | null) ?? []).map((m) => ({
    id: m.id,
    nombre: m.display_name ?? "Sin nombre",
  }));

  const porEstado = ESTADOS.map((estado) => ({
    estado,
    total: leads.filter((l) => l.status === estado).length,
  }));

  function enlace(cambio: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    for (const [clave, valor] of Object.entries({ ...filtros, ...cambio })) if (valor) p.set(clave, valor);
    const cadena = p.toString();
    return `/dashboard/leads${cadena ? `?${cadena}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contactos</h1>
          <p className="text-sm text-[var(--texto-suave)]">
            {leads.length} contactos · {porEstado.find((e) => e.estado === "nuevo")?.total ?? 0} sin atender
          </p>
        </div>
        <a
          href={`/api/panel/leads.csv?negocio=${sesion.negocio.id}`}
          className="text-sm font-semibold underline underline-offset-4"
        >
          Exportar CSV
        </a>
      </header>

      <form action="/dashboard/leads" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={filtros.q ?? ""}
          placeholder="Buscar por nombre o teléfono"
          className="min-h-11 flex-1 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
        />
        <select
          name="tipo"
          defaultValue={filtros.tipo ?? ""}
          className="min-h-11 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] px-3 text-sm"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(ETIQUETA_TIPO_LEAD).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-[var(--radio)] bg-[var(--marca)] px-4 text-sm font-semibold text-[var(--marca-contraste)]"
        >
          Filtrar
        </button>
      </form>

      <nav aria-label="Filtro por estado" className="flex flex-wrap gap-2">
        <Link
          href={enlace({ estado: undefined })}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
            !filtros.estado ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]" : "border-[var(--borde)]"
          }`}
        >
          Todos ({leads.length})
        </Link>
        {porEstado.map((e) => (
          <Link
            key={e.estado}
            href={enlace({ estado: e.estado })}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filtros.estado === e.estado
                ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
                : "border-[var(--borde)]"
            }`}
          >
            {ETIQUETA_ESTADO_LEAD[e.estado]} ({e.total})
          </Link>
        ))}
      </nav>

      {leads.length ? (
        <div className="space-y-3">
          {leads.map((lead) => (
            <FilaLead
              key={lead.id}
              lead={lead}
              inmueble={lead.properties}
              equipo={equipo}
              whatsappNegocio={sesion.negocio.name}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay contactos</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--texto-suave)]">
            Cuando alguien rellene un formulario desde un QR o desde la landing, aparecerá aquí con su origen y su
            consentimiento.{" "}
            <Link href="/dashboard/qr" className="underline underline-offset-4">
              Crea tu primer QR
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-[var(--texto-suave)]">
        <Badge tono="contorno">RGPD</Badge> Cada contacto guarda la fecha del consentimiento y la versión del texto
        legal aceptado. No envíes comunicaciones comerciales a quien no lo haya autorizado.
      </p>
    </div>
  );
}
