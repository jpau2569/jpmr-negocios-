/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — fotos para Clara
   La foto del móvil pesa 3-5 MB y Vercel corta las peticiones de más de
   4,5 MB. Aquí se reduce en el propio teléfono (1600 px si va sola, 1400 px
   si van varias) y se ajusta la calidad hasta que quepa en su parte del
   presupuesto, así que caben hasta 6 juntas en una sola petición. Se saca
   además una miniatura para enseñarla en el chat. La original no sale del
   móvil.

   Las fotos se preparan DE UNA EN UNA, nunca en paralelo: decodificar seis
   fotos de 12 Mpx a la vez son más de 300 MB de memoria y en móviles
   modestos la pestaña se cerraba sola («se bloquea»).
   ═══════════════════════════════════════════════════════════════════ */

export const LADO_MAXIMO = 1600;
export const MAX_FOTOS = 6;
/** Base64 total de todas las fotos de una petición: con el texto, el
    historial y el JSON se queda holgado por debajo de los 4,5 MB de Vercel. */
export const PRESUPUESTO_B64 = 3_300_000;
const LADO_MINIATURA = 240;
const EXTENSIONES = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

/** Medidas finales conservando la proporción. Pura: se prueba en Node. */
export function medidas(ancho, alto, maximo = LADO_MAXIMO) {
  const mayor = Math.max(ancho, alto);
  if (!mayor) return { ancho: 0, alto: 0 };
  const factor = Math.min(1, maximo / mayor);
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) };
}

/** Ajustes según cuántas fotos van juntas. Pura: se prueba en Node.
    Una sola va más grande; varias, algo más pequeñas pero legibles. */
export function ajustesPara(cuantas) {
  const n = Math.max(1, Math.min(MAX_FOTOS, Math.floor(cuantas) || 1));
  return {
    lado: n === 1 ? LADO_MAXIMO : 1400,
    calidad: n === 1 ? 0.8 : 0.72,
    maxB64: Math.floor(PRESUPUESTO_B64 / n)
  };
}

/** Escalones de calidad y tamaño para encajar una foto en su presupuesto.
    Pura: se prueba en Node. Primero baja la calidad, luego el tamaño. */
export function escalones({ lado, calidad }) {
  const pasos = [{ lado, calidad }];
  for (const q of [calidad - 0.1, calidad - 0.2]) if (q >= 0.5) pasos.push({ lado, calidad: +q.toFixed(2) });
  for (const f of [0.85, 0.7, 0.55]) pasos.push({ lado: Math.round(lado * f), calidad: 0.6 });
  return pasos;
}

/** En el chat las fotos se van añadiendo poco a poco, así que cada una se
    prepara pensando en que pueden acabar siendo 6: grande (1600 px) pero
    sin pasar de su sexta parte del presupuesto. */
export const AJUSTES_CHAT = Object.freeze({ lado: LADO_MAXIMO, calidad: 0.78, maxB64: Math.floor(PRESUPUESTO_B64 / MAX_FOTOS) });

/** ¿Parece una imagen? Algunos Android mandan la foto de la cámara sin
    tipo (type vacío): entonces se mira la extensión o se intenta abrir. */
export function pareceFoto(archivo) {
  if (!archivo) return false;
  const tipo = archivo.type || '';
  if (tipo) return /^image\//.test(tipo);
  return !archivo.name || EXTENSIONES.test(archivo.name);
}

/* createImageBitmap respeta la orientación EXIF: sin eso, las fotos hechas
   en vertical llegaban tumbadas y Clara leía el ejercicio de lado. */
async function decodifica(archivo) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch { /* sigue abajo */ }
  }
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error(/hei[cf]/i.test(archivo.type || archivo.name || '')
      ? 'Este móvil no sabe abrir fotos HEIC. Hazle una captura de pantalla a la foto y manda la captura.'
      : 'No he podido abrir esa foto.');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function aJPEG(imagen, maximo, calidad) {
  const { ancho, alto } = medidas(imagen.width, imagen.height, maximo);
  if (!ancho || !alto) throw new Error('La foto está vacía.');
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const pincel = lienzo.getContext('2d');
  pincel.fillStyle = '#fff'; // los PNG con transparencia no quedan negros
  pincel.fillRect(0, 0, ancho, alto);
  pincel.drawImage(imagen, 0, 0, ancho, alto);
  const url = lienzo.toDataURL('image/jpeg', calidad);
  // Soltar el lienzo ya: en Safari los lienzos se acumulan y acaban en
  // «memoria insuficiente» al tercer o cuarto intento.
  lienzo.width = 0;
  lienzo.height = 0;
  if (!url.startsWith('data:image/jpeg')) throw new Error('Este navegador no sabe convertir la foto.');
  return url;
}

/** Devuelve `{ media_type, data, miniatura }` o lanza un error legible.
    `maxB64` es lo que puede ocupar como mucho (su parte del presupuesto). */
export async function preparaFoto(archivo, { lado = LADO_MAXIMO, calidad = 0.8, maxB64 = PRESUPUESTO_B64 } = {}) {
  if (!pareceFoto(archivo)) throw new Error('Eso no parece una foto.');
  const imagen = await decodifica(archivo);
  try {
    let data = '';
    for (const paso of escalones({ lado, calidad })) {
      data = aJPEG(imagen, paso.lado, paso.calidad).split(',')[1];
      if (data.length <= maxB64) break;
    }
    if (data.length > maxB64) throw new Error('La foto es demasiado grande incluso reducida.');
    const miniatura = aJPEG(imagen, LADO_MINIATURA, 0.7);
    return { media_type: 'image/jpeg', data, miniatura };
  } finally {
    imagen.close?.();
  }
}

/** Prepara varias fotos de una en una. Nunca lanza: devuelve las que han
    salido bien y cuántas han fallado (con el primer motivo), para que una
    foto rara no tire las otras cinco.
    `alProgreso(hechas, total)` sirve para enseñar «Preparando 3 de 6…». */
export async function preparaFotos(archivos, { cuantasEnTotal, ajustes: forzados, alProgreso } = {}) {
  const lista = Array.from(archivos || []).slice(0, MAX_FOTOS);
  const ajustes = forzados || ajustesPara(cuantasEnTotal || lista.length);
  const fotos = [];
  let fallidas = 0;
  let motivo = '';
  for (let i = 0; i < lista.length; i++) {
    alProgreso?.(i, lista.length);
    try {
      fotos.push(await preparaFoto(lista[i], ajustes));
    } catch (e) {
      fallidas += 1;
      motivo = motivo || e.message;
    }
    // Un respiro al hilo principal entre foto y foto: la pantalla no se congela.
    await new Promise((r) => setTimeout(r, 0));
  }
  alProgreso?.(lista.length, lista.length);
  return { fotos, fallidas, motivo };
}
