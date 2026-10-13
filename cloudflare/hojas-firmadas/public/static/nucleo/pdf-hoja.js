/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — el PDF de una hoja firmada
   No dibuja nada propio: traduce la hoja a lo que esperan pdfHojaVisita
   y pdfCaptacion de Cerebro (copia exacta en ../cerebro/documentos.js)
   y les pasa la marca, los textos legales TAL COMO SE FIRMARON, la firma
   del agente y un pie con el código SHA-256 y las fechas.
   Módulo puro: entra la hoja, sale un Uint8Array con el PDF.
   ═══════════════════════════════════════════════════════════════════ */

import { pdfCaptacion, pdfHojaVisita } from '../cerebro/documentos.js';
import { A4, partirTexto } from '../cerebro/pdf.js';
import { nombrePiso } from '../cerebro/campos-piso.js';
import { nombreArchivo, fechaCorta } from '../cerebro/utiles.js';
import { lineaLegal } from './marca.js';
import { enMadrid, TIPOS } from './hoja.js';

/** Los «ajustes» de Cerebro a partir de la hoja (marca y textos del momento de la firma). */
export function ajustesDocumento(hoja) {
  const m = hoja.marca;
  const t = hoja.textos;
  const visita = hoja.tipo === 'visita';
  return {
    agente: hoja.agente.nombre,
    empresa: m.nombreComercial,
    ciudad: m.ciudad && !/\[/.test(m.ciudad) ? m.ciudad : '[PENDIENTE: ciudad]',
    telefono: m.telefono,
    web: m.web,
    email: m.correo,
    encabezadoFirmas: m.encabezadoFirmas,
    colorPrincipal: m.colorPrincipal,
    colorAcento: m.colorAcento,
    lineaLegal: lineaLegal(m),
    textoDeclaracion: visita ? t.declaracion : '',
    textoRgpd: visita ? t.rgpd : '',
    textosRevisados: visita ? t.revisados : false,
    textoCaptacion: visita ? '' : t.conformidad,
    textoRgpdCaptacion: visita ? '' : t.rgpd,
    textoDesistimiento: visita ? '' : t.desistimiento,
    textosCaptacionRevisados: visita ? false : t.revisados,
    firmaAgente: hoja.firmas.agente?.dataUrl || '',
    firmaAgenteAncho: hoja.firmas.agente?.ancho,
    firmaAgenteAlto: hoja.firmas.agente?.alto,
  };
}

/* El pie de cerebro/documentos.js escribe cada línea en 7,5 pt a lo ancho
   de la página y CORTA lo que no cabe. Aquí se comprueba con la misma
   partirTexto que cada línea cabe entera; si no, se usa una versión más
   corta (y, como último recurso, se recorta el motivo de la anulación). */
export const ANCHO_PIE = A4.ancho - 2 * 48;
export const TAM_PIE = 7.5;
export const cabeEnPie = (t) => partirTexto(String(t), ANCHO_PIE, TAM_PIE).length <= 1;
const laQueCabe = (...opciones) => opciones.find(cabeEnPie) ?? opciones[opciones.length - 1];
const recorta = (t, n) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/**
 * Las dos líneas del pie: fechas (o la anulación) y el código SHA-256.
 * registro: { hash, recibida, estado, anulada, motivo } (recibida vacía = aún
 * no ha llegado al servidor). Las dos caben siempre enteras (cabeEnPie).
 */
export function textoPieHoja(hoja, registro = {}) {
  const f = enMadrid(hoja.firmadaEn);
  const r = registro.recibida ? enMadrid(registro.recibida) : null;
  const hash = registro.hash || '';
  if (registro.estado === 'anulada') {
    const a = enMadrid(registro.anulada);
    const motivo = String(registro.motivo || '').replace(/\s+/g, ' ').trim();
    let n = 60;
    let linea1 = `ANULADA el ${a.fecha} a las ${a.hora}. Motivo: ${recorta(motivo, n)}`;
    while (!cabeEnPie(linea1) && n > 10) { n -= 5; linea1 = `ANULADA el ${a.fecha} a las ${a.hora}. Motivo: ${recorta(motivo, n)}`; }
    const registrada = r ? `Registrada ${r.fecha} ${r.hora}` : 'Sin registrar';
    const linea2 = laQueCabe(
      `SHA-256: ${hash} · Firmada ${f.fecha} ${f.hora} · ${registrada}`,
      `SHA-256: ${hash} · Firm. ${f.fecha} ${f.hora} · ${r ? `Reg. ${r.fecha} ${r.hora}` : 'Sin reg.'}`,
    );
    return [linea1, linea2];
  }
  const linea1 = r
    ? laQueCabe(
      `${TIPOS[hoja.tipo]} · Firmada en el móvil el ${f.fecha} ${f.hora} · Registrada en el servidor el ${r.fecha} ${r.hora} (hora de Madrid)`,
      `${TIPOS[hoja.tipo]} · Firmada ${f.fecha} ${f.hora} · Registrada ${r.fecha} ${r.hora} (hora de Madrid)`,
    )
    : laQueCabe(
      `${TIPOS[hoja.tipo]} · Firmada en el móvil el ${f.fecha} ${f.hora} · Pendiente de registrar en el servidor`,
      `${TIPOS[hoja.tipo]} · Firmada ${f.fecha} ${f.hora} · Pendiente de registrar`,
    );
  const linea2 = laQueCabe(`SHA-256 del contenido firmado: ${hash}`, `SHA-256: ${hash}`);
  return [linea1, linea2];
}

/**
 * Nota bajo las firmas de la hoja de visita. La visita, la firma y el
 * registro son tres momentos distintos: la hora de la visita es la que se
 * escribió en el formulario, la de la firma la del móvil y «Registrada»
 * SOLO sale cuando el servidor ha confirmado la hoja (registro.recibida).
 */
export function notaFirmasVisita(hoja, registro = {}) {
  const f = enMadrid(hoja.firmadaEn);
  const base = `Visita del ${fechaCorta(hoja.datos.fecha)} a las ${hoja.datos.hora}. Firmada en el móvil el ${f.fecha} a las ${f.hora} (hora de Madrid).`;
  if (!registro.recibida) return base;
  const r = enMadrid(registro.recibida);
  return `${base} Registrada en el servidor el ${r.fecha} a las ${r.hora}.`;
}

/** El PDF. logo: { bytes: Uint8Array JPEG, ancho, alto } o null (sale el nombre). */
export function pdfDeHoja(hoja, registro = {}, { logo = null } = {}) {
  const ajustes = ajustesDocumento(hoja);
  const opciones = { logo, textoPie: textoPieHoja(hoja, registro), productor: `Hojas firmadas · ${hoja.marca.nombreComercial}` };
  const f = enMadrid(hoja.firmadaEn);
  if (hoja.tipo === 'visita') {
    const d = hoja.datos;
    const visita = {
      id: hoja.id,
      fecha: d.fecha,
      hora: d.hora,
      inmueble: nombrePiso(d.piso),
      visitante: d.visitante,
      acompanantes: d.acompanantes,
      observaciones: d.observaciones,
      aceptaRgpd: d.aceptaRgpd,
      aceptaOfertas: d.aceptaOfertas,
      firma: hoja.firmas.cliente.dataUrl,
      firmaAncho: hoja.firmas.cliente.ancho,
      firmaAlto: hoja.firmas.cliente.alto,
      piso: d.piso,
    };
    return pdfHojaVisita(visita, ajustes, { ...opciones, ahora: new Date(hoja.firmadaEn), notaFirmas: notaFirmasVisita(hoja, registro) });
  }
  // Captación: la nota bajo las firmas es «En {ciudad}, a {fecha de
  // captación}.», que no habla de registro ni de horas: se deja como está.
  const piso = {
    ...hoja.datos.piso,
    notas: hoja.datos.notas,
    firmaPropietario: hoja.firmas.cliente.dataUrl,
    firmaPropietarioAncho: hoja.firmas.cliente.ancho,
    firmaPropietarioAlto: hoja.firmas.cliente.alto,
  };
  return pdfCaptacion(piso, ajustes, { ...opciones, hoy: hoja.datos.piso.fechaCaptacion || f.iso });
}

export function nombrePdf(hoja) {
  const p = hoja.datos.piso || {};
  const base = hoja.tipo === 'captacion' ? 'Hoja-captacion' : 'Hoja-visita';
  return `${nombreArchivo(`${base}-${p.referencia || p.direccion || ''}-${enMadrid(hoja.firmadaEn).iso}`)}.pdf`;
}
