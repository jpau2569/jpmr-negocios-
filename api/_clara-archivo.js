// ============================================================================
//  /api/clara-archivo — crea y descarga los archivos que prepara Clara
// ----------------------------------------------------------------------------
//  POST { ficha, estado?, firmaEstado? }
//    Trabaja un tramo (~45 s) con las skills oficiales de Anthropic y responde:
//      { listo: true, archivo: { nombre, formato, bytes, url } }
//      { pendiente: true, estado, firmaEstado, intento, max }  → volver a llamar
//      { error }
//  GET ?descargar=<file_id>&f=<firma>
//    Hace de proxy de client.beta.files.download con el Content-Type y el
//    Content-Disposition correctos. Solo sirve file_id firmados aquí.
//
//  Protección: la ficha la firma el servidor de Clara cuando ella llama a
//  preparar_archivo, así que esta ruta solo trabaja encargos de Clara (con
//  la misma exposición que el propio chat) y nunca reparte archivos ajenos.
//  Todo lo que es lógica vive en lib/archivos.js.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import {
  FORMATOS,
  MAX_TRAMOS,
  MAX_DESCARGA,
  archivosActivos,
  comprobarFicha,
  desempaquetarEstado,
  empaquetarEstado,
  tramoArchivo,
  urlDescarga,
  comprobarDescarga,
  nombreDescarga,
  formatoDeNombre,
  nombreBase,
} from "../lib/archivos.js";

const AVISO_SIN_CLAVE =
  "La creación de archivos no está activa: falta ANTHROPIC_API_KEY en Vercel (o está apagada con CLARA_ARCHIVOS=no). El chat sigue funcionando: pídele a Clara la tabla en CSV o el documento en HTML.";
const AVISO_BETA =
  "Las skills de Anthropic (beta) no han podido crear el archivo ahora mismo. El chat sigue funcionando: pídele a Clara la tabla en CSV o el documento en HTML mientras tanto.";

// Cliente inyectable para las pruebas.
let crearCliente = () => new Anthropic();
export function _usarCliente(fabrica) {
  crearCliente = fabrica || (() => new Anthropic());
}

function errorApi(res, e) {
  const status = e?.status;
  if (status === 401) return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no es válida. Revísala en Vercel." });
  if (status === 429) return res.status(429).json({ error: "Demasiadas peticiones seguidas. Espera un minuto y vuelve a pulsar la tarjeta." });
  if (status === 404 && e?.esDescarga) return res.status(404).json({ error: "Ese archivo ya no existe en la cuenta." });
  if (status >= 400 && status < 500) {
    console.error("[clara-archivo] la API rechazó la petición:", status, String(e?.message || e).slice(0, 300));
    return res.status(502).json({ error: AVISO_BETA, detalle: `La API respondió ${status}.` });
  }
  console.error("[clara-archivo] error:", status, String(e?.message || e).slice(0, 300));
  return res.status(502).json({ error: "Ha fallado la conexión con Claude al crear el archivo. Vuelve a pulsar la tarjeta en un momento." });
}

async function descargar(req, res) {
  const id = String(req.query?.descargar || "");
  const firma = String(req.query?.f || "");
  if (!comprobarDescarga(id, firma)) {
    return res.status(403).json({ error: "Enlace de descarga no válido." });
  }
  const cliente = crearCliente();
  let meta;
  try {
    meta = await cliente.beta.files.retrieveMetadata(id);
  } catch (e) {
    e.esDescarga = true;
    return errorApi(res, e);
  }
  const formato = formatoDeNombre(meta?.filename);
  if (!formato) return res.status(415).json({ error: "Ese archivo no es de Word, Excel, PowerPoint ni PDF." });
  if (Number(meta?.size_bytes) > MAX_DESCARGA) {
    return res.status(413).json({
      error: `El archivo pesa ${(Number(meta.size_bytes) / 1e6).toFixed(1)} MB y Vercel no deja pasar más de 4,5 MB. Pídele a Clara una versión más ligera (menos imágenes).`,
    });
  }
  let r;
  try {
    r = await cliente.beta.files.download(id);
  } catch (e) {
    e.esDescarga = true;
    return errorApi(res, e);
  }
  const datos = Buffer.from(await r.arrayBuffer());
  if (datos.length > MAX_DESCARGA) return res.status(413).json({ error: "El archivo es demasiado grande para descargarlo desde aquí." });
  const nombre = nombreDescarga(meta.filename, formato);
  const ascii = nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || `documento.${formato}`;
  res.setHeader("Content-Type", FORMATOS[formato].mime);
  res.setHeader("Content-Disposition", `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`);
  res.setHeader("Content-Length", String(datos.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200);
  return res.end(datos);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!archivosActivos()) return res.status(503).json({ error: AVISO_SIN_CLAVE });

  if (req.method === "GET" && req.query?.descargar !== undefined) return descargar(req, res);
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST con la ficha, o GET ?descargar=…" });

  const { ficha: bruta, estado, firmaEstado } = req.body ?? {};
  const fc = comprobarFicha(bruta);
  if (!fc.ok) return res.status(fc.codigo).json({ error: fc.error });
  const ficha = fc.ficha;
  const de = desempaquetarEstado(estado, firmaEstado, ficha);
  if (!de.ok) return res.status(400).json({ error: de.error });

  const cliente = crearCliente();
  let r;
  try {
    r = await tramoArchivo(cliente, ficha, de.previo);
  } catch (e) {
    return errorApi(res, e);
  }
  if (r.error) return res.status(r.codigo || 422).json({ error: r.error });
  if (r.pendiente) {
    return res.status(200).json({ pendiente: true, intento: r.intento, max: MAX_TRAMOS, motivo: r.motivo, ...empaquetarEstado(r.estado, ficha) });
  }

  // Hay archivo: se elige el del formato pedido (si salió más de uno) y se firma su descarga.
  let elegido = null;
  for (const id of r.ids.slice(-3).reverse()) {
    try {
      const meta = await cliente.beta.files.retrieveMetadata(id);
      const formato = formatoDeNombre(meta?.filename);
      const cand = { id, nombre: nombreDescarga(meta?.filename, formato || ficha.formato), formato: formato || ficha.formato, bytes: Number(meta?.size_bytes) || 0 };
      if (formato === ficha.formato) { elegido = cand; break; }
      if (!elegido && formato) elegido = cand;
    } catch (e) {
      console.error("[clara-archivo] metadatos:", String(e?.message || e).slice(0, 200));
    }
  }
  if (!elegido) {
    const id = r.ids.at(-1);
    elegido = { id, nombre: `${nombreBase(ficha.titulo)}.${ficha.formato}`, formato: ficha.formato, bytes: 0 };
  }
  return res.status(200).json({
    listo: true,
    intento: r.intento,
    max: MAX_TRAMOS,
    archivo: { nombre: elegido.nombre, formato: elegido.formato, bytes: elegido.bytes, url: urlDescarga(elegido.id) },
  });
}
