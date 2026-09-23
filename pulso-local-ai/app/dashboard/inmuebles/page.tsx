import Link from "next/link";
import { leerEspacio, slugsConocidos, hayBackend, moduloActivo } from "@/lib/datos";
import { admin } from "@/lib/supabase/servidor";
import { Aviso } from "@/components/ui/basicos";
import { EditorInmuebles, type InmueblePanel } from "@/components/dashboard/editor-inmuebles";

// ============================================================================
//  Panel de inmuebles — /dashboard/inmuebles
// ----------------------------------------------------------------------------
//  Esta página NO usa la capa de datos pública: aquella solo devuelve los
//  inmuebles de visibilidad "publico", que es justo lo contrario de lo que
//  hace falta aquí. La agencia tiene que ver también sus borradores y, sobre
//  todo, sus inmuebles de enlace privado.
//
//  Por eso se lee con service_role, filtrando por business_id a mano. Se llega
//  hasta aquí habiendo pasado el middleware, así que hay sesión de panel.
// ============================================================================

export const dynamic = "force-dynamic";

async function leerCarteraCompleta(slug: string): Promise<InmueblePanel[]> {
  if (!hayBackend()) return [];
  const db = admin();
  const { data: negocio } = await db
    .from("businesses").select("id").eq("slug", slug).maybeSingle();
  if (!negocio) return [];

  const { data } = await db
    .from("properties")
    .select(
      "id, reference, slug, title, operation, kind, price_cents, municipality,"
      + " visibility, deal_state, status, energy_status, source, private_token",
    )
    .eq("business_id", negocio.id)
    .order("position");

  const inmuebles = (data ?? []) as unknown as InmueblePanel[];

  // El token del QR de cada inmueble sale de la base, NO se reconstruye aquí:
  // si un día cambia la forma de generarlo, los carteles ya impresos siguen
  // valiendo y el panel sigue enlazando al que se imprimió.
  const { data: qrs } = await db
    .from("qr_codes")
    .select("token, location_ref")
    .eq("business_id", negocio.id)
    .eq("target", "property");

  const porInmueble = new Map(
    (qrs ?? []).map((q) => [q.location_ref as string, q.token as string]),
  );
  return inmuebles.map((i) => ({ ...i, qrToken: porInmueble.get(i.id) ?? null }));
}

export default async function PaginaInmuebles({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>;
}) {
  const { negocio } = await searchParams;
  const slugs = slugsConocidos();
  const slug = negocio && slugs.includes(negocio) ? negocio : (slugs[0] ?? "");
  const espacio = slug ? await leerEspacio(slug) : null;
  if (!espacio) return <p className="text-sm text-white/60">No hay ningún negocio cargado.</p>;

  // Las inmobiliarias tienen cartera; los bares, no. Se dice en vez de enseñar
  // una pantalla vacía que parece rota.
  const esInmobiliaria = moduloActivo(espacio, "properties");
  const inmuebles = esInmobiliaria ? await leerCarteraCompleta(slug) : [];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Inmuebles</h1>
          <p className="text-xs text-white/50">{espacio.negocio.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => (
            <Link
              key={s}
              href={`/dashboard/inmuebles?negocio=${s}`}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                s === slug ? "border-[#d4a03c] text-[#d4a03c]" : "border-white/15 text-white/60"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {!esInmobiliaria ? (
        <Aviso>
          <strong>{espacio.negocio.name}</strong> no es una inmobiliaria: tiene
          el módulo de cartera apagado. Elige otro negocio arriba.
        </Aviso>
      ) : (
        <EditorInmuebles
          slug={slug}
          negocio={espacio.negocio.name}
          web={espacio.ajustes.website}
          inmuebles={inmuebles}
          hayBackend={hayBackend()}
        />
      )}
    </>
  );
}
