// ============================================================================
//  Tema del negocio
// ----------------------------------------------------------------------------
//  Los colores de cada cliente llegan en business_settings.theme y se vuelcan
//  como custom properties. Toda la hoja de estilos lee esas variables, así que
//  un negocio nuevo cambia de aspecto sin tocar una línea de CSS.
//
//  El color del texto SOBRE el acento se calcula por contraste WCAG, no se
//  elige a ojo: hay marcas con acento amarillo donde el texto blanco encima no
//  se lee, y eso es un fallo de accesibilidad, no una cuestión de gusto.
// ============================================================================

import { colorValido, textoSobre } from "@/lib/utils";
import type { Tema } from "@/types/negocio";

const POR_DEFECTO = {
  fondo: "#0e0f11",
  superficie: "#17181b",
  acento: "#d4a03c",
  acento2: "#8e2a33",
  texto: "#f3efe6",
} as const;

export function variablesTema(tema: Tema | null | undefined): Record<string, string> {
  const t = tema ?? {};
  const fondo = colorValido(t.fondo, POR_DEFECTO.fondo);
  const acento = colorValido(t.acento, POR_DEFECTO.acento);
  const acento2 = colorValido(t.acento2, POR_DEFECTO.acento2);
  const texto = colorValido(t.texto, POR_DEFECTO.texto);
  // Si el cliente no da superficie, se deriva del fondo aclarándolo un poco
  // con color-mix, para que las tarjetas se despeguen del fondo.
  const superficie = colorValido(t.superficie, "");

  return {
    "--negocio-fondo": fondo,
    "--negocio-superficie": superficie || `color-mix(in srgb, ${fondo} 88%, ${texto})`,
    "--negocio-acento": acento,
    "--negocio-acento2": acento2,
    "--negocio-texto": texto,
    "--negocio-sobre-acento": textoSobre(acento),
    "--negocio-sobre-acento2": textoSobre(acento2),
    "--negocio-borde": `color-mix(in srgb, ${texto} 14%, transparent)`,
    "--negocio-tenue": `color-mix(in srgb, ${texto} 62%, transparent)`,
  };
}

/**
 * Inyecta las variables en :root. Va en el <head> del layout del negocio para
 * que el primer pintado ya salga con sus colores y no haya un parpadeo.
 */
export function TemaNegocio({ tema }: { tema: Tema | null | undefined }) {
  const css = Object.entries(variablesTema(tema))
    .map(([clave, valor]) => `${clave}:${valor}`)
    .join(";");
  return <style dangerouslySetInnerHTML={{ __html: `:root{${css}}` }} />;
}
