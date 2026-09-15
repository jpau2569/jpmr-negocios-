"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puedeAdministrar, requerirSesionPanel } from "@/lib/autorizacion";
import { normalizarHex } from "@/lib/tema";

const urlOpcional = z.string().trim().url("Revisa la dirección web").max(400).optional().or(z.literal(""));

const esquemaPerfil = z.object({
  name: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(160).optional(),
  founded_note: z.string().trim().max(80).optional(),
  description: z.string().trim().max(600).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsapp_phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email("Revisa el correo").max(120).optional().or(z.literal("")),
  address: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  postal_code: z.string().trim().max(12).optional(),
  website_url: urlOpcional,
  review_url: urlOpcional,
  horario_semana: z.string().trim().max(80).optional(),
  horario_sabado: z.string().trim().max(80).optional(),
  horario_domingo: z.string().trim().max(80).optional(),
  color_marca: z.string().max(9).optional(),
  color_acento: z.string().max(9).optional(),
});

/**
 * Perfil público del negocio.
 *
 * Los colores se normalizan antes de guardarse: si alguien pega algo que no es
 * un hexadecimal válido, se queda el anterior en vez de romper la landing.
 */
export async function guardarPerfil(formulario: FormData) {
  const sesion = await requerirSesionPanel();
  if (!puedeAdministrar(sesion.rol)) return { error: "Solo un administrador puede cambiar la configuración" };

  const datos = esquemaPerfil.safeParse(Object.fromEntries(formulario.entries()));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos" };
  const d = datos.data;

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("businesses")
    .update({
      name: d.name,
      tagline: d.tagline || null,
      founded_note: d.founded_note || null,
      description: d.description || null,
      phone: d.phone || null,
      whatsapp_phone: d.whatsapp_phone || null,
      email: d.email || null,
      address: d.address || null,
      city: d.city || null,
      postal_code: d.postal_code || null,
      website_url: d.website_url || null,
      review_url: d.review_url || null,
      opening_hours: {
        lunes_viernes: d.horario_semana || "",
        sabado: d.horario_sabado || "",
        domingo: d.horario_domingo || "",
      },
      theme: {
        ...sesion.negocio.theme,
        marca: normalizarHex(d.color_marca) ?? sesion.negocio.theme?.marca ?? "#0E2A3F",
        acento: normalizarHex(d.color_acento) ?? sesion.negocio.theme?.acento ?? "#C2A06A",
      },
    })
    .eq("id", sesion.negocio.id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };
  revalidatePath("/dashboard/configuracion");
  revalidatePath(`/b/${sesion.negocio.slug}`, "layout");
  return { ok: true };
}

const esquemaAjustes = z.object({
  google_review_url: urlOpcional,
  review_request_high: z.string().trim().max(300).optional(),
  review_request_low: z.string().trim().max(300).optional(),
  hero_title: z.string().trim().max(160).optional(),
  hero_subtitle: z.string().trim().max(300).optional(),
  valuation_mode: z.enum(["personalizada", "orientativa_manual"]),
  valuation_manual_note: z.string().trim().max(400).optional(),
  ai_assistant_enabled: z.union([z.string(), z.boolean()]).optional(),
  ai_assistant_name: z.string().trim().max(60).optional(),
  privacy_policy_url: urlOpcional,
});

export async function guardarAjustes(formulario: FormData) {
  const sesion = await requerirSesionPanel();
  if (!puedeAdministrar(sesion.rol)) return { error: "Solo un administrador puede cambiar la configuración" };

  const datos = esquemaAjustes.safeParse(Object.fromEntries(formulario.entries()));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos" };
  const d = datos.data;

  const supabase = await clienteServidor();
  const { error } = await supabase.from("business_settings").upsert(
    {
      business_id: sesion.negocio.id,
      google_review_url: d.google_review_url || null,
      review_request_high: d.review_request_high || null,
      review_request_low: d.review_request_low || null,
      hero_title: d.hero_title || null,
      hero_subtitle: d.hero_subtitle || null,
      valuation_mode: d.valuation_mode,
      valuation_manual_note: d.valuation_manual_note || null,
      ai_assistant_enabled: d.ai_assistant_enabled === "on" || d.ai_assistant_enabled === true,
      ai_assistant_name: d.ai_assistant_name || "Asistente 24/7",
      privacy_policy_url: d.privacy_policy_url || null,
    },
    { onConflict: "business_id" },
  );

  if (error) return { error: `No se ha podido guardar: ${error.message}` };
  revalidatePath("/dashboard/configuracion");
  revalidatePath(`/b/${sesion.negocio.slug}`, "layout");
  return { ok: true };
}
