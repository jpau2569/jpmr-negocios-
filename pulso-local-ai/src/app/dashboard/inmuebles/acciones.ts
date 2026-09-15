"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puedeAdministrar, puedeEscribir, requerirSesionPanel } from "@/lib/autorizacion";
import { aSlug } from "@/lib/formato";
import { TIPOS_INMUEBLE } from "@/lib/validaciones/formularios";

const numeroOpcional = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

const booleanoCasilla = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

const esquemaInmueble = z.object({
  title: z.string().trim().min(3, "El título es obligatorio").max(160),
  slug: z.string().trim().max(80).optional(),
  reference_code: z.string().trim().max(40).optional(),
  operation_type: z.enum(["venta", "alquiler", "alquiler_opcion_compra", "traspaso"]),
  property_type: z.enum(TIPOS_INMUEBLE),
  status: z.enum(["borrador", "disponible", "reservado", "vendido", "alquilado", "archivado"]),
  price: numeroOpcional,
  municipality: z.string().trim().max(80).optional(),
  neighborhood: z.string().trim().max(80).optional(),
  public_address: z.string().trim().max(160).optional(),
  private_address: z.string().trim().max(200).optional(),
  show_public_address: booleanoCasilla,
  bedrooms: numeroOpcional,
  bathrooms: numeroOpcional,
  built_area_m2: numeroOpcional,
  usable_area_m2: numeroOpcional,
  floor: z.string().trim().max(20).optional(),
  has_elevator: booleanoCasilla,
  has_terrace: booleanoCasilla,
  has_garage: booleanoCasilla,
  energy_rating: z.enum(["A", "B", "C", "D", "E", "F", "G", "en_tramite", "exento"]).optional().or(z.literal("")),
  year_built: numeroOpcional,
  short_description: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  conditions_note: z.string().trim().max(500).optional(),
  tags: z.string().trim().max(200).optional(),
  featured: booleanoCasilla,
});

function desdeFormulario(formulario: FormData) {
  const bruto = Object.fromEntries(formulario.entries());
  return esquemaInmueble.safeParse(bruto);
}

/**
 * Alta y edición de inmuebles.
 *
 * `private_address` se guarda pero no sale en ninguna vista pública, y
 * `public_address` solo se enseña si el administrador marca la casilla: publicar
 * el portal exacto de una vivienda habitada es un problema de seguridad para
 * quien vive dentro.
 */
export async function guardarInmueble(propertyId: string | null, formulario: FormData) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite editar inmuebles" };

  const datos = desdeFormulario(formulario);
  if (!datos.success) {
    return { error: datos.error.issues[0]?.message ?? "Revisa los datos del inmueble" };
  }

  const d = datos.data;
  const supabase = await clienteServidor();
  const fila = {
    business_id: sesion.negocio.id,
    title: d.title,
    slug: aSlug(d.slug || d.title),
    reference_code: d.reference_code || null,
    operation_type: d.operation_type,
    property_type: d.property_type,
    status: d.status,
    price: d.price,
    municipality: d.municipality || null,
    neighborhood: d.neighborhood || null,
    public_address: d.public_address || null,
    private_address: d.private_address || null,
    show_public_address: d.show_public_address,
    bedrooms: d.bedrooms,
    bathrooms: d.bathrooms,
    built_area_m2: d.built_area_m2,
    usable_area_m2: d.usable_area_m2,
    floor: d.floor || null,
    has_elevator: d.has_elevator,
    has_terrace: d.has_terrace,
    has_garage: d.has_garage,
    energy_rating: d.energy_rating || null,
    year_built: d.year_built,
    short_description: d.short_description || null,
    description: d.description || null,
    conditions_note: d.conditions_note || null,
    tags: (d.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    featured: d.featured,
  };

  if (propertyId) {
    const { error } = await supabase
      .from("properties")
      .update(fila)
      .eq("id", propertyId)
      .eq("business_id", sesion.negocio.id);
    if (error) return { error: `No se ha podido guardar: ${error.message}` };
  } else {
    const { data, error } = await supabase.from("properties").insert(fila).select("id").single();
    if (error) return { error: `No se ha podido crear: ${error.message}` };
    revalidatePath("/dashboard/inmuebles");
    redirect(`/dashboard/inmuebles/${(data as { id: string }).id}`);
  }

  revalidatePath("/dashboard/inmuebles");
  revalidatePath(`/b/${sesion.negocio.slug}`, "layout");
  return { ok: true };
}

/** Publicar y despublicar. Publicar es poner fecha; retirar es quitarla. */
export async function alternarPublicacion(propertyId: string, publicar: boolean) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite publicar" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("properties")
    .update({
      published_at: publicar ? new Date().toISOString() : null,
      status: publicar ? "disponible" : "borrador",
    })
    .eq("id", propertyId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido cambiar la publicación" };
  revalidatePath("/dashboard/inmuebles");
  revalidatePath(`/b/${sesion.negocio.slug}`, "layout");
  return { ok: true };
}

export async function duplicarInmueble(propertyId: string) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite duplicar inmuebles" };

  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("business_id", sesion.negocio.id)
    .maybeSingle();
  if (!data) return { error: "Inmueble no encontrado" };

  const original = data as Record<string, unknown>;
  const sufijo = Date.now().toString(36).slice(-4);
  delete original.id;
  delete original.created_at;
  delete original.updated_at;
  delete original.view_count;

  const { error } = await supabase.from("properties").insert({
    ...original,
    title: `${original.title as string} (copia)`,
    slug: `${original.slug as string}-${sufijo}`,
    reference_code: original.reference_code ? `${original.reference_code as string}-C` : null,
    status: "borrador",
    published_at: null,
    featured: false,
  });

  if (error) return { error: `No se ha podido duplicar: ${error.message}` };
  revalidatePath("/dashboard/inmuebles");
  return { ok: true };
}

/**
 * Archivar en vez de borrar: un inmueble vendido sigue teniendo leads, visitas y
 * estadísticas colgando. Borrarlo sería perder el historial comercial.
 */
export async function archivarInmueble(propertyId: string) {
  const sesion = await requerirSesionPanel();
  if (!puedeAdministrar(sesion.rol)) return { error: "Solo un administrador puede archivar" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("properties")
    .update({ status: "archivado", published_at: null, deleted_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido archivar" };
  revalidatePath("/dashboard/inmuebles");
  return { ok: true };
}
