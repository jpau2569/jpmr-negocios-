"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puedeEscribir, puedeAdministrar, requerirSesionPanel } from "@/lib/autorizacion";
import { aSlug } from "@/lib/formato";

const esquemaQr = z.object({
  label: z.string().trim().min(2, "Ponle un nombre que reconozcas").max(80),
  code: z.string().trim().max(60).optional(),
  target_type: z.enum([
    "landing", "inmueble", "valoracion", "buscar_vivienda", "servicios",
    "administracion_fincas", "opinion", "whatsapp", "url_personalizada",
  ]),
  property_id: z.string().uuid().optional().or(z.literal("")),
  target_url: z.string().url("La URL no es válida").max(600).optional().or(z.literal("")),
  whatsapp_message: z.string().trim().max(300).optional(),
  location_note: z.string().trim().max(120).optional(),
  utm_campaign: z.string().trim().max(60).optional(),
  fg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0E2A3F"),
  bg_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
});

/**
 * Alta de un QR.
 *
 * El código corto se guarda en la base de datos y el cartel apunta a `/q/<code>`,
 * nunca a la URL final. Así, cuando la vivienda se venda, el mismo cartel puede
 * llevar a otra cosa sin reimprimir nada.
 */
export async function crearQr(formulario: FormData) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite crear códigos QR" };

  const datos = esquemaQr.safeParse(Object.fromEntries(formulario.entries()));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos" };
  const d = datos.data;

  if (d.target_type === "url_personalizada" && !d.target_url) {
    return { error: "Para una URL personalizada hay que indicar la dirección" };
  }

  const base = aSlug(d.code || `${sesion.negocio.slug}-${d.label}`);
  const supabase = await clienteServidor();

  // El código es único en todo el sistema: si está cogido, se le añade sufijo.
  let codigo = base;
  for (let intento = 0; intento < 5; intento++) {
    const { data: existe } = await supabase.from("qr_codes").select("id").eq("code", codigo).maybeSingle();
    if (!existe) break;
    codigo = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { error } = await supabase.from("qr_codes").insert({
    business_id: sesion.negocio.id,
    property_id: d.property_id || null,
    code: codigo,
    label: d.label,
    location_note: d.location_note || null,
    target_type: d.target_type,
    target_url: d.target_url || null,
    whatsapp_message: d.whatsapp_message || null,
    utm_source: "qr",
    utm_medium: "impreso",
    utm_campaign: d.utm_campaign || null,
    fg_color: d.fg_color,
    bg_color: d.bg_color,
  });

  if (error) return { error: `No se ha podido crear: ${error.message}` };
  revalidatePath("/dashboard/qr");
  return { ok: true, code: codigo };
}

export async function alternarQr(qrId: string, activo: boolean) {
  const sesion = await requerirSesionPanel();
  if (!puedeEscribir(sesion.rol)) return { error: "Tu rol no permite editar códigos QR" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("qr_codes")
    .update({ is_active: activo })
    .eq("id", qrId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido actualizar" };
  revalidatePath("/dashboard/qr");
  return { ok: true };
}

/**
 * Un QR no se borra: se archiva. El cartel sigue existiendo en la calle y el
 * código tiene que seguir resolviendo a algo (la landing) en vez de a un 404.
 */
export async function archivarQr(qrId: string) {
  const sesion = await requerirSesionPanel();
  if (!puedeAdministrar(sesion.rol)) return { error: "Solo un administrador puede archivar códigos" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("qr_codes")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", qrId)
    .eq("business_id", sesion.negocio.id);

  if (error) return { error: "No se ha podido archivar" };
  revalidatePath("/dashboard/qr");
  return { ok: true };
}
