/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — comprobar que un JPEG es un JPEG de verdad
   Lo usan las firmas (hoja.js, en el móvil y en el Worker) y el logo
   (src/index.js). Hace lo mismo que leeJpeg de cerebro/pdf.js (que no se
   exporta y no se toca, porque Cerebro tiene que seguir dando los mismos
   PDF) y algo más estricto:
     · empieza por SOI (FF D8);
     · recorre los segmentos uno a uno sin salirse del archivo;
     · tiene un marcador SOF con medidas razonables y 1, 3 o 4 canales
       (los únicos que sabe incrustar cerebro/pdf.js);
     · tiene datos de imagen (SOS) y termina en EOI (FF D9).
   Lo que NO puede saber: si la firma está en blanco. Un JPEG blanco bien
   formado es un JPEG válido; eso lo vigila el móvil antes de firmar
   (creaFirma().suficiente() exige un trazo de cierta longitud), pero
   quien manipule la app puede mandar un recuadro en blanco y el servidor
   no tiene forma fiable de distinguirlo de una firma muy clara.
   Módulo puro (atob existe en Workers, navegador y Node).
   ═══════════════════════════════════════════════════════════════════ */

/** Bytes de un dataURL base64 de JPEG, o null si no lo es. */
export function bytesJpegDeDataUrl(dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(dataUrl ?? ''));
  if (!m) return null;
  try {
    const bin = atob(m[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * Analiza la estructura del JPEG. Devuelve { ok: true, ancho, alto, canales }
 * o { ok: false, motivo } (motivo en castellano llano).
 * maxLado: lado máximo admitido en píxeles.
 */
export function analizaJpeg(bytes, { maxLado = 4000 } = {}) {
  const b = bytes instanceof Uint8Array ? bytes : null;
  if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return { ok: false, motivo: 'no empieza como un JPEG' };
  if (b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) return { ok: false, motivo: 'está cortado (no termina como un JPEG)' };
  let i = 2;
  let sof = null;
  while (i < b.length) {
    if (b[i] !== 0xff) return { ok: false, motivo: 'tiene la estructura rota' };
    let marca = b[i + 1];
    while (marca === 0xff && i + 2 < b.length) { i++; marca = b[i + 1]; } // relleno entre segmentos
    if (marca === undefined) return { ok: false, motivo: 'está cortado' };
    if (marca === 0xd9) return { ok: false, motivo: 'no tiene imagen' }; // EOI antes de SOS
    if (marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
    if (i + 4 > b.length) return { ok: false, motivo: 'está cortado' };
    const largo = (b[i + 2] << 8) | b[i + 3];
    if (largo < 2 || i + 2 + largo > b.length) return { ok: false, motivo: 'tiene un segmento que se sale del archivo' };
    const esSof = marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;
    if (esSof) {
      if (largo < 8) return { ok: false, motivo: 'tiene la cabecera de medidas rota' };
      sof = { alto: (b[i + 5] << 8) | b[i + 6], ancho: (b[i + 7] << 8) | b[i + 8], canales: b[i + 9] };
    }
    if (marca === 0xda) {
      // Empiezan los datos de la imagen: tiene que haber habido SOF antes.
      if (!sof) return { ok: false, motivo: 'no dice sus medidas' };
      const datos = b.length - 2 - (i + 2 + largo);
      if (datos < 1) return { ok: false, motivo: 'no tiene imagen' };
      break;
    }
    i += 2 + largo;
  }
  if (!sof) return { ok: false, motivo: 'no tiene imagen' };
  if (!(sof.ancho >= 1 && sof.alto >= 1 && sof.ancho <= maxLado && sof.alto <= maxLado)) return { ok: false, motivo: 'tiene unas medidas que no son razonables' };
  if (![1, 3, 4].includes(sof.canales)) return { ok: false, motivo: 'tiene un formato de color no admitido' };
  return { ok: true, ancho: sof.ancho, alto: sof.alto, canales: sof.canales };
}

/** Atajo para un dataURL: { ok, ancho, alto, canales, bytes } o { ok: false, motivo }. */
export function analizaJpegDataUrl(dataUrl, opciones) {
  const bytes = bytesJpegDeDataUrl(dataUrl);
  if (!bytes) return { ok: false, motivo: 'no es una imagen JPEG' };
  const r = analizaJpeg(bytes, opciones);
  return r.ok ? { ...r, bytes } : r;
}
