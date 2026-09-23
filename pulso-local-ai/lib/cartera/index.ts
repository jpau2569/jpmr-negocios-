// ============================================================================
//  Cartera: salir a buscarla a la web de la agencia
// ----------------------------------------------------------------------------
//  Aquí vive lo único que toca la red. El análisis del HTML está en
//  ./parseo.ts, que es puro y por eso se puede probar sin internet.
//
//  Dónde corre: SOLO en el servidor (Route Handler del panel, o un cron).
//  Desde el navegador no funcionaría —CORS—, y el propio `server-only` impide
//  que alguien lo importe por error en un componente de cliente.
// ============================================================================

import "server-only";
import { parsearInmuebles, type InmuebleLeido } from "./parseo";
import type { OperacionInmueble } from "@/types/negocio";

export * from "./parseo";

export interface FuenteCartera {
  /** Raíz de la web, sin barra final. Ej: "https://www.asesoriacastresana.com" */
  base: string;
  /** Rutas de resultados a leer, con la operación que representa cada una. */
  rutas: { operacion: OperacionInmueble; ruta: string }[];
}

/** Web Inmoweb (la que usa Asesoría Castresana y buena parte del sector). */
export function fuenteInmoweb(base: string): FuenteCartera {
  const raiz = base.replace(/\/+$/, "");
  return {
    base: raiz,
    rutas: [
      { operacion: "venta", ruta: "/results/?id_tipo_operacion=1&od=pri.d&i=0&c=45" },
      { operacion: "alquiler", ruta: "/results/?id_tipo_operacion=2&od=pri.d&i=0&c=45" },
    ],
  };
}

const CABECERAS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

export interface ResultadoCartera {
  inmuebles: InmuebleLeido[];
  errores: string[];
}

/**
 * Lee la cartera completa (venta + alquiler) de la web de la agencia.
 *
 * Nunca lanza: si una de las dos páginas falla, devuelve lo que sí ha podido
 * leer y el error en `errores`. Una sincronización a medias es mejor que una
 * pantalla de error, y el panel enseña lo que ha fallado.
 */
export async function obtenerCartera(fuente: FuenteCartera): Promise<ResultadoCartera> {
  const inmuebles: InmuebleLeido[] = [];
  const errores: string[] = [];
  const vistos = new Set<string>();

  for (const { operacion, ruta } of fuente.rutas) {
    try {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), 12_000);
      const respuesta = await fetch(`${fuente.base}${ruta}`, {
        headers: CABECERAS,
        signal: controlador.signal,
        cache: "no-store",
      });
      clearTimeout(temporizador);
      if (!respuesta.ok) {
        errores.push(`${operacion}: HTTP ${respuesta.status}`);
        continue;
      }
      const html = await respuesta.text();
      for (const item of parsearInmuebles(html, operacion, fuente.base)) {
        // La misma referencia no puede repetirse: la base tiene un unique y
        // reventaría la sincronización entera por una ficha duplicada.
        if (vistos.has(item.reference)) continue;
        vistos.add(item.reference);
        inmuebles.push(item);
      }
    } catch (e) {
      errores.push(`${operacion}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { inmuebles, errores };
}
