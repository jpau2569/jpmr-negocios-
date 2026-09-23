import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { leerEspacio, moduloActivo } from "@/lib/datos";
import { admin, haySupabase } from "@/lib/supabase/servidor";
import { Tarjeta, Aviso } from "@/components/ui/basicos";
import { EnlaceBoton } from "@/components/ui/boton";
import { EtiquetaEnergia } from "@/components/publico/energia";
import { FormularioVisita } from "@/components/publico/formulario-visita";
import { precioInmueble } from "@/components/publico/inmueble";
import { Vista } from "@/components/publico/rastreador";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import {
  precioPorM2, TIPOS_INMUEBLE_ES, type Inmueble, type FotoInmueble,
} from "@/types/negocio";

// ============================================================================
//  Inmueble de enlace privado — /b/[slug]/privado/[token]
// ----------------------------------------------------------------------------
//  Esta es la pieza que hace útil el boca a boca: una captación que el
//  propietario no quiere anunciar, pero que la agencia sí quiere poder mandar
//  por WhatsApp a tres personas concretas.
//
//  Cómo se resuelve, y por qué así:
//
//  · RLS NO enseña estos inmuebles al público JAMÁS, ni conociendo el token
//    (hay una prueba contra PostgreSQL real que lo comprueba). Así que la
//    clave anon no puede sacarlos ni escribiendo mal una consulta.
//  · Se resuelven AQUÍ, en el servidor, con service_role, buscando por token
//    Y filtrando por negocio. El token no viaja nunca al navegador salvo en
//    la propia URL, que es de quien la tiene.
//  · La página va marcada noindex: el enlace es privado, y que Google lo
//    indexara sería exactamente el fallo que se está evitando.
//
//  No se renderiza estáticamente: cada token se resuelve al pedirlo.
// ============================================================================

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string; token: string }>;
}

export const metadata: Metadata = {
  // El enlace es privado. Que no lo indexe nadie.
  robots: { index: false, follow: false, nocache: true },
  title: "Inmueble privado",
};

type FilaPrivada = Omit<Inmueble, "fotos"> & { property_photos?: FotoInmueble[] };

async function leerPorToken(slug: string, token: string): Promise<Inmueble | null> {
  if (!haySupabase() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  // Un token con forma rara ni se consulta.
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;

  const db = admin();
  const { data: negocio } = await db
    .from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (!negocio) return null;

  const { data } = await db
    .from("properties")
    .select("*, property_photos(id, url, alt, position, is_cover)")
    .eq("business_id", negocio.id)
    .eq("private_token", token)
    .eq("visibility", "enlace_privado")
    .maybeSingle();
  if (!data) return null;

  const fila = data as unknown as FilaPrivada;
  const { property_photos, ...resto } = fila;
  return {
    ...resto,
    fotos: [...(property_photos ?? [])].sort((a, b) => {
      if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
      return a.position - b.position;
    }),
  };
}

export default async function PaginaPrivada({ params }: Props) {
  const { slug, token } = await params;
  const espacio = await leerEspacio(slug);
  if (!espacio) notFound();
  if (!moduloActivo(espacio, "private_listings")) notFound();

  const ficha = await leerPorToken(slug, token);
  // Token que no resuelve: 404 igual que cualquier otra página inexistente.
  // Nada de "token incorrecto", que confirmaría que el mecanismo existe.
  if (!ficha) notFound();

  const { negocio, ajustes } = espacio;
  const porM2 = precioPorM2(ficha);
  const asunto = `${ficha.title} (ref. ${ficha.reference})`;
  const wasap = enlaceWhatsapp(ajustes.whatsapp, negocio.name, { tipo: "inmueble", detalle: asunto });

  return (
    <div className="px-4 py-8 sm:px-6">
      <Vista evento="private_link_view" subjectId={ficha.id} />

      <div className="mx-auto w-full max-w-4xl">
        <Aviso>
          <strong>Este inmueble no está anunciado.</strong> Te lo enseñamos por
          este enlace privado: no sale en nuestra web, ni en los portales, ni en
          Google. Te agradecemos que lo trates con la misma discreción.
        </Aviso>

        <h1 className="mt-5 font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          {ficha.title}
        </h1>

        <p className="mt-3 text-3xl font-semibold">{precioInmueble(ficha)}</p>
        {porM2 !== null ? (
          <p className="text-sm text-[var(--negocio-tenue)]">
            {porM2.toLocaleString("es-ES")} €/m² construido
          </p>
        ) : null}

        {ficha.fotos.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {ficha.fotos.map((f, indice) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.id}
                src={f.url}
                alt={f.alt ?? `${ficha.title} — foto ${indice + 1}`}
                loading={indice === 0 ? "eager" : "lazy"}
                className={`w-full rounded-xl border border-[var(--negocio-borde)] object-cover ${
                  indice === 0 ? "sm:col-span-2 aspect-[16/10]" : "aspect-[4/3]"
                }`}
              />
            ))}
          </div>
        ) : null}

        {ficha.description ? (
          <p className="mt-8 whitespace-pre-line leading-relaxed">{ficha.description}</p>
        ) : null}

        <Tarjeta className="mt-8 p-5">
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-xs uppercase text-[var(--negocio-tenue)]">Tipo</dt>
              <dd>{TIPOS_INMUEBLE_ES[ficha.kind]}</dd></div>
            {ficha.surface_built_m2 !== null ? (
              <div><dt className="text-xs uppercase text-[var(--negocio-tenue)]">Superficie</dt>
                <dd>{ficha.surface_built_m2} m²</dd></div>
            ) : null}
            {ficha.rooms !== null ? (
              <div><dt className="text-xs uppercase text-[var(--negocio-tenue)]">Habitaciones</dt>
                <dd>{ficha.rooms}</dd></div>
            ) : null}
            {ficha.municipality ? (
              <div><dt className="text-xs uppercase text-[var(--negocio-tenue)]">Municipio</dt>
                <dd>{ficha.municipality}</dd></div>
            ) : null}
          </dl>
          <div className="mt-4">
            <EtiquetaEnergia letra={ficha.energy_rating} estado={ficha.energy_status} conTexto />
          </div>
        </Tarjeta>

        {wasap ? (
          <div className="mt-5">
            <EnlaceBoton href={wasap} target="_blank" rel="noopener" variante="principal">
              Preguntar por WhatsApp
            </EnlaceBoton>
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">Pedir visita</h2>
          <div className="mt-4">
            <FormularioVisita
              slug={slug}
              negocio={negocio.name}
              telefono={ajustes.phone}
              whatsapp={ajustes.whatsapp}
              referencia={ficha.reference}
              tituloInmueble={ficha.title}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
