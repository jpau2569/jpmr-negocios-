"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { requerirSuperadmin } from "@/lib/autorizacion";
import { aSlug } from "@/lib/formato";

/**
 * Acciones del panel del SaaS.
 *
 * Todas empiezan por `requerirSuperadmin()`, y además RLS solo permite insertar
 * negocios a quien tiene `profiles.is_superadmin`. Dos cerraduras para la misma
 * puerta: la de la aplicación da un mensaje claro, la de la base de datos es la
 * que de verdad no se puede saltar.
 */

const esquemaNegocio = z.object({
  name: z.string().trim().min(2, "Ponle nombre al negocio").max(120),
  slug: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsapp_phone: z.string().trim().max(30).optional(),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(160).optional(),
  dias_demo: z.coerce.number().int().min(1).max(90).default(7),
  plantilla: z.string().trim().max(80).default("inmobiliaria-asesoria-local"),
  copiar_de: z.string().uuid().optional().or(z.literal("")),
});

/**
 * Crea un negocio en demo a partir de la plantilla del vertical.
 *
 * `trial_ends_at` se calcula en el servidor y se guarda en UTC. Cambiar la hora
 * del ordenador del cliente no alarga la demo ni un minuto.
 */
export async function crearNegocioDemo(formulario: FormData) {
  await requerirSuperadmin();

  const datos = esquemaNegocio.safeParse(Object.fromEntries(formulario.entries()));
  if (!datos.success) return { error: datos.error.issues[0]?.message ?? "Revisa los datos" };
  const d = datos.data;

  const supabase = await clienteServidor();
  const slug = aSlug(d.slug || d.name);

  const { data: existe } = await supabase.from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (existe) return { error: `Ya hay un negocio con la dirección /b/${slug}` };

  const { data: plantilla } = await supabase
    .from("business_templates")
    .select("id, vertical, theme, modules, content")
    .eq("slug", d.plantilla)
    .maybeSingle();

  const t = plantilla as { id: string; vertical: string; theme: object; modules: object; content: Record<string, string> } | null;
  const finDemo = new Date(Date.now() + d.dias_demo * 86_400_000).toISOString();

  const { data: creado, error } = await supabase
    .from("businesses")
    .insert({
      name: d.name,
      slug,
      business_type: t?.vertical ?? "inmobiliaria_asesoria",
      template_id: t?.id ?? null,
      status: "trial",
      trial_ends_at: finDemo,
      phone: d.phone || null,
      whatsapp_phone: d.whatsapp_phone || null,
      city: d.city || null,
      address: d.address || null,
      theme: t?.theme ?? {},
      modules: t?.modules ?? {},
      is_demo_data: true,
    })
    .select("id")
    .single();

  if (error || !creado) return { error: `No se ha podido crear: ${error?.message}` };
  const negocioId = (creado as { id: string }).id;

  await Promise.all([
    supabase.from("business_settings").insert({
      business_id: negocioId,
      hero_title: t?.content?.hero_title ?? null,
      hero_subtitle: t?.content?.hero_subtitle ?? null,
    }),
    supabase.from("trial_settings").insert({ business_id: negocioId, trial_days: d.dias_demo }),
    supabase.from("subscriptions").insert({
      business_id: negocioId,
      plan: "demo",
      status: "trialing",
      current_period_end: finDemo,
    }),
    supabase.from("legal_text_versions").insert({
      business_id: negocioId,
      kind: "consentimiento_lead",
      version: "v1",
      body:
        "Al enviar este formulario autorizas el tratamiento de tus datos con la única finalidad de atender tu " +
        "solicitud y ponerse en contacto contigo. AVISO: este contenido es una plantilla técnica y debe ser " +
        "revisado por un profesional legal antes de publicarse.",
      is_current: true,
    }),
  ]);

  // Copiar contenido de otro negocio, si se ha pedido: servicios y FAQs, nunca
  // leads, opiniones ni analítica. Los datos de personas no se clonan jamás.
  if (d.copiar_de) {
    const [{ data: categorias }, { data: servicios }, { data: faqs }] = await Promise.all([
      supabase.from("service_categories").select("*").eq("business_id", d.copiar_de),
      supabase.from("services").select("*").eq("business_id", d.copiar_de),
      supabase.from("faqs").select("*").eq("business_id", d.copiar_de),
    ]);

    const mapaCategorias = new Map<string, string>();
    for (const categoria of (categorias as Record<string, unknown>[] | null) ?? []) {
      const original = { ...categoria };
      const idAntiguo = original.id as string;
      delete original.id;
      delete original.created_at;
      delete original.updated_at;
      const { data: nueva } = await supabase
        .from("service_categories")
        .insert({ ...original, business_id: negocioId })
        .select("id")
        .single();
      if (nueva) mapaCategorias.set(idAntiguo, (nueva as { id: string }).id);
    }

    for (const servicio of (servicios as Record<string, unknown>[] | null) ?? []) {
      const original = { ...servicio };
      delete original.id;
      delete original.created_at;
      delete original.updated_at;
      await supabase.from("services").insert({
        ...original,
        business_id: negocioId,
        category_id: original.category_id ? (mapaCategorias.get(original.category_id as string) ?? null) : null,
      });
    }

    for (const faq of (faqs as Record<string, unknown>[] | null) ?? []) {
      const original = { ...faq };
      delete original.id;
      delete original.created_at;
      delete original.updated_at;
      await supabase.from("faqs").insert({ ...original, business_id: negocioId });
    }
  }

  revalidatePath("/admin");
  return { ok: true, slug };
}

export async function cambiarEstadoNegocio(businessId: string, estado: string) {
  await requerirSuperadmin();

  const datos = z
    .object({ businessId: z.string().uuid(), estado: z.enum(["trial", "active", "suspended", "expired"]) })
    .safeParse({ businessId, estado });
  if (!datos.success) return { error: "Estado no válido" };

  const supabase = await clienteServidor();
  const cambios: Record<string, unknown> = { status: datos.data.estado };

  // Pasar a cliente activo quita la fecha de caducidad: ya no es una demo.
  if (datos.data.estado === "active") cambios.trial_ends_at = null;

  const { error } = await supabase.from("businesses").update(cambios).eq("id", datos.data.businessId);
  if (error) return { error: "No se ha podido cambiar el estado" };

  if (datos.data.estado === "active") {
    await supabase
      .from("subscriptions")
      .update({ status: "active", plan: "basico" })
      .eq("business_id", datos.data.businessId);
  }

  revalidatePath("/admin");
  return { ok: true };
}

/** Alargar o acortar una demo. La fecha se calcula siempre en el servidor. */
export async function ajustarDemo(businessId: string, dias: number) {
  await requerirSuperadmin();

  const datos = z
    .object({ businessId: z.string().uuid(), dias: z.number().int().min(1).max(90) })
    .safeParse({ businessId, dias });
  if (!datos.success) return { error: "Número de días no válido" };

  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("businesses")
    .update({
      status: "trial",
      trial_ends_at: new Date(Date.now() + datos.data.dias * 86_400_000).toISOString(),
    })
    .eq("id", datos.data.businessId);

  if (error) return { error: "No se ha podido ajustar la demo" };
  revalidatePath("/admin");
  return { ok: true };
}

export async function anadirNotaComercial(businessId: string, formulario: FormData) {
  const admin = await requerirSuperadmin();

  const datos = z
    .object({ businessId: z.string().uuid(), nota: z.string().trim().min(1).max(2000) })
    .safeParse({ businessId, nota: formulario.get("nota") });
  if (!datos.success) return { error: "La nota está vacía" };

  const supabase = await clienteServidor();
  const { error } = await supabase.from("business_admin_notes").insert({
    business_id: datos.data.businessId,
    author_id: admin.userId,
    note: datos.data.nota,
  });

  if (error) return { error: "No se ha podido guardar la nota" };
  revalidatePath("/admin");
  return { ok: true };
}
