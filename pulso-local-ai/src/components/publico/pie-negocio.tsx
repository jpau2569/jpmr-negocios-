import Link from "next/link";
import { DistintivoDemo } from "@/components/ui/aviso";
import type { AjustesPublicos, NegocioPublico } from "@/types/dominio";

export function PieNegocio({
  negocio,
  ajustes,
}: {
  negocio: NegocioPublico;
  ajustes: AjustesPublicos | null;
}) {
  return (
    <footer className="border-t border-[var(--borde)] bg-[var(--superficie)]">
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 text-sm text-[var(--texto-suave)]">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={`/b/${negocio.slug}`} className="underline underline-offset-4">Inicio</Link>
          <Link href={`/b/${negocio.slug}/inmuebles`} className="underline underline-offset-4">Inmuebles</Link>
          <Link href={`/b/${negocio.slug}/servicios`} className="underline underline-offset-4">Servicios</Link>
          <Link href={`/b/${negocio.slug}/valoracion`} className="underline underline-offset-4">Valoración</Link>
          <Link href={`/b/${negocio.slug}/buscar-vivienda`} className="underline underline-offset-4">Busco vivienda</Link>
          <Link href={`/b/${negocio.slug}/opinion`} className="underline underline-offset-4">Opinión</Link>
        </nav>

        <p>
          <strong className="text-[var(--texto)]">{negocio.name}</strong>
          {negocio.address ? ` · ${negocio.address}` : ""}
          {negocio.city ? `, ${negocio.city}` : ""}
        </p>

        {ajustes?.privacy_policy_url ? (
          <p>
            <a href={ajustes.privacy_policy_url} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
              Política de privacidad
            </a>
          </p>
        ) : null}

        {negocio.is_demo_data && (ajustes?.show_demo_badge ?? true) ? (
          <div className="space-y-2">
            <DistintivoDemo />
            <p className="text-xs">
              Los inmuebles, precios y opiniones de este espacio son de demostración y no representan disponibilidad
              real. Consulta siempre con el equipo antes de tomar una decisión.
            </p>
          </div>
        ) : null}

        <p className="text-xs">
          Espacio creado con <span className="font-semibold">PULSO LOCAL AI</span>.
        </p>
      </div>
    </footer>
  );
}
