import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirSesionPanel } from "@/lib/autorizacion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { FormularioInmueble, type ValoresInmueble } from "@/components/panel/formulario-inmueble";
import { GestorMedios } from "@/components/panel/gestor-medios";
import { Badge } from "@/components/ui/badge";
import type { MedioPublico } from "@/types/dominio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar inmueble" };

export default async function EditarInmueble({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requerirSesionPanel();
  const supabase = await clienteServidor();

  const [{ data }, { data: medios }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).eq("business_id", sesion.negocio.id).maybeSingle(),
    supabase.from("property_media").select("*").eq("property_id", id).order("position"),
  ]);

  if (!data) notFound();
  const inmueble = data as ValoresInmueble & { published_at: string | null; slug: string; view_count: number };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{inmueble.title}</h1>
          <p className="text-sm text-[var(--texto-suave)]">
            <Badge tono={inmueble.published_at ? "exito" : "neutro"}>
              {inmueble.published_at ? "Publicado" : "Sin publicar"}
            </Badge>{" "}
            · {inmueble.view_count} vistas
          </p>
        </div>
        <Link href="/dashboard/inmuebles" className="text-sm underline underline-offset-4">
          Volver al listado
        </Link>
      </header>

      <GestorMedios
        propertyId={id}
        businessId={sesion.negocio.id}
        medios={(medios as MedioPublico[] | null) ?? []}
      />

      <FormularioInmueble valores={{ ...inmueble, id }} />
    </div>
  );
}
