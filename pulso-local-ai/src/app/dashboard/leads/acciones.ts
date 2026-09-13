"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { requerirSesionPanel, puedeEscribir } from "@/lib/autorizacion";

/**
 * Acciones del CRM.
 *
 * Se ejecutan con la sesión del usuario, así que RLS vuelve a comprobar la
 * pertenencia al negocio: aunque alguien manipulara el `leadId`, la base de
 * datos no dejaría tocar un lead de otro tenant. La comprobación de rol de aquí
 * es para dar un mensaje claro, no para sostener la seguridad.
 */

const idLead = z.string().uuid();

export async function cambiarEstadoLead(leadId: string, estado: string) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite editar contactos" };

  const datos = z
    .object({
      leadId: idLead,
      estado: z.enum(["nuevo", "contactado", "cualificado", "visita_agendada", "cerrado", "descartado"]),
    })
    .safeParse({ leadId, estado });
  if (!datos.success) return { error: "Estado no válido" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("leads")
    .update({ status: datos.data.estado })
    .eq("id", datos.data.leadId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido actualizar" };

  // Historial: quién movió el lead y a qué estado.
  await supabase.from("lead_assignments").insert({
    lead_id: datos.data.leadId,
    business_id: sesion.negocio.id,
    assigned_by: sesion.userId,
    to_status: datos.data.estado,
  });

  revalidatePath("/dashboard/leads");
  return { ok: true };
}

export async function anadirNota(leadId: string, formulario: FormData) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite escribir notas" };

  const datos = z
    .object({ leadId: idLead, nota: z.string().trim().min(1).max(2000) })
    .safeParse({ leadId, nota: formulario.get("nota") });
  if (!datos.success) return { error: "La nota está vacía" };

  const supabase = await clienteServidor();
  const { error } = await supabase.from("lead_notes").insert({
    lead_id: datos.data.leadId,
    business_id: sesion.negocio.id,
    author_id: sesion.userId,
    note: datos.data.nota,
  });

  if (error) return { error: "No se ha podido guardar la nota" };
  revalidatePath("/dashboard/leads");
  return { ok: true };
}

export async function asignarLead(leadId: string, memberId: string | null) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite asignar contactos" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: memberId })
    .eq("id", leadId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido asignar" };
  revalidatePath("/dashboard/leads");
  return { ok: true };
}
