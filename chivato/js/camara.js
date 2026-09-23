/* Captura y compresión de la foto en el propio móvil: la imagen se reduce a
   1.280 px y calidad 0,72 antes de salir del dispositivo, para que la subida
   sea rápida y la llamada a la IA barata.                                  */

const LADO_MAX = 1280;
const CALIDAD = 0.72;
const LADO_MINIATURA = 200;

/** Lee un File y devuelve un <img> ya cargado. */
function comoImagen(archivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se ha podido leer la imagen.')); };
    img.src = url;
  });
}

function dibujar(img, lado) {
  const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.naturalWidth * escala);
  lienzo.height = Math.round(img.naturalHeight * escala);
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo;
}

/**
 * Comprime la foto elegida.
 * @returns {Promise<{dataURL:string, base64:string, mime:string, miniatura:string, ancho:number, alto:number}>}
 */
export async function prepararFoto(archivo) {
  if (!archivo || !archivo.type.startsWith('image/')) {
    throw new Error('Eso no parece una imagen. Elige una foto del cuadro de mandos.');
  }
  const img = await comoImagen(archivo);
  const lienzo = dibujar(img, LADO_MAX);
  const dataURL = lienzo.toDataURL('image/jpeg', CALIDAD);
  const miniatura = dibujar(img, LADO_MINIATURA).toDataURL('image/jpeg', 0.55);

  return {
    dataURL,
    base64: dataURL.slice(dataURL.indexOf(',') + 1),
    mime: 'image/jpeg',
    miniatura,
    ancho: lienzo.width,
    alto: lienzo.height,
  };
}
