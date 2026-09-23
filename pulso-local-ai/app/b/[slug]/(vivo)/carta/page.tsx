import { notFound } from "next/navigation";
import { leerEspacio, platosDeCategoria, moduloActivo } from "@/lib/datos";
import { Tarjeta, Vacio, SinConfirmar } from "@/components/ui/basicos";
import { FichaPlato } from "@/components/publico/plato";
import { IniciarAnalitica, Vista } from "@/components/publico/rastreador";

// ============================================================================
//  Carta completa — /b/[slug]/carta
// ----------------------------------------------------------------------------
//  Una sola página con todo, y un índice pegajoso arriba. Nada de acordeones:
//  quien busca el precio de un cachopo quiere verlo, no abrir tres cajones.
// ============================================================================

export const revalidate = 60;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ qr?: string }>;
}

export default async function PaginaCarta({ params, searchParams }: Props) {
  const { slug } = await params;
  const { qr } = await searchParams;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();
  // Las rutas son comunes a todos los sectores: si este negocio no tiene
  // el módulo encendido, esta página no existe para él.
  if (!moduloActivo(espacio, "menu")) notFound();

  const { negocio, ajustes, categorias } = espacio;
  const conPlatos = categorias
    .map((c) => ({ categoria: c, platos: platosDeCategoria(espacio, c.id) }))
    .filter((g) => g.platos.length > 0);

  return (
    <div className="px-4 py-8 sm:px-6">
      <IniciarAnalitica slug={slug} qr={qr ?? null} />
      <Vista evento="menu_view" />

      <div className="mx-auto w-full max-w-3xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">La carta</h1>
        <p className="mt-1.5 text-sm text-[var(--negocio-tenue)]">
          {espacio.platos.length} platos en {conPlatos.length} apartados.
        </p>

        {conPlatos.length === 0 ? (
          <Vacio>La carta todavía no está cargada.</Vacio>
        ) : (
          <>
            <nav
              aria-label="Apartados de la carta"
              className="sticky top-[4.2rem] z-30 -mx-4 mt-5 overflow-x-auto border-y border-[var(--negocio-borde)] bg-[var(--negocio-fondo)]/95 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6"
            >
              <ul className="flex gap-2">
                {conPlatos.map(({ categoria }) => (
                  <li key={categoria.id}>
                    <a
                      href={`#categoria-${categoria.id}`}
                      className="inline-block whitespace-nowrap rounded-full border border-[var(--negocio-borde)] px-3.5 py-1.5 text-sm"
                    >
                      {categoria.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {espacio.platos.some((p) => p.is_demo) ? (
              <SinConfirmar
                className="mt-5"
                texto="Hay platos y precios marcados como muestra: el negocio los confirma antes de publicar. Pregunta en el local cualquier precio o alérgeno concreto."
              />
            ) : null}

            <div className="mt-6 space-y-8">
              {conPlatos.map(({ categoria, platos }) => (
                <section key={categoria.id} id={`categoria-${categoria.id}`} className="scroll-mt-32">
                  <h2 className="font-[family-name:var(--font-display)] text-2xl">{categoria.name}</h2>
                  {categoria.description ? (
                    <p className="mt-1 text-sm text-[var(--negocio-tenue)]">{categoria.description}</p>
                  ) : null}
                  <Tarjeta className="mt-3 px-5 py-1">
                    {platos.map((p) => (
                      <FichaPlato
                        key={p.id}
                        plato={p}
                        negocio={negocio.name}
                        whatsapp={ajustes.whatsapp}
                      />
                    ))}
                  </Tarjeta>
                </section>
              ))}
            </div>

            <p className="mt-10 rounded-xl border border-[var(--negocio-borde)] px-4 py-3 text-xs leading-relaxed text-[var(--negocio-tenue)]">
              <strong className="text-[var(--negocio-texto)]">Alergias e intolerancias:</strong>{" "}
              avisa siempre al personal antes de pedir. Aunque un plato no lleve un alérgeno en su
              receta, puede haber contaminación cruzada en cocina, y eso no lo sabe una web.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
