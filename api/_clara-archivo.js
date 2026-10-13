// ============================================================================
//  /api/clara-archivo — crea y descarga los archivos que prepara Clara
// ----------------------------------------------------------------------------
//  POST { ficha, estado?, firmaEstado?, clave? }
//    Trabaja un tramo (~45 s) con las skills oficiales de Anthropic y responde:
//      { listo: true, archivo: { nombre, formato, bytes, url } }
//      { pendiente: true, estado, firmaEstado, intento, max }  → volver a llamar
//      { error }
//    Todas las respuestas tras un tramo llevan además { uso, uso_estado } (el
//    contador de gasto, lib/uso.js); con la nube y el tope mensual
//    (CLARA_TOPE_MES_USD) alcanzado responde 402 sin gastar nada.
//  GET ?descargar=<file_id>&e=<caduca>&f=<firma>
//    Hace de proxy de client.beta.files.download con el Content-Type y el
//    Content-Disposition correctos. Solo sirve file_id firmados aquí, durante
//    30 días.
//
//  Protección: la ficha la firma el servidor de Clara cuando ella llama a
//  preparar_archivo, así que esta ruta solo trabaja encargos de Clara (con
//  la misma exposición que el propio chat) y nunca reparte archivos ajenos.
//  Si la nube está configurada (como la memoria de Clara), además exige la
//  clave de sincronización que clara.html ya guarda para la 🧠 Memoria.
//  Tiempos: nada pasa de los 60 s de Vercel (cliente con maxRetries 1,
//  8 s por llamada a la Files API y sin metadatos pasados los 52 s).
//  Todo lo que es lógica vive en lib/archivos.js.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import {
  FORMATOS,
  MAX_TRAMOS,
  MAX_DESCARGA,
  LIMITE_TRAMO_MS,
  TIEMPO_FILES_MS,
  archivosActivos,
  comprobarFicha,
  desempaquetarEstado,
  empaquetarEstado,
  tramoArchivo,
  urlDescarga,
  comprobarDescarga,
  nombreDescarga,
  formatoDeNombre,
  elegirArchivo,
} from "../lib/archivos.js";
import { nubeConfigurada, leerMemoria } from "../lib/memoria.js";
import { MODELO_ARCHIVOS } from "../lib/archivos.js";
import { crearContador, registrarUso, topeMensual, leerUsoMes, formatoUsd } from "../lib/uso.js";

// Pasado este tiempo desde el inicio, el uso no se guarda en la nube (lo
// cuenta el navegador): antes que el contador está no pasar del minuto.
const LIMITE_GUARDAR_USO_MS = 50000;

const AVISO_SIN_CLAVE =
  "La creación de archivos no está activa: falta ANTHROPIC_API_KEY en Vercel (o está apagada con CLARA_ARCHIVOS=no). El chat sigue funcionando: pídele a Clara la tabla en CSV o el documento en HTML.";
const AVISO_BETA =
  "Las skills de Anthropic (beta) no han podido crear el archivo ahora mismo. El chat sigue funcionando: pídele a Clara la tabla en CSV o el documento en HTML mientras tanto.";

// Un reintento como mucho: con los reintentos por defecto (2) y sus esperas,
// una llamada lenta podía pasar del minuto de Vercel.
export const OPCIONES_CLIENTE = Object.freeze({ maxRetries: 1 });
const OPCIONES_FILES = Object.freeze({ timeout: TIEMPO_FILES_MS });

// Cliente y reloj inyectables para las pruebas.
let crearCliente = () => new Anthropic({ ...OPCIONES_CLIENTE });
export function _usarCliente(fabrica) {
  crearCliente = fabrica || (() => new Anthropic({ ...OPCIONES_CLIENTE }));
}
let reloj = () => Date.now();
export function _usarReloj(f) {
  reloj = f || (() => Date.now());
}

// Con la nube activa, la misma clave de sincronización que la 🧠 Memoria
// (igual que autoriza() de api/_cerebro.js). Sin nube no se pide nada más.
// Devuelve null si pasa o { codigo, error }.
export async function autorizaArchivo(clave) {
  if (!nubeConfigurada()) return null;
  const c = typeof clave === "string" ? clave.trim() : "";
  if (!c) {
    return { codigo: 401, error: "Para crear archivos hace falta tu clave de sincronización: escríbela en 🧠 Memoria en este dispositivo y vuelve a pulsar." };
  }
  try {
    await leerMemoria(c);
    return null;
  } catch (e) {
    return String(e?.message || e).includes("incorrecta")
      ? { codigo: 401, error: "Clave de sincronización incorrecta. Revísala en 🧠 Memoria." }
      : { codigo: 502, error: "No se pudo comprobar la clave de sincronización. Inténtalo en un momento." };
  }
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
  const cd = comprobarDescarga(id, firma, req.query?.e, process.env, reloj());
  if (!cd.ok) return res.status(cd.codigo).json({ error: cd.error });
  const cliente = crearCliente();
  let meta;
  try {
    meta = await cliente.beta.files.retrieveMetadata(id, {}, OPCIONES_FILES);
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
    r = await cliente.beta.files.download(id, {}, OPCIONES_FILES);
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

  const inicio = reloj();
  const { ficha: bruta, estado, firmaEstado, clave } = req.body ?? {};
  const fc = comprobarFicha(bruta, process.env, inicio);
  if (!fc.ok) return res.status(fc.codigo).json({ error: fc.error });
  const ficha = fc.ficha;
  const de = desempaquetarEstado(estado, firmaEstado, ficha);
  if (!de.ok) return res.status(400).json({ error: de.error });
  const no = await autorizaArchivo(clave);
  if (no) return res.status(no.codigo).json({ error: no.error });

  // Tope mensual de gasto: con la nube (total fiable), al 100 % no se crean
  // archivos. Sin nube o sin la tabla clara_uso, el tope solo avisa en el chat.
  const tope = topeMensual();
  if (tope && nubeConfigurada()) {
    const mes = await leerUsoMes();
    if (mes && mes.coste_usd >= tope) {
      return res.status(402).json({
        error:
          `Este mes ya se ha llegado al tope de gasto de Clara (${formatoUsd(mes.coste_usd)} $ estimados de ${formatoUsd(tope)} $). ` +
          "Por eso no se crean archivos hasta el mes que viene o hasta que subas CLARA_TOPE_MES_USD en Vercel. Mientras, pídele a Clara la tabla en CSV o el documento en HTML.",
        tope_usd: tope,
        gastado_usd: mes.coste_usd,
      });
    }
  }

  const cliente = crearCliente();
  // Lo que haya tardado la clave se descuenta del tramo.
  const limiteMs = Math.max(5000, LIMITE_TRAMO_MS - (reloj() - inicio));
  let r;
  try {
    r = await tramoArchivo(cliente, ficha, de.previo, { limiteMs });
  } catch (e) {
    return errorApi(res, e);
  }
  // Contador de gasto: el tramo se paga salga o no el archivo.
  const contador = crearContador(MODELO_ARCHIVOS);
  contador.claude(r.usage);
  const usoInfo =
    reloj() - inicio < LIMITE_GUARDAR_USO_MS
      ? await registrarUso(contador.total, { clave: typeof clave === "string" ? clave.trim() : "", nube: nubeConfigurada(), tope })
      : await registrarUso(contador.total, { nube: false, tope });
  if (r.error) return res.status(r.codigo || 422).json({ error: r.error, ...usoInfo });
  if (r.pendiente) {
    return res.status(200).json({ pendiente: true, intento: r.intento, max: MAX_TRAMOS, motivo: r.motivo, ...empaquetarEstado(r.estado, ficha), ...usoInfo });
  }

  // Hay archivo: se elige el de oficina (mejor el del formato pedido) y se firma su descarga.
  const el = await elegirArchivo(cliente, r.ids, ficha, {
    inicio,
    ahora: reloj,
    alError: (e) => console.error("[clara-archivo] metadatos:", String(e?.message || e).slice(0, 200)),
  });
  if (!el.ok) return res.status(el.codigo).json({ error: el.error, ...usoInfo });
  const elegido = el.elegido;
  return res.status(200).json({
    listo: true,
    intento: r.intento,
    max: MAX_TRAMOS,
    archivo: { nombre: elegido.nombre, formato: elegido.formato, bytes: elegido.bytes, url: urlDescarga(elegido.id, process.env, reloj()) },
    ...usoInfo,
  });
}
