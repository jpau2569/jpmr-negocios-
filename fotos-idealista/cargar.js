// ============================================================================
//  Fotos para Idealista — abrir y preparar cada foto en el propio navegador
// ----------------------------------------------------------------------------
//  Todo pasa en el dispositivo: la foto se abre respetando su orientación,
//  se reduce a 2560 px de lado largo (sin ampliar), se retoca suave si está
//  activado y se vuelve a guardar en JPEG al 90 %. Al redibujarla en un
//  <canvas> se pierden los metadatos EXIF, GPS incluido: la foto sale «limpia».
//
//  HEIC: Safari lo abre solo. Chrome/Android/Windows no, y entonces se carga
//  (solo esa vez y solo si hace falta) heic2any desde cdn.jsdelivr.net, con
//  la huella SRI fijada para que no se pueda colar otro código.
// ============================================================================

import { LADO_SALIDA, LADO_IA, dHashDesdeGris } from "./catalogo.js";
import { medidasSalida, retocar, aGris, nitidez, esHeic } from "./procesar.js";

const HEIC2ANY = {
  url: "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js",
  integridad: "sha384-OTofQ0MEeiSgh62havBcemCIK0gqj809wX6UA0uPISNMRnR6NZyCdGzX3SbLrgwL",
};
const LADO_VISTA = 480;     // miniatura para la pantalla
const CALIDAD_SALIDA = 0.9;
const CALIDAD_IA = 0.7;

let promesaHeic = null;
/** Carga heic2any una sola vez. */
function cargarHeic2any() {
  if (globalThis.heic2any) return Promise.resolve(globalThis.heic2any);
  if (!promesaHeic) {
    promesaHeic = new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = HEIC2ANY.url;
      s.integrity = HEIC2ANY.integridad;
      s.crossOrigin = "anonymous";
      s.onload = () => (globalThis.heic2any ? ok(globalThis.heic2any) : mal(new Error("heic2any no se ha cargado")));
      s.onerror = () => { promesaHeic = null; mal(new Error("No se ha podido descargar el lector de HEIC. ¿Hay conexión?")); };
      document.head.append(s);
    });
  }
  return promesaHeic;
}

/** Abre una imagen con lo que tenga el navegador, respetando la orientación EXIF. */
async function decodificarNativo(blob) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch { /* probamos con <img> */ }
  }
  // <img> aplica la orientación EXIF por defecto en todos los navegadores actuales.
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // La imagen ya está decodificada; la URL se libera un poco después.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Abre el archivo; si es HEIC y el navegador no puede, lo convierte antes. */
export async function decodificar(archivo) {
  const cabecera = new Uint8Array(await archivo.slice(0, 16).arrayBuffer());
  const heic = esHeic(cabecera, archivo.name, archivo.type);
  try {
    return await decodificarNativo(archivo);
  } catch (e) {
    if (!heic) throw new Error("No se puede abrir: no parece una foto.");
  }
  const convertir = await cargarHeic2any();
  let jpg = await convertir({ blob: archivo, toType: "image/jpeg", quality: 0.95 });
  if (Array.isArray(jpg)) jpg = jpg[0];
  return decodificarNativo(jpg);
}

const medidas = (f) => ({ ancho: f.width || f.naturalWidth, alto: f.height || f.naturalHeight });

function lienzo(ancho, alto) {
  const c = document.createElement("canvas");
  c.width = ancho; c.height = alto;
  return c;
}

/**
 * Reduce a (ancho, alto) a mitades sucesivas: dibujar de 2560 a 9 píxeles de
 * una vez da resultados ruidosos; a mitades sale una media limpia.
 */
function reducirA(origen, ancho, alto) {
  let actual = origen;
  let { ancho: w, alto: h } = medidas(origen);
  while (w / 2 >= ancho * 1.5 && h / 2 >= alto * 1.5) {
    w = Math.max(ancho, Math.round(w / 2)); h = Math.max(alto, Math.round(h / 2));
    const c = lienzo(w, h);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(actual, 0, 0, w, h);
    actual = c;
  }
  const final = lienzo(ancho, alto);
  const ctx = final.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(actual, 0, 0, ancho, alto);
  return final;
}

function reducirLado(origen, lado) {
  const { ancho, alto } = medidas(origen);
  const m = medidasSalida(ancho, alto, lado);
  return reducirA(origen, m.ancho, m.alto);
}

const aBlob = (c, calidad) => new Promise((ok, mal) =>
  c.toBlob((b) => (b ? ok(b) : mal(new Error("No se ha podido guardar la foto."))), "image/jpeg", calidad));

/**
 * Prepara una foto para Idealista.
 * @returns {Promise<{blob:Blob, vista:Blob, mini:string, hash:string, nitidez:number, ancho:number, alto:number, anchoOriginal:number, altoOriginal:number}>}
 */
export async function preparar(archivo, { retoque = true } = {}) {
  const fuente = await decodificar(archivo);
  const original = medidas(fuente);
  const { ancho, alto } = medidasSalida(original.ancho, original.alto, LADO_SALIDA);

  // Reducción por mitades hasta el tamaño final, y luego el retoque.
  const grande = reducirA(fuente, ancho, alto);
  fuente.close?.();
  if (retoque) {
    const ctx = grande.getContext("2d", { willReadFrequently: true });
    const img = ctx.getImageData(0, 0, ancho, alto);
    retocar(img);
    ctx.putImageData(img, 0, 0);
  }
  const blob = await aBlob(grande, CALIDAD_SALIDA);

  const vistaC = reducirLado(grande, LADO_VISTA);
  const vista = await aBlob(vistaC, 0.8);
  const miniC = reducirLado(grande, LADO_IA);
  const mini = miniC.toDataURL("image/jpeg", CALIDAD_IA).split(",")[1];

  // Nitidez sobre una copia de ~256 px y huella dHash sobre 9×8.
  const peq = reducirLado(grande, 256);
  const datosPeq = peq.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, peq.width, peq.height);
  const nit = nitidez(aGris(datosPeq.data), peq.width, peq.height);
  const d = reducirA(peq, 9, 8).getContext("2d", { willReadFrequently: true }).getImageData(0, 0, 9, 8);
  const hash = dHashDesdeGris(aGris(d.data));

  // En iPhone los lienzos grandes ocupan mucha memoria: se liberan ya.
  for (const c of [grande, vistaC, miniC, peq]) { c.width = 0; c.height = 0; }

  return { blob, vista, mini, hash, nitidez: nit, ancho, alto, anchoOriginal: original.ancho, altoOriginal: original.alto };
}
