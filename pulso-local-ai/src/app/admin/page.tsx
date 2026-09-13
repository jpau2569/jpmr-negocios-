import Link from "next/link";
import { requerirSuperadmin } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { salir } from "@/app/login/acciones";
import { TarjetaMetrica } from "@/components/panel/metricas";
import { FichaNegocioSaas } from "@/components/panel/ficha-negocio-saas";
import { FormularioNuevoNegocio } from "@/components/panel/formulario-nuevo-negocio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricasSaas } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administración SaaS" };

export interface NegocioSaas {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended" | "expired";
  city: string | null;
  trial_ends_at: string | null;
  created_at: string;
  is_demo_data: boolean;
}

export default async function PanelAdmin() {
  await requerirSuperadmin();
  const supabase = await clienteServidor();

  const [{ data: metricas }, { data: negocios }, { data: plantillas }] = await Promise.all([
    supabase.rpc("metricas_saas"),
    supabase
      .from("businesses")
      .select("id, name, slug, status, city, trial_ends_at, created_at, is_demo_data")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("business_templates").select("slug, name").eq("is_active", true),
  ]);

  const m = (metricas as MetricasSaas | null) ?? null;
  const lista = (negocios as NegocioSaas[] | null) ?? [];

  // Leads por negocio: el número agregado, nunca los datos de las personas. Un
  // superadministrador del SaaS no necesita leer los contactos de sus clientes
  // para saber si el producto les está funcionando.
  const { data: leads } = await supabase.from("leads").select("business_id");
  const leadsPorNegocio = ((leads as { business_id: string }[] | null) ?? []).reduce<Record<string, number>>(
    (acc, l) => {
      acc[l.business_id] = (acc[l.business_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const porCaducar = lista.filter(
    (n) =>
      n.status === "trial" &&
      n.trial_ends_at !== null &&
      new Date(n.trial_ends_at).getTime() - Date.now() < 3 * 86_400_000,
  );

  return (
    <div className="min-h-dvh bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-bold tracking-widest text-[var(--acento)] uppercase">Pulso Local AI</p>
            <h1 className="text-lg font-bold tracking-tight">Administración del SaaS</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="underline underline-offset-4">
              Ir a un panel
            </Link>
            <form action={salir}>
              <button type="submit" className="text-[var(--texto-suave)] underline underline-offset-4">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <TarjetaMetrica titulo="Negocios" valor={m?.negocios_total ?? 0} icono="edificio" />
          <TarjetaMetrica titulo="En demo" valor={m?.en_demo ?? 0} icono="reloj" tono="atencion" />
          <TarjetaMetrica titulo="Activos" valor={m?.activos ?? 0} icono="ok" tono="bueno" />
          <TarjetaMetrica titulo="Caducados" valor={m?.caducados ?? 0} icono="aviso" />
          <TarjetaMetrica titulo="Leads (30 d)" valor={m?.leads_30d ?? 0} icono="usuarios" />
          <TarjetaMetrica titulo="Inmuebles publicados" valor={m?.inmuebles_publicados ?? 0} icono="casa" />
        </section>

        {porCaducar.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Demos que caducan en menos de 3 días</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {porCaducar.map((n) => (
                  <li key={n.id}>
                    <strong>{n.name}</strong> · termina el{" "}
                    {new Date(n.trial_ends_at!).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <FormularioNuevoNegocio
            plantillas={(plantillas as { slug: string; name: string }[] | null) ?? []}
            negocios={lista.map((n) => ({ id: n.id, name: n.name }))}
          />

          <section className="space-y-3">
            <h2 className="text-lg font-bold tracking-tight">Negocios ({lista.length})</h2>
            {lista.map((negocio) => (
              <FichaNegocioSaas key={negocio.id} negocio={negocio} leads={leadsPorNegocio[negocio.id] ?? 0} />
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
