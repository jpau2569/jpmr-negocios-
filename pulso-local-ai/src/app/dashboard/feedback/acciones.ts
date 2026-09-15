"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puedeEscribir, requerirSesionPanel } from "@/lib/autorizacion";

export async function resolverOpinion(feedbackId: string, formulario: FormData) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite gestionar opiniones" };

  const datos = z
    .object({
      feedbackId: z.string().uuid(),
      nota: z.string().trim().max(1000).optional(),
      estado: z.enum(["nuevo", "en_revision", "resuelto"]),
    })
    .safeParse({
      feedbackId,
      nota: formulario.get("nota") ?? undefined,
      estado: formulario.get("estado") ?? "en_revision",
    });
  if (!datos.success) return { error: "Datos no válidos" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("feedback")
    .update({
      status: datos.data.estado,
      internal_note: datos.data.nota || null,
      resolved_at: datos.data.estado === "resuelto" ? new Date().toISOString() : null,
      resolved_by: datos.data.estado === "resuelto" ? sesion.userId : null,
    })
    .eq("id", datos.data.feedbackId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido guardar" };
  revalidatePath("/dashboard/feedback");
  return { ok: true };
}
