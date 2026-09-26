/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — los PDF: hoja de visita e informe de valoración
   Se dibujan con pdf.js (generador propio, sin librerías) para que
   funcionen sin conexión. Colores de la marca Castresana.
   Funciones puras: entran datos, sale un Uint8Array con el PDF.
   ═══════════════════════════════════════════════════════════════════ */

import { A4, nuevoPdf, partirTexto } from './pdf.js';
import { euros, fechaCorta, fechaLarga, numero } from './utiles.js';
import { bytesDeDataUrl, declaracionDe } from './visitas.js';
import { AVISO_VALORACION, FUENTES_COMPARABLE, METODOLOGIA, eurosM2 } from './valoracion.js';

const MARINO = [16, 32, 58];
const DORADO = [201, 162, 39];
const GRIS = [90, 90, 90];
const GRIS_CLARO = [225, 222, 214];
const CREMA = [247, 245, 240];
const M = 48; // margen
const ANCHO = A4.ancho - 2 * M;

function cabecera(doc, ajustes, titulo, subtitulo) {
  doc.rect(0, 0, A4.ancho, 92, { relleno: MARINO });
  doc.rect(0, 92, A4.ancho, 4, { relleno: DORADO });
  doc.texto(M, 40, ajustes.empresa || 'Asesoría Castresana', { tam: 15, negrita: true, color: [255, 255, 255] });
  doc.texto(M, 60, [ajustes.ciudad, ajustes.telefono && `Tel. ${ajustes.telefono}`, ajustes.web].filter(Boolean).join('  ·  '), { tam: 9, color: [215, 220, 230] });
  doc.texto(A4.ancho - M, 40, titulo, { tam: 13, negrita: true, color: DORADO, alinear: 'derecha' });
  if (subtitulo) doc.texto(A4.ancho - M, 60, subtitulo, { tam: 9, color: [215, 220, 230], alinear: 'derecha' });
}

function pie(doc, texto, borrador) {
  const y = A4.alto - 36;
  doc.linea(M, y - 14, A4.ancho - M, y - 14, { grosor: 0.5, color: GRIS_CLARO });
  doc.texto(M, y, texto, { tam: 7.5, color: GRIS });
  if (borrador) doc.texto(M, y - 22, 'BORRADOR — textos legales pendientes de revisar con gestor o abogado', { tam: 7.5, negrita: true, color: [180, 60, 40] });
}

function titulo(doc, y, texto) {
  doc.texto(M, y, texto.toUpperCase(), { tam: 9, negrita: true, color: DORADO });
  doc.linea(M, y + 5, A4.ancho - M, y + 5, { grosor: 0.6, color: GRIS_CLARO });
  return y + 22;
}

/** Filas etiqueta: valor en dos columnas. Devuelve la y siguiente. */
function filas(doc, y, pares, colEtiqueta = 120) {
  for (const [etq, val] of pares) {
    if (!val) continue;
    doc.texto(M, y, etq, { tam: 9.5, color: GRIS });
    y = doc.parrafo(M + colEtiqueta, y, ANCHO - colEtiqueta, String(val), { tam: 10.5, negrita: true });
    y += 4;
  }
  return y;
}

function casilla(doc, y, marcada) {
  doc.rect(M, y - 9, 11, 11, { borde: MARINO, grosor: 1 });
  if (marcada) {
    doc.linea(M + 2, y - 3, M + 5, y, { grosor: 1.4, color: MARINO });
    doc.linea(M + 5, y, M + 10, y - 8, { grosor: 1.4, color: MARINO });
  }
}

/* ─────────────────────────── Hoja de visita ─────────────────────────── */

export function pdfHojaVisita(visita, ajustes, ahora = new Date()) {
  const doc = nuevoPdf({ titulo: `Hoja de visita · ${visita.inmueble}`, autor: ajustes.agente });
  doc.pagina();
  const borrador = !ajustes.textosRevisados;
  cabecera(doc, ajustes, 'HOJA DE VISITA', `Registro ${String(visita.id || '').slice(-8).toUpperCase()}`);

  let y = 130;
  y = titulo(doc, y, 'Datos de la visita');
  y = filas(doc, y, [
    ['Fecha', `${fechaLarga(visita.fecha)}`],
    ['Hora', visita.hora],
    ['Inmueble', visita.inmueble],
    ['Agente', ajustes.agente],
  ]);
  y += 6;
  y = titulo(doc, y, 'Visitante');
  y = filas(doc, y, [
    ['Nombre', visita.visitante.nombre],
    ['DNI / NIE', visita.visitante.dni],
    ['Teléfono', visita.visitante.telefono],
    ['Correo', visita.visitante.email],
    ['Acompañantes', visita.acompanantes],
  ]);
  if (visita.observaciones) {
    y += 6;
    y = titulo(doc, y, 'Observaciones');
    y = doc.parrafo(M, y, ANCHO, visita.observaciones, { tam: 10 });
  }

  y += 10;
  y = titulo(doc, y, 'Declaración');
  y = doc.parrafo(M, y, ANCHO, declaracionDe(visita, ajustes), { tam: 10.5 });

  if (ajustes.textoRgpd) {
    y += 8;
    y = titulo(doc, y, 'Protección de datos');
    y = doc.parrafo(M, y, ANCHO, ajustes.textoRgpd, { tam: 8, color: GRIS, interlineado: 1.3 });
  }
  y += 6;
  casilla(doc, y, visita.aceptaRgpd);
  doc.texto(M + 18, y, 'El visitante declara haber leído la información sobre protección de datos.', { tam: 9 });
  y += 18;
  casilla(doc, y, visita.aceptaOfertas);
  doc.texto(M + 18, y, visita.aceptaOfertas ? 'Acepta recibir información de otros inmuebles.' : 'No desea recibir información de otros inmuebles.', { tam: 9 });
  y += 22;

  // Firma: si no cabe en la página, pasa a una segunda.
  const altoFirma = 110;
  if (y + altoFirma + 60 > A4.alto) {
    pie(doc, `Hoja de visita · ${visita.inmueble}`, borrador);
    doc.pagina();
    y = 60;
  }
  y = titulo(doc, y, 'Firma del visitante');
  doc.rect(M, y - 4, 260, altoFirma, { relleno: CREMA, borde: GRIS_CLARO });
  const ratio = (visita.firmaAncho || 600) / (visita.firmaAlto || 200);
  const w = Math.min(248, (altoFirma - 12) * ratio);
  const h = w / ratio;
  doc.imagenJpeg(bytesDeDataUrl(visita.firma), visita.firmaAncho || 600, visita.firmaAlto || 200, M + 6, y + 2, w, h);
  doc.texto(M, y + altoFirma + 10, visita.visitante.nombre, { tam: 9, negrita: true });
  doc.texto(M + 280, y + 20, 'Firmado en el dispositivo del agente', { tam: 8.5, color: GRIS });
  doc.texto(M + 280, y + 34, `el ${fechaCorta(visita.fecha)} a las ${visita.hora}.`, { tam: 8.5, color: GRIS });
  doc.texto(M + 280, y + 56, `Registrada: ${new Date(visita.registrada || ahora).toLocaleString('es-ES')}`, { tam: 8.5, color: GRIS });

  pie(doc, `Documento generado con Cerebro Útil Pau · ${ajustes.empresa}`, borrador);
  return doc.bytes();
}

/* ─────────────────────── Informe de valoración ─────────────────────── */

export function pdfValoracion(val, calculo, ajustes, hoy) {
  const doc = nuevoPdf({ titulo: `Informe de valoración · ${val.inmueble?.direccion || ''}`, autor: ajustes.agente });
  doc.pagina();
  cabecera(doc, ajustes, 'INFORME DE VALORACIÓN', `Orientativo · ${fechaCorta(hoy)}`);
  const s = val.inmueble || {};

  let y = 135;
  doc.texto(M, y, s.direccion || 'Inmueble', { tam: 18, negrita: true, color: MARINO });
  y += 18;
  if (val.propietario) { doc.texto(M, y, `Preparado para: ${val.propietario}`, { tam: 10, color: GRIS }); y += 16; }
  y += 8;
  y = titulo(doc, y, 'El inmueble');
  y = filas(doc, y, [
    ['Zona', s.zona],
    ['Superficie', calculo.m2Sujeto > 0 ? `${numero(calculo.m2Sujeto)} m²` : ''],
    ['Habitaciones', s.habitaciones],
    ['Baños', s.banos],
    ['Planta', s.planta],
    ['Estado', s.estado],
    ['Extras', s.extras],
  ]);

  y += 8;
  y = titulo(doc, y, 'Resultado');
  if (calculo.suficiente && calculo.valor) {
    doc.rect(M, y - 6, ANCHO, 84, { relleno: CREMA, borde: DORADO, grosor: 1 });
    doc.texto(M + ANCHO / 2, y + 16, 'Rango de precio orientativo', { tam: 10, color: GRIS, alinear: 'centro' });
    doc.texto(M + ANCHO / 2, y + 44, `${euros(calculo.valor.bajo)}  —  ${euros(calculo.valor.alto)}`, { tam: 22, negrita: true, color: MARINO, alinear: 'centro' });
    doc.texto(M + ANCHO / 2, y + 66, `Valor central: ${euros(calculo.valor.central)}  ·  ${euros(calculo.porM2.mediana)}/m² (mediana de ${calculo.n} comparables)`, { tam: 9.5, color: GRIS, alinear: 'centro' });
    y += 96;
    if (calculo.dispersionAlta) {
      y = doc.parrafo(M, y, ANCHO, 'Atención: los comparables son poco homogéneos (el más caro por m² dobla al más barato). El rango debe tomarse con prudencia.', { tam: 9, color: [180, 60, 40] });
      y += 4;
    }
  } else {
    y = doc.parrafo(M, y, ANCHO, `No hay datos suficientes para dar un rango: hacen falta al menos 3 comparables válidos y la superficie del inmueble (faltan ${calculo.faltan}).`, { tam: 10.5, negrita: true, color: [180, 60, 40] });
    y += 6;
  }
  if (val.comentario) {
    y += 4;
    y = titulo(doc, y, 'Comentario del agente');
    y = doc.parrafo(M, y, ANCHO, val.comentario, { tam: 10 });
  }

  // Página 2: comparables, gráfico, método y aviso.
  pie(doc, `${ajustes.empresa} · ${ajustes.agente}`, false);
  doc.pagina();
  y = 60;
  y = titulo(doc, y, `Comparables utilizados (${calculo.n})`);
  const cols = [
    { t: 'Dirección / referencia', x: M, w: 170 },
    { t: 'Fuente', x: M + 175, w: 95 },
    { t: 'Precio', x: M + 270, w: 64, der: true },
    { t: 'm²', x: M + 335, w: 40, der: true },
    { t: 'Ajuste', x: M + 380, w: 40, der: true },
    { t: '€/m²', x: M + 425, w: ANCHO - 425, der: true },
  ];
  doc.rect(M, y - 12, ANCHO, 18, { relleno: MARINO });
  for (const c of cols) doc.texto(c.der ? c.x + c.w - 4 : c.x + 4, y, c.t, { tam: 8.5, negrita: true, color: [255, 255, 255], alinear: c.der ? 'derecha' : 'izquierda' });
  y += 18;
  calculo.validos.forEach((c, i) => {
    if (y > A4.alto - 120) { pie(doc, ajustes.empresa, false); doc.pagina(); y = 60; }
    if (i % 2 === 0) doc.rect(M, y - 12, ANCHO, 18, { relleno: CREMA });
    const fuente = FUENTES_COMPARABLE.find((f) => f.id === c.fuente)?.corto || '';
    const dir = partirTexto(c.direccion, cols[0].w - 6, 8.5)[0] || '';
    doc.texto(cols[0].x + 4, y, dir, { tam: 8.5 });
    doc.texto(cols[1].x + 4, y, fuente, { tam: 8.5 });
    doc.texto(cols[2].x + cols[2].w - 4, y, euros(c.precio), { tam: 8.5, alinear: 'derecha' });
    doc.texto(cols[3].x + cols[3].w - 4, y, numero(c.m2), { tam: 8.5, alinear: 'derecha' });
    doc.texto(cols[4].x + cols[4].w - 4, y, c.ajuste ? `${c.ajuste > 0 ? '+' : ''}${numero(c.ajuste)} %` : '—', { tam: 8.5, alinear: 'derecha' });
    doc.texto(cols[5].x + cols[5].w - 4, y, euros(eurosM2(c)), { tam: 8.5, negrita: true, alinear: 'derecha' });
    y += 18;
  });

  if (calculo.n) {
    y += 14;
    y = titulo(doc, y, 'Precio por m² de cada comparable');
    const max = calculo.porM2.max;
    calculo.validos.forEach((c) => {
      if (y > A4.alto - 110) { pie(doc, ajustes.empresa, false); doc.pagina(); y = 60; }
      const v = eurosM2(c);
      const largo = Math.max(4, ((ANCHO - 170) * v) / max);
      doc.texto(M, y, partirTexto(c.direccion, 110, 8)[0] || '', { tam: 8, color: GRIS });
      doc.rect(M + 115, y - 9, largo, 11, { relleno: DORADO });
      doc.texto(M + 120 + largo, y, euros(v), { tam: 8 });
      y += 16;
    });
  }

  y += 14;
  if (y > A4.alto - 200) { pie(doc, ajustes.empresa, false); doc.pagina(); y = 60; }
  y = titulo(doc, y, 'Cómo se ha calculado');
  y = doc.parrafo(M, y, ANCHO, METODOLOGIA, { tam: 9, color: GRIS });
  y += 10;
  y = titulo(doc, y, 'Aviso importante');
  y = doc.parrafo(M, y, ANCHO, AVISO_VALORACION, { tam: 9, color: GRIS });
  y += 16;
  doc.texto(M, y, `${ajustes.agente} · ${ajustes.empresa}`, { tam: 10, negrita: true, color: MARINO });
  y += 14;
  doc.texto(M, y, [ajustes.telefono && `Tel. ${ajustes.telefono}`, ajustes.whatsapp && `WhatsApp ${ajustes.whatsapp}`, ajustes.email, ajustes.web].filter(Boolean).join('  ·  '), { tam: 9, color: GRIS });
  pie(doc, `Informe generado con Cerebro Útil Pau el ${fechaLarga(hoy)}`, false);
  return doc.bytes();
}
