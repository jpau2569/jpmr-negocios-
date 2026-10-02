/* ═══════════════════════════════════════════════════════════════════
   NICER ESTUDIA — fichas para imprimir (PDF y Word)
   Con el material que Clara preparó para una lección (o con el mini test
   del día) se monta una ficha de estudio: explicación, infografía,
   ejemplos resueltos, ejercicios con hueco para contestar, mini test y,
   al final y en otra página, las soluciones.

   Todo sale en el propio móvil y sin internet: el PDF con el generador
   propio (pdf.js) y el Word (.docx de verdad) con un ZIP propio. Módulo
   puro: entra el material, salen los bytes. Se prueba en Node.

   Paso 1: `piezasDeFicha` convierte el material en una lista de piezas
   (título, párrafo, infografía, ejercicio…). Paso 2: `fichaPdf` y
   `fichaDocx` dibujan esas mismas piezas, así PDF y Word dicen lo mismo.
   ═══════════════════════════════════════════════════════════════════ */

import { nuevoPdf, partirTexto, A4 } from './pdf.js';

const LETRAS = ['a', 'b', 'c', 'd'];
const lista = (v) => (Array.isArray(v) ? v : []);

export const SECCIONES = [
  { id: 'explicacion', texto: 'Explicación de la lección' },
  { id: 'infografia', texto: 'Infografía' },
  { id: 'ejemplos', texto: 'Ejemplos resueltos' },
  { id: 'ejercicios', texto: 'Ejercicios para practicar' },
  { id: 'minitest', texto: 'Mini test' },
  { id: 'soluciones', texto: 'Soluciones al final' }
];

/** Nombre de archivo sin tildes, espacios ni caracteres raros. */
export function nombreArchivo(titulo, extension) {
  const base = String(titulo || 'ficha')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .toLowerCase().slice(0, 60) || 'ficha';
  return `ficha-${base}.${extension}`;
}

/**
 * Lista de piezas de la ficha.
 * @param {{titulo:string, subtitulo?:string, fecha?:string, partes:{titulo:string, material:object}[],
 *          incluir?:Record<string,boolean>, hueco?:boolean}} datos
 *   `partes`: una por lección (si son varias, cada una lleva su encabezado).
 */
export function piezasDeFicha({ titulo, subtitulo = '', fecha = '', partes = [], incluir = {}, hueco = true }) {
  const quiere = (id) => incluir[id] !== false;
  const varias = partes.length > 1;
  const piezas = [{ t: 'portada', titulo: String(titulo || 'Ficha de estudio'), subtitulo, fecha }];
  const ejercicios = [];
  const preguntas = [];

  for (const parte of partes) {
    const m = parte.material || {};
    if (varias) piezas.push({ t: 'h1', texto: parte.titulo });

    if (quiere('explicacion') && lista(m.explicacion).length) {
      piezas.push({ t: 'h2', texto: 'Explicación', color: 'azul' });
      for (const a of m.explicacion) {
        if (a.titulo) piezas.push({ t: 'h3', texto: a.titulo });
        piezas.push({ t: 'p', texto: a.texto });
      }
    }
    if (quiere('infografia') && m.infografia) {
      piezas.push({ t: 'h2', texto: 'Infografía', color: 'morado' });
      piezas.push({ t: 'info', info: m.infografia });
    }
    if (quiere('ejemplos') && lista(m.ejemplos).length) {
      piezas.push({ t: 'h2', texto: 'Ejemplos resueltos', color: 'verde' });
      m.ejemplos.forEach((e, i) => piezas.push({ t: 'ejemplo', n: i + 1, ...e }));
    }
    if (quiere('ejercicios') && lista(m.ejercicios).length) {
      piezas.push({ t: 'h2', texto: 'Ejercicios para practicar', color: 'ambar' });
      for (const e of m.ejercicios) {
        ejercicios.push(e);
        piezas.push({ t: 'ejercicio', n: ejercicios.length, enunciado: e.enunciado, pista: e.pista, hueco });
      }
    }
    if (quiere('minitest') && lista(m.minitest).length) {
      piezas.push({ t: 'h2', texto: 'Mini test', color: 'rojo' });
      piezas.push({ t: 'nota', texto: 'Marca la respuesta correcta. Solo hay una.' });
      for (const p of m.minitest) {
        preguntas.push(p);
        piezas.push({ t: 'pregunta', n: preguntas.length, pregunta: p.pregunta, opciones: p.opciones });
      }
    }
  }

  if (quiere('soluciones') && (ejercicios.length || preguntas.length)) {
    piezas.push({ t: 'salto' });
    piezas.push({ t: 'h2', texto: 'Soluciones', color: 'verde' });
    piezas.push({ t: 'nota', texto: 'Míralas después de intentarlo, no antes. Así es como se aprende.' });
    if (ejercicios.length) {
      piezas.push({ t: 'h3', texto: 'Ejercicios' });
      ejercicios.forEach((e, i) => piezas.push({ t: 'solucion', n: i + 1, texto: e.solucion }));
    }
    if (preguntas.length) {
      piezas.push({ t: 'h3', texto: 'Mini test' });
      preguntas.forEach((p, i) => piezas.push({
        t: 'solucion', n: i + 1,
        texto: `${LETRAS[p.correcta] || '?'}) ${p.opciones[p.correcta] || ''}${p.explicacion ? ` — ${p.explicacion}` : ''}`
      }));
    }
  }
  return piezas;
}

/* ═════════════════════════════ PDF ═════════════════════════════ */

// El generador quiere los colores en 0-255; aquí se escriben en 0-1 y se pasan.
const COLOR_01 = {
  azul: [0.07, 0.38, 0.54], azulSuave: [0.91, 0.94, 0.965],
  verde: [0.14, 0.44, 0.29], verdeSuave: [0.89, 0.95, 0.92],
  ambar: [0.66, 0.4, 0.04], ambarSuave: [0.98, 0.945, 0.875],
  rojo: [0.66, 0.23, 0.15], rojoSuave: [0.985, 0.92, 0.9],
  morado: [0.34, 0.22, 0.61], moradoSuave: [0.94, 0.92, 0.98],
  tinta: [0.08, 0.09, 0.11], gris: [0.33, 0.37, 0.42], linea: [0.82, 0.82, 0.8], blanco: [1, 1, 1],
  cieloClaro: [0.8, 0.9, 0.96], cieloTexto: [0.86, 0.93, 0.97]
};
const COLOR = Object.fromEntries(Object.entries(COLOR_01).map(([k, v]) => [k, v.map((x) => Math.round(x * 255))]));

/* Helvetica solo sabe Latin-1: lo de matemáticas que no está se escribe
   con letras para que no salga «?» en mitad de una fórmula. */
const SUSTITUTOS = [
  [/π/g, 'pi'], [/√/g, 'raíz de '], [/≤/g, '<='], [/≥/g, '>='], [/≠/g, '!='],
  [/≈/g, '~'], [/→/g, '->'], [/←/g, '<-'], [/∞/g, 'infinito'], [/−/g, '-'],
  [/⁰/g, '^0'], [/⁴/g, '^4'], [/⁵/g, '^5'], [/⁶/g, '^6'], [/⁷/g, '^7'], [/⁸/g, '^8'], [/⁹/g, '^9'], [/ⁿ/g, '^n'],
  [/₀/g, '0'], [/₁/g, '1'], [/₂/g, '2'], [/₃/g, '3'], [/₄/g, '4'], [/₅/g, '5'], [/₆/g, '6'], [/₇/g, '7'], [/₈/g, '8'], [/₉/g, '9'],
  [/Δ/g, 'Incremento de '], [/α/g, 'alfa'], [/β/g, 'beta'], [/λ/g, 'lambda'], [/Ω/g, 'ohmios'], [/∑/g, 'suma'],
  [/✓|✔/g, 'Sí'], [/✗|✘/g, 'No']
];
export function textoPdf(t) {
  let s = String(t ?? '');
  for (const [re, por] of SUSTITUTOS) s = s.replace(re, por);
  return s;
}

const MARGEN = 48;
const ANCHO = A4.ancho - MARGEN * 2;
const ABAJO = A4.alto - 58;

export function fichaPdf(piezas) {
  const portada = piezas.find((p) => p.t === 'portada') || { titulo: 'Ficha' };
  const doc = nuevoPdf({ titulo: textoPdf(portada.titulo), autor: 'Nicer Estudia' });
  let y = 0;
  let pagina = 0;

  const pie = () => {
    doc.linea(MARGEN, A4.alto - 40, A4.ancho - MARGEN, A4.alto - 40, { grosor: 0.5, color: COLOR.linea });
    doc.texto(MARGEN, A4.alto - 26, textoPdf(`Nicer Estudia · ${portada.titulo}`).slice(0, 90), { tam: 8, color: COLOR.gris });
    doc.texto(A4.ancho - MARGEN, A4.alto - 26, `Página ${pagina}`, { tam: 8, color: COLOR.gris, alinear: 'derecha' });
  };
  const nuevaPagina = () => { doc.pagina(); pagina += 1; pie(); y = 56; };
  const asegura = (alto) => { if (y + alto > ABAJO) nuevaPagina(); };
  const lineas = (t, ancho, tam, negrita = false) => partirTexto(textoPdf(t), ancho, tam, negrita);
  const escribe = (t, { x = MARGEN, ancho = ANCHO, tam = 10.5, negrita = false, color = COLOR.tinta, salto = 1.38 } = {}) => {
    for (const l of lineas(t, ancho, tam, negrita)) {
      asegura(tam * salto);
      if (l) doc.texto(x, y + tam, l, { tam, negrita, color });
      y += tam * salto;
    }
  };

  for (const p of piezas) {
    switch (p.t) {
      case 'portada': {
        nuevaPagina();
        doc.rect(0, 0, A4.ancho, 104, { relleno: COLOR.azul });
        doc.texto(MARGEN, 30, 'NICER ESTUDIA · FICHA DE ESTUDIO', { tam: 8.5, negrita: true, color: COLOR.cieloClaro });
        const titulo = lineas(p.titulo, ANCHO, 20, true).slice(0, 2);
        titulo.forEach((l, i) => doc.texto(MARGEN, 56 + i * 23, l, { tam: 20, negrita: true, color: COLOR.blanco }));
        if (p.subtitulo) doc.texto(MARGEN, titulo.length > 1 ? 96 : 80, textoPdf(p.subtitulo).slice(0, 100), { tam: 10, color: COLOR.cieloTexto });
        y = 130;
        doc.texto(MARGEN, y, 'Nombre:', { tam: 10, negrita: true, color: COLOR.gris });
        doc.linea(MARGEN + 46, y + 2, MARGEN + 300, y + 2, { grosor: 0.6, color: COLOR.linea });
        doc.texto(MARGEN + 320, y, 'Fecha:', { tam: 10, negrita: true, color: COLOR.gris });
        if (p.fecha) doc.texto(MARGEN + 358, y, p.fecha, { tam: 10, color: COLOR.tinta });
        else doc.linea(MARGEN + 358, y + 2, A4.ancho - MARGEN, y + 2, { grosor: 0.6, color: COLOR.linea });
        y += 22;
        break;
      }
      case 'h1': {
        asegura(60);
        y += 10;
        doc.rect(MARGEN, y, ANCHO, 30, { relleno: COLOR.tinta });
        doc.texto(MARGEN + 12, y + 20, textoPdf(p.texto).slice(0, 80), { tam: 13, negrita: true, color: COLOR.blanco });
        y += 42;
        break;
      }
      case 'h2': {
        asegura(70);
        y += 12;
        const c = COLOR[p.color] || COLOR.azul;
        doc.rect(MARGEN, y, 5, 20, { relleno: c });
        doc.texto(MARGEN + 14, y + 15, textoPdf(p.texto), { tam: 14.5, negrita: true, color: c });
        y += 30;
        break;
      }
      case 'h3': {
        asegura(40);
        y += 4;
        escribe(p.texto, { tam: 11.5, negrita: true });
        y += 2;
        break;
      }
      case 'p': {
        escribe(p.texto);
        y += 6;
        break;
      }
      case 'nota': {
        escribe(p.texto, { tam: 9.5, color: COLOR.gris });
        y += 4;
        break;
      }
      case 'info': {
        const i = p.info;
        if (i.titulo) {
          asegura(30);
          const t = lineas(i.titulo, ANCHO, 14, true);
          t.forEach((l) => { doc.texto(A4.ancho / 2, y + 14, l, { tam: 14, negrita: true, color: COLOR.morado, alinear: 'centro' }); y += 18; });
          y += 4;
        }
        if (i.idea) {
          const l = lineas(i.idea, ANCHO - 28, 11, true);
          const alto = l.length * 15 + 16;
          asegura(alto);
          doc.rect(MARGEN, y, ANCHO, alto, { relleno: COLOR.moradoSuave });
          l.forEach((x, k) => doc.texto(A4.ancho / 2, y + 20 + k * 15, x, { tam: 11, negrita: true, color: COLOR.morado, alinear: 'centro' }));
          y += alto + 10;
        }
        // Bloques en dos columnas.
        const hueco = 12;
        const col = (ANCHO - hueco) / 2;
        const medidas = i.bloques.map((b) => {
          const tit = lineas(b.titulo, col - 20, 10.5, true);
          const pts = b.puntos.map((x) => lineas(`• ${x}`, col - 20, 9.5));
          return { b, tit, pts, alto: 12 + tit.length * 13 + 8 + pts.reduce((s, x) => s + x.length * 12.5, 0) + 8 };
        });
        for (let k = 0; k < medidas.length; k += 2) {
          const fila = medidas.slice(k, k + 2);
          const alto = Math.max(...fila.map((m) => m.alto));
          asegura(alto + hueco);
          fila.forEach((m, j) => {
            const x = MARGEN + j * (col + hueco);
            doc.rect(x, y, col, alto, { relleno: COLOR.azulSuave });
            const cab = 12 + m.tit.length * 13;
            doc.rect(x, y, col, cab, { relleno: COLOR.azul });
            m.tit.forEach((l, n) => doc.texto(x + 10, y + 15 + n * 13, l, { tam: 10.5, negrita: true, color: COLOR.blanco }));
            let yy = y + cab + 14;
            for (const pl of m.pts) for (const l of pl) { doc.texto(x + 10, yy, l, { tam: 9.5, color: COLOR.tinta }); yy += 12.5; }
          });
          y += alto + hueco;
        }
        if (i.datos?.length) {
          const n = i.datos.length;
          const w = (ANCHO - (n - 1) * 8) / n;
          const alto = 54;
          asegura(alto + 10);
          i.datos.forEach((d, k) => {
            const x = MARGEN + k * (w + 8);
            doc.rect(x, y, w, alto, { relleno: COLOR.verdeSuave });
            doc.texto(x + w / 2, y + 22, textoPdf(d.valor).slice(0, 24), { tam: 14, negrita: true, color: COLOR.verde, alinear: 'centro' });
            lineas(d.etiqueta, w - 10, 8, false).slice(0, 2)
              .forEach((l, m) => doc.texto(x + w / 2, y + 36 + m * 10, l, { tam: 8, color: COLOR.gris, alinear: 'centro' }));
          });
          y += alto + 10;
        }
        if (i.recuerda) {
          const l = lineas(`Recuerda: ${i.recuerda}`, ANCHO - 24, 10.5, true);
          const alto = l.length * 14 + 14;
          asegura(alto);
          doc.rect(MARGEN, y, ANCHO, alto, { relleno: COLOR.ambarSuave, borde: COLOR.ambar, grosor: 0.6 });
          l.forEach((x, k) => doc.texto(MARGEN + 12, y + 19 + k * 14, x, { tam: 10.5, negrita: true, color: COLOR.ambar }));
          y += alto + 8;
        }
        break;
      }
      case 'ejemplo': {
        asegura(50);
        y += 4;
        escribe(`Ejemplo ${p.n}`, { tam: 11, negrita: true, color: COLOR.verde });
        escribe(p.enunciado);
        (p.pasos || []).forEach((paso, k) => escribe(`${k + 1}) ${paso}`, { x: MARGEN + 14, ancho: ANCHO - 14, tam: 10 }));
        if (p.solucion) escribe(`Solución: ${p.solucion}`, { tam: 10.5, negrita: true, color: COLOR.verde });
        y += 8;
        break;
      }
      case 'ejercicio': {
        asegura(p.hueco ? 90 : 40);
        y += 4;
        escribe(`${p.n}. ${p.enunciado}`, { negrita: true, tam: 10.5 });
        if (p.pista) escribe(`Pista: ${p.pista}`, { tam: 9, color: COLOR.gris });
        if (p.hueco) {
          for (let k = 0; k < 3; k++) {
            asegura(22);
            y += 20;
            doc.linea(MARGEN, y, A4.ancho - MARGEN, y, { grosor: 0.5, color: COLOR.linea });
          }
          y += 6;
        }
        y += 6;
        break;
      }
      case 'pregunta': {
        const opciones = p.opciones.map((o, k) => lineas(`${LETRAS[k]}) ${o}`, ANCHO - 34, 10));
        asegura(18 + opciones.reduce((s, o) => s + o.length * 14, 0));
        y += 2;
        escribe(`${p.n}. ${p.pregunta}`, { negrita: true, tam: 10.5 });
        opciones.forEach((ls) => {
          asegura(ls.length * 14);
          doc.rect(MARGEN + 12, y + 2.5, 8, 8, { borde: COLOR.gris, grosor: 0.7 });
          ls.forEach((l) => { doc.texto(MARGEN + 26, y + 10, l, { tam: 10 }); y += 14; });
        });
        y += 6;
        break;
      }
      case 'solucion': {
        escribe(`${p.n}. ${p.texto}`, { tam: 10 });
        y += 3;
        break;
      }
      case 'salto': nuevaPagina(); break;
      default: break;
    }
  }
  return doc.bytes();
}

/* ═════════════════════════════ WORD ═════════════════════════════ */

const HEX = { azul: '12628A', verde: '24704A', ambar: 'A8650B', rojo: 'A83A25', morado: '57399C', gris: '545E6B' };

const xml = (t) => String(t ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const run = (t, { negrita = false, color = '', tam = 0 } = {}) =>
  `<w:r><w:rPr>${negrita ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}${tam ? `<w:sz w:val="${tam * 2}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r>`;

const parrafo = (runs, { estilo = '', centrado = false, sangria = 0, antes = 0, despues = 0, sombra = '', bordeAbajo = false, saltoAntes = false } = {}) =>
  `<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${saltoAntes ? '<w:pageBreakBefore/>' : ''}` +
  `${bordeAbajo ? '<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="BFBFBF"/></w:pBdr>' : ''}` +
  `${sombra ? `<w:shd w:val="clear" w:color="auto" w:fill="${sombra}"/>` : ''}` +
  `<w:spacing w:before="${antes}" w:after="${despues}"/>${sangria ? `<w:ind w:left="${sangria}"/>` : ''}` +
  `${centrado ? '<w:jc w:val="center"/>' : ''}</w:pPr>${Array.isArray(runs) ? runs.join('') : runs}</w:p>`;

function celda(contenido, { ancho, fondo = '' }) {
  return `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${fondo ? `<w:shd w:val="clear" w:color="auto" w:fill="${fondo}"/>` : ''}` +
    '<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar>' +
    `</w:tcPr>${contenido || '<w:p/>'}</w:tc>`;
}
function tabla(filas, anchos) {
  const borde = '<w:tblBorders><w:insideH w:val="single" w:sz="18" w:color="FFFFFF"/><w:insideV w:val="single" w:sz="18" w:color="FFFFFF"/></w:tblBorders>';
  return `<w:tbl><w:tblPr><w:tblW w:w="${anchos.reduce((a, b) => a + b, 0)}" w:type="dxa"/>${borde}<w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${anchos.map((a) => `<w:gridCol w:w="${a}"/>`).join('')}</w:tblGrid>` +
    filas.map((f) => `<w:tr>${f.join('')}</w:tr>`).join('') + '</w:tbl>' + parrafo([], { despues: 80 });
}

function cuerpoDocx(piezas) {
  const out = [];
  const ANCHO_TXT = 9638; // A4 con márgenes de 2 cm, en veinteavos de punto
  let saltar = false;
  for (const p of piezas) {
    const salto = saltar; saltar = false;
    switch (p.t) {
      case 'portada':
        out.push(parrafo(run('NICER ESTUDIA · FICHA DE ESTUDIO', { negrita: true, color: HEX.azul, tam: 9 }), { despues: 40 }));
        out.push(parrafo(run(p.titulo), { estilo: 'Title' }));
        if (p.subtitulo) out.push(parrafo(run(p.subtitulo, { color: HEX.gris }), { despues: 160 }));
        out.push(parrafo([run('Nombre: ', { negrita: true, color: HEX.gris }), run('______________________________   '),
          run('Fecha: ', { negrita: true, color: HEX.gris }), run(p.fecha || '____________')], { despues: 240 }));
        break;
      case 'h1': out.push(parrafo(run(p.texto, { color: 'FFFFFF' }), { estilo: 'Heading1', sombra: '14171D', saltoAntes: salto })); break;
      case 'h2': out.push(parrafo(run(p.texto, { color: HEX[p.color] || HEX.azul }), { estilo: 'Heading2', saltoAntes: salto })); break;
      case 'h3': out.push(parrafo(run(p.texto), { estilo: 'Heading3' })); break;
      case 'p': out.push(parrafo(run(p.texto), { despues: 120 })); break;
      case 'nota': out.push(parrafo(run(p.texto, { color: HEX.gris, tam: 9.5 }), { despues: 100 })); break;
      case 'info': {
        const i = p.info;
        if (i.titulo) out.push(parrafo(run(i.titulo, { negrita: true, color: HEX.morado, tam: 14 }), { centrado: true, despues: 80 }));
        if (i.idea) out.push(parrafo(run(i.idea, { negrita: true, color: HEX.morado }), { centrado: true, sombra: 'F0EBFA', despues: 160 }));
        const mitad = Math.floor(ANCHO_TXT / 2);
        const filas = [];
        for (let k = 0; k < i.bloques.length; k += 2) {
          filas.push([0, 1].map((j) => {
            const b = i.bloques[k + j];
            if (!b) return celda('', { ancho: mitad });
            const contenido = parrafo(run(`${b.icono ? b.icono + ' ' : ''}${b.titulo}`, { negrita: true, color: HEX.azul }), { despues: 60 }) +
              b.puntos.map((x) => parrafo(run(`• ${x}`, { tam: 10 }), { despues: 20 })).join('');
            return celda(contenido, { ancho: mitad, fondo: 'E8F0F6' });
          }));
        }
        out.push(tabla(filas, [mitad, mitad]));
        if (i.datos?.length) {
          const w = Math.floor(ANCHO_TXT / i.datos.length);
          out.push(tabla([i.datos.map((d) => celda(
            parrafo(run(d.valor, { negrita: true, color: HEX.verde, tam: 15 }), { centrado: true }) +
            parrafo(run(d.etiqueta, { color: HEX.gris, tam: 9 }), { centrado: true }), { ancho: w, fondo: 'E4F2EA' }))],
          i.datos.map(() => w)));
        }
        if (i.recuerda) out.push(parrafo([run('Recuerda: ', { negrita: true, color: HEX.ambar }), run(i.recuerda, { negrita: true, color: HEX.ambar })], { sombra: 'FBF1DF', despues: 160 }));
        break;
      }
      case 'ejemplo':
        out.push(parrafo(run(`Ejemplo ${p.n}`, { negrita: true, color: HEX.verde }), { antes: 120, despues: 40 }));
        out.push(parrafo(run(p.enunciado), { despues: 60 }));
        (p.pasos || []).forEach((paso, k) => out.push(parrafo(run(`${k + 1}) ${paso}`), { sangria: 360, despues: 30 })));
        if (p.solucion) out.push(parrafo([run('Solución: ', { negrita: true, color: HEX.verde }), run(p.solucion, { negrita: true })], { despues: 120 }));
        break;
      case 'ejercicio':
        out.push(parrafo(run(`${p.n}. ${p.enunciado}`, { negrita: true }), { antes: 120, despues: 40 }));
        if (p.pista) out.push(parrafo(run(`Pista: ${p.pista}`, { color: HEX.gris, tam: 9.5 }), { despues: 40 }));
        if (p.hueco) for (let k = 0; k < 3; k++) out.push(parrafo(run(' '), { bordeAbajo: true, antes: 200 }));
        break;
      case 'pregunta':
        out.push(parrafo(run(`${p.n}. ${p.pregunta}`, { negrita: true }), { antes: 120, despues: 40 }));
        p.opciones.forEach((o, k) => out.push(parrafo(run(`☐  ${LETRAS[k]}) ${o}`), { sangria: 280, despues: 20 })));
        break;
      case 'solucion': out.push(parrafo([run(`${p.n}. `, { negrita: true }), run(p.texto)], { despues: 60 })); break;
      case 'salto': saltar = true; break;
      default: break;
    }
  }
  return out.join('');
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="12628A"/><w:sz w:val="48"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

export function fichaDocx(piezas, fecha = new Date()) {
  const portada = piezas.find((p) => p.t === 'portada') || { titulo: 'Ficha' };
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${cuerpoDocx(piezas)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const archivos = [
    { nombre: '[Content_Types].xml', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
    { nombre: '_rels/.rels', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { nombre: 'docProps/core.xml', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(portada.titulo)}</dc:title><dc:creator>Nicer Estudia</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${fecha.toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
    { nombre: 'word/_rels/document.xml.rels', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'word/styles.xml', contenido: ESTILOS },
    { nombre: 'word/document.xml', contenido: documento }
  ];
  return zipBytes(archivos, fecha);
}

/* ── ZIP sin comprimir (lo que pide un .docx), copiado del de Escaparate
      3D Pro pero devolviendo bytes, para poder probarlo en Node. ── */

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipBytes(archivos, fecha = new Date()) {
  const cod = new TextEncoder();
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1);
  const dia = ((Math.max(1980, fecha.getFullYear()) - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate();
  const entradas = archivos.map((a) => {
    const datos = typeof a.contenido === 'string' ? cod.encode(a.contenido) : a.contenido;
    return { nombre: cod.encode(a.nombre), datos, crc: crc32(datos) };
  });
  const trozos = [];
  const centrales = [];
  let offset = 0;
  const campos = (v, lista) => { let o = 0; for (const [n, x] of lista) { if (n === 2) v.setUint16(o, x, true); else v.setUint32(o, x, true); o += n; } };
  for (const e of entradas) {
    const cab = new Uint8Array(30 + e.nombre.length);
    campos(new DataView(cab.buffer), [[4, 0x04034b50], [2, 20], [2, 0x0800], [2, 0], [2, hora], [2, dia],
      [4, e.crc], [4, e.datos.length], [4, e.datos.length], [2, e.nombre.length], [2, 0]]);
    cab.set(e.nombre, 30);
    trozos.push(cab, e.datos);
    centrales.push({ ...e, offset });
    offset += cab.length + e.datos.length;
  }
  const inicio = offset;
  for (const e of centrales) {
    const c = new Uint8Array(46 + e.nombre.length);
    campos(new DataView(c.buffer), [[4, 0x02014b50], [2, 20], [2, 20], [2, 0x0800], [2, 0], [2, hora], [2, dia],
      [4, e.crc], [4, e.datos.length], [4, e.datos.length], [2, e.nombre.length], [2, 0], [2, 0], [2, 0], [2, 0], [4, 0], [4, e.offset]]);
    c.set(e.nombre, 46);
    trozos.push(c);
    offset += c.length;
  }
  const fin = new Uint8Array(22);
  campos(new DataView(fin.buffer), [[4, 0x06054b50], [2, 0], [2, 0], [2, centrales.length], [2, centrales.length],
    [4, offset - inicio], [4, inicio], [2, 0]]);
  trozos.push(fin);
  const salida = new Uint8Array(trozos.reduce((s, t) => s + t.length, 0));
  let pos = 0;
  for (const t of trozos) { salida.set(t, pos); pos += t.length; }
  return salida;
}
