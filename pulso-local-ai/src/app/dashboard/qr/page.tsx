import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { entornoPublico } from "@/lib/entorno";
import { ConstructorQr } from "@/components/panel/constructor-qr";
import { Aviso } from "@/components/ui/aviso";
import type { CodigoQr } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Códigos QR" };

export default async function PanelQr() {
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const [{ data: codigos }, { data: inmuebles }, { data: escaneos }] = await Promise.all([
    supabase
      .from("qr_codes")
      .select("*")
      .eq("business_id", sesion.negocio.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("properties")
      .select("id, title")
      .eq("business_id", sesion.negocio.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("rendimiento_qr", { p_business_id: sesion.negocio.id, p_dias: 30 }),
  ]);

  const rendimiento = new Map(
    ((escaneos as { qr_id: string; escaneos: number; leads: number }[] | null) ?? []).map((r) => [
      r.qr_id,
      { escaneos: Number(r.escaneos), leads: Number(r.leads) },
    ]),
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Códigos QR</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          Un QR por sitio físico. Cada uno se mide por separado, así sabrás qué cartel trae clientes.
        </p>
      </header>

      <Aviso tono="info" titulo="Por qué el QR apunta a una URL corta">
        Todos los códigos llevan a <code>{entornoPublico.urlApp}/q/&lt;código&gt;</code>. Ahí se cuenta el escaneo y
        se redirige. Si mañana ese piso se vende, cambias el destino desde aquí y el cartel impreso sigue valiendo.
      </Aviso>

      <ConstructorQr
        urlBase={entornoPublico.urlApp}
        negocio={{ id: sesion.negocio.id, name: sesion.negocio.name, slug: sesion.negocio.slug }}
        codigos={((codigos as CodigoQr[] | null) ?? []).map((c) => ({
          ...c,
          metricas: rendimiento.get(c.id) ?? { escaneos: 0, leads: 0 },
        }))}
        inmuebles={(inmuebles as { id: string; title: string }[] | null) ?? []}
      />
    </div>
  );
}
