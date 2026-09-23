import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/supabase/servidor";
import { escribir } from "@/lib/panel";
import { esquemaMenuDia } from "@/lib/schemas/panel";

// ============================================================================
//  Guardar el menú del día — /api/panel/menu-dia
// ----------------------------------------------------------------------------
//  Se reemplazan los platos enteros en vez de ir uno a uno: el hostelero
//  reescribe el menú de la mañana entero, no edita el segundo plato del jueves.
//
//  is_demo pasa a false en cuanto el negocio guarda: lo que ha escrito el dueño
//  ya no es una muestra, y deja de salir marcado en la web.
// ============================================================================

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return escribir(peticion, esquemaMenuDia, "menu-dia", async ({ datos, negocio }) => {
    const db = admin();

    const { data: menu, error: fallo } = await db
      .from("daily_menus")
      .upsert(
        {
          business_id: negocio.id,
          service_date: datos.service_date,
          price_cents: datos.price_cents,
          includes_drink: datos.includes_drink,
          notes: datos.notes || null,
          status: datos.status,
          is_demo: false,
        },
        { onConflict: "business_id,service_date" },
      )
      .select("id")
      .single();
    if (fallo) throw fallo;

    await db.from("daily_menu_items").delete().eq("daily_menu_id", menu.id);

    if (datos.platos.length > 0) {
      const { error: falloPlatos } = await db.from("daily_menu_items").insert(
        datos.platos.map((p, i) => ({
          daily_menu_id: menu.id,
          course: p.course,
          name: p.name,
          description: p.description || null,
          position: i,
        })),
      );
      if (falloPlatos) throw falloPlatos;
    }

    // La página pública se cachea 60 s; esto la refresca al momento, para que
    // el dueño vea el cambio en su móvil antes de bajar a abrir.
    revalidatePath(`/b/${datos.slug}`);
    revalidatePath(`/b/${datos.slug}/menu-del-dia`);

    return NextResponse.json({ ok: true, id: menu.id });
  });
}
