/* ═══════════════════════════════════════════════════════════════════
   CEREBRO ÚTIL PAU — generador de PDF propio, sin dependencias
   Cerebro funciona sin conexión, así que no puede tirar de una librería
   por CDN para sacar un PDF. Este módulo escribe el PDF a mano: páginas A4,
   texto con Helvetica y Helvetica-Bold (las fuentes estándar que trae
   cualquier lector de PDF, por eso no hay que incrustarlas), líneas,
   rectángulos e imágenes JPEG.

   Módulo puro: no toca el DOM, funciona igual en el navegador y en Node.
   Entra lo que se quiere dibujar, sale un Uint8Array con el PDF.

   Coordenadas: como en la pantalla, (0,0) es la esquina de ARRIBA a la
   izquierda y la y crece hacia abajo. Por dentro se pasan al sistema del
   PDF, que empieza abajo a la izquierda. La unidad es el punto (1/72").
   ═══════════════════════════════════════════════════════════════════ */

export const A4 = { ancho: 595.28, alto: 841.89 };

const PRODUCTOR = 'Cerebro Útil Pau';

/* ── Métricas ─────────────────────────────────────────────────────────
   Anchos AFM oficiales de Adobe (Core14, versión 002.000) para los códigos
   WinAnsi 32-255, en milésimas del tamaño de letra. El índice es
   código − 32. Los huecos que WinAnsi no define (127, 129, 141, 143, 144 y
   157) valen 0: nunca se escriben, porque se cambian por "?". */
const ANCHOS_HELVETICA = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500];
const ANCHOS_HELVETICA_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,0,556,0,278,556,500,1000,556,556,333,1000,667,333,1000,0,611,0,0,278,278,500,500,350,556,1000,333,1000,556,333,944,0,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556];

/* ── Codificación CP1252 (WinAnsi) ────────────────────────────────────
   De 0xA0 a 0xFF coincide con Unicode (Latin-1): á, ñ, ¿, º… van tal cual.
   De 0x80 a 0x9F Windows metió sus extras (€, comillas tipográficas,
   rayas, puntos suspensivos…), que en Unicode están en otro sitio. */
const EXTRAS_CP1252 = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85],
  [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A],
  [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92],
  [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C],
  [0x017E, 0x9E], [0x0178, 0x9F]
]);
const INTERROGACION = 0x3F;

/* Un carácter Unicode → su byte CP1252. Los tabuladores y saltos de línea
   sueltos se vuelven espacio (una línea de texto es una línea) y lo que
   no cabe en CP1252 (emojis, chino, flechas…) se vuelve "?". */
function byteCp1252(punto) {
  if (punto === 0x09 || punto === 0x0A || punto === 0x0D) return 0x20;
  if (punto >= 0x20 && punto <= 0x7E) return punto;
  if (punto >= 0xA0 && punto <= 0xFF) return punto;
  return EXTRAS_CP1252.get(punto) ?? INTERROGACION;
}

/* Texto → bytes CP1252. Se normaliza a NFC antes, para que una "á" escrita
   como "a" + tilde combinable (pasa al copiar de algunos PDF o del Mac)
   acabe siendo la "á" de una pieza que sí existe en CP1252. */
function aCp1252(texto) {
  const limpio = String(texto ?? '').normalize('NFC');
  const bytes = [];
  for (const caracter of limpio) bytes.push(byteCp1252(caracter.codePointAt(0)));
  return bytes;
}

function anchoBytes(bytes, tam, negrita) {
  const tabla = negrita ? ANCHOS_HELVETICA_BOLD : ANCHOS_HELVETICA;
  let milesimas = 0;
  for (const b of bytes) milesimas += tabla[b - 32] ?? 0;
  return (milesimas * tam) / 1000;
}

/* Ancho en puntos que ocupará el texto con Helvetica (o Helvetica-Bold). */
export function anchoTexto(texto, tam, negrita = false) {
  return anchoBytes(aCp1252(texto), tam, negrita);
}

/* ── Ajuste de líneas ─────────────────────────────────────────────────
   Respeta los saltos de línea del texto (una línea vacía se queda vacía,
   para que los párrafos se separen), parte por palabras y, si una palabra
   sola no cabe (un enlace largo, un IBAN), la corta por caracteres. */
export function partirTexto(texto, anchoMax, tam, negrita = false) {
  const mide = (t) => anchoTexto(t, tam, negrita);
  const lineas = [];
  const parrafos = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n');

  for (const parrafo of parrafos) {
    const palabras = parrafo.replace(/\t/g, ' ').split(' ').filter((p) => p !== '');
    if (!palabras.length) { lineas.push(''); continue; }

    let actual = '';
    for (const palabra of palabras) {
      const candidata = actual ? `${actual} ${palabra}` : palabra;
      if (mide(candidata) <= anchoMax) { actual = candidata; continue; }
      if (actual) lineas.push(actual);
      actual = '';
      if (mide(palabra) <= anchoMax) { actual = palabra; continue; }
      // Palabra más ancha que la línea: a trozos, al menos un carácter por
      // línea para no entrar en un bucle infinito si el ancho es ridículo.
      let trozo = '';
      for (const caracter of palabra) {
        if (trozo && mide(trozo + caracter) > anchoMax) { lineas.push(trozo); trozo = caracter; }
        else trozo += caracter;
      }
      actual = trozo;
    }
    lineas.push(actual);
  }
  return lineas;
}

/* ── Utilidades de escritura ──────────────────────────────────────────── */

/* Números cortos y sin notación científica: el PDF no entiende "1e-7". */
function num(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return Object.is(v, -0) ? '0' : String(v);
}

function componente(c) {
  const v = Math.min(255, Math.max(0, Number(c) || 0));
  return String(Math.round((v / 255) * 1000) / 1000);
}
const colorRelleno = (c) => `${(c || [0, 0, 0]).slice(0, 3).map(componente).join(' ')} rg`;
const colorTrazo = (c) => `${(c || [0, 0, 0]).slice(0, 3).map(componente).join(' ')} RG`;

/* Bytes CP1252 → cadena literal del PDF: ( ) y \ van escapados; el resto
   de bytes se escriben tal cual (el PDF es binario, lo admite). */
function literal(bytes) {
  let s = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5C) s += '\\' + String.fromCharCode(b);
    else s += String.fromCharCode(b);
  }
  return s + ')';
}

/* Para /Info: UTF-16BE con marca BOM en hexadecimal. Así el título con
   tildes se lee bien en cualquier visor, sin líos de PDFDocEncoding. */
function textoInfo(texto) {
  let hex = 'FEFF';
  const s = String(texto ?? '');
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

function fechaPdf(fecha) {
  const d = (n) => String(n).padStart(2, '0');
  return `D:${fecha.getUTCFullYear()}${d(fecha.getUTCMonth() + 1)}${d(fecha.getUTCDate())}` +
    `${d(fecha.getUTCHours())}${d(fecha.getUTCMinutes())}${d(fecha.getUTCSeconds())}Z`;
}

/* Cadena "binaria" (cada carácter es un byte 0-255) → Uint8Array. */
function aBytes(cadena) {
  const bytes = new Uint8Array(cadena.length);
  for (let i = 0; i < cadena.length; i++) bytes[i] = cadena.charCodeAt(i) & 0xFF;
  return bytes;
}

/* Lee la cabecera SOF del JPEG: tamaño real y número de canales. Hace
   falta para declarar bien el espacio de color (gris, RGB o CMYK). */
function leeJpeg(bytes) {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    const marca = bytes[i + 1];
    if (marca === 0xFF) { i++; continue; }
    if (marca === 0xD8 || marca === 0x01 || (marca >= 0xD0 && marca <= 0xD7)) { i += 2; continue; }
    const largo = (bytes[i + 2] << 8) | bytes[i + 3];
    const esSof = marca >= 0xC0 && marca <= 0xCF && marca !== 0xC4 && marca !== 0xC8 && marca !== 0xCC;
    if (esSof) {
      return {
        alto: (bytes[i + 5] << 8) | bytes[i + 6],
        ancho: (bytes[i + 7] << 8) | bytes[i + 8],
        canales: bytes[i + 9]
      };
    }
    if (marca === 0xDA) break; // empieza la imagen y no hubo SOF
    i += 2 + largo;
  }
  return null;
}

/* ── El documento ─────────────────────────────────────────────────────── */

export function nuevoPdf({ titulo = '', autor = '' } = {}) {
  const paginas = [];   // cada una: { contenido: [líneas], imagenes: [{ nombre, datos }] }
  let contadorImagenes = 0;

  const actual = () => {
    if (!paginas.length) doc.pagina();
    return paginas[paginas.length - 1];
  };
  const escribe = (linea) => actual().contenido.push(linea);
  const yPdf = (y) => A4.alto - (Number(y) || 0);

  const doc = {
    pagina() {
      paginas.push({ contenido: [], imagenes: [] });
      return doc;
    },

    get numPaginas() { return paginas.length; },

    /* (x, y) es la línea base del texto, medida desde arriba. Con "centro"
       o "derecha", x es el punto donde se ancla el texto. */
    texto(x, y, texto, { tam = 11, negrita = false, color = [0, 0, 0], alinear = 'izquierda' } = {}) {
      const bytes = aCp1252(texto);
      if (!bytes.length) return doc;
      const ancho = anchoBytes(bytes, tam, negrita);
      let xi = Number(x) || 0;
      if (alinear === 'centro') xi -= ancho / 2;
      else if (alinear === 'derecha') xi -= ancho;
      escribe(`q BT /${negrita ? 'F2' : 'F1'} ${num(tam)} Tf ${colorRelleno(color)} ` +
        `${num(xi)} ${num(yPdf(y))} Td ${literal(bytes)} Tj ET Q`);
      return doc;
    },

    /* Escribe un bloque ajustado al ancho y devuelve la y donde tocaría la
       siguiente línea, para encadenar párrafos sin hacer cuentas fuera. */
    parrafo(x, y, ancho, texto, { tam = 11, negrita = false, color = [0, 0, 0], interlineado = 1.35, alinear = 'izquierda' } = {}) {
      const salto = tam * interlineado;
      const ancla = alinear === 'centro' ? x + ancho / 2 : alinear === 'derecha' ? x + ancho : x;
      let yy = Number(y) || 0;
      for (const linea of partirTexto(texto, ancho, tam, negrita)) {
        if (linea) doc.texto(ancla, yy, linea, { tam, negrita, color, alinear });
        yy += salto;
      }
      return yy;
    },

    linea(x1, y1, x2, y2, { grosor = 0.8, color = [0, 0, 0] } = {}) {
      escribe(`q ${num(grosor)} w ${colorTrazo(color)} ${num(x1)} ${num(yPdf(y1))} m ` +
        `${num(x2)} ${num(yPdf(y2))} l S Q`);
      return doc;
    },

    /* (x, y) es la esquina de arriba a la izquierda. Sin relleno ni borde
       se dibuja el borde en negro, para que la llamada no sea invisible. */
    rect(x, y, w, h, { relleno = null, borde = null, grosor = 0.8 } = {}) {
      const trazo = borde || (relleno ? null : [0, 0, 0]);
      const partes = ['q'];
      if (relleno) partes.push(colorRelleno(relleno));
      if (trazo) partes.push(`${num(grosor)} w`, colorTrazo(trazo));
      partes.push(`${num(x)} ${num(yPdf(Number(y) + Number(h)))} ${num(w)} ${num(h)} re`);
      partes.push(relleno && trazo ? 'B' : relleno ? 'f' : 'S', 'Q');
      escribe(partes.join(' '));
      return doc;
    },

    /* Incrusta un JPEG tal cual (el PDF sabe leerlo con /DCTDecode), sin
       recomprimir. Si la cabecera del JPEG trae el tamaño, manda ese: un
       /Width que no coincide con la imagen la deja rota en algunos visores. */
    imagenJpeg(bytes, anchoPx, altoPx, x, y, w, h) {
      if (!(bytes instanceof Uint8Array)) throw new TypeError('imagenJpeg: los bytes tienen que ser un Uint8Array');
      if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) throw new Error('imagenJpeg: no es un JPEG (no empieza por FF D8)');
      const info = leeJpeg(bytes);
      const ancho = info?.ancho || Math.round(anchoPx);
      const alto = info?.alto || Math.round(altoPx);
      if (!(ancho > 0) || !(alto > 0)) throw new Error('imagenJpeg: faltan las medidas en píxeles');
      const canales = info?.canales || 3;
      const pagina = actual();
      const nombre = `Im${++contadorImagenes}`;
      pagina.imagenes.push({ nombre, datos: bytes, ancho, alto, canales });
      pagina.contenido.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(yPdf(Number(y) + Number(h)))} cm /${nombre} Do Q`);
      return doc;
    },

    /* Monta el archivo completo. Se puede llamar varias veces: cada vez
       genera el PDF con lo que haya dibujado hasta ese momento. */
    bytes() {
      if (!paginas.length) doc.pagina();

      // Numeración: 1 catálogo, 2 árbol de páginas, 3 y 4 fuentes, 5 info,
      // y luego, por página: la página, su contenido y sus imágenes.
      const objetos = [];  // índice = número de objeto − 1; valor: array de trozos (cadena binaria o Uint8Array)
      const reserva = () => { objetos.push(null); return objetos.length; };
      const CATALOGO = reserva(), PAGINAS = reserva(), F1 = reserva(), F2 = reserva(), INFO = reserva();

      objetos[CATALOGO - 1] = [`<< /Type /Catalog /Pages ${PAGINAS} 0 R >>`];
      objetos[F1 - 1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
      objetos[F2 - 1] = ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
      objetos[INFO - 1] = [`<< /Title ${textoInfo(titulo)} /Author ${textoInfo(autor)} ` +
        `/Producer ${textoInfo(PRODUCTOR)} /Creator ${textoInfo(PRODUCTOR)} /CreationDate (${fechaPdf(new Date())}) >>`];

      const hijos = [];
      for (const pagina of paginas) {
        const numPagina = reserva();
        const numContenido = reserva();
        hijos.push(numPagina);

        const xobjetos = [];
        for (const img of pagina.imagenes) {
          const numImg = reserva();
          xobjetos.push(`/${img.nombre} ${numImg} 0 R`);
          const espacio = img.canales === 1 ? '/DeviceGray' : img.canales === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
          objetos[numImg - 1] = [
            `<< /Type /XObject /Subtype /Image /Width ${img.ancho} /Height ${img.alto} /ColorSpace ${espacio} ` +
            `/BitsPerComponent 8 /Filter /DCTDecode /Length ${img.datos.length} >>\nstream\n`,
            img.datos,
            '\nendstream'
          ];
        }

        const recursos = `<< /Font << /F1 ${F1} 0 R /F2 ${F2} 0 R >>` +
          (xobjetos.length ? ` /XObject << ${xobjetos.join(' ')} >>` : '') + ' >>';
        objetos[numPagina - 1] = [`<< /Type /Page /Parent ${PAGINAS} 0 R /MediaBox [0 0 ${A4.ancho} ${A4.alto}] ` +
          `/Resources ${recursos} /Contents ${numContenido} 0 R >>`];

        const contenido = pagina.contenido.join('\n');
        objetos[numContenido - 1] = [`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`];
      }
      objetos[PAGINAS - 1] = [`<< /Type /Pages /Kids [${hijos.map((n) => `${n} 0 R`).join(' ')}] /Count ${hijos.length} >>`];

      // Escritura con la cuenta de bytes al día, que es lo que pide la xref.
      const trozos = [];
      let largo = 0;
      const pon = (t) => {
        const b = typeof t === 'string' ? aBytes(t) : t;
        trozos.push(b);
        largo += b.length;
      };

      // La segunda línea, con bytes altos, avisa a los programas de que el
      // archivo es binario y no deben tocar los saltos de línea.
      pon('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      const desplazamientos = [];
      objetos.forEach((partes, i) => {
        desplazamientos.push(largo);
        pon(`${i + 1} 0 obj\n`);
        for (const p of partes) pon(p);
        pon('\nendobj\n');
      });

      const inicioXref = largo;
      let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
      for (const d of desplazamientos) xref += `${String(d).padStart(10, '0')} 00000 n \n`;
      pon(xref);
      pon(`trailer\n<< /Size ${objetos.length + 1} /Root ${CATALOGO} 0 R /Info ${INFO} 0 R >>\n` +
        `startxref\n${inicioXref}\n%%EOF\n`);

      const salida = new Uint8Array(largo);
      let pos = 0;
      for (const t of trozos) { salida.set(t, pos); pos += t.length; }
      return salida;
    }
  };

  return doc;
}
