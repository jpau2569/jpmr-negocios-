import { ESTADO_ENERGIA_ES, type EstadoEnergia, type LetraEnergia } from "@/types/negocio";

// ============================================================================
//  Etiqueta de eficiencia energética
// ----------------------------------------------------------------------------
//  El RD 390/2021 obliga a mostrar la calificación en CUALQUIER anuncio de
//  venta o alquiler. Por eso este componente nunca devuelve null: si falta, lo
//  dice. Es deliberadamente incómodo de ver, porque su trabajo es que la
//  agencia lo cargue, no que la ficha quede bonita sin él.
//
//  Los colores son los de la escala oficial: A verde oscuro, G rojo. Se ponen
//  literales y no desde el tema del negocio, porque la escala es la que es y
//  teñirla con la marca de la agencia sería confundir al comprador.
// ============================================================================

const COLORES: Record<LetraEnergia, string> = {
  A: "#00a651",
  B: "#50b848",
  C: "#bfd730",
  D: "#fff200",
  E: "#fdb913",
  F: "#f37021",
  G: "#ed1c24",
};

/** Sobre amarillo y verde claro, el texto negro se lee; sobre el resto, blanco. */
const TINTA: Record<LetraEnergia, string> = {
  A: "#ffffff", B: "#ffffff", C: "#1a1a1a", D: "#1a1a1a",
  E: "#1a1a1a", F: "#ffffff", G: "#ffffff",
};

interface Props {
  letra: LetraEnergia | null;
  estado: EstadoEnergia;
  /** En la ficha se explica; en el listado basta el distintivo. */
  conTexto?: boolean;
}

export function EtiquetaEnergia({ letra, estado, conTexto = false }: Props) {
  if (estado === "disponible" && letra) {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold"
          style={{ background: COLORES[letra], color: TINTA[letra] }}
        >
          {letra}
        </span>
        <span className={conTexto ? "text-sm" : "sr-only"}>
          Calificación energética {letra}
        </span>
      </span>
    );
  }

  // Ni "en trámite" ni "exento" son un problema: son situaciones legales
  // previstas. Se dicen con naturalidad.
  if (estado === "en_tramite" || estado === "exento") {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-[var(--negocio-tenue)]">
        <span
          aria-hidden
          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--negocio-borde)] text-xs font-bold"
        >
          {estado === "exento" ? "—" : "·"}
        </span>
        {ESTADO_ENERGIA_ES[estado]}
      </span>
    );
  }

  // Pendiente: se canta. Preferimos que se vea que falta a que parezca que
  // no hace falta.
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--negocio-tenue)]">
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded border border-dashed border-[var(--negocio-borde)] text-xs font-bold"
      >
        ?
      </span>
      {conTexto
        ? "Calificación energética pendiente de cargar. Pregúntanos por ella antes de visitar."
        : "Calificación pendiente"}
    </span>
  );
}
