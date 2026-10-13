/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — el PDF de una hoja firmada
   No dibuja nada propio: traduce la hoja a lo que esperan pdfHojaVisita
   y pdfCaptacion de Cerebro (copia exacta en ../cerebro/documentos.js)
   y les pasa la marca, los textos legales TAL COMO SE FIRMARON, la firma
   del agente y un pie con el código SHA-256 y las fechas.
   Módulo puro: entra la hoja, sale un Uint8Array con el PDF.
   ═══════════════════════════════════════════════════════════════════ */

import { pdfCaptacion, pdfHojaVisita } from '../cerebro/documentos.js';
import { nombrePiso } from '../cerebro/campos-piso.js';
import { nombreArchivo } from '../cerebro/utiles.js';
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

/**
 * Las dos líneas del pie: fechas (o la anulación) y el código SHA-256.
 * registro: { hash, recibida, estado, anulada, motivo } (recibida vacía = aún
 * no ha llegado al servidor).
 */
export function textoPieHoja(hoja, registro = {}) {
  const f = enMadrid(hoja.firmadaEn);
  const firmada = `Firmada en el móvil el ${f.fecha} ${f.hora}`;
  let linea1;
  if (registro.estado === 'anulada') {
    const a = enMadrid(registro.anulada);
    linea1 = `ANULADA el ${a.fecha} a las ${a.hora}. Motivo: ${String(registro.motivo || '').slice(0, 90)}`;
  } else if (registro.recibida) {
    const r = enMadrid(registro.recibida);
    linea1 = `${TIPOS[hoja.tipo]} · ${firmada} · Registrada en el servidor el ${r.fecha} ${r.hora} (hora de Madrid)`;
  } else {
    linea1 = `${TIPOS[hoja.tipo]} · ${firmada} · Pendiente de registrar en el servidor`;
  }
  const linea2 = `SHA-256 del contenido firmado: ${registro.hash || ''}${registro.estado === 'anulada' ? ` · ${firmada}` : ''}`;
  return [linea1, linea2];
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
      registrada: registro.recibida || hoja.firmadaEn,
      piso: d.piso,
    };
    return pdfHojaVisita(visita, ajustes, { ...opciones, ahora: new Date(hoja.firmadaEn) });
  }
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
