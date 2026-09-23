import { Etiqueta } from "@/components/ui/basicos";
import { euros } from "@/lib/utils";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import { ALERGENOS_ES } from "@/types/negocio";
import { Rastreador } from "./rastreador";
import type { Plato } from "@/types/negocio";

// ============================================================================
//  Ficha de plato
// ----------------------------------------------------------------------------
//  Tres cosas que no se negocian:
//   · Sin precio se pone "Consultar", nunca una cifra aproximada.
//   · Los alérgenos se enseñan tal como los ha declarado el negocio, y siempre
//     con el recordatorio de avisar al personal: la contaminación cruzada no
//     está en ninguna base de datos.
//   · Si el plato está sin confirmar, se marca a la vista.
// ============================================================================

export function FichaPlato({
  plato, negocio, whatsapp, conFoto = true,
}: {
  plato: Plato;
  negocio: string;
  whatsapp: string | null;
  conFoto?: boolean;
}) {
  const wasap = enlaceWhatsapp(whatsapp, negocio, { tipo: "plato", plato: plato.name });
  const agotado = plato.status === "sold_out";

  return (
    <article
      id={`plato-${plato.id}`}
      className={`flex gap-3.5 border-b border-[var(--negocio-borde)] py-4 last:border-0 ${agotado ? "opacity-55" : ""}`}
    >
      {conFoto && plato.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={plato.image_url}
          alt={plato.name}
          loading="lazy"
          className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-medium leading-snug">{plato.name}</h3>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {euros(plato.price_cents, { desde: plato.price_from })}
          </span>
        </div>

        {plato.description ? (
          <p className="mt-0.5 text-sm leading-snug text-[var(--negocio-tenue)]">{plato.description}</p>
        ) : null}

        {plato.tags.length > 0 || agotado ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {agotado ? <Etiqueta nombre="Agotado hoy" /> : null}
            {plato.tags.map((t) => <Etiqueta key={t} nombre={t} />)}
          </div>
        ) : null}

        {plato.alergenos.length > 0 ? (
          <p className="mt-1.5 text-[0.7rem] text-[var(--negocio-tenue)]">
            Alérgenos declarados: {plato.alergenos.map((a) => ALERGENOS_ES[a]).join(", ")}
          </p>
        ) : null}

        {plato.is_demo ? (
          <p className="mt-1.5 text-[0.7rem] text-amber-200/80">
            ⚠ Nombre y precio sin confirmar por el negocio
          </p>
        ) : null}

        {wasap ? (
          <Rastreador evento="whatsapp_click" subjectId={plato.id}>
            <a
              href={wasap}
              target="_blank"
              rel="noopener"
              className="mt-2 inline-block text-xs font-medium underline underline-offset-4"
            >
              Preguntar por WhatsApp
            </a>
          </Rastreador>
        ) : null}
      </div>
    </article>
  );
}
