/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — fotos para Clara
   La foto del móvil pesa 3-5 MB y Vercel corta las peticiones de más de
   4,5 MB. Aquí se reduce en el propio teléfono a 1600 px y JPEG 80 %
   (unos 200-500 KB), que Clara lee perfectamente, y se saca además una
   miniatura para enseñarla en el chat. La foto original no sale del móvil.
   ═══════════════════════════════════════════════════════════════════ */

export const LADO_MAXIMO = 1600;
const LADO_MINIATURA = 240;

/** Medidas finales conservando la proporción. Pura: se prueba en Node. */
export function medidas(ancho, alto, maximo = LADO_MAXIMO) {
  const mayor = Math.max(ancho, alto);
  if (!mayor) return { ancho: 0, alto: 0 };
  const factor = Math.min(1, maximo / mayor);
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) };
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
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function aLienzo(imagen, maximo) {
  const { ancho, alto } = medidas(imagen.width, imagen.height, maximo);
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const pincel = lienzo.getContext('2d');
  pincel.fillStyle = '#fff'; // los PNG con transparencia no quedan negros
  pincel.fillRect(0, 0, ancho, alto);
  pincel.drawImage(imagen, 0, 0, ancho, alto);
  return lienzo;
}

/** Devuelve `{ media_type, data, miniatura }` o lanza un error legible. */
export async function preparaFoto(archivo) {
  if (!archivo || !/^image\//.test(archivo.type || '')) {
    throw new Error('Eso no parece una foto.');
  }
  const imagen = await decodifica(archivo);
  const grande = aLienzo(imagen, LADO_MAXIMO).toDataURL('image/jpeg', 0.8);
  const pequena = aLienzo(imagen, LADO_MINIATURA).toDataURL('image/jpeg', 0.7);
  imagen.close?.();
  return { media_type: 'image/jpeg', data: grande.split(',')[1], miniatura: pequena };
}
