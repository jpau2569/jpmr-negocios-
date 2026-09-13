import { requerirSesionPanel } from "@/lib/autorizacion";
import { FormularioInmueble } from "@/components/panel/formulario-inmueble";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo inmueble" };

export default async function NuevoInmueble() {
  await requerirSesionPanel();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo inmueble</h1>
      <p className="text-sm text-[var(--texto-suave)]">
        Se crea como borrador. No aparece en la web hasta que lo publiques.
      </p>
      <FormularioInmueble valores={{}} />
    </div>
  );
}
