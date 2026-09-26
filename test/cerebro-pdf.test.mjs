// ============================================================================
//  Tests del generador de PDF de Cerebro Útil Pau (cerebro/pdf.js)
// ----------------------------------------------------------------------------
//  Ejecutar con: node test/cerebro-pdf.test.mjs
//  Sin red ni navegador: el JPEG de prueba va incrustado aquí (8×6 px, sacado
//  una vez de un canvas de Chromium con toDataURL('image/jpeg')).
// ============================================================================

import { A4, anchoTexto, partirTexto, nuevoPdf } from "../cerebro/pdf.js";

let pasados = 0, fallados = 0;
const check = (nombre, cond, detalle = "") => {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
};

const JPEG_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAGAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAaEAEAAQUAAAAAAAAAAAAAAAAAAwYVVqXR/8QAFQEBAQAAAAAAAAAAAAAAAAAABgf/xAAdEQABAwUBAAAAAAAAAAAAAAACAFGSAQMUFdHS/9oADAMBAAIRAxEAPwCDe6YxLZS8AH9facpn6Vgxwesi6v/Z";
const JPEG = new Uint8Array(Buffer.from(JPEG_B64, "base64"));

// El PDF como cadena latin1: cada carácter es un byte, así se puede buscar.
const comoTexto = (bytes) => Buffer.from(bytes).toString("latin1");
const cerca = (a, b) => Math.abs(a - b) < 1e-9;

// Lee la tabla xref y comprueba que cada entrada cae justo en "N 0 obj".
function revisaXref(pdf) {
  const s = comoTexto(pdf);
  const inicio = Number(s.match(/startxref\n(\d+)\n%%EOF\n$/)?.[1]);
  if (!(inicio >= 0) || s.slice(inicio, inicio + 5) !== "xref\n") return { ok: false, motivo: "startxref no apunta a xref" };
  const m = s.slice(inicio).match(/^xref\n0 (\d+)\n/);
  const total = Number(m[1]);
  let pos = inicio + m[0].length;
  const fallos = [];
  for (let i = 0; i < total; i++) {
    const entrada = s.slice(pos, pos + 20);
    pos += 20;
    if (i === 0) { if (entrada !== "0000000000 65535 f \n") fallos.push("entrada 0"); continue; }
    const off = Number(entrada.slice(0, 10));
    if (!/^\d{10} 00000 n \n$/.test(entrada)) fallos.push(`formato ${i}`);
    if (s.slice(off, off + `${i} 0 obj\n`.length) !== `${i} 0 obj\n`) fallos.push(`obj ${i} en ${off}`);
  }
  const size = Number(s.match(/\/Size (\d+)/)?.[1]);
  if (size !== total) fallos.push(`/Size ${size} ≠ ${total}`);
  return { ok: fallos.length === 0, motivo: fallos.join(", "), total };
}

// Cada stream: /Length tiene que ser exactamente lo que hay entre "stream\n" y "\nendstream".
function revisaLongitudes(pdf) {
  const s = comoTexto(pdf);
  const re = /\/Length (\d+) >>\nstream\n/g;
  let m, fallos = 0, vistos = 0;
  while ((m = re.exec(s))) {
    vistos++;
    const desde = m.index + m[0].length;
    if (s.slice(desde + Number(m[1]), desde + Number(m[1]) + 10) !== "\nendstream") fallos++;
  }
  return { vistos, fallos };
}

console.log("\n📏 Métricas");
check("A4 en puntos", A4.ancho === 595.28 && A4.alto === 841.89);
check("anchoTexto Helvetica: 'Hola' a 10 pt = 20,56", cerca(anchoTexto("Hola", 10), 20.56), anchoTexto("Hola", 10));
check("anchoTexto Helvetica-Bold: 'Hola' a 10 pt = 21,67", cerca(anchoTexto("Hola", 10, true), 21.67), anchoTexto("Hola", 10, true));
check("anchoTexto cuenta la ñ, la Ñ y el € con sus anchos AFM", cerca(anchoTexto("ñÑ€", 1000), 556 + 722 + 556));
check("una tilde combinable se normaliza (á = a + ◌́)", cerca(anchoTexto("a\u0301", 12), anchoTexto("á", 12)));
check("texto vacío mide 0", anchoTexto("", 12) === 0 && anchoTexto(null, 12) === 0);

console.log("\n✂️  Ajuste de líneas");
{
  const largo = "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. ¿Qué tal Ñandú? ¡Genial!";
  let peor = 0, todasBien = true;
  for (const ancho of [40, 80, 120, 200, 300, 500]) {
    for (const negrita of [false, true]) {
      for (const tam of [8, 11, 16]) {
        const lineas = partirTexto(largo + " https://jpmr-negocios.vercel.app/una/ruta/larguisima/sin/espacios/para/cortar", ancho, tam, negrita);
        for (const l of lineas) {
          const w = anchoTexto(l, tam, negrita);
          peor = Math.max(peor, w - ancho);
          if (w > ancho + 1e-9) todasBien = false;
        }
      }
    }
  }
  check("partirTexto nunca devuelve una línea más ancha que el máximo", todasBien, `se pasa ${peor} pt`);
  const juntas = partirTexto(largo, 150, 11).join(" ");
  check("partirTexto no pierde ni cambia palabras", juntas === largo);
  check("respeta los saltos de línea y las líneas vacías", JSON.stringify(partirTexto("uno\n\ndos", 500, 11)) === '["uno","","dos"]');
  const cortada = partirTexto("Supercalifragilisticoespialidoso", 50, 11);
  check("una palabra más larga que el ancho se corta por caracteres", cortada.length > 1 && cortada.join("") === "Supercalifragilisticoespialidoso");
  check("con un ancho ridículo no se cuelga (un carácter por línea)", partirTexto("abc", 0.1, 11).join("|") === "a|b|c");
  check("junta los espacios repetidos", JSON.stringify(partirTexto("hola    mundo", 500, 11)) === '["hola mundo"]');
}

console.log("\n📄 Estructura del PDF");
{
  const doc = nuevoPdf({ titulo: "Informe de cartera", autor: "Pau" });
  check("sin dibujar no hay páginas", doc.numPaginas === 0);
  doc.texto(50, 60, "Página uno");  // sin pagina(): la crea sola
  check("dibujar sin páginas crea la primera", doc.numPaginas === 1);
  doc.pagina();
  doc.texto(50, 60, "Página dos");
  doc.pagina();
  doc.rect(40, 40, 100, 50, { relleno: [200, 16, 46] });
  check("numPaginas cuenta las páginas", doc.numPaginas === 3);

  const pdf = doc.bytes();
  const s = comoTexto(pdf);
  check("devuelve un Uint8Array", pdf instanceof Uint8Array);
  check("cabecera %PDF-1.4", s.startsWith("%PDF-1.4\n"));
  check("termina en %%EOF", s.endsWith("%%EOF\n"));
  const xref = revisaXref(pdf);
  check("los offsets de la xref apuntan justo a cada 'N 0 obj'", xref.ok, xref.motivo);
  const lon = revisaLongitudes(pdf);
  check("cada /Length coincide con los bytes del stream", lon.vistos === 3 && lon.fallos === 0, JSON.stringify(lon));
  check("/Count 3 en el árbol de páginas", /\/Type \/Pages \/Kids \[[^\]]+\] \/Count 3 >>/.test(s));
  check("tres objetos /Type /Page", (s.match(/\/Type \/Page /g) || []).length === 3);
  check("fuentes Helvetica y Helvetica-Bold con WinAnsiEncoding",
    s.includes("/BaseFont /Helvetica /Encoding /WinAnsiEncoding") && s.includes("/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding"));
  const hex = (t) => "FEFF" + [...t].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()).join("");
  check("/Info con Title, Author y Producer 'Cerebro Útil Pau'",
    s.includes(`/Title <${hex("Informe de cartera")}>`) && s.includes(`/Author <${hex("Pau")}>`) && s.includes(`/Producer <${hex("Cerebro Útil Pau")}>`));
  check("/Info con CreationDate en formato PDF", /\/CreationDate \(D:\d{14}Z\)/.test(s));
  check("trailer con /Root y /Info", /trailer\n<< \/Size \d+ \/Root 1 0 R \/Info 5 0 R >>/.test(s));
  check("MediaBox A4", s.includes("/MediaBox [0 0 595.28 841.89]"));
  check("bytes() se puede llamar dos veces con el mismo resultado de estructura", revisaXref(doc.bytes()).ok);
  check("un documento vacío sale con una página en blanco válida", (() => {
    const d = nuevoPdf(); const p = d.bytes(); return d.numPaginas === 1 && revisaXref(p).ok;
  })());
}

console.log("\n🔤 Texto en español");
{
  const doc = nuevoPdf();
  doc.texto(50, 100, "Señor Ñandú 120.000 €");
  doc.texto(50, 120, "Paréntesis (así) y barra \\ fin");
  doc.texto(50, 140, "Emoji 🏠 y flecha →");
  doc.texto(50, 160, "¿Qué? ¡Sí! 1º 2ª «hola» “cita” ‘sí’ – — … ·");
  doc.texto(300, 180, "Centro", { alinear: "centro", tam: 10 });
  doc.texto(500, 200, "Derecha", { alinear: "derecha", negrita: true, tam: 10, color: [255, 0, 0] });
  const s = comoTexto(doc.bytes());
  check("'Señor Ñandú 120.000 €' va en CP1252 (0xF1, 0xD1, 0xFA, 0x80)", s.includes("(Se\xF1or \xD1and\xFA 120.000 \x80) Tj"));
  check("escapa ( ) y \\ en las cadenas", s.includes("(Par\xE9ntesis \\(as\xED\\) y barra \\\\ fin) Tj"));
  check("lo que no cabe en CP1252 sale como '?'", s.includes("(Emoji ? y flecha ?) Tj"));
  check("¿ ¡ º ª « » comillas, rayas, … y · en sus bytes CP1252",
    s.includes("(\xBFQu\xE9? \xA1S\xED! 1\xBA 2\xAA \xABhola\xBB \x93cita\x94 \x91s\xED\x92 \x96 \x97 \x85 \xB7) Tj"));
  check("la y se mide desde arriba (100 → 741.89)", s.includes("50 741.89 Td (Se"));
  const xc = Math.round((300 - anchoTexto("Centro", 10) / 2) * 100) / 100;
  check("alinear 'centro' ancla en el medio", s.includes(`${xc} 661.89 Td (Centro)`), String(xc));
  const xd = Math.round((500 - anchoTexto("Derecha", 10, true)) * 100) / 100;
  check("alinear 'derecha' ancla en el final y usa la negrita (F2)", s.includes(`/F2 10 Tf 1 0 0 rg ${xd} 641.89 Td (Derecha)`), String(xd));
}

console.log("\n📝 Párrafos, líneas y rectángulos");
{
  const doc = nuevoPdf();
  const texto = "Piso luminoso en el centro de Oviedo, reformado, con ascensor y calefacción. ".repeat(4);
  const lineas = partirTexto(texto, 200, 11);
  const y = doc.parrafo(50, 100, 200, texto, { tam: 11 });
  check("parrafo devuelve la y siguiente (líneas × tam × 1,35)", cerca(y, 100 + lineas.length * 11 * 1.35), `${y}`);
  const y2 = doc.parrafo(50, y, 200, "Uno\nDos", { tam: 10, interlineado: 2 });
  check("parrafo respeta el interlineado y los saltos", cerca(y2, y + 2 * 20));
  doc.linea(10, 20, 110, 20, { grosor: 2, color: [0, 0, 255] });
  doc.rect(10, 30, 100, 40, { relleno: [255, 255, 255], borde: [0, 0, 0], grosor: 1 });
  doc.rect(10, 80, 100, 40);
  const s = comoTexto(doc.bytes());
  const numTj = (s.match(/\) Tj ET Q/g) || []).length;
  check("parrafo escribe una orden de texto por línea", numTj === lineas.filter(Boolean).length + 2, `${numTj}`);
  check("linea: grosor, color de trazo y coordenadas desde arriba", s.includes("q 2 w 0 0 1 RG 10 821.89 m 110 821.89 l S Q"));
  check("rect con relleno y borde usa 'B' y la esquina de arriba", s.includes("q 1 1 1 rg 1 w 0 0 0 RG 10 771.89 100 40 re B Q"));
  check("rect sin colores dibuja el borde negro", s.includes("q 0.8 w 0 0 0 RG 10 721.89 100 40 re S Q"));
  check("la xref sigue cuadrando", revisaXref(doc.bytes()).ok);
}

console.log("\n🖼️  Imágenes JPEG");
{
  const doc = nuevoPdf({ titulo: "Con foto" });
  doc.pagina();
  doc.imagenJpeg(JPEG, 8, 6, 50, 100, 160, 120);
  doc.pagina();
  doc.imagenJpeg(JPEG, 8, 6, 50, 100, 80, 60);
  doc.imagenJpeg(JPEG, 8, 6, 200, 100, 80, 60);
  const pdf = doc.bytes();
  const s = comoTexto(pdf);
  check("el JPEG de prueba empieza por FF D8", JPEG[0] === 0xFF && JPEG[1] === 0xD8);
  check("se incrusta como XObject /DCTDecode RGB de 8×6",
    s.includes("/Subtype /Image /Width 8 /Height 6 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode"));
  check("una imagen por uso (3 incrustadas)", (s.match(/\/Subtype \/Image/g) || []).length === 3);
  check("los bytes del JPEG van intactos dentro del stream", s.includes(comoTexto(JPEG)));
  check("se coloca con la esquina de arriba a la izquierda", s.includes("q 160 0 0 120 50 621.89 cm /Im1 Do Q"));
  check("la página enlaza sus imágenes en /XObject", s.includes("/XObject << /Im2 ") && s.includes(" /Im3 "));
  check("xref correcta con imágenes binarias", revisaXref(pdf).ok);
  const lon = revisaLongitudes(pdf);
  check("/Length de las imágenes y contenidos exacto", lon.vistos === 5 && lon.fallos === 0, JSON.stringify(lon));
  let error = "";
  try { doc.imagenJpeg(new Uint8Array([0x89, 0x50, 0x4E, 0x47]), 1, 1, 0, 0, 10, 10); } catch (e) { error = e.message; }
  check("rechaza lo que no empieza por FF D8 (un PNG)", /FF D8/.test(error));
  error = "";
  try { doc.imagenJpeg([0xFF, 0xD8], 1, 1, 0, 0, 10, 10); } catch (e) { error = e.message; }
  check("rechaza lo que no es Uint8Array", /Uint8Array/.test(error));
}

console.log(`\nResultado Cerebro PDF: ${pasados} pasados, ${fallados} fallados.`);
if (fallados) process.exit(1);
