/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — los PDF: hoja de visita, hoja de captación e
   informe de valoración
   Se dibujan con pdf.js (generador propio, sin librerías) para que
   funcionen sin conexión. Cabecera con el logo de Asesoría Castresana
   (si se pasa en `opciones.logo`) y bloque de firmas encabezado por
   «ASESORIA CASTRESANA INMO».
   Funciones puras: entran datos, sale un Uint8Array con el PDF.
   ═══════════════════════════════════════════════════════════════════ */

import { A4, anchoTexto, nuevoPdf, partirTexto } from './pdf.js';
import { euros, fechaCorta, fechaLarga, numero, rellena } from './utiles.js';
import { bytesDeDataUrl, declaracionDe, esFirmaJpeg } from './visitas.js';
import { AVISO_VALORACION, COMPARABLES_RECOMENDADOS, FUENTES_COMPARABLE, eurosM2, textoMetodologia } from './valoracion.js';
import { CAMPOS_PISO, CAMPOS_INMUEBLE, GRUPOS_PISO, nombrePiso, paresFicha, referenciaZona } from './campos-piso.js';

const MARINO = [16, 32, 58];
const DORADO = [201, 162, 39];
const GRIS = [90, 90, 90];
const GRIS_CLARO = [225, 222, 214];
const CREMA = [247, 245, 240];
const ROJO = [180, 60, 40];
const M = 48; // margen
const ANCHO = A4.ancho - 2 * M;
const LIMITE = A4.alto - 80; // por encima del aviso de BORRADOR y del pie
export const ENCABEZADO_FIRMAS = 'ASESORIA CASTRESANA INMO';

/* Cabecera blanca con el logo a la izquierda, título a la derecha y
   filete dorado. Sin logo, el nombre de la empresa en azul marino. */
function cabecera(doc, ajustes, titulo, subtitulo, logo) {
  if (logo?.bytes) {
    const alto = 54;
    const ancho = (alto * (logo.ancho || 500)) / (logo.alto || 201);
    doc.imagenJpeg(logo.bytes, logo.ancho || 500, logo.alto || 201, M - 4, 20, ancho, alto);
  } else {
    const hueco = ANCHO - anchoTexto(titulo, 13, true) - 16;
    doc.texto(M, 50, partirTexto(ajustes.empresa || 'Asesoría Castresana', hueco, 15, true)[0] || '', { tam: 15, negrita: true, color: MARINO });
  }
  const derecha = ANCHO - 170; // lo que deja libre el logo
  doc.texto(A4.ancho - M, 44, titulo, { tam: 13, negrita: true, color: MARINO, alinear: 'derecha' });
  if (subtitulo) doc.texto(A4.ancho - M, 60, partirTexto(subtitulo, derecha, 9)[0] || '', { tam: 9, color: GRIS, alinear: 'derecha' });
  doc.texto(A4.ancho - M, 76, partirTexto([ajustes.ciudad, ajustes.telefono && `Tel. ${ajustes.telefono}`, ajustes.web].filter(Boolean).join('  ·  '), derecha, 8)[0] || '', { tam: 8, color: GRIS, alinear: 'derecha' });
  doc.rect(M, 90, ANCHO, 2.5, { relleno: DORADO });
}

function pie(doc, texto, borrador) {
  const y = A4.alto - 36;
  doc.linea(M, y - 14, A4.ancho - M, y - 14, { grosor: 0.5, color: GRIS_CLARO });
  doc.texto(M, y, partirTexto(texto, ANCHO, 7.5)[0] || '', { tam: 7.5, color: GRIS });
  if (borrador) doc.texto(M, y - 22, 'BORRADOR — textos legales pendientes de revisar con gestor o abogado', { tam: 7.5, negrita: true, color: ROJO });
}

/**
 * Escritor con paso de página automático: todo lo que escribe respeta
 * LIMITE, y al cambiar de página pone el pie en la que deja.
 */
function escritor(doc, { textoPie, borrador, yInicial = 118 }) {
  const e = {
    y: yInicial,
    cabe(alto) {
      if (e.y + alto > LIMITE) { pie(doc, textoPie, borrador); doc.pagina(); e.y = 60; }
    },
    seccion(texto) {
      e.cabe(44);
      doc.texto(M, e.y, texto.toUpperCase(), { tam: 9, negrita: true, color: DORADO });
      doc.linea(M, e.y + 5, A4.ancho - M, e.y + 5, { grosor: 0.6, color: GRIS_CLARO });
      e.y += 22;
    },
    parrafo(texto, opts = {}) {
      const o = { tam: 10, ...opts };
      const salto = o.tam * (o.interlineado || 1.35);
      for (const linea of partirTexto(texto, ANCHO, o.tam, o.negrita)) {
        e.cabe(salto);
        if (linea) doc.texto(M, e.y, linea, o);
        e.y += salto;
      }
    },
    /** Etiqueta a la izquierda y valor (que puede ocupar varias líneas) a la derecha. */
    filas(pares, colEtiqueta = 120) {
      for (const [etq, val] of pares) {
        if (val === undefined || val === null || val === '') continue;
        const lineas = partirTexto(String(val), ANCHO - colEtiqueta, 10.5, true);
        const etqs = partirTexto(String(etq), colEtiqueta - 8, 9.5);
        const n = Math.max(lineas.length, etqs.length);
        e.cabe(n * 14.2 + 4);
        etqs.forEach((l, j) => doc.texto(M, e.y + j * 14.2, l, { tam: 9.5, color: GRIS }));
        lineas.forEach((l, j) => doc.texto(M + colEtiqueta, e.y + j * 14.2, l, { tam: 10.5, negrita: true }));
        e.y += n * 14.2 + 4;
      }
    },
    /** Rejilla de dos columnas para las fichas largas (datos del piso). */
    rejilla(pares) {
      // Etiqueta y valor pueden ocupar varias líneas: nada se recorta.
      const col = ANCHO / 2;
      const salto = 12;
      for (let i = 0; i < pares.length; i += 2) {
        const celdas = [pares[i], pares[i + 1]].map((par) => par && {
          e: partirTexto(String(par[0]), 98, 8.5),
          v: partirTexto(String(par[1]), col - 112, 9.5, true),
        });
        const n = Math.max(...celdas.filter(Boolean).map((c) => Math.max(c.e.length, c.v.length)));
        e.cabe(n * salto + 5);
        celdas.forEach((c, k) => {
          if (!c) return;
          const x = M + k * col;
          c.e.forEach((l, j) => doc.texto(x, e.y + j * salto, l, { tam: 8.5, color: GRIS }));
          c.v.forEach((l, j) => doc.texto(x + 104, e.y + j * salto, l, { tam: 9.5, negrita: true }));
        });
        e.y += n * salto + 5;
      }
    },
    casilla(texto, marcada) {
      e.cabe(20);
      doc.rect(M, e.y - 9, 11, 11, { borde: MARINO, grosor: 1 });
      if (marcada) {
        doc.linea(M + 2, e.y - 3, M + 5, e.y, { grosor: 1.4, color: MARINO });
        doc.linea(M + 5, e.y, M + 10, e.y - 8, { grosor: 1.4, color: MARINO });
      }
      doc.texto(M + 18, e.y, texto, { tam: 9 });
      e.y += 18;
    },
    /**
     * Bloque de firmas con el encabezado «ASESORIA CASTRESANA INMO».
     * firmas: [{ etiqueta, nombre, firma (dataURL JPEG o ''), ancho, alto }]
     * Si no cabe entero, pasa a la página siguiente.
     */
    firmas(firmas, encabezado = ENCABEZADO_FIRMAS, nota = '') {
      const alto = 104;
      e.cabe(30 + alto + 34 + (nota ? 16 : 0));
      doc.texto(M + ANCHO / 2, e.y, partirTexto(String(encabezado).slice(0, 60), ANCHO, 12, true)[0] || '', { tam: 12, negrita: true, color: MARINO, alinear: 'centro' });
      doc.linea(M + ANCHO / 2 - 110, e.y + 6, M + ANCHO / 2 + 110, e.y + 6, { grosor: 1.2, color: DORADO });
      e.y += 26;
      const hueco = 16;
      const ancho = (ANCHO - hueco * (firmas.length - 1)) / firmas.length;
      firmas.forEach((f, i) => {
        const x = M + i * (ancho + hueco);
        doc.texto(x, e.y, f.etiqueta, { tam: 8.5, negrita: true, color: GRIS });
        doc.rect(x, e.y + 6, ancho, alto, { relleno: CREMA, borde: GRIS_CLARO });
        if (esFirmaJpeg(f.firma)) {
          const ratio = (f.ancho || 600) / (f.alto || 200);
          const w = Math.min(ancho - 12, (alto - 12) * ratio);
          doc.imagenJpeg(bytesDeDataUrl(f.firma), f.ancho || 600, f.alto || 200, x + (ancho - w) / 2, e.y + 12, w, w / ratio);
        }
        doc.texto(x, e.y + alto + 20, partirTexto(f.nombre || '', ancho, 9, true)[0] || '', { tam: 9, negrita: true });
      });
      e.y += alto + 34;
      if (nota) { for (const l of partirTexto(nota, ANCHO, 8)) { doc.texto(M, e.y, l, { tam: 8, color: GRIS }); e.y += 11; } e.y += 5; }
    },
  };
  return e;
}

/** Firma del agente guardada en Ajustes (una vez), para no firmar cada documento. */
function firmaAgente(ajustes) {
  return { etiqueta: 'Firma del agente', nombre: ajustes.agente, firma: ajustes.firmaAgente || '', ancho: ajustes.firmaAgenteAncho, alto: ajustes.firmaAgenteAlto };
}

/* ─────────────────────────── Hoja de visita ─────────────────────────── */

export function pdfHojaVisita(visita, ajustes, opciones = {}) {
  const { logo, ahora = new Date() } = opciones instanceof Date ? { ahora: opciones } : opciones;
  const doc = nuevoPdf({ titulo: `Hoja de visita · ${visita.inmueble}`, autor: ajustes.agente });
  doc.pagina();
  const borrador = !ajustes.textosRevisados;
  cabecera(doc, ajustes, 'HOJA DE VISITA', `Registro ${String(visita.id || '').slice(-8).toUpperCase()}`, logo);
  const e = escritor(doc, { textoPie: `Hoja de visita · ${visita.inmueble} · ${ajustes.empresa}`, borrador });

  e.seccion('Datos de la visita');
  e.filas([
    ['Fecha', fechaLarga(visita.fecha)],
    ['Hora', visita.hora],
    ['Inmueble', visita.inmueble],
    ['Agente', ajustes.agente],
  ]);
  e.y += 6;
  e.seccion('Visitante');
  e.filas([
    ['Nombre', visita.visitante.nombre],
    ['DNI / NIE', visita.visitante.dni],
    ['Teléfono', visita.visitante.telefono],
    ['Correo', visita.visitante.email],
    ['Acompañantes', visita.acompanantes],
  ]);
  const datosPiso = paresFicha(visita.piso || {}, CAMPOS_INMUEBLE);
  if (datosPiso.length) {
    e.y += 6;
    e.seccion('Datos del inmueble');
    e.rejilla(datosPiso);
  }
  if (visita.observaciones) {
    e.y += 6;
    e.seccion('Observaciones');
    e.parrafo(visita.observaciones, { tam: 10 });
  }
  e.y += 10;
  e.seccion('Declaración');
  e.parrafo(declaracionDe(visita, ajustes), { tam: 10.5 });
  if (ajustes.textoRgpd) {
    e.y += 8;
    e.seccion('Protección de datos');
    e.parrafo(ajustes.textoRgpd, { tam: 8, color: GRIS, interlineado: 1.3 });
  }
  e.y += 6;
  e.casilla('El visitante declara haber leído la información sobre protección de datos.', visita.aceptaRgpd);
  e.casilla(visita.aceptaOfertas ? 'Acepta recibir información de otros inmuebles.' : 'No desea recibir información de otros inmuebles.', visita.aceptaOfertas);
  e.y += 10;
  const firmas = [{ etiqueta: 'Firma del visitante', nombre: visita.visitante.nombre, firma: visita.firma, ancho: visita.firmaAncho, alto: visita.firmaAlto }];
  if (ajustes.firmaAgente) firmas.push(firmaAgente(ajustes));
  e.firmas(firmas, ajustes.encabezadoFirmas || ENCABEZADO_FIRMAS,
    `Firmado en el dispositivo del agente el ${fechaCorta(visita.fecha)} a las ${visita.hora}. Registrada: ${new Date(visita.registrada || ahora).toLocaleString('es-ES')}.`);

  pie(doc, `Documento generado con Cerebro Útil Pau · ${ajustes.empresa}`, borrador);
  return doc.bytes();
}

/* ────────────────────────── Hoja de captación ────────────────────────── */

export function textoConformidad(piso, ajustes, hoy) {
  return rellena(ajustes.textoCaptacion, {
    propietario: piso.propNombre, dni: piso.propDni || 'no indicado', inmueble: nombrePiso(piso),
    empresa: ajustes.empresa, agente: ajustes.agente, tipoEncargo: piso.tipoEncargo,
    honorarios: piso.honorarios, duracion: piso.duracion, fecha: fechaLarga(piso.fechaCaptacion || hoy),
  });
}

export function pdfCaptacion(piso, ajustes, opciones = {}) {
  const { logo, hoy } = opciones;
  const doc = nuevoPdf({ titulo: `Hoja de captación · ${nombrePiso(piso)}`, autor: ajustes.agente });
  doc.pagina();
  const borrador = !ajustes.textosCaptacionRevisados;
  cabecera(doc, ajustes, 'HOJA DE CAPTACIÓN', piso.referencia ? `Ref. ${piso.referencia}` : fechaCorta(piso.fechaCaptacion || hoy), logo);
  const e = escritor(doc, { textoPie: `Hoja de captación · ${nombrePiso(piso)} · ${ajustes.empresa}`, borrador });

  e.parrafo(nombrePiso(piso), { tam: 15, negrita: true, color: MARINO, interlineado: 1.2 });
  e.y += 6;
  for (const g of GRUPOS_PISO) {
    const pares = paresFicha(piso, CAMPOS_PISO.filter((c) => c.grupo === g.id));
    if (!pares.length) continue;
    e.seccion(g.titulo);
    if (g.id === 'propietario' || g.id === 'encargo') e.filas(pares, 150);
    else e.rejilla(pares);
    e.y += 4;
  }
  if (piso.notas) {
    e.seccion('Observaciones');
    e.parrafo(piso.notas, { tam: 10 });
    e.y += 4;
  }
  if (ajustes.textoCaptacion) {
    e.seccion('Conformidad del propietario');
    e.parrafo(textoConformidad(piso, ajustes, hoy), { tam: 10 });
    e.y += 4;
  }
  if (piso.lugarFirma === 'Fuera de la oficina' && ajustes.textoDesistimiento) {
    e.seccion('Derecho de desistimiento');
    e.parrafo(rellena(ajustes.textoDesistimiento, { empresa: ajustes.empresa }), { tam: 9 });
    e.casilla('El propietario pide que se empiece a comercializar el inmueble dentro de esos 14 días.', piso.comercializarYa === 'Sí');
    e.y += 4;
  }
  if (ajustes.textoRgpdCaptacion) {
    e.seccion('Protección de datos');
    e.parrafo(ajustes.textoRgpdCaptacion, { tam: 8, color: GRIS, interlineado: 1.3 });
    e.casilla('Acepta recibir información sobre otros servicios de la agencia.', piso.propAceptaOfertas === 'Sí');
  }
  e.y += 10;
  e.firmas([
    { etiqueta: 'Firma del propietario', nombre: piso.propNombre, firma: piso.firmaPropietario, ancho: piso.firmaPropietarioAncho, alto: piso.firmaPropietarioAlto },
    firmaAgente(ajustes),
  ], ajustes.encabezadoFirmas || ENCABEZADO_FIRMAS, `En ${ajustes.ciudad || 'Oviedo'}, a ${fechaLarga(piso.fechaCaptacion || hoy)}.`);

  pie(doc, `Documento generado con Cerebro Útil Pau · ${ajustes.empresa}`, borrador);
  return doc.bytes();
}

/* ─────────────────────── Informe de valoración ─────────────────────── */

export function pdfValoracion(val, calculo, ajustes, hoy, opciones = {}) {
  const { logo } = opciones;
  const doc = nuevoPdf({ titulo: `Informe de valoración · ${val.inmueble?.direccion || ''}`, autor: ajustes.agente });
  doc.pagina();
  cabecera(doc, ajustes, 'INFORME DE VALORACIÓN', `Orientativo · ${fechaCorta(hoy)}`, logo);
  const s = val.inmueble || {};
  const e = escritor(doc, { textoPie: `${ajustes.empresa} · ${ajustes.agente}`, borrador: false, yInicial: 126 });

  e.parrafo(s.direccion || 'Inmueble', { tam: 18, negrita: true, color: MARINO, interlineado: 1.15 });
  if (val.propietario) { e.parrafo(`Preparado para: ${val.propietario}`, { tam: 10, color: GRIS }); e.y += 2; }
  e.y += 8;
  e.seccion('El inmueble');
  e.filas([
    ['Municipio', s.municipio],
    ['Zona', s.zona],
    ['Superficie', calculo.m2Sujeto > 0 ? `${numero(calculo.m2Sujeto)} m²` : ''],
    ['Habitaciones', s.habitaciones],
    ['Baños', s.banos],
    ['Planta', s.planta],
    ['Estado', s.estado],
    ['Extras', s.extras],
  ]);

  e.y += 8;
  e.seccion('Resultado');
  if (calculo.suficiente && calculo.valor) {
    e.cabe(96);
    const y = e.y;
    doc.rect(M, y - 6, ANCHO, 84, { relleno: CREMA, borde: DORADO, grosor: 1 });
    doc.texto(M + ANCHO / 2, y + 16, 'Rango de precio orientativo', { tam: 10, color: GRIS, alinear: 'centro' });
    doc.texto(M + ANCHO / 2, y + 44, `${euros(calculo.valor.bajo)}  —  ${euros(calculo.valor.alto)}`, { tam: 22, negrita: true, color: MARINO, alinear: 'centro' });
    doc.texto(M + ANCHO / 2, y + 66, `Valor central: ${euros(calculo.valor.central)}  ·  ${euros(calculo.porM2.mediana)}/m² (mediana de ${calculo.n} comparables)`, { tam: 9.5, color: GRIS, alinear: 'centro' });
    e.y += 96;
    if (calculo.n < COMPARABLES_RECOMENDADOS) {
      e.parrafo(`Muestra reducida: ${calculo.n} comparables. Para un informe completo se recomiendan ${COMPARABLES_RECOMENDADOS} o más; el rango debe tomarse con más prudencia.`, { tam: 9, color: ROJO });
      e.y += 4;
    }
    if (calculo.dispersionAlta) {
      e.parrafo('Atención: los comparables son poco homogéneos (el más caro por m² dobla al más barato). El rango debe tomarse con prudencia.', { tam: 9, color: ROJO });
      e.y += 4;
    }
  } else {
    e.parrafo(`No hay datos suficientes para dar un rango: hacen falta al menos 3 comparables válidos y la superficie del inmueble (faltan ${calculo.faltan}).`, { tam: 10.5, negrita: true, color: ROJO });
    e.y += 6;
  }
  const ref = referenciaZona(s.municipio);
  if (ref) {
    e.parrafo(`Referencia de zona: precio medio de oferta en ${ref.municipio}, ${euros(ref.eurosM2)}/m² (${ref.fuente}). Es un dato de contexto y no entra en el cálculo del rango.`, { tam: 8.5, color: GRIS });
    e.y += 4;
  }
  if (val.comentario) {
    e.y += 4;
    e.seccion('Comentario del agente');
    e.parrafo(val.comentario, { tam: 10 });
  }

  // Comparables en página nueva: tabla, gráfico, fuentes, método y aviso.
  pie(doc, `${ajustes.empresa} · ${ajustes.agente}`, false);
  doc.pagina();
  e.y = 60;
  e.seccion(`Comparables utilizados (${calculo.n})`);
  const cols = [
    { t: 'Dirección / referencia', x: M, w: 170 },
    { t: 'Fuente', x: M + 175, w: 95 },
    { t: 'Precio', x: M + 270, w: 64, der: true },
    { t: 'm²', x: M + 335, w: 40, der: true },
    { t: 'Ajuste', x: M + 380, w: 40, der: true },
    { t: '€/m²', x: M + 425, w: ANCHO - 425, der: true },
  ];
  const cabeceraTabla = () => {
    doc.rect(M, e.y - 12, ANCHO, 18, { relleno: MARINO });
    for (const c of cols) doc.texto(c.der ? c.x + c.w - 4 : c.x + 4, e.y, c.t, { tam: 8.5, negrita: true, color: [255, 255, 255], alinear: c.der ? 'derecha' : 'izquierda' });
    e.y += 18;
  };
  cabeceraTabla();
  calculo.validos.forEach((c, i) => {
    if (e.y + 18 > LIMITE) { pie(doc, ajustes.empresa, false); doc.pagina(); e.y = 60; cabeceraTabla(); }
    if (i % 2 === 0) doc.rect(M, e.y - 12, ANCHO, 18, { relleno: CREMA });
    const fuente = FUENTES_COMPARABLE.find((f) => f.id === c.fuente)?.corto || '';
    doc.texto(cols[0].x + 4, e.y, `${i + 1}. ${partirTexto(c.direccion, cols[0].w - 18, 8.5)[0] || ''}`, { tam: 8.5 });
    doc.texto(cols[1].x + 4, e.y, fuente, { tam: 8.5 });
    doc.texto(cols[2].x + cols[2].w - 4, e.y, euros(c.precio), { tam: 8.5, alinear: 'derecha' });
    doc.texto(cols[3].x + cols[3].w - 4, e.y, numero(c.m2), { tam: 8.5, alinear: 'derecha' });
    doc.texto(cols[4].x + cols[4].w - 4, e.y, c.ajuste ? `${c.ajuste > 0 ? '+' : ''}${numero(c.ajuste)} %` : '—', { tam: 8.5, alinear: 'derecha' });
    doc.texto(cols[5].x + cols[5].w - 4, e.y, euros(eurosM2(c)), { tam: 8.5, negrita: true, alinear: 'derecha' });
    e.y += 18;
  });

  if (calculo.n) {
    e.y += 14;
    e.seccion('Precio por m² de cada comparable');
    const max = calculo.porM2.max;
    calculo.validos.forEach((c, i) => {
      e.cabe(16);
      const v = eurosM2(c);
      const largo = Math.max(4, ((ANCHO - 170) * v) / max);
      doc.texto(M, e.y, `${i + 1}. ${partirTexto(c.direccion, 100, 8)[0] || ''}`, { tam: 8, color: GRIS });
      doc.rect(M + 115, e.y - 9, largo, 11, { relleno: DORADO });
      doc.texto(M + 120 + largo, e.y, euros(v), { tam: 8 });
      e.y += 16;
    });
    const conFuente = calculo.validos.map((c, i) => [i + 1, c.notas]).filter(([, n]) => n);
    if (conFuente.length) {
      e.y += 10;
      e.seccion('Fuentes de los comparables');
      for (const [n, nota] of conFuente) e.parrafo(`${n}. ${nota}`, { tam: 8, color: GRIS, interlineado: 1.25 });
    }
  }

  e.y += 14;
  e.seccion('Cómo se ha calculado');
  e.parrafo(textoMetodologia(calculo), { tam: 9, color: GRIS });
  e.y += 10;
  e.seccion('Aviso importante');
  e.parrafo(AVISO_VALORACION, { tam: 9, color: GRIS });
  e.y += 16;
  e.firmas([firmaAgente(ajustes)], ajustes.encabezadoFirmas || ENCABEZADO_FIRMAS);
  e.cabe(30);
  doc.texto(M, e.y, `${ajustes.agente} · ${ajustes.empresa}`, { tam: 10, negrita: true, color: MARINO });
  e.y += 14;
  doc.texto(M, e.y, [ajustes.telefono && `Tel. ${ajustes.telefono}`, ajustes.whatsapp && `WhatsApp ${ajustes.whatsapp}`, ajustes.email, ajustes.web].filter(Boolean).join('  ·  '), { tam: 9, color: GRIS });
  pie(doc, `Informe generado con Cerebro Útil Pau el ${fechaLarga(hoy)}`, false);
  return doc.bytes();
}
