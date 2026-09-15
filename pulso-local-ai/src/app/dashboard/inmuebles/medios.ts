"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puedeEscribir, requerirSesionPanel } from "@/lib/autorizacion";

/**
 * Multimedia de los inmuebles.
 *
 * El archivo se sube desde el navegador directamente a Supabase Storage (no pasa
 * por el servidor de Next: una foto de 8 MB no tiene por qué atravesar una
 * función serverless). Estas acciones solo registran la fila y comprueban el
 * rol; Storage aplica además su propia política, que exige que la primera
 * carpeta de la ruta sea el business_id de quien sube.
 */

export async function registrarMedio(datos: {
  propertyId: string;
  url: string;
  storagePath?: string;
  kind?: "foto" | "video" | "tour_virtual" | "plano" | "documento";
  altText?: string;
}) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite subir archivos" };

  const validado = z
    .object({
      propertyId: z.string().uuid(),
      url: z.string().url().max(600),
      storagePath: z.string().max(400).optional(),
      kind: z.enum(["foto", "video", "tour_virtual", "plano", "documento"]).default("foto"),
      altText: z.string().max(160).optional(),
    })
    .safeParse(datos);
  if (!validado.success) return { error: "Datos del archivo no válidos" };

  const supabase = await clienteServidor();

  const { count } = await supabase
    .from("property_media")
    .select("id", { count: "exact", head: true })
    .eq("property_id", validado.data.propertyId);

  const { error } = await supabase.from("property_media").insert({
    property_id: validado.data.propertyId,
    business_id: sesion.negocio.id,
    kind: validado.data.kind,
    url: validado.data.url,
    storage_path: validado.data.storagePath ?? null,
    alt_text: validado.data.altText ?? null,
    position: count ?? 0,
    is_cover: (count ?? 0) === 0 && validado.data.kind === "foto",
  });

  if (error) return { error: `No se ha podido registrar: ${error.message}` };
  revalidatePath(`/dashboard/inmuebles/${validado.data.propertyId}`);
  return { ok: true };
}

/** Solo puede haber una portada por inmueble: la anterior se desmarca antes. */
export async function marcarPortada(mediaId: string, propertyId: string) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite editar archivos" };

  const supabase = await clienteServidor();
  await supabase.from("property_media").update({ is_cover: false }).eq("property_id", propertyId);
  const { error } = await supabase
    .from("property_media")
    .update({ is_cover: true })
    .eq("id", mediaId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido marcar la portada" };
  revalidatePath(`/dashboard/inmuebles/${propertyId}`);
  return { ok: true };
}

export async function borrarMedio(mediaId: string, propertyId: string) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite borrar archivos" };

  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("property_media")
    .select("storage_path")
    .eq("id", mediaId)
    .eq("business_id", sesion.negocio.id)
    .maybeSingle();

  const { error } = await supabase.from("property_media").delete().eq("id", mediaId).eq("business_id", sesion.negocio.id);
  if (error) return { error: "No se ha podido borrar" };

  const ruta = (data as { storage_path: string | null } | null)?.storage_path;
  if (ruta) await supabase.storage.from("medios").remove([ruta]);

  revalidatePath(`/dashboard/inmuebles/${propertyId}`);
  return { ok: true };
}
