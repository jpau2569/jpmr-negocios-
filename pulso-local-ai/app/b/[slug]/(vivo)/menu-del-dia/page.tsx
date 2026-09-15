import { notFound } from "next/navigation";
import { leerEspacio, moduloActivo } from "@/lib/datos";
import { Vacio } from "@/components/ui/basicos";
import { EnlaceBoton } from "@/components/ui/boton";
import { MenuDelDia } from "@/components/publico/menu-dia";
import { IniciarAnalitica } from "@/components/publico/rastreador";

// ============================================================================
//  Menú del día — /b/[slug]/menu-del-dia
// ----------------------------------------------------------------------------
//  Destino del QR de la barra y del cartel del menú. Si hoy no hay menú
//  cargado, se dice claramente en vez de enseñar el de otro día.
// ============================================================================

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ qr?: string }>;
}

export default async function PaginaMenuDia({ params, searchParams }: Props) {
  const { slug } = await params;
  const { qr } = await searchParams;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();
  // Las rutas son comunes a todos los sectores: si este negocio no tiene
  // el módulo encendido, esta página no existe para él.
  if (!moduloActivo(espacio, "daily_menu")) notFound();

  return (
    <div className="py-6">
      <IniciarAnalitica slug={slug} qr={qr ?? null} />
      {espacio.menuDeHoy ? (
        <MenuDelDia espacio={espacio} />
      ) : (
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Menú del día</h1>
          <div className="mt-5">
            <Vacio>
              Hoy no hay menú del día cargado todavía. Pregunta en la barra o mira la carta.
            </Vacio>
          </div>
          <EnlaceBoton href={`/b/${slug}/carta`} variante="contorno" tamano="bloque" className="mt-4">
            Ver la carta
          </EnlaceBoton>
        </div>
      )}
    </div>
  );
}
