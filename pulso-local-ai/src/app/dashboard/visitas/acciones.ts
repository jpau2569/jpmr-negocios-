"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puedeEscribir, requerirSesionPanel } from "@/lib/autorizacion";

/**
 * Estado de una solicitud de visita.
 *
 * Confirmar aquí NO crea ningún evento en Google Calendar. La integración está
 * prevista (`visit_requests.calendar_event_id` existe y el adaptador está
 * documentado), pero escribir en el calendario de alguien exige que esa persona
 * lo autorice explícitamente antes, no que nosotros lo demos por hecho.
 */
export async function cambiarEstadoVisita(visitaId: string, estado: string) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite gestionar visitas" };

  const datos = z
    .object({
      visitaId: z.string().uuid(),
      estado: z.enum(["pendiente", "confirmado", "realizado", "cancelado"]),
    })
    .safeParse({ visitaId, estado });
  if (!datos.success) return { error: "Estado no válido" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("visit_requests")
    .update({
      status: datos.data.estado,
      confirmed_at: datos.data.estado === "confirmado" ? new Date().toISOString() : null,
    })
    .eq("id", datos.data.visitaId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido actualizar la visita" };
  revalidatePath("/dashboard/visitas");
  return { ok: true };
}
