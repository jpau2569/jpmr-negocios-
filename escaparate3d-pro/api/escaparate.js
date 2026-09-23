// Escaparate Castresana: lee los inmuebles publicados en www.asesoriacastresana.com
// y los devuelve como JSON para la pantalla del escaparate (escaparate.html).
// No usa ninguna clave: escrapea las páginas públicas de resultados del propio portal.
// La lógica de lectura vive en lib/cartera.js (compartida con Clara y el briefing).

import { obtenerCartera } from "../lib/cartera.js";

export default async function handler(_req, res) {
  const { items, errores } = await obtenerCartera();

  // Caché en el CDN de Vercel: 30 min fresco, hasta 1 día servible mientras revalida.
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    ok: items.length > 0,
    actualizado: new Date().toISOString(),
    total: items.length,
    errores: errores.length ? errores : undefined,
    items,
  });
}
