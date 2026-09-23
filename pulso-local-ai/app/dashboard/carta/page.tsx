import Link from "next/link";
import { leerEspacio, slugsConocidos, hayBackend } from "@/lib/datos";
import { EditorCarta, type PlatoPanel } from "@/components/dashboard/editor-carta";

export const dynamic = "force-dynamic";

export default async function PaginaCarta({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>;
}) {
  const { negocio } = await searchParams;
  const slugs = slugsConocidos();
  const slug = negocio && slugs.includes(negocio) ? negocio : (slugs[0] ?? "");
  const espacio = slug ? await leerEspacio(slug) : null;
  if (!espacio) return <p className="text-sm text-white/60">No hay ningún negocio cargado.</p>;

  const nombreCategoria = new Map(espacio.categorias.map((c) => [c.id, c.name]));
  const platos: PlatoPanel[] = espacio.platos.map((p) => ({
    id: p.id,
    categoria: nombreCategoria.get(p.category_id ?? "") ?? "Sin apartado",
    name: p.name,
    price_cents: p.price_cents,
    status: p.status,
    is_demo: p.is_demo,
  }));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">La carta</h1>
          <p className="text-xs text-white/50">
            {espacio.negocio.name} · {platos.length} platos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => (
            <Link
              key={s}
              href={`/dashboard/carta?negocio=${s}`}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                s === slug ? "border-[#d4a03c] text-[#d4a03c]" : "border-white/15 text-white/60"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      <EditorCarta slug={slug} platos={platos} hayBackend={hayBackend()} />

      <p className="mt-6 text-center text-xs text-white/40">
        Se ve en{" "}
        <Link href={`/b/${slug}/carta`} className="underline underline-offset-4">/b/{slug}/carta</Link>
      </p>
    </>
  );
}
