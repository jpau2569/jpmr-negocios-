// ============================================================================
//  Proxy de fotos de los inmuebles
// ----------------------------------------------------------------------------
//  El escaparate 3D pinta las fotos dentro de un <canvas> y WebGL rechaza las
//  imágenes de otro dominio salvo que ese dominio autorice CORS. Las fotos de
//  la web oficial (y de su CDN de Inmoweb) no lo autorizan, así que sin esto
//  las tarjetas 3D saldrían sin foto.
//
//  Esta función las sirve desde nuestro propio dominio, con caché en el CDN de
//  Vercel. NO es un proxy abierto: solo deja pasar los dominios de la lista.
//
//  Uso:  /api/foto?u=https://fotos15.apinmo.com/....jpg
//
//  Lo definitivo sigue siendo tener las fotos en casa
//  (escaparate3d/herramientas/sincronizar.mjs); esto es lo que hace que el
//  escaparate funcione desde el minuto uno, sin esperar a la sincronización.
// ============================================================================

const PERMITIDOS = [/(^|\.)asesoriacastresana\.com$/i, /(^|\.)apinmo\.com$/i];
const MAX_BYTES = 8 * 1024 * 1024;

export function dominioPermitido(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return PERMITIDOS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const origen = req.query?.u || new URL(req.url, "http://x").searchParams.get("u");
  if (!origen) return res.status(400).json({ error: "Falta el parámetro u." });
  if (!dominioPermitido(origen)) {
    return res.status(403).json({ error: "Ese dominio no está permitido." });
  }

  try {
    const ctrl = new AbortController();
    const temporizador = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(origen, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; escaparate-castresana/1.0)",
        Referer: "https://www.asesoriacastresana.com/",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
    });
    clearTimeout(temporizador);

    const tipo = r.headers.get("content-type") || "";
    if (!r.ok || !tipo.startsWith("image/")) {
      return res.status(502).json({ error: `El origen devolvió ${r.status} (${tipo || "sin tipo"}).` });
    }
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > MAX_BYTES) return res.status(413).json({ error: "Imagen demasiado grande." });

    res.setHeader("Content-Type", tipo);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    return res.status(200).end(bytes);
  } catch (e) {
    return res.status(502).json({ error: "No se pudo traer la imagen: " + String(e?.message || e) });
  }
}
