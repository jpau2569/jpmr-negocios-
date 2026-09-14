import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/supabase/servidor";
import { escribir } from "@/lib/panel";
import { esquemaPlato } from "@/lib/schemas/panel";

// Corregir un plato: precio, nombre, estado o quitarle la marca de "sin
// confirmar". Es lo que convierte los 30 platos de muestra de La Taberna en
// datos reales, uno a uno, según el dueño los va validando.
export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return escribir(peticion, esquemaPlato, "plato", async ({ datos, negocio }) => {
    const campos: Record<string, unknown> = {};
    if (datos.price_cents !== undefined) campos.price_cents = datos.price_cents;
    if (datos.status !== undefined) campos.status = datos.status;
    if (datos.is_demo !== undefined) campos.is_demo = datos.is_demo;
    if (datos.name !== undefined) campos.name = datos.name;
    if (datos.description !== undefined) campos.description = datos.description || null;

    if (Object.keys(campos).length === 0) {
      return NextResponse.json({ ok: false, error: "No hay nada que cambiar." }, { status: 400 });
    }

    const { error: fallo, count } = await admin()
      .from("menu_items")
      .update(campos, { count: "exact" })
      .eq("id", datos.id)
      .eq("business_id", negocio.id);
    if (fallo) throw fallo;

    if (!count) {
      return NextResponse.json(
        { ok: false, error: "Ese plato no es de este negocio." },
        { status: 404 },
      );
    }

    revalidatePath(`/b/${datos.slug}`);
    revalidatePath(`/b/${datos.slug}/carta`);
    return NextResponse.json({ ok: true });
  });
}
