import { notFound } from "next/navigation";
import Link from "next/link";
import { Rastreador } from "@/components/publico/rastreador";
import { TarjetaInmueble } from "@/components/publico/tarjeta-inmueble";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { listarInmuebles, listarMedios, obtenerNegocioPublico } from "@/lib/negocio";
import { ETIQUETA_OPERACION, ETIQUETA_TIPO_INMUEBLE } from "@/lib/etiquetas";

export const revalidate = 60;
export const metadata = { title: "Inmuebles" };

const OPERACIONES = ["venta", "alquiler"] as const;
const TIPOS = ["piso", "casa", "atico", "local", "garaje"] as const;

export default async function CatalogoInmuebles({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ operacion?: string; tipo?: string; municipio?: string }>;
}) {
  const { slug } = await params;
  const filtros = await searchParams;
  const negocio = await obtenerNegocioPublico(slug);
  if (!negocio) notFound();

  const inmuebles = await listarInmuebles(negocio.id, {
    operacion: filtros.operacion,
    tipo: filtros.tipo,
    municipio: filtros.municipio,
  });
  const medios = await listarMedios(inmuebles.map((p) => p.id));
  const portadas = new Map(medios.filter((m) => m.is_cover).map((m) => [m.property_id, m]));

  const municipios = [...new Set(inmuebles.map((p) => p.municipality).filter(Boolean))] as string[];

  function enlaceFiltro(cambio: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const fusion = { ...filtros, ...cambio };
    for (const [clave, valor] of Object.entries(fusion)) if (valor) p.set(clave, valor);
    const cadena = p.toString();
    return `/b/${slug}/inmuebles${cadena ? `?${cadena}` : ""}`;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <Rastreador slug={slug} tipo="property_list_view" />

      <header className="mb-5 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Inmuebles</h1>
        <p className="text-sm text-[var(--texto-suave)]">
          {inmuebles.length} {inmuebles.length === 1 ? "inmueble publicado" : "inmuebles publicados"}
        </p>
      </header>

      <nav aria-label="Filtros" className="mb-5 space-y-2 overflow-x-auto">
        <div className="flex gap-2">
          <FiltroChip href={enlaceFiltro({ operacion: undefined })} activo={!filtros.operacion}>
            Todas
          </FiltroChip>
          {OPERACIONES.map((operacion) => (
            <FiltroChip
              key={operacion}
              href={enlaceFiltro({ operacion })}
              activo={filtros.operacion === operacion}
            >
              {ETIQUETA_OPERACION[operacion]}
            </FiltroChip>
          ))}
        </div>
        <div className="flex gap-2">
          <FiltroChip href={enlaceFiltro({ tipo: undefined })} activo={!filtros.tipo}>
            Cualquier tipo
          </FiltroChip>
          {TIPOS.map((tipo) => (
            <FiltroChip key={tipo} href={enlaceFiltro({ tipo })} activo={filtros.tipo === tipo}>
              {ETIQUETA_TIPO_INMUEBLE[tipo]}
            </FiltroChip>
          ))}
        </div>
        {municipios.length > 1 ? (
          <div className="flex gap-2">
            <FiltroChip href={enlaceFiltro({ municipio: undefined })} activo={!filtros.municipio}>
              Todos los municipios
            </FiltroChip>
            {municipios.map((municipio) => (
              <FiltroChip key={municipio} href={enlaceFiltro({ municipio })} activo={filtros.municipio === municipio}>
                {municipio}
              </FiltroChip>
            ))}
          </div>
        ) : null}
      </nav>

      {negocio.is_demo_data ? (
        <Aviso tono="aviso" className="mb-5">
          Datos de demostración. Consultar disponibilidad.
        </Aviso>
      ) : null}

      {inmuebles.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {inmuebles.map((inmueble) => (
            <TarjetaInmueble
              key={inmueble.id}
              inmueble={inmueble}
              portada={portadas.get(inmueble.id)}
              slugNegocio={slug}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--superficie)] p-6 text-center">
          <p className="text-sm text-[var(--texto-suave)]">
            No hay inmuebles que encajen con este filtro. Cuéntanos qué buscas y te avisamos cuando entre algo.
          </p>
          <Button asChild ancho="completo">
            <Link href={`/b/${slug}/buscar-vivienda`}>Quiero que me avisen</Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function FiltroChip({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={`flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
        activo
          ? "border-[var(--marca)] bg-[var(--marca)] text-[var(--marca-contraste)]"
          : "border-[var(--borde)] bg-[var(--superficie)]"
      }`}
    >
      {children}
    </Link>
  );
}
