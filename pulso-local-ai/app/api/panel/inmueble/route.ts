import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { admin } from "@/lib/supabase/servidor";
import { escribir } from "@/lib/panel";
import { esquemaInmueble } from "@/lib/schemas/panel";
import { slugDeInmueble } from "@/lib/cartera";

// ============================================================================
//  Alta y corrección de un inmueble — /api/panel/inmueble
// ----------------------------------------------------------------------------
//  Esto es, sobre todo, el boca a boca: la agencia sale de ver un piso que no
//  está en la web ni en ningún portal y lo mete desde el móvil. Por eso solo
//  se exigen referencia y título; lo demás se completa cuando se pueda.
//
//  Los que se dan de alta aquí nacen con source = 'manual', y eso los protege:
//  la sincronización NUNCA los toca (ver lib/cartera/fusion.ts). Si no fuera
//  así, el trabajo de captación desaparecería solo en cuanto alguien pulsara
//  «Sincronizar».
// ============================================================================

export const runtime = "nodejs";

/**
 * Token del enlace privado. 24 caracteres de base64url: suficiente para que
 * no se adivine probando, que es de lo único que hay que protegerlo — RLS ya
 * impide que el público lo saque de la base, con token o sin él.
 */
function tokenPrivado(): string {
  return randomBytes(18).toString("base64url");
}

export async function POST(peticion: Request) {
  return escribir(peticion, esquemaInmueble, "inmueble", async ({ datos, negocio }) => {
    const db = admin();

    // El token solo existe si el inmueble es de enlace privado, y la base lo
    // exige con un CHECK. Al cambiar de visibilidad hay que ajustarlo.
    const esPrivado = datos.visibility === "enlace_privado";

    const campos = {
      title: datos.title,
      description: datos.description || null,
      operation: datos.operation,
      kind: datos.kind,
      price_cents: datos.price_on_request ? null : (datos.price_cents ?? null),
      price_on_request: datos.price_on_request,
      surface_built_m2: datos.surface_built_m2 ?? null,
      rooms: datos.rooms ?? null,
      bathrooms: datos.bathrooms ?? null,
      floor_label: datos.floor_label || null,
      has_lift: datos.has_lift ?? null,
      municipality: datos.municipality || null,
      zone: datos.zone || null,
      street: datos.street || null,
      street_is_public: datos.street_is_public,
      energy_rating: datos.energy_rating ?? null,
      energy_status: datos.energy_status,
      visibility: datos.visibility,
      deal_state: datos.deal_state,
      status: datos.status,
    };

    /* --- Corrección de uno que ya existe ---------------------------------- */
    if (datos.id) {
      // Se lee antes para no regenerar un token que ya está repartido: si el
      // inmueble ya era privado, su enlace tiene que seguir funcionando.
      const { data: actual } = await db
        .from("properties")
        .select("private_token, source")
        .eq("id", datos.id)
        .eq("business_id", negocio.id)
        .maybeSingle();

      if (!actual) {
        return NextResponse.json(
          { ok: false, error: "Ese inmueble no es de este negocio." },
          { status: 404 },
        );
      }

      const { error: fallo } = await db
        .from("properties")
        .update({
          ...campos,
          reference: datos.reference,
          private_token: esPrivado ? (actual.private_token ?? tokenPrivado()) : null,
        })
        .eq("id", datos.id)
        .eq("business_id", negocio.id);
      if (fallo) throw fallo;

      revalidatePath(`/b/${datos.slug}/inmuebles`);
      revalidatePath(`/b/${datos.slug}`);
      return NextResponse.json({ ok: true, id: datos.id });
    }

    /* --- Alta nueva -------------------------------------------------------- */
    const { data: creado, error: fallo } = await db
      .from("properties")
      .insert({
        ...campos,
        business_id: negocio.id,
        reference: datos.reference,
        slug: slugDeInmueble(datos.title, datos.reference),
        private_token: esPrivado ? tokenPrivado() : null,
        source: "manual",
      })
      .select("id, slug, private_token")
      .single();

    if (fallo) {
      // El caso de siempre: repetir una referencia que ya existe. Merece un
      // mensaje en español, no un error de PostgreSQL en crudo.
      const texto = String((fallo as { message?: string }).message ?? "");
      if (texto.includes("duplicate") || texto.includes("unique")) {
        return NextResponse.json(
          { ok: false, error: `Ya tienes un inmueble con la referencia ${datos.reference}.` },
          { status: 409 },
        );
      }
      throw fallo;
    }

    revalidatePath(`/b/${datos.slug}/inmuebles`);
    revalidatePath(`/b/${datos.slug}`);

    return NextResponse.json({
      ok: true,
      id: creado.id,
      slug: creado.slug,
      // El enlace para mandar por WhatsApp a quien corresponda. Solo se
      // devuelve al crearlo: quien lo reparte es la agencia, no la web.
      enlacePrivado: creado.private_token
        ? `/b/${datos.slug}/privado/${creado.private_token}`
        : null,
    });
  });
}
