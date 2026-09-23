import Link from "next/link";
import { leerEspacio, slugsConocidos, hayBackend } from "@/lib/datos";
import { EditorMenuDia } from "@/components/dashboard/editor-menu-dia";

export const dynamic = "force-dynamic";

export default async function PaginaMenuDia({
  searchParams,
}: {
  searchParams: Promise<{ negocio?: string }>;
}) {
  const { negocio } = await searchParams;
  const slugs = slugsConocidos();
  const slug = negocio && slugs.includes(negocio) ? negocio : (slugs[0] ?? "");
  const espacio = slug ? await leerEspacio(slug) : null;

  if (!espacio) return <p className="text-sm text-white/60">No hay ningún negocio cargado.</p>;

  const menu = espacio.menuDeHoy;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Menú del día</h1>
          <p className="text-xs text-white/50">{espacio.negocio.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slugs.map((s) => (
            <Link
              key={s}
              href={`/dashboard/menu-del-dia?negocio=${s}`}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                s === slug ? "border-[#d4a03c] text-[#d4a03c]" : "border-white/15 text-white/60"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {menu?.is_demo ? (
        <p className="mb-5 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          ⚠ Lo que hay cargado ahora es un menú de muestra. En cuanto guardes el tuyo, deja de
          salir marcado como muestra en la web.
        </p>
      ) : null}

      <EditorMenuDia
        slug={slug}
        inicial={menu ? {
          service_date: menu.service_date,
          price_cents: menu.price_cents,
          includes_drink: menu.includes_drink,
          notes: menu.notes,
          status: menu.status,
          platos: menu.platos.map((p) => ({ course: p.course, name: p.name })),
        } : null}
        hayBackend={hayBackend()}
      />

      <p className="mt-6 text-center text-xs text-white/40">
        Lo publicado se ve en{" "}
        <Link href={`/b/${slug}/menu-del-dia`} className="underline underline-offset-4">
          /b/{slug}/menu-del-dia
        </Link>
      </p>
    </>
  );
}
