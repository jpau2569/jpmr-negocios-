import { NextResponse } from "next/server";
import { clienteAdmin } from "@/lib/supabase/servidor";
import { entornoServidor } from "@/lib/entorno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diario: marca como `expired` las demos vencidas y limpia los contadores
 * de cupo.
 *
 * Ojo: esto es ORDEN, no seguridad. Una demo caducada deja de publicarse en el
 * mismo instante en que vence, porque `negocio_publicable()` mira la fecha en
 * cada consulta. Si este cron no llega a ejecutarse, no se publica nada de más;
 * solo quedaría el estado sin refrescar en el panel del SaaS.
 */
export async function GET(peticion: Request) {
  const { cronSecret } = entornoServidor();
  const cabecera = peticion.headers.get("authorization");
  if (!cronSecret || cabecera !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const supabase = clienteAdmin();
  const [{ data: caducadas }, { data: limpiadas }] = await Promise.all([
    supabase.rpc("caducar_demos"),
    supabase.rpc("limpiar_rate_limit"),
  ]);

  return NextResponse.json({ ok: true, demosCaducadas: caducadas ?? 0, cupoLimpiado: limpiadas ?? 0 });
}
