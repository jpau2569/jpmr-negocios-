import Link from "next/link";
import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccionesInmueble } from "@/components/panel/acciones-inmueble";
import { ETIQUETA_ESTADO_INMUEBLE, ETIQUETA_OPERACION, ETIQUETA_TIPO_INMUEBLE } from "@/lib/etiquetas";
import { euros, fechaCorta } from "@/lib/formato";
import type { EstadoInmueble, OperacionInmueble, TipoInmueble } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inmuebles" };

interface FilaInmueble {
  id: string;
  title: string;
  slug: string;
  reference_code: string | null;
  operation_type: OperacionInmueble;
  property_type: TipoInmueble;
  status: EstadoInmueble;
  price: number | null;
  municipality: string | null;
  featured: boolean;
  is_demo_data: boolean;
  view_count: number;
  published_at: string | null;
  created_at: string;
}

export default async function PanelInmuebles() {
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const { data } = await supabase
    .from("properties")
    .select("id, title, slug, reference_code, operation_type, property_type, status, price, municipality, featured, is_demo_data, view_count, published_at, created_at")
    .eq("business_id", sesion.negocio.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const inmuebles = (data as FilaInmueble[] | null) ?? [];

  // Leads por inmueble, para que la lista diga qué piso genera interés de verdad
  // y no solo cuál se ha visto más.
  const { data: leads } = await supabase
    .from("leads")
    .select("property_id")
    .eq("business_id", sesion.negocio.id)
    .not("property_id", "is", null);

  const leadsPorInmueble = ((leads as { property_id: string }[] | null) ?? []).reduce<Record<string, number>>(
    (acc, l) => {
      acc[l.property_id] = (acc[l.property_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inmuebles</h1>
          <p className="text-sm text-[var(--texto-suave)]">
            {inmuebles.filter((i) => i.published_at).length} publicados de {inmuebles.length}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/inmuebles/nuevo">Nuevo inmueble</Link>
        </Button>
      </header>

      {inmuebles.length ? (
        <div className="overflow-x-auto rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-[var(--borde)] text-left text-xs text-[var(--texto-suave)]">
              <tr>
                <th scope="col" className="p-3">Inmueble</th>
                <th scope="col" className="p-3">Estado</th>
                <th scope="col" className="p-3">Precio</th>
                <th scope="col" className="p-3">Vistas</th>
                <th scope="col" className="p-3">Leads</th>
                <th scope="col" className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--borde)]">
              {inmuebles.map((inmueble) => (
                <tr key={inmueble.id}>
                  <td className="p-3">
                    <Link href={`/dashboard/inmuebles/${inmueble.id}`} className="font-semibold hover:underline">
                      {inmueble.title}
                    </Link>
                    <p className="text-xs text-[var(--texto-suave)]">
                      {ETIQUETA_OPERACION[inmueble.operation_type]} ·{" "}
                      {ETIQUETA_TIPO_INMUEBLE[inmueble.property_type]}
                      {inmueble.municipality ? ` · ${inmueble.municipality}` : ""}
                      {inmueble.reference_code ? ` · ${inmueble.reference_code}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {inmueble.featured ? <Badge tono="acento">Destacado</Badge> : null}
                      {inmueble.is_demo_data ? <Badge tono="aviso">Demo</Badge> : null}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge tono={inmueble.published_at ? "exito" : "neutro"}>
                      {inmueble.published_at ? "Publicado" : "Sin publicar"}
                    </Badge>
                    <p className="mt-1 text-xs text-[var(--texto-suave)]">
                      {ETIQUETA_ESTADO_INMUEBLE[inmueble.status]}
                      {inmueble.published_at ? ` · ${fechaCorta(inmueble.published_at)}` : ""}
                    </p>
                  </td>
                  <td className="p-3 font-semibold">{euros(inmueble.price)}</td>
                  <td className="p-3">{inmueble.view_count}</td>
                  <td className="p-3">{leadsPorInmueble[inmueble.id] ?? 0}</td>
                  <td className="p-3">
                    <AccionesInmueble
                      propertyId={inmueble.id}
                      publicado={Boolean(inmueble.published_at)}
                      slugNegocio={sesion.negocio.slug}
                      slugInmueble={inmueble.slug}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-6 text-sm text-[var(--texto-suave)]">
          Todavía no hay inmuebles. Crea el primero y genera su QR para el cartel de la vivienda.
        </div>
      )}
    </div>
  );
}
