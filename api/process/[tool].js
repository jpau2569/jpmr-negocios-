// ============================================================================
//  LimpiaFotos JPMR — Función serverless (Vercel) conectada con Clipdrop
// ----------------------------------------------------------------------------
//  Proxy seguro: la clave vive en la variable de entorno CLIPDROP_API_KEY
//  (Vercel → Project → Settings → Environment Variables). El navegador nunca
//  la ve. El cuerpo multipart del navegador se reenvía tal cual a Clipdrop
//  (se conserva el boundary), así que no hace falta ningún parser.
// ============================================================================

export const config = { api: { bodyParser: false } };

const CLIPDROP_BASE = "https://clipdrop-api.co";

const ENDPOINTS = {
  "remove-background": "/remove-background/v1",
  "remove-text": "/remove-text/v1",
  "image-upscaling": "/image-upscaling/v1/upscale",
  "cleanup": "/cleanup/v1",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con multipart/form-data." });
  }

  const tool = req.query.tool;
  const endpoint = ENDPOINTS[tool];
  if (!endpoint) {
    return res.status(400).json({
      error: `Herramienta no válida: "${tool}". Opciones: ${Object.keys(ENDPOINTS).join(", ")}`,
    });
  }

  const key = process.env.CLIPDROP_API_KEY;
  if (!key) {
    return res.status(500).json({
      error:
        "Falta la clave de Clipdrop. Añádela en Vercel → Settings → Environment Variables como CLIPDROP_API_KEY y vuelve a desplegar.",
    });
  }

  try {
    // Leemos el cuerpo crudo (multipart con su boundary intacto).
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (!body.length) {
      return res.status(400).json({ error: "No se recibió ninguna imagen." });
    }

    const clipdropRes = await fetch(`${CLIPDROP_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "content-type": req.headers["content-type"] || "multipart/form-data",
      },
      body,
    });

    if (!clipdropRes.ok) {
      const detail = await clipdropRes.text().catch(() => "");
      return res.status(clipdropRes.status).json({
        error: `Clipdrop devolvió ${clipdropRes.status}.`,
        detail: detail?.slice(0, 500),
      });
    }

    // Reenviamos la imagen resultante + créditos restantes.
    res.setHeader("Content-Type", clipdropRes.headers.get("content-type") || "image/png");
    const remaining = clipdropRes.headers.get("x-remaining-credits");
    const consumed = clipdropRes.headers.get("x-credits-consumed");
    if (remaining) res.setHeader("X-Remaining-Credits", remaining);
    if (consumed) res.setHeader("X-Credits-Consumed", consumed);
    res.setHeader("Access-Control-Expose-Headers", "X-Remaining-Credits, X-Credits-Consumed");
    res.setHeader("Cache-Control", "no-store");

    const arrayBuffer = await clipdropRes.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Error procesando imagen:", err);
    return res.status(500).json({
      error: "Error interno al procesar la imagen.",
      detail: String(err?.message || err),
    });
  }
}
