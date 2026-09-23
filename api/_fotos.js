// ============================================================================
//  Fotos de un inmueble para la galería del escaparate 3D
// ----------------------------------------------------------------------------
//  /api/fotos?u=<url de la ficha en asesoriacastresana.com>
//  Devuelve { ok, total, fotos: [...] } con las URLs de todas las fotos de esa
//  ficha. La galería las pide luego a /api/foto para poder mostrarlas.
//
//  Solo acepta fichas del portal propio: no es un lector de páginas ajenas.
// ============================================================================

import { extraeFotos } from "../lib/fotos-ficha.js";

const FICHA_VALIDA = /^https?:\/\/(www\.)?asesoriacastresana\.com\//i;

export default async function handler(req, res) {
  const ficha = req.query?.u || new URL(req.url, "http://x").searchParams.get("u");
  if (!ficha) return res.status(400).json({ error: "Falta el parámetro u." });
  if (!FICHA_VALIDA.test(ficha)) {
    return res.status(403).json({ error: "Solo se leen fichas de asesoriacastresana.com." });
  }

  try {
    const ctrl = new AbortController();
    const temporizador = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(ficha, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });
    clearTimeout(temporizador);
    if (!r.ok) return res.status(502).json({ error: `La ficha devolvió HTTP ${r.status}.` });

    const fotos = extraeFotos(await r.text(), ficha);
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ ok: fotos.length > 0, total: fotos.length, fotos });
  } catch (e) {
    return res.status(502).json({ error: "No se pudo leer la ficha: " + String(e?.message || e) });
  }
}
