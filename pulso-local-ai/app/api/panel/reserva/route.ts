import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/servidor";
import { escribir } from "@/lib/panel";
import { esquemaEstadoReserva } from "@/lib/schemas/panel";

// Cambiar el estado de una reserva o de una petición de grupo.
// El filtro por business_id no es decorativo: service_role salta RLS, así que
// sin él un id de otro negocio se podría tocar desde aquí.
export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return escribir(peticion, esquemaEstadoReserva, "reserva", async ({ datos, negocio }) => {
    const tabla = datos.tipo === "grupo" ? "group_requests" : "reservations";
    const campos: Record<string, unknown> = { status: datos.status };
    if (datos.tipo === "reserva" && datos.staff_notes !== undefined) {
      campos.staff_notes = datos.staff_notes || null;
    }

    const { error: fallo, count } = await admin()
      .from(tabla)
      .update(campos, { count: "exact" })
      .eq("id", datos.id)
      .eq("business_id", negocio.id);
    if (fallo) throw fallo;

    if (!count) {
      return NextResponse.json(
        { ok: false, error: "Esa reserva no es de este negocio." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  });
}
