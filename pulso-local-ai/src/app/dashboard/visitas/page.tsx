import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Aviso } from "@/components/ui/aviso";
import { FilaVisita } from "@/components/panel/fila-visita";
import type { EstadoVisita, ModoVisita } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Visitas" };

export interface VisitaConDatos {
  id: string;
  mode: ModoVisita;
  preferred_date: string | null;
  preferred_slot: string | null;
  status: EstadoVisita;
  internal_note: string | null;
  created_at: string;
  properties: { title: string; slug: string } | null;
  leads: { name: string; phone: string | null; email: string | null } | null;
}

export default async function PanelVisitas() {
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const { data } = await supabase
    .from("visit_requests")
    .select("id, mode, preferred_date, preferred_slot, status, internal_note, created_at, properties(title, slug), leads(name, phone, email)")
    .eq("business_id", sesion.negocio.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const visitas = (data as unknown as VisitaConDatos[] | null) ?? [];
  const pendientes = visitas.filter((v) => v.status === "pendiente");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Visitas</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          {pendientes.length} sin confirmar · {visitas.length} en total
        </p>
      </header>

      <Aviso tono="info" titulo="Sobre el calendario">
        Confirmar una visita aquí cambia su estado y deja constancia para el equipo, pero no crea eventos en
        Google Calendar. La sincronización se activará cuando la autorices desde Configuración.
      </Aviso>

      {visitas.length ? (
        <div className="space-y-3">
          {visitas.map((visita) => (
            <FilaVisita key={visita.id} visita={visita} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--texto-suave)]">
          Todavía no hay solicitudes de visita. Aparecerán aquí en cuanto alguien las pida desde una ficha.
        </p>
      )}
    </div>
  );
}
