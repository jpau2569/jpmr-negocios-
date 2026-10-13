// ============================================================================
//  Tests de cloudflare/hojas-firmadas (Worker de Cloudflare + D1) — npm test
//  1) Lógica pura: forma canónica y SHA-256, validación de la hoja, marca y
//     textos legales, PDF con la marca configurada, CSV, cola sin conexión.
//  2) El Worker entero con una D1 simulada sobre SQLite (node:sqlite):
//     sesión y límites de intentos, subida idempotente, inmutabilidad (también
//     en la base de datos), anulación, supresión, agentes, marca y logo.
//  Sin red: Telegram se simula con un fetch falso.
// ============================================================================
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  canonico, hashHoja, limpiaHoja, esHojaExacta, resumenHoja, enMadrid, textoEnvio, enlaceWhatsapp, enlaceCorreo,
  bytesDeBase64, MAX_FIRMA_BYTES, VERSION_HOJA, CAMPOS_CAPTACION, nombreDePila, huellaTextos,
} from "../cloudflare/hojas-firmadas/public/static/nucleo/hoja.js";
import {
  MARCA_DEFECTO, TEXTOS_DEFECTO, validaMarca, marcaCompleta, textosCompletos, cambiaTextos, marcaRevisados, textoSobre, contraste,
  coloresInterfaz, lineaLegal, pendientesMarca, AVISO_SUPRESION, avisosMarca, textosDeHoja,
} from "../cloudflare/hojas-firmadas/public/static/nucleo/marca.js";
import { pdfDeHoja, textoPieHoja, nombrePdf, notaFirmasVisita, cabeEnPie } from "../cloudflare/hojas-firmadas/public/static/nucleo/pdf-hoja.js";
import { analizaJpeg, analizaJpegDataUrl } from "../cloudflare/hojas-firmadas/public/static/nucleo/jpeg.js";
import { pdfHojaVisita } from "../cerebro/documentos.js";
import { decideTrasSubida, repartePendientes } from "../cloudflare/hojas-firmadas/public/static/app/cola.js";
import * as V from "../cloudflare/hojas-firmadas/public/static/app/vistas.js";
import { aCsv } from "../cloudflare/hojas-firmadas/src/csv.js";
import {
  creaSesion, leeSesion, resumeClave, compruebaClave, cabeceraCookie, COOKIE, igualesSeguro,
} from "../cloudflare/hojas-firmadas/src/sesion.js";
import { textoHojaFirmada } from "../cloudflare/hojas-firmadas/src/telegram.js";
import { iconoPng } from "../cloudflare/hojas-firmadas/src/icono.js";
import { paginaApp } from "../cloudflare/hojas-firmadas/src/html.js";
import { crearManejador, LIMITE, inicioDiaMadridUtc, validaLogo } from "../cloudflare/hojas-firmadas/src/index.js";
import { creaD1, creaAssets } from "../cloudflare/hojas-firmadas/herramientas/d1-local.mjs";
import { claveDelPanel } from "../cloudflare/hojas-firmadas/herramientas/probar-en-local.mjs";
import { desincronizados, ARCHIVOS_CEREBRO } from "../cloudflare/hojas-firmadas/herramientas/copiar-cerebro.mjs";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}
const latin1 = (bytes) => new TextDecoder("latin1").decode(bytes);
const raiz = (r) => new URL(`../${r}`, import.meta.url);

// Una firma de verdad (JPEG): el logo de Castresana sirve para las pruebas.
const JPEG = readFileSync(raiz("cerebro/logo-castresana.jpg"));
const FIRMA = { dataUrl: `data:image/jpeg;base64,${JPEG.toString("base64")}`, ancho: 500, alto: 201 };
const AHORA = Date.parse("2026-10-13T08:30:00.000Z"); // martes, 10:30 en Madrid
const aDataUrl = (buf) => `data:image/jpeg;base64,${Buffer.from(buf).toString("base64")}`;
/** El JPEG de pruebas con N segmentos de comentario (COM) de relleno tras el SOI: sigue siendo válido. */
const jpegConRelleno = (n, tam = 60_000) => Buffer.concat([JPEG.subarray(0, 2), ...Array.from({ length: n }, () => Buffer.concat([Buffer.from([0xff, 0xfe, (tam + 2) >> 8, (tam + 2) & 255]), Buffer.alloc(tam, 0x20)])), JPEG.subarray(2)]);

function hojaVisita(extra = {}) {
  const r = limpiaHoja({
    v: VERSION_HOJA,
    id: extra.id || crypto.randomUUID(),
    tipo: "visita",
    firmadaEn: new Date(AHORA - 60_000).toISOString(),
    agente: { id: 0, nombre: "Pau Moralejo" },
    marca: marcaCompleta(null),
    textos: { declaracion: TEXTOS_DEFECTO.declaracion, rgpd: TEXTOS_DEFECTO.rgpdVisita, revisados: false },
    datos: {
      fecha: "2026-10-13", hora: "10:00",
      visitante: { nombre: "Ana García López", dni: "12345678z", telefono: "600 11 22 33", email: "ana@ejemplo.es" },
      acompanantes: "", observaciones: "Le gusta la luz.", aceptaRgpd: true, aceptaOfertas: false,
      piso: { referencia: "PIS0190", direccion: "Uría 12", planta: "3ºB", municipio: "Oviedo", habitaciones: "3", ascensor: "Sí" },
    },
    firmas: { cliente: FIRMA, agente: FIRMA },
    ...extra.sobre,
  }, { ahoraMs: extra.ahoraMs || AHORA });
  if (!r.ok) throw new Error(`hojaVisita no válida: ${r.errores.join(" | ")}`);
  return r.hoja;
}

function hojaCaptacion(piso = {}, marca = marcaCompleta(null)) {
  const r = limpiaHoja({
    v: VERSION_HOJA, id: crypto.randomUUID(), tipo: "captacion", firmadaEn: new Date(AHORA - 60_000).toISOString(),
    agente: { id: 0, nombre: "Pau Moralejo" }, marca,
    textos: { conformidad: TEXTOS_DEFECTO.conformidad, rgpd: TEXTOS_DEFECTO.rgpdCaptacion, desistimiento: TEXTOS_DEFECTO.desistimiento, revisados: false },
    datos: {
      piso: {
        referencia: "PIS0201", direccion: "Calle Gascona 5", municipio: "Oviedo", propNombre: "Luis Fernández", propDni: "11111111H", propTelefono: "611222333",
        tipoEncargo: "Exclusiva", honorarios: "3 % + IVA", duracion: "6 meses", lugarFirma: "En la oficina", fechaCaptacion: "2026-10-13", ...piso,
      },
      notas: "",
    },
    firmas: { cliente: FIRMA, agente: FIRMA },
  }, { ahoraMs: AHORA });
  if (!r.ok) throw new Error(`hojaCaptacion no válida: ${r.errores.join(" | ")}`);
  return r.hoja;
}

// ============================================================================
console.log("\n🔁 Lo reutilizado de Cerebro y de castresana-web");
check("las copias de Cerebro en public/static/cerebro/ son idénticas a cerebro/", desincronizados().length === 0, desincronizados().join(", "));
check("se copian los módulos de PDF, datos del piso, textos legales y firma", ["campos-piso.js", "pdf.js", "documentos.js", "operaciones-datos.js", "firma.js"].every((n) => ARCHIVOS_CEREBRO.includes(n)));
check("csv.js es el mismo que el de castresana-web", readFileSync(raiz("cloudflare/hojas-firmadas/src/csv.js"), "utf8") === readFileSync(raiz("cloudflare/castresana-web/src/csv.js"), "utf8"));
check("los textos legales de partida son los BORRADOR de Cerebro", TEXTOS_DEFECTO.conformidad.includes("{propietario}") && TEXTOS_DEFECTO.desistimiento.includes("14 días naturales") && TEXTOS_DEFECTO.declaracion.includes("{visitante}"));

// ============================================================================
console.log("\n#️⃣  Forma canónica y SHA-256");
{
  check("canonico ordena las claves (mismo contenido, mismo texto)", canonico({ b: 1, a: { d: [1, "x"], c: true } }) === canonico({ a: { c: true, d: [1, "x"] }, b: 1 }));
  check("canonico omite undefined y rechaza NaN", canonico({ a: undefined, b: null }) === '{"b":null}' && (() => { try { canonico({ x: NaN }); return false; } catch { return true; } })());
  const h = hojaVisita();
  const huella = await hashHoja(h);
  check("hash de 64 caracteres hexadecimales", /^[0-9a-f]{64}$/.test(huella));
  check("el hash no depende del orden de las claves", huella === await hashHoja(JSON.parse(canonico(h))));
  const cambiada = structuredClone(h); cambiada.datos.observaciones += ",";
  check("una coma más cambia el hash", huella !== await hashHoja(cambiada));
  const otraFirma = structuredClone(h); otraFirma.firmas.cliente.dataUrl = otraFirma.firmas.cliente.dataUrl.replace(/A(?=[^A]*$)/, "B");
  check("tocar un byte de la firma cambia el hash", huella !== await hashHoja(otraFirma));
  const otroTexto = structuredClone(h); otroTexto.textos.rgpd = otroTexto.textos.rgpd.replace("RGPD", "rgpd");
  check("cambiar el texto legal firmado cambia el hash", huella !== await hashHoja(otroTexto));
}

// ============================================================================
console.log("\n🧾 Validación de la hoja");
{
  const h = hojaVisita();
  check("una hoja de visita completa es válida y exacta", esHojaExacta(h, { ahoraMs: AHORA }).ok);
  check("el piso de la visita solo guarda campos del inmueble (limpiaFicha)", h.datos.piso.habitaciones === 3 && h.datos.piso.ascensor === "Sí" && !("propNombre" in h.datos.piso));
  check("el DNI se guarda en mayúsculas", h.datos.visitante.dni === "12345678Z");
  const sinNada = limpiaHoja({ v: 1, id: crypto.randomUUID(), tipo: "visita", firmadaEn: new Date(AHORA).toISOString(), agente: { id: 0, nombre: "Pau" }, marca: {}, textos: {}, datos: {}, firmas: {} }, { ahoraMs: AHORA });
  const e = sinNada.errores.join(" | ");
  check("vacía: faltan nombre, teléfono, piso, RGPD y las dos firmas", !sinNada.ok && /nombre del visitante/.test(e) && /teléfono/.test(e) && /referencia o la dirección/.test(e) && /protección de datos/.test(e) && /firma del visitante/.test(e) && /firma del agente/.test(e), e);
  const conExtra = { ...structuredClone(h), colado: "<script>" };
  check("una hoja con un campo de más no es exacta (no se arregla en silencio)", !esHojaExacta(conExtra, { ahoraMs: AHORA }).ok);
  const conEspacios = structuredClone(h); conEspacios.datos.visitante.nombre = " Ana García López ";
  check("una hoja que limpiar cambiaría (espacios) tampoco es exacta", !esHojaExacta(conEspacios, { ahoraMs: AHORA }).ok);
  const futura = structuredClone(h); futura.firmadaEn = new Date(AHORA + 3600_000).toISOString();
  check("fecha de firma del futuro → error (reloj del móvil mal)", !limpiaHoja(futura, { ahoraMs: AHORA }).ok);
  const vieja = structuredClone(h); vieja.firmadaEn = new Date(AHORA - 91 * 86400_000).toISOString();
  check("firmada hace más de 90 días → error", !limpiaHoja(vieja, { ahoraMs: AHORA }).ok);
  const sinMs = structuredClone(h); sinMs.firmadaEn = "2026-10-13T08:29:00Z";
  check("la fecha tiene que venir como toISOString() (para ordenar como texto)", !limpiaHoja(sinMs, { ahoraMs: AHORA }).ok);
  const png = structuredClone(h); png.firmas.cliente.dataUrl = "data:image/png;base64," + "A".repeat(200);
  check("una firma que no es JPEG se rechaza", !limpiaHoja(png, { ahoraMs: AHORA }).ok);
  const falsa = structuredClone(h); falsa.firmas.cliente.dataUrl = "data:image/jpeg;base64," + "A".repeat(200);
  check("una firma «JPEG» sin la cabecera FF D8 FF se rechaza", !limpiaHoja(falsa, { ahoraMs: AHORA }).ok);
  const grande = structuredClone(h); grande.firmas.cliente.dataUrl = "data:image/jpeg;base64,/9j/" + "A".repeat(Math.ceil((MAX_FIRMA_BYTES + 10) * 4 / 3));
  check("una firma de más de 150 KB se rechaza", bytesDeBase64(grande.firmas.cliente.dataUrl) > MAX_FIRMA_BYTES && /150 KB/.test(limpiaHoja(grande, { ahoraMs: AHORA }).errores.join(" ")));
  const capt = hojaCaptacion();
  check("una hoja de captación completa es válida", esHojaExacta(capt, { ahoraMs: AHORA }).ok);
  check("la captación no admite el precio mínimo interno", !CAMPOS_CAPTACION.some((c) => c.id === "precioMinimo") && !("precioMinimo" in hojaCaptacion({ precioMinimo: 99000 }).datos.piso));
  const sinCondiciones = limpiaHoja({ ...structuredClone(capt), datos: { piso: { referencia: "X1", propNombre: "Luis", fechaCaptacion: "2026-10-13" }, notas: "" } }, { ahoraMs: AHORA });
  check("captación sin honorarios, duración, tipo ni lugar de firma → no se puede firmar", !sinCondiciones.ok && ["Honorarios", "Duración", "Tipo de encargo", "Lugar de firma"].every((t) => sinCondiciones.errores.join(" ").includes(t)), sinCondiciones.errores.join(" | "));
  const r = resumenHoja(capt);
  check("resumen de la captación: propietario, referencia y búsqueda sin tildes", r.nombre === "Luis Fernández" && r.referencia === "PIS0201" && r.busqueda.includes("luis fernandez"));
}

// ============================================================================
console.log("\n🎨 Marca (white-label) y textos legales");
{
  check("por defecto, Asesoría Castresana con su encabezado y sus colores", MARCA_DEFECTO.nombreComercial === "Asesoría Castresana" && MARCA_DEFECTO.encabezadoFirmas === "ASESORIA CASTRESANA INMO" && MARCA_DEFECTO.colorPrincipal === "#10203a" && MARCA_DEFECTO.colorAcento === "#c9a227");
  check("razón social y CIF de Castresana quedan [PENDIENTE] (no se inventan)", /PENDIENTE/.test(MARCA_DEFECTO.razonSocial) && /PENDIENTE/.test(MARCA_DEFECTO.cif) && pendientesMarca(MARCA_DEFECTO).length === 2);
  const v = validaMarca({ ...MARCA_DEFECTO, colorPrincipal: "rojo", nombreComercial: "" });
  check("color mal escrito y nombre vacío → errores", !v.ok && v.errores.length === 2);
  check("marcaCompleta rellena lo que falta", marcaCompleta({ nombreComercial: "Pisos Norte" }).encabezadoFirmas === "ASESORIA CASTRESANA INMO" && marcaCompleta({ nombreComercial: "Pisos Norte" }).nombreComercial === "Pisos Norte");
  check("texto blanco sobre azul marino y negro sobre amarillo (WCAG)", textoSobre("#10203a") === "#ffffff" && textoSobre("#ffe600") === "#000000");
  check("contraste blanco/negro = 21", Math.round(contraste("#ffffff", "#000000")) === 21);
  check("un principal claro no se usa para títulos sobre blanco", coloresInterfaz({ colorPrincipal: "#ffe600", colorAcento: "#000000" }).titulos === "#222222");
  check("la línea legal no imprime los [PENDIENTE]", !lineaLegal(MARCA_DEFECTO).includes("PENDIENTE") && lineaLegal(MARCA_DEFECTO).includes("Cabo Noval"));
  const t0 = textosCompletos(null);
  check("textos de partida: BORRADOR", t0.visitaRevisados === false && t0.captacionRevisados === false);
  check("con [corchetes] no se pueden marcar como revisados", !marcaRevisados(t0, "visita", true).ok);
  const sinCorchetes = { ...t0, rgpdVisita: "Responsable: Pisos Norte SL." };
  const rev = marcaRevisados(sinCorchetes, "visita", true);
  check("sin corchetes sí", rev.ok && rev.textos.visitaRevisados === true);
  const cambio = cambiaTextos(rev.textos, { declaracion: rev.textos.declaracion + " Texto nuevo." });
  check("cambiar un texto lo vuelve BORRADOR", cambio.ok && cambio.textos.visitaRevisados === false);
  check("no se puede dejar un texto vacío", !cambiaTextos(t0, { declaracion: "   " }).ok);
  check("textosCompletos no se cree un «revisados» con corchetes", textosCompletos({ ...t0, visitaRevisados: true }).visitaRevisados === false);
  check("la protección de datos de la visita de serie no nombra a Asesoría Castresana", !/castresana/i.test(TEXTOS_DEFECTO.rgpdVisita) && TEXTOS_DEFECTO.rgpdVisita.includes("[razón social y NIF]"));
  check("…ni ningún otro texto legal de serie", Object.values(TEXTOS_DEFECTO).filter((v) => typeof v === "string").every((v) => !/castresana/i.test(v)));
  const otra = { ...MARCA_DEFECTO, nombreComercial: "Pisos Norte" };
  const av = avisosMarca(otra, null, "defecto").join(" | ");
  check("avisos: otra inmobiliaria con el logo de serie", /logo de serie/.test(av), av);
  check("avisos: otra inmobiliaria con «Castresana» en el encabezado de firmas", /Castresana».*encabezado de firmas/.test(av), av);
  check("avisos: razón social y CIF [PENDIENTE]", /razón social y el CIF siguen como \[PENDIENTE\]/.test(av), av);
  const conTexto = avisosMarca({ ...otra, encabezadoFirmas: "PISOS NORTE", razonSocial: "Pisos Norte SL", cif: "B00000000" }, { ...textosCompletos(null), conformidad: "Encargo a Asesoría Castresana" }, "propio").join(" | ");
  check("avisos: «Castresana» en un texto legal de la captación (sin avisos de logo ni de CIF)", /textos legales de la hoja de captación/.test(conTexto) && !/logo|CIF|visita/.test(conTexto), conTexto);
  check("avisos: Asesoría Castresana con su logo y su encabezado no se avisa a sí misma", !/logo|Castresana»/.test(avisosMarca(MARCA_DEFECTO, null, "defecto").join(" ")));
  check("avisos: una inmobiliaria completa y limpia no tiene avisos de marca", avisosMarca({ ...otra, encabezadoFirmas: "PISOS NORTE", razonSocial: "Pisos Norte SL", cif: "B00000000" }, null, "propio").length === 0);
  check("textosDeHoja: las claves de la hoja (rgpdVisita → rgpd)", canonico(textosDeHoja(null, "visita")) === canonico({ declaracion: TEXTOS_DEFECTO.declaracion, rgpd: TEXTOS_DEFECTO.rgpdVisita, revisados: false }));
  check("huellaTextos no depende de «revisados»", (await huellaTextos({ a: "x", revisados: true })) === (await huellaTextos({ a: "x", revisados: false })));
  check("el aviso de supresión es BORRADOR y no da plazos", AVISO_SUPRESION.startsWith("BORRADOR") && !/\d+\s*(años|meses|días)/.test(AVISO_SUPRESION));
}

// ============================================================================
console.log("\n📄 PDF con la marca configurada");
{
  const marca = { ...marcaCompleta(null), nombreComercial: "Pisos Norte", encabezadoFirmas: "PISOS NORTE GESTION SL", colorPrincipal: "#0b5d1e", colorAcento: "#e85d04", razonSocial: "Pisos Norte Gestion SL", cif: "B00000000", ciudad: "Gijon" };
  const base = hojaVisita();
  const h = limpiaHoja({ ...base, marca }, { ahoraMs: AHORA }).hoja;
  const huella = await hashHoja(h);
  const pdf = latin1(pdfDeHoja(h, { hash: huella, recibida: new Date(AHORA).toISOString(), estado: "firmada" }));
  check("el PDF es un PDF", pdf.startsWith("%PDF-1.4") && pdf.trimEnd().endsWith("%%EOF"));
  check("lleva el encabezado de firmas configurado", pdf.includes("(PISOS NORTE GESTION SL)"));
  check("y no el de Castresana", !pdf.includes("ASESORIA CASTRESANA INMO"));
  check("lleva el nombre comercial (pie y metadatos)", pdf.includes("Pisos Norte") && pdf.includes("Hojas firmadas · Pisos Norte".split("").map((c) => c.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase()).join("")));
  check("lleva la razón social y el CIF bajo la cabecera", pdf.includes("Pisos Norte Gestion SL · CIF B00000000"));
  check("el pie lleva el SHA-256 del contenido firmado", pdf.includes(`SHA-256 del contenido firmado: ${huella}`));
  check("el pie lleva la fecha de firma y la del servidor (hora de Madrid)", pdf.includes("Firmada en el móvil el 13/10/2026 10:29") && pdf.includes("Registrada en el servidor el 13/10/2026 10:30"));
  check("bajo las firmas: la visita, la firma y el registro, cada uno con SU hora", pdf.includes("Visita del 13/10/2026 a las 10:00. Firmada en el m") && notaFirmasVisita(h, { recibida: new Date(AHORA).toISOString() }) === "Visita del 13/10/2026 a las 10:00. Firmada en el móvil el 13/10/2026 a las 10:29 (hora de Madrid). Registrada en el servidor el 13/10/2026 a las 10:30.", notaFirmasVisita(h, { recibida: new Date(AHORA).toISOString() }));
  const pendiente = latin1(pdfDeHoja(h, { hash: huella }));
  check("sin subir: el PDF NUNCA dice «Registrada» (ni pone la hora de firma en su lugar)", !pendiente.includes("Registrada") && !/Registrad/.test(notaFirmasVisita(h, {})) && notaFirmasVisita(h, { recibida: "" }).endsWith("(hora de Madrid)."));
  check("ni usa la hora de la visita como hora de la firma", !pendiente.includes("a las 10:00. Registrada") && !pendiente.includes("Firmado en el dispositivo del agente el 13/10/2026 a las 10:00"));
  check("usa el color principal configurado y no el azul de Castresana", pdf.includes("0.043 0.365 0.118 rg") && !pdf.includes("0.063 0.125 0.227 rg"));
  check("dos firmas incrustadas (visitante y agente) + logo opcional", (pdf.match(/\/Subtype \/Image/g) || []).length === 2);
  const conLogo = latin1(pdfDeHoja(h, { hash: huella }, { logo: { bytes: new Uint8Array(JPEG), ancho: 500, alto: 201 } }));
  check("con logo: tres imágenes", (conLogo.match(/\/Subtype \/Image/g) || []).length === 3);
  check("sin registrar todavía: lo dice al pie", conLogo.includes("Pendiente de registrar en el servidor"));
  const pie = textoPieHoja(h, { hash: huella, recibida: new Date(AHORA).toISOString() });
  check("la primera línea del pie cabe en una línea del PDF", pdf.includes(`(${pie[0].replace(/[()]/g, (c) => `\\${c}`)})`), pie[0]);
  const anulada = latin1(pdfDeHoja(h, { hash: huella, recibida: new Date(AHORA).toISOString(), estado: "anulada", anulada: new Date(AHORA + 3600_000).toISOString(), motivo: "Datos del visitante equivocados" }));
  check("una hoja anulada lo dice al pie con el motivo", anulada.includes("ANULADA el 13/10/2026 a las 11:30. Motivo: Datos del visitante equivocados"));
  check("anulada: la segunda línea lleva SHA-256, firma Y registro (no se pierde la hora del servidor)", anulada.includes(`(SHA-256: ${huella} · Firmada 13/10/2026 10:29 · Registrada 13/10/2026 10:30)`));
  // El peor caso: hash con las cifras más anchas y un motivo largo.
  const hashAncho = "a".repeat(64);
  const casos = [
    { hash: hashAncho },
    { hash: hashAncho, recibida: new Date(AHORA).toISOString() },
    { hash: hashAncho, recibida: new Date(AHORA).toISOString(), estado: "anulada", anulada: new Date(AHORA + 3600_000).toISOString(), motivo: "El visitante dio mal su teléfono y hay que repetir la hoja con los datos buenos, todos y cada uno de ellos" },
    { hash: hashAncho, estado: "anulada", anulada: new Date(AHORA + 3600_000).toISOString(), motivo: "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" },
  ];
  for (const tipo of ["visita", "captacion"]) {
    const hh = tipo === "visita" ? h : hojaCaptacion();
    const lineas = casos.flatMap((c) => textoPieHoja(hh, c));
    check(`pie (${tipo}): ninguna línea se corta, ni con el código más ancho ni con un motivo largo`, lineas.every(cabeEnPie), lineas.filter((l) => !cabeEnPie(l)).join(" || "));
  }
  const motivoLargo = textoPieHoja(h, casos[2])[0];
  check("anulada: el motivo se recorta a unos 60 caracteres con «…»", motivoLargo.endsWith("…") && motivoLargo.split("Motivo: ")[1].length <= 60, motivoLargo);
  check("BORRADOR mientras los textos no estén revisados", pdf.includes("BORRADOR"));
  const revisada = limpiaHoja({ ...h, textos: { ...h.textos, revisados: true } }, { ahoraMs: AHORA }).hoja;
  check("sin aviso BORRADOR cuando los textos se firmaron revisados", !latin1(pdfDeHoja(revisada, { hash: "x" })).includes("BORRADOR"));
  const defecto = latin1(pdfDeHoja(hojaVisita(), { hash: huella }));
  check("con la marca de serie, firmas bajo ASESORIA CASTRESANA INMO", defecto.includes("(ASESORIA CASTRESANA INMO)"));
  const capFuera = latin1(pdfDeHoja(hojaCaptacion({ lugarFirma: "Fuera de la oficina", comercializarYa: "Sí" }), { hash: huella }));
  const capDentro = latin1(pdfDeHoja(hojaCaptacion(), { hash: huella }));
  check("captación firmada fuera de la oficina: con desistimiento de 14 días", capFuera.includes("DERECHO DE DESISTIMIENTO") && capFuera.includes("14 d\xedas naturales"));
  check("captación en la oficina: sin desistimiento", !capDentro.includes("DERECHO DE DESISTIMIENTO"));
  check("captación: condiciones del encargo tal como se escribieron", capDentro.includes("(3 % + IVA)") && capDentro.includes("(6 meses)"));
  check("captación: firma del propietario y del agente", capDentro.includes("(Firma del propietario)") && capDentro.includes("(Firma del agente)"));
  check("nombre de archivo sin caracteres raros", nombrePdf(h) === "Hoja-visita-PIS0190-2026-10-13.pdf", nombrePdf(h));
}

// ============================================================================
console.log("\n🧠 Cerebro: la opción nueva no cambia nada si no se pasa");
{
  const visita = { id: "abc-12345678", fecha: "2026-10-13", hora: "17:30", inmueble: "Uría 12", visitante: { nombre: "Ana López", dni: "1X", telefono: "600000000", email: "" }, aceptaRgpd: true, aceptaOfertas: false, firma: FIRMA.dataUrl, firmaAncho: 500, firmaAlto: 201, registrada: "2026-10-13T15:30:00.000Z" };
  const ajustes = { empresa: "Asesoría Castresana", agente: "Pau Moralejo", ciudad: "Oviedo", textoDeclaracion: "Visita {visitante}", textoRgpd: "RGPD", textosRevisados: false };
  const sin = latin1(pdfHojaVisita(visita, ajustes, { ahora: new Date("2026-10-13T15:30:00Z") }));
  const conDate = latin1(pdfHojaVisita(visita, ajustes, new Date("2026-10-13T15:30:00Z")));
  check("sin notaFirmas: la nota de siempre de Cerebro", sin.includes("Firmado en el dispositivo del agente el 13/10/2026 a las 17:30. Registrada:") && conDate.includes("Firmado en el dispositivo del agente el 13/10/2026 a las 17:30. Registrada:"));
  const con = latin1(pdfHojaVisita(visita, ajustes, { ahora: new Date("2026-10-13T15:30:00Z"), notaFirmas: "Nota propia." }));
  check("con notaFirmas: solo esa nota", con.includes("(Nota propia.)") && !con.includes("Firmado en el dispositivo"));
  const quita = (t) => t.replace(/\/CreationDate \([^)]*\)/g, "");
  check("notaFirmas: undefined da el mismo PDF que no pasarla", quita(latin1(pdfHojaVisita(visita, ajustes, { ahora: new Date("2026-10-13T15:30:00Z"), notaFirmas: undefined }))) === quita(sin));
}

// ============================================================================
console.log("\n📤 Envío (sin enviar nada solo) y Telegram con datos mínimos");
{
  const h = hojaVisita();
  const txt = textoEnvio(h, h.marca);
  check("texto para el cliente con su nombre de pila y la referencia", txt.startsWith("Hola Ana,") && txt.includes("PIS0190"));
  check("wa.me con el 34 delante y el texto codificado", enlaceWhatsapp("600 11 22 33", "Hola Ana").startsWith("https://wa.me/34600112233?text=Hola%20Ana"));
  check("mailto con asunto y cuerpo codificados", enlaceCorreo("ana@ejemplo.es", "Hoja & firma", "a b") === "mailto:ana@ejemplo.es?subject=Hoja%20%26%20firma&body=a%20b");
  check("mailto ignora un correo raro", enlaceCorreo("x?bcc=otro@x.es", "a", "b").startsWith("mailto:?subject"));
  const tg = textoHojaFirmada(h);
  check("Telegram: tipo, nombre de pila y referencia", tg.includes("Hoja de visita firmada") && tg.includes("Nombre: Ana\n") && tg.includes("PIS0190"));
  check("Telegram: nada de apellidos, DNI, teléfono, correo ni dirección", !/García|12345678|600|ana@|Uría/.test(tg));
  check("nombreDePila", nombreDePila("  María José Pérez") === "María");
}

// ============================================================================
console.log("\n📊 CSV y cola sin conexión");
{
  const csv = aCsv(["Nombre", "Nota"], [["=HYPERLINK(\"x\")", "a;b"]]);
  check("CSV con BOM, «;» y fórmulas neutralizadas", csv.startsWith("\uFEFF") && csv.includes("'=HYPERLINK") && csv.includes('"a;b"'));
  check("cola: 201/200 subida, 410 borrada, 401 sesión, sin red/429/5xx espera, 422/409 error",
    decideTrasSubida(201) === "subida" && decideTrasSubida(200) === "subida" && decideTrasSubida(410) === "borrada" && decideTrasSubida(401) === "sesion"
    && decideTrasSubida(0) === "espera" && decideTrasSubida(429) === "espera" && decideTrasSubida(502) === "espera" && decideTrasSubida(422) === "error" && decideTrasSubida(409) === "error");
  const cola = [{ id: "a", hoja: { agente: { id: 0 } } }, { id: "b", hoja: { agente: { id: 3 } } }, { id: "c", hoja: { agente: { id: 3 } } }];
  const deAna = repartePendientes(cola, 3);
  check("cola compartida: cada usuario ve solo las suyas y de las otras solo cuántas", deAna.mias.map((i) => i.id).join() === "b,c" && deAna.otras === 1 && repartePendientes(cola, 0).mias.length === 1 && repartePendientes(cola, 0).otras === 2);
  check("cola compartida: sin sesión no se enseña ninguna", repartePendientes(cola, null).mias.length === 0 && repartePendientes(cola, null).otras === 3);
  const lista = V.vistaHojas({ pendientes: deAna.mias.map((i) => ({ ...i, hoja: hojaVisita({ sobre: { agente: { id: 3, nombre: "Ana" } } }) })), otrasPendientes: 1 });
  check("la lista dice «1 hoja pendiente de otro usuario en este móvil» sin datos suyos", lista.includes("1 hoja pendiente de otro usuario en este móvil"));
}

// ============================================================================
console.log("\n🧱 Vistas y esqueleto (todo escapado)");
{
  const malo = '<img src=x onerror="alert(1)">';
  const formV = V.formVisita({ cfg: { marca: MARCA_DEFECTO, textos: textosCompletos(null) }, agente: { nombre: malo }, hoy: "2026-10-13", hora: "10:00" });
  check("el nombre del agente se escapa en el formulario", !formV.includes("<img src=x") && formV.includes("&lt;img"));
  check("el formulario de visita no lleva estilos ni scripts en línea", !/ style=|<script|onclick=/.test(formV));
  check("todos los campos del formulario tienen etiqueta", [...formV.matchAll(/<(input|select|textarea) id="([^"]+)"/g)].every((m) => formV.includes(`for="${m[2]}"`)));
  const formC = V.formCaptacion({ cfg: { marca: MARCA_DEFECTO, textos: textosCompletos(null) }, agente: { nombre: "Pau" } });
  check("captación: honorarios y duración en blanco (sin valores inventados)", /id="c-honorarios"[^>]*value=""/.test(formC) && /id="c-duracion"[^>]*value=""/.test(formC));
  check("captación: el precio mínimo interno no aparece", !formC.includes("c-precioMinimo"));
  check("casillas: la etiqueta envuelve la casilla (toda la fila se toca)", /<label for="v-rgpd"><input id="v-rgpd"[^>]*type="checkbox"/.test(formV) && /<label for="v-ofertas"><input id="v-ofertas"/.test(formV));
  check("«Ir a Ajustes» con zona táctil", V.vistaInicio({ agente: { nombre: "Pau" }, avisos: ["x"] }).includes('class="enlace-tactil" href="#ajustes"'));
  const det = V.vistaDetalle({ hoja: hojaVisita(), registro: { hash: "f".repeat(64), recibida: new Date(AHORA).toISOString(), estado: "firmada", textosAlDia: false, marcaAlDia: true }, marca: MARCA_DEFECTO });
  check("detalle: «← Volver a la lista» con zona táctil", det.includes('class="enlace-tactil" href="#hojas">← Volver a la lista'));
  check("detalle: el SHA-256 explicado para Pau", det.includes("Código de comprobación (SHA-256): sirve para demostrar que la hoja no ha cambiado"));
  check("detalle: avisa si los textos legales no eran los de Ajustes", det.includes("DISTINTOS de los que había en Ajustes") && det.includes("La misma que había en Ajustes"));
  const ajV = V.vistaAjustes({ agente: { titular: true, nombre: "Pau" }, marca: MARCA_DEFECTO, textos: textosCompletos(null), logo: { modo: "defecto" }, permisos: { agentesSoloSuyas: true } });
  check("Ajustes: «Los agentes solo ven sus hojas», marcado por defecto", /<input id="p-soloSuyas"[^>]* checked/.test(ajV) && ajV.includes("Los agentes solo ven sus hojas"));
  check("Ajustes: sin palabras técnicas en la exportación", !ajV.includes("SHA-256"));
  const app = paginaApp({ marca: { ...MARCA_DEFECTO, nombreComercial: `Pisos "Norte" <b>` }, conLogo: true });
  check("el título de la app sale del nombre comercial y escapado", app.includes("<title>Pisos &quot;Norte&quot; &lt;b&gt; · Hojas firmadas</title>"));
  check("el esqueleto no lleva scripts ni estilos en línea", !/<script>|<style|style="/.test(app));
}

// ============================================================================
console.log("\n🔐 Sesión y claves");
{
  const s = await creaSesion("clave-de-prueba-larga", AHORA, { agente: 3, version: 2 });
  check("sesión válida con agente y versión", JSON.stringify(await leeSesion(s, "clave-de-prueba-larga", AHORA)) === '{"agente":3,"version":2}');
  check("sesión caducada a la semana", (await leeSesion(s, "clave-de-prueba-larga", AHORA + 7 * 86400_000 + 1000)) === null);
  check("si cambia PANEL_CLAVE, no vale", (await leeSesion(s, "otra-clave-larga-xx", AHORA)) === null);
  check("cambiar el agente de la cookie la invalida", (await leeSesion(s.replace(".3.2.", ".0.2."), "clave-de-prueba-larga", AHORA)) === null);
  check("cookie __Host- HttpOnly Secure SameSite=Strict", /^__Host-sesion=.*; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800$/.test(cabeceraCookie("x")) && COOKIE === "__Host-sesion");
  const g = await resumeClave("una frase larga de clave", 1000);
  check("clave de agente con PBKDF2 y sal: no se guarda en claro", g.hash.length === 64 && g.sal.length === 32 && !JSON.stringify(g).includes("frase"));
  check("la clave buena coincide y la mala no", (await compruebaClave("una frase larga de clave", g)) && !(await compruebaClave("otra", g)));
  check("igualesSeguro", (await igualesSeguro("a", "a")) && !(await igualesSeguro("a", "b")));
  const c1 = claveDelPanel({}), c2 = claveDelPanel({});
  check("probar-en-local: clave aleatoria distinta en cada arranque", c1 !== c2 && c1.length >= 16);
}

// ============================================================================
console.log("\n🕰️  Filtros por día en hora de Madrid");
check("invierno: el 15-01-2026 empieza a las 23:00 UTC del 14", inicioDiaMadridUtc("2026-01-15") === "2026-01-14T23:00:00.000Z");
check("verano: el 15-07-2026 empieza a las 22:00 UTC del 14", inicioDiaMadridUtc("2026-07-15") === "2026-07-14T22:00:00.000Z");
check("día del cambio de hora (25-10-2026)", inicioDiaMadridUtc("2026-10-25") === "2026-10-24T22:00:00.000Z");
check("fecha imposible → ''", inicioDiaMadridUtc("2026-02-30") === "");
check("enMadrid", enMadrid("2026-10-13T08:30:00.000Z").hora === "10:30" && enMadrid("2026-12-31T23:30:00.000Z").fecha === "01/01/2027");

// ============================================================================
console.log("\n🖼️  Icono y logo");
{
  const png = await iconoPng(192, "#10203a", "#c9a227");
  const firma = [...png.slice(0, 8)].join(",");
  const dv = new DataView(png.buffer, png.byteOffset);
  check("icono PNG de 192×192", firma === "137,80,78,71,13,10,26,10" && dv.getUint32(16) === 192 && dv.getUint32(20) === 192);
  const otro = await iconoPng(192, "#0b5d1e", "#e85d04");
  check("el icono cambia con los colores de la marca", Buffer.compare(Buffer.from(png), Buffer.from(otro)) !== 0);
  check("logo: JPEG válido", Boolean(validaLogo({ dataUrl: FIRMA.dataUrl, ancho: 500, alto: 201 }).logo));
  check("logo: un PNG disfrazado se rechaza", Boolean(validaLogo({ dataUrl: "data:image/jpeg;base64," + Buffer.from("\x89PNG....").toString("base64"), ancho: 50, alto: 50 }).error));
  const grande = jpegConRelleno(4);
  check("logo: más de 200 KB se rechaza (aunque sea un JPEG bien formado)", analizaJpeg(new Uint8Array(grande)).ok && /200 KB/.test(validaLogo({ dataUrl: aDataUrl(grande), ancho: 500, alto: 201 }).error || ""));
  check("logo: una cabecera FF D8 FF con relleno detrás ya no pasa", Boolean(validaLogo({ dataUrl: aDataUrl(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(1024)])), ancho: 50, alto: 50 }).error));
  const poliglota = aDataUrl(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("<html><script>alert(1)</script></html>")]));
  check("logo: un HTML con cabecera de JPEG delante se rechaza (políglota)", Boolean(validaLogo({ dataUrl: poliglota, ancho: 100, alto: 100 }).error));
  check("logo: un SVG disfrazado de JPEG se rechaza", Boolean(validaLogo({ dataUrl: aDataUrl(Buffer.from("<svg onload=alert(1)>")), ancho: 100, alto: 100 }).error));
  check("logo: medidas que no son las del JPEG → error", /no coinciden/.test(validaLogo({ dataUrl: FIRMA.dataUrl, ancho: 400, alto: 201 }).error || ""));
}

// ============================================================================
console.log("\n🧪 JPEG de verdad (firmas y logo)");
{
  const ok = analizaJpeg(new Uint8Array(JPEG));
  check("el JPEG de pruebas se analiza: medidas y canales", ok.ok && ok.ancho === 500 && ok.alto === 201 && [1, 3, 4].includes(ok.canales), JSON.stringify(ok));
  check("sin EOI (cortado) → no vale", !analizaJpeg(new Uint8Array(JPEG.subarray(0, JPEG.length - 2))).ok);
  check("cortado por la mitad → no vale", !analizaJpeg(new Uint8Array(JPEG.subarray(0, Math.floor(JPEG.length / 2)))).ok);
  check("solo SOI + EOI (sin SOF ni imagen) → no vale", !analizaJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])).ok);
  check("«/9j/» + basura → no vale", !analizaJpegDataUrl("data:image/jpeg;base64,/9j/" + "A".repeat(200)).ok);
  const enorme = Buffer.from(JPEG); // medidas de 65535 × 65535 en el SOF
  const iSof = [...enorme.keys()].find((i) => enorme[i] === 0xff && enorme[i + 1] >= 0xc0 && enorme[i + 1] <= 0xc2);
  enorme[iSof + 5] = 0xff; enorme[iSof + 6] = 0xff; enorme[iSof + 7] = 0xff; enorme[iSof + 8] = 0xff;
  check("medidas absurdas en el SOF → no vale", !analizaJpeg(new Uint8Array(enorme)).ok);
  const h = hojaVisita();
  const basura = structuredClone(h); basura.firmas.cliente.dataUrl = "data:image/jpeg;base64,/9j/" + "A".repeat(200);
  check("firma «/9j/» + basura (cabecera bien, resto no) → la hoja no vale", !limpiaHoja(basura, { ahoraMs: AHORA }).ok && /no es una imagen válida/.test(limpiaHoja(basura, { ahoraMs: AHORA }).errores.join(" ")));
  const cortada = structuredClone(h); cortada.firmas.agente.dataUrl = aDataUrl(JPEG.subarray(0, JPEG.length - 40));
  check("firma cortada → la hoja no vale", !limpiaHoja(cortada, { ahoraMs: AHORA }).ok);
  const mentira = structuredClone(h); mentira.firmas.cliente.ancho = 600;
  check("firma con medidas que no son las suyas → la hoja no vale", /medidas que dice/.test(limpiaHoja(mentira, { ahoraMs: AHORA }).errores.join(" ")));
  check("firma de verdad → vale", limpiaHoja(h, { ahoraMs: AHORA }).ok);
}

// ============================================================================
//  El Worker entero con D1 simulada
// ============================================================================
const CLAVE = "clave-del-titular-de-prueba";
let reloj = AHORA;
const telegram = [];
const hazFetch = async (url, op) => { telegram.push({ url, cuerpo: JSON.parse(op.body) }); return new Response('{"ok":true}', { status: 200 }); };
const manejador = crearManejador({ reloj: () => reloj, hazFetch });
const db = creaD1();
const env = { DB: db, ASSETS: creaAssets(), PANEL_CLAVE: CLAVE, TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "42" };
const BASE = "https://hojas.ejemplo.workers.dev";

async function pide(ruta, { metodo = "GET", cuerpo, cookie = "", ip = "1.1.1.1", cabeceras = {}, entorno = env } = {}) {
  const h = { "cf-connecting-ip": ip, "sec-fetch-site": "same-origin", ...cabeceras };
  if (cookie) h.cookie = cookie;
  if (cuerpo !== undefined) h["content-type"] = h["content-type"] || "application/json";
  const pendientes = [];
  const r = await manejador(new Request(BASE + ruta, { method: metodo, headers: h, body: cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) }), entorno, { waitUntil: (p) => pendientes.push(p) });
  await Promise.allSettled(pendientes);
  return r;
}
const cookieDe = (r) => (r.headers.get("set-cookie") || "").split(";")[0];
const jsonDe = async (r) => r.json();

console.log("\n🌐 Worker: páginas, cabeceras y app apagada");
{
  const sinClave = await pide("/api/yo", { entorno: { ...env, PANEL_CLAVE: "corta" } });
  check("sin PANEL_CLAVE (o corta) la API está apagada (503), nunca abierta", sinClave.status === 503 && (await jsonDe(sinClave)).apagada === true);
  const inicio = await pide("/");
  const html = await inicio.text();
  check("la app se sirve con el nombre de la marca de serie", inicio.status === 200 && html.includes("<title>Asesoría Castresana · Hojas firmadas</title>"));
  const csp = inicio.headers.get("content-security-policy");
  check("CSP sin nada en línea y sin marcos", csp.includes("script-src 'self'") && !csp.includes("unsafe-inline") && csp.includes("frame-ancestors 'none'"));
  check("noindex y nosniff", inicio.headers.get("x-robots-tag") === "noindex, nofollow" && inicio.headers.get("x-content-type-options") === "nosniff");
  const man = JSON.parse(await (await pide("/manifest.webmanifest")).text());
  check("el manifiesto sale de la marca", man.name === "Asesoría Castresana · Hojas firmadas" && man.theme_color === "#10203a" && man.icons.some((i) => i.purpose === "maskable"));
  const ico = await pide("/icono-512.png");
  check("icono de 512 px", ico.status === 200 && ico.headers.get("content-type") === "image/png");
  const logo = await pide("/marca/logo.jpg");
  check("logo de serie: el de Castresana", logo.status === 200 && Buffer.from(await logo.arrayBuffer()).equals(JPEG));
  const sw = await pide("/sw.js");
  check("service worker servido con alcance /", sw.status === 200 && sw.headers.get("service-worker-allowed") === "/");
  const swTexto = await sw.text();
  const lista = [...swTexto.matchAll(/'(\/static\/[^']+)'/g)].map((m) => m[1]);
  check("todos los archivos que cachea el service worker existen", lista.length > 10 && lista.every((p) => existsSync(new URL(`../cloudflare/hojas-firmadas/public${p}`, import.meta.url))), lista.filter((p) => !existsSync(new URL(`../cloudflare/hojas-firmadas/public${p}`, import.meta.url))).join(", "));
  check("el service worker nunca cachea /api/", /startsWith\('\/api\/'\)\) return/.test(swTexto));
  check("sin sesión, /api/hojas → 401", (await pide("/api/hojas")).status === 401);
  check("ruta /static con ../ no sale de public/", (await pide("/static/../src/index.js")).status === 404);
}

console.log("\n🚪 Worker: entrar, límites y sesión");
let cookieTitular;
{
  const mala = await pide("/api/entrar", { metodo: "POST", cuerpo: { clave: "mala" }, ip: "2.2.2.2" });
  check("clave mala → 401", mala.status === 401);
  const deFuera = await pide("/api/entrar", { metodo: "POST", cuerpo: { clave: CLAVE }, cabeceras: { "sec-fetch-site": "cross-site" } });
  check("entrar desde otra web → 403", deFuera.status === 403);
  const formulario = await pide("/api/entrar", { metodo: "POST", cuerpo: `clave=${CLAVE}`, cabeceras: { "content-type": "application/x-www-form-urlencoded" } });
  check("entrar con un formulario (no JSON) → 415", formulario.status === 415);
  const buena = await pide("/api/entrar", { metodo: "POST", cuerpo: { clave: CLAVE } });
  cookieTitular = cookieDe(buena);
  check("clave buena → cookie __Host-sesion HttpOnly Secure SameSite=Strict", buena.status === 200 && cookieTitular.startsWith("__Host-sesion=v1.") && /HttpOnly; Secure; SameSite=Strict/.test(buena.headers.get("set-cookie")));
  const yo = await jsonDe(await pide("/api/yo", { cookie: cookieTitular }));
  check("/api/yo: titular con la marca, los textos y avisos de lo pendiente", yo.agente.titular === true && yo.agente.nombre === "Pau Moralejo" && yo.marca.nombreComercial === "Asesoría Castresana" && yo.avisos.some((a) => /BORRADOR/.test(a)));
  // 40 claves a la vez desde la misma IP: como mucho se comparan 5.
  const a40 = await Promise.all(Array.from({ length: 40 }, () => pide("/api/entrar", { metodo: "POST", cuerpo: { clave: "intento" }, ip: "3.3.3.3" })));
  const comparadas = a40.filter((r) => r.status === 401).length;
  check("40 intentos a la vez desde una IP: como mucho 5 se comparan, el resto 429", comparadas <= 5 && a40.filter((r) => r.status === 429).length >= 35, `${comparadas} comparadas`);
  const bloqueada = await pide("/api/entrar", { metodo: "POST", cuerpo: { clave: CLAVE }, ip: "3.3.3.3" });
  check("bloqueada, ni con la clave buena (hay que esperar 15 min)", bloqueada.status === 429);
  reloj += 16 * 60_000;
  check("a los 15 minutos vuelve a dejar", (await pide("/api/entrar", { metodo: "POST", cuerpo: { clave: CLAVE }, ip: "3.3.3.3" })).status === 200);
  const filasLim = db._base.prepare("SELECT clave FROM limites").all();
  check("los límites guardan la IP resumida, nunca en claro", filasLim.length > 0 && filasLim.every((f) => !/\d+\.\d+\.\d+\.\d+/.test(f.clave)));
  const trucada = cookieTitular.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  check("cookie trucada → 401", (await pide("/api/yo", { cookie: trucada })).status === 401);
  check("con otra PANEL_CLAVE la sesión deja de valer", (await pide("/api/yo", { cookie: cookieTitular, entorno: { ...env, PANEL_CLAVE: "otra-clave-del-titular" } })).status === 401);
  const salir = await pide("/api/salir", { metodo: "POST", cuerpo: {}, cookie: cookieTitular });
  check("salir borra la cookie", /Max-Age=0/.test(salir.headers.get("set-cookie") || ""));
  check("y la cierra EN EL SERVIDOR: la cookie copiada ya no vale", (await pide("/api/yo", { cookie: cookieTitular })).status === 401);
  cookieTitular = cookieDe(await pide("/api/entrar", { metodo: "POST", cuerpo: { clave: CLAVE }, ip: "7.7.7.7" }));
  check("al volver a entrar, la sesión nueva sí vale", (await pide("/api/yo", { cookie: cookieTitular })).status === 200);
  const yoSin = await jsonDe(await pide("/api/yo", { cookie: cookieTitular, entorno: { ...env, TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" } }));
  check("aviso de Telegram en palabras de Pau, sin nombres de secretos", yoSin.avisos.includes("Avisos por Telegram: sin configurar (opcional).") && !JSON.stringify(yoSin.avisos).includes("TELEGRAM_"));
  check("aviso de razón social y CIF [PENDIENTE] en /api/yo", yoSin.avisos.some((a) => /razón social y el CIF siguen como \[PENDIENTE\]/.test(a)));
}

console.log("\n⬆️  Worker: subir hojas (idempotente) e inmutabilidad");
let hojaSubida, hashSubida;
{
  hojaSubida = hojaVisita();
  hashSubida = await hashHoja(hojaSubida);
  telegram.length = 0;
  const r1 = await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: hojaSubida, hash: hashSubida }, cookie: cookieTitular, ip: "9.9.9.9" });
  const j1 = await jsonDe(r1);
  check("subida nueva → 201 con el sello de tiempo del servidor", r1.status === 201 && j1.recibida === new Date(reloj).toISOString() && j1.hash === hashSubida);
  const fila = db._base.prepare("SELECT * FROM hojas WHERE id = ?").get(hojaSubida.id);
  check("en D1: contenido canónico, SHA-256, IP en HMAC y firmas en base64", fila.contenido === canonico(hojaSubida) && fila.hash === hashSubida && fila.ip.length === 32 && fila.ip !== "9.9.9.9" && fila.contenido.includes("data:image/jpeg;base64,/9j/"));
  check("Telegram: un aviso con datos mínimos", telegram.length === 1 && telegram[0].cuerpo.text.includes("Ana") && !telegram[0].cuerpo.text.includes("García") && !telegram[0].cuerpo.text.includes("600"));
  const r2 = await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: hojaSubida, hash: hashSubida }, cookie: cookieTitular });
  const j2 = await jsonDe(r2);
  check("la misma hoja otra vez (la cola reintenta) → 200 repetida, sin duplicar", r2.status === 200 && j2.repetida === true && j2.recibida === j1.recibida);
  const otra = hojaVisita();
  const hOtra = await hashHoja(otra);
  const paralelo = await Promise.all(Array.from({ length: 6 }, () => pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: otra, hash: hOtra }, cookie: cookieTitular })));
  check("6 subidas a la vez de la misma hoja → 1 nueva y 5 repetidas", paralelo.filter((r) => r.status === 201).length === 1 && paralelo.filter((r) => r.status === 200).length === 5);
  check("y una sola fila en D1", db._base.prepare("SELECT COUNT(*) AS n FROM hojas WHERE id = ?").get(otra.id).n === 1);
  check("Telegram avisa una sola vez por hoja", telegram.length === 2);
  const distinta = structuredClone(hojaSubida); distinta.datos.observaciones = "Otra cosa.";
  const r3 = await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: distinta, hash: await hashHoja(distinta) }, cookie: cookieTitular });
  check("mismo id con otro contenido → 409 (no se sobrescribe)", r3.status === 409);
  const r4 = await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: distinta, hash: hashSubida }, cookie: cookieTitular });
  check("contenido cambiado después de firmar (el hash ya no cuadra) → 422", r4.status === 422 && /SHA-256/.test((await jsonDe(r4)).error));
  const r5 = await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: { ...hojaVisita(), colado: 1 }, hash: hashSubida }, cookie: cookieTitular });
  check("hoja con datos de más → 422", r5.status === 422);
  check("subir sin sesión → 401", (await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: hojaSubida, hash: hashSubida } })).status === 401);
  const tras = db._base.prepare("SELECT contenido, hash FROM hojas WHERE id = ?").get(hojaSubida.id);
  check("la hoja guardada no ha cambiado tras los intentos", tras.contenido === canonico(hojaSubida) && tras.hash === hashSubida);
  let bloqueoBd = "";
  try { db._base.prepare("UPDATE hojas SET contenido = '{}' WHERE id = ?").run(hojaSubida.id); } catch (e) { bloqueoBd = e.message; }
  check("INMUTABLE también en la base de datos: un UPDATE del contenido falla (trigger)", /no se puede modificar/.test(bloqueoBd), bloqueoBd);
  let bloqueoNombre = "";
  try { db._base.prepare("UPDATE hojas SET nombre = 'Otro' WHERE id = ?").run(hojaSubida.id); } catch (e) { bloqueoNombre = e.message; }
  check("…ni el nombre", /no se puede modificar/.test(bloqueoNombre));
  const det = await jsonDe(await pide(`/api/hojas/${hojaSubida.id}`, { cookie: cookieTitular }));
  check("detalle: la hoja tal cual se firmó y su registro", canonico(det.hoja) === canonico(hojaSubida) && det.registro.hash === hashSubida && det.registro.estado === "firmada");
  const viejo = LIMITE.subidasPorHora;
  LIMITE.subidasPorHora = 3;
  reloj += 3600_000;
  const lim = [];
  for (let i = 0; i < 4; i++) lim.push((await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: hojaSubida, hash: hashSubida }, cookie: cookieTitular })).status);
  LIMITE.subidasPorHora = viejo;
  check("límite de subidas por agente y hora → 429", lim.join(",") === "200,200,200,429", lim.join(","));
  const grande = await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: "x".repeat(LIMITE.cuerpoHoja + 10) }, cookie: cookieTitular });
  check("cuerpo demasiado grande → 413", grande.status === 413);
}

console.log("\n🔎 Worker: lista, filtros y CSV");
{
  reloj += 3600_000;
  const cap = hojaCaptacion({ propNombre: "=HYPERLINK(\"http://malo\")", referencia: "PIS0777" });
  // La captación se firma ahora (dentro del margen de 90 días del reloj del Worker).
  await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: cap, hash: await hashHoja(cap) }, cookie: cookieTitular });
  const todas = await jsonDe(await pide("/api/hojas", { cookie: cookieTitular }));
  check("lista: 3 hojas, sin contenido ni firmas", todas.hojas.length === 3 && todas.total === 3 && !JSON.stringify(todas).includes("base64"));
  const vis = await jsonDe(await pide("/api/hojas?tipo=visita", { cookie: cookieTitular }));
  check("filtro por tipo", vis.hojas.length === 2 && vis.hojas.every((h) => h.tipo === "visita"));
  const porRef = await jsonDe(await pide("/api/hojas?ref=pis0777", { cookie: cookieTitular }));
  check("filtro por referencia (sin distinguir mayúsculas)", porRef.hojas.length === 1 && porRef.hojas[0].referencia === "PIS0777");
  const porNombre = await jsonDe(await pide(`/api/hojas?nombre=${encodeURIComponent("GARCIA")}`, { cookie: cookieTitular }));
  check("filtro por nombre sin tildes ni mayúsculas", porNombre.hojas.length === 2);
  const comodin = await jsonDe(await pide(`/api/hojas?nombre=${encodeURIComponent("%")}`, { cookie: cookieTitular }));
  check("un % en la búsqueda se busca tal cual (no es comodín)", comodin.hojas.length === 0);
  check("filtro por fechas (día de Madrid)", (await jsonDe(await pide("/api/hojas?desde=2026-10-13&hasta=2026-10-13", { cookie: cookieTitular }))).hojas.length === 3
    && (await jsonDe(await pide("/api/hojas?desde=2026-10-14", { cookie: cookieTitular }))).hojas.length === 0);
  const csv = await pide("/api/exportar", { cookie: cookieTitular });
  const bytes = Buffer.from(await csv.arrayBuffer());
  const t = bytes.toString("utf8"); // Response.text() se come el BOM: se mira en los bytes
  check("CSV: descarga con BOM, «;» y cabecera en español", csv.headers.get("content-disposition").includes("hojas-firmadas-2026-10-13.csv") && bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) && t.startsWith("\uFEFFTipo;Estado;") && t.includes("DNI / NIE;Teléfono;Correo"));
  check("CSV: datos de contacto sacados del JSON y sin firmas", t.includes("12345678Z") && t.includes("600 11 22 33") && !t.includes("base64"));
  check("CSV: fórmula del nombre neutralizada", t.includes("'=HYPERLINK"));
}

console.log("\n🛑 Worker: anular");
{
  const corto = await pide(`/api/hojas/${hojaSubida.id}/anular`, { metodo: "POST", cuerpo: { motivo: "no" }, cookie: cookieTitular });
  check("anular sin motivo → 422", corto.status === 422);
  const ok = await pide(`/api/hojas/${hojaSubida.id}/anular`, { metodo: "POST", cuerpo: { motivo: "El visitante dio mal el teléfono" }, cookie: cookieTitular });
  check("anular con motivo → 200", ok.status === 200);
  const fila = db._base.prepare("SELECT * FROM hojas WHERE id = ?").get(hojaSubida.id);
  check("anulada: estado, fecha, motivo y quién; lo firmado sigue igual", fila.estado === "anulada" && fila.motivo === "El visitante dio mal el teléfono" && fila.anulada_por === "Pau Moralejo" && fila.contenido === canonico(hojaSubida) && fila.hash === hashSubida);
  check("queda constancia en el registro", db._base.prepare("SELECT COUNT(*) AS n FROM registro WHERE hoja = ? AND accion = 'anulada'").get(hojaSubida.id).n === 1);
  check("anular otra vez → 409", (await pide(`/api/hojas/${hojaSubida.id}/anular`, { metodo: "POST", cuerpo: { motivo: "Otra vez lo mismo" }, cookie: cookieTitular })).status === 409);
  let desanular = "";
  try { db._base.prepare("UPDATE hojas SET estado = 'firmada' WHERE id = ?").run(hojaSubida.id); } catch (e) { desanular = e.message; }
  check("una anulada no se puede «desanular» ni en la base de datos", /no se puede modificar/.test(desanular));
  const repetida = await jsonDe(await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: hojaSubida, hash: hashSubida }, cookie: cookieTitular }));
  check("si la cola la vuelve a subir, sigue anulada", repetida.repetida === true && repetida.estado === "anulada");
}

console.log("\n🧹 Worker: borrar datos (supresión)");
{
  const sinConfirmar = await pide(`/api/hojas/${hojaSubida.id}/borrar`, { metodo: "POST", cuerpo: {}, cookie: cookieTitular });
  check("sin escribir BORRAR → 422", sinConfirmar.status === 422);
  const ok = await pide(`/api/hojas/${hojaSubida.id}/borrar`, { metodo: "POST", cuerpo: { confirmacion: "BORRAR" }, cookie: cookieTitular });
  check("con confirmación → 200", ok.status === 200);
  check("ya no está la hoja (datos ni firmas)", !db._base.prepare("SELECT 1 FROM hojas WHERE id = ?").get(hojaSubida.id) && (await pide(`/api/hojas/${hojaSubida.id}`, { cookie: cookieTitular })).status === 404);
  const reg = db._base.prepare("SELECT * FROM registro WHERE hoja = ?").all(hojaSubida.id);
  check("en el registro queda solo «borrada» (sin datos de la persona ni el motivo de la anulación)", reg.length === 1 && reg[0].accion === "borrada" && reg[0].tipo === "visita" && !JSON.stringify(reg).match(/Ana|teléfono|600/));
  const otraVez = await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: hojaSubida, hash: hashSubida }, cookie: cookieTitular });
  check("una cola vieja no la puede volver a subir → 410", otraVez.status === 410);
  check("y el CSV ya no la lleva", !(await (await pide("/api/exportar", { cookie: cookieTitular })).text()).includes(hojaSubida.id));
}

console.log("\n👥 Worker: agentes");
{
  const mal = await pide("/api/agentes", { metodo: "POST", cuerpo: { nombre: "A", usuario: "Ña", clave: "corta" }, cookie: cookieTitular });
  check("agente con datos malos → 422 con los tres errores", mal.status === 422 && (await jsonDe(mal)).errores.length === 3);
  const alta = await jsonDe(await pide("/api/agentes", { metodo: "POST", cuerpo: { nombre: "Marta Ruiz", usuario: "marta", clave: "marta clave larga 1" }, cookie: cookieTitular }));
  check("alta de agente", alta.ok && alta.id > 0);
  check("usuario repetido → 409", (await pide("/api/agentes", { metodo: "POST", cuerpo: { nombre: "Otra", usuario: "MARTA", clave: "otra clave larga" }, cookie: cookieTitular })).status === 409);
  const fila = db._base.prepare("SELECT * FROM agentes WHERE id = ?").get(alta.id);
  check("su clave no se guarda en claro (PBKDF2 con 100.000 vueltas)", !JSON.stringify(fila).includes("marta clave") && fila.iteraciones === 100000);
  const malaClave = await pide("/api/entrar", { metodo: "POST", cuerpo: { usuario: "marta", clave: "no es" }, ip: "5.5.5.5" });
  const noExiste = await pide("/api/entrar", { metodo: "POST", cuerpo: { usuario: "nadie", clave: "no es" }, ip: "5.5.5.5" });
  check("usuario o clave mal → el mismo mensaje (no dice qué usuarios existen)", malaClave.status === 401 && noExiste.status === 401 && (await jsonDe(malaClave)).error === (await jsonDe(noExiste)).error);
  const entra = await pide("/api/entrar", { metodo: "POST", cuerpo: { usuario: "Marta", clave: "marta clave larga 1" }, ip: "5.5.5.5" });
  const cookieMarta = cookieDe(entra);
  const yo = await jsonDe(await pide("/api/yo", { cookie: cookieMarta }));
  check("el agente entra con su usuario y su nombre sale en la sesión", entra.status === 200 && yo.agente.nombre === "Marta Ruiz" && yo.agente.titular === false && yo.avisos.length === 0);
  const suya = hojaVisita({ sobre: { agente: { id: alta.id, nombre: "Marta Ruiz" } } });
  check("sube sus hojas", (await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: suya, hash: await hashHoja(suya) }, cookie: cookieMarta })).status === 201);
  const ajena = hojaVisita();
  check("no puede subir hojas firmadas por otro agente → 403", (await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: ajena, hash: await hashHoja(ajena) }, cookie: cookieMarta })).status === 403);
  check("no puede anular, borrar, exportar ni tocar la marca → 403",
    (await pide(`/api/hojas/${suya.id}/anular`, { metodo: "POST", cuerpo: { motivo: "Porque sí, de prueba" }, cookie: cookieMarta })).status === 403
    && (await pide(`/api/hojas/${suya.id}/borrar`, { metodo: "POST", cuerpo: { confirmacion: "BORRAR" }, cookie: cookieMarta })).status === 403
    && (await pide("/api/exportar", { cookie: cookieMarta })).status === 403
    && (await pide("/api/ajustes/marca", { metodo: "POST", cuerpo: { marca: MARCA_DEFECTO }, cookie: cookieMarta })).status === 403
    && (await pide("/api/agentes", { cookie: cookieMarta })).status === 403);
  check("cambiar su clave cierra su sesión", (await pide(`/api/agentes/${alta.id}/clave`, { metodo: "POST", cuerpo: { clave: "clave nueva de marta" }, cookie: cookieTitular })).status === 200
    && (await pide("/api/yo", { cookie: cookieMarta })).status === 401);
  const entra2 = cookieDe(await pide("/api/entrar", { metodo: "POST", cuerpo: { usuario: "marta", clave: "clave nueva de marta" }, ip: "6.6.6.6" }));
  check("con la clave nueva entra", (await pide("/api/yo", { cookie: entra2 })).status === 200);
  check("baja: se cierra su sesión y no puede entrar", (await pide(`/api/agentes/${alta.id}/baja`, { metodo: "POST", cuerpo: {}, cookie: cookieTitular })).status === 200
    && (await pide("/api/yo", { cookie: entra2 })).status === 401
    && (await pide("/api/entrar", { metodo: "POST", cuerpo: { usuario: "marta", clave: "clave nueva de marta" }, ip: "6.6.6.6" })).status === 401);
  check("sus hojas se conservan con su nombre", db._base.prepare("SELECT agente FROM hojas WHERE id = ?").get(suya.id).agente === "Marta Ruiz");
}

console.log("\n🏷️  Worker: marca, textos y logo desde Ajustes");
{
  const mala = await pide("/api/ajustes/marca", { metodo: "POST", cuerpo: { marca: { ...MARCA_DEFECTO, colorPrincipal: "azul" } }, cookie: cookieTitular });
  check("color mal → 422", mala.status === 422);
  const nueva = { ...MARCA_DEFECTO, nombreComercial: "Pisos Norte", encabezadoFirmas: "PISOS NORTE GESTION SL", colorPrincipal: "#0b5d1e", titular: "Laura Prieto" };
  check("guardar la marca → 200", (await pide("/api/ajustes/marca", { metodo: "POST", cuerpo: { marca: nueva }, cookie: cookieTitular })).status === 200);
  check("el título de la app y el manifiesto cambian", (await (await pide("/")).text()).includes("<title>Pisos Norte · Hojas firmadas</title>")
    && JSON.parse(await (await pide("/manifest.webmanifest")).text()).theme_color === "#0b5d1e");
  check("el titular sale con el nombre nuevo", (await jsonDe(await pide("/api/yo", { cookie: cookieTitular }))).agente.nombre === "Laura Prieto");
  const tx = await jsonDe(await pide("/api/ajustes/textos", { metodo: "POST", cuerpo: { textos: { rgpdVisita: "Responsable: Pisos Norte Gestion SL, B00000000." } }, cookie: cookieTitular }));
  check("guardar textos", tx.ok && tx.textos.rgpdVisita.startsWith("Responsable: Pisos Norte"));
  check("«revisados» con corchetes en la captación → 422", (await pide("/api/ajustes/revisados", { metodo: "POST", cuerpo: { grupo: "captacion", valor: true }, cookie: cookieTitular })).status === 422);
  check("«revisados» en la visita (ya sin corchetes) → 200", (await jsonDe(await pide("/api/ajustes/revisados", { metodo: "POST", cuerpo: { grupo: "visita", valor: true }, cookie: cookieTitular }))).textos.visitaRevisados === true);
  check("volver al borrador → vuelve a ser BORRADOR", (await jsonDe(await pide("/api/ajustes/borrador", { metodo: "POST", cuerpo: { grupo: "visita" }, cookie: cookieTitular }))).textos.visitaRevisados === false);
  const subeLogo = await pide("/api/ajustes/logo", { metodo: "POST", cuerpo: { dataUrl: FIRMA.dataUrl, ancho: 500, alto: 201 }, cookie: cookieTitular });
  check("subir logo propio", subeLogo.status === 200 && (await jsonDe(subeLogo)).logo.modo === "propio");
  check("el logo propio se sirve desde D1", Buffer.from(await (await pide("/marca/logo.jpg")).arrayBuffer()).equals(JPEG));
  check("un logo que no es JPEG → 422", (await pide("/api/ajustes/logo", { metodo: "POST", cuerpo: { dataUrl: "data:image/jpeg;base64,iVBORw0KGgo=", ancho: 50, alto: 50 }, cookie: cookieTitular })).status === 422);
  await pide("/api/ajustes/logo", { metodo: "POST", cuerpo: { quitar: true }, cookie: cookieTitular });
  check("quitar el logo: 404 y la app no pinta la imagen", (await pide("/marca/logo.jpg")).status === 404 && !(await (await pide("/")).text()).includes("/marca/logo.jpg"));
  await pide("/api/ajustes/logo", { metodo: "POST", cuerpo: { defecto: true }, cookie: cookieTitular });
  check("volver al logo de serie", (await pide("/marca/logo.jpg")).status === 200);
  const reg = await jsonDe(await pide("/api/registro", { cookie: cookieTitular }));
  check("registro visible para el titular", reg.registro.length >= 1);
}

console.log("\n🕵️  Worker: el servidor no se cree lo que dice el móvil");
let cookieAna, idAna;
{
  // Todo esto con la marca y los textos de Ajustes de AHORA (Pisos Norte, tras el bloque anterior).
  const yo = await jsonDe(await pide("/api/yo", { cookie: cookieTitular }));
  const marcaAhora = yo.marca;
  const hoja = (sobre = {}) => hojaVisita({ ahoraMs: reloj, sobre: { marca: marcaAhora, textos: textosDeHoja(yo.textos, "visita"), firmadaEn: new Date(reloj - 60_000).toISOString(), ...sobre } });
  const sube = async (h, cookie) => pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: h, hash: await hashHoja(h) }, cookie });
  idAna = (await jsonDe(await pide("/api/agentes", { metodo: "POST", cuerpo: { nombre: "Ana Agente", usuario: "ana", clave: "clave de ana larga" }, cookie: cookieTitular }))).id;
  cookieAna = cookieDe(await pide("/api/entrar", { metodo: "POST", cuerpo: { usuario: "ana", clave: "clave de ana larga" }, ip: "8.8.8.8" }));
  const suplanta = await sube(hoja({ agente: { id: idAna, nombre: "Laura Prieto" } }), cookieAna);
  check("un agente no puede firmar con el nombre de otro (aunque el id sea el suyo) → 403", suplanta.status === 403 && /nombre/.test((await jsonDe(suplanta)).error));
  const buena = hoja({ agente: { id: idAna, nombre: "Ana Agente" } });
  const rBuena = await sube(buena, cookieAna);
  const jBuena = await jsonDe(rBuena);
  check("con su id y su nombre sí → 201, con textos y marca al día", rBuena.status === 201 && jBuena.textosAlDia === true && jBuena.marcaAlDia === true);
  check("el titular no puede subir hojas de un agente que no existe → 422", (await sube(hoja({ agente: { id: 999, nombre: "Fantasma" } }), cookieTitular)).status === 422);
  check("ni de un agente que existe con otro nombre → 422", (await sube(hoja({ agente: { id: idAna, nombre: "Otro Nombre" } }), cookieTitular)).status === 422);
  check("pero sí las de un agente que existe, con su nombre → 201", (await sube(hoja({ agente: { id: idAna, nombre: "Ana Agente" } }), cookieTitular)).status === 201);
  // «Revisados» falsos: los textos de Ajustes son BORRADOR.
  const falsa = hoja({ agente: { id: idAna, nombre: "Ana Agente" }, textos: { declaracion: "Declaro lo que el agente quiera {visitante}", rgpd: "Nada.", revisados: true } });
  const rFalsa = await sube(falsa, cookieAna);
  check("textos inventados con «revisados: true» (Ajustes no los tiene revisados) → 422", rFalsa.status === 422 && /revisados/.test((await jsonDe(rFalsa)).error));
  const borradorRevisado = hoja({ agente: { id: idAna, nombre: "Ana Agente" }, textos: { ...textosDeHoja(yo.textos, "visita"), revisados: true } });
  check("los mismos textos de Ajustes pero con «revisados: true» cuando no lo están → 422", (await sube(borradorRevisado, cookieAna)).status === 422);
  // Marca distinta: se acepta, pero queda marcada y se enseña.
  const otraMarca = hoja({ agente: { id: idAna, nombre: "Ana Agente" }, marca: { ...marcaAhora, cif: "B12345678", razonSocial: "Inventada SL" } });
  const rMarca = await jsonDe(await sube(otraMarca, cookieAna));
  check("marca distinta de la de Ajustes: se acepta pero marcada como diferente", rMarca.ok && rMarca.marcaAlDia === false && rMarca.textosAlDia === true);
  const det = await jsonDe(await pide(`/api/hojas/${otraMarca.id}`, { cookie: cookieTitular }));
  check("el detalle lo enseña (marcaAlDia: false)", det.registro.marcaAlDia === false && det.registro.textosAlDia === true);
  const csv = Buffer.from(await (await pide("/api/exportar", { cookie: cookieTitular })).arrayBuffer()).toString("utf8");
  const filaCsv = csv.split("\r\n").find((l) => l.includes(otraMarca.id)) || csv.split("\n").find((l) => l.includes(otraMarca.id)) || "";
  check("el CSV tiene las columnas de textos y marca y la hoja sale con «Sí;No»", csv.includes("Textos legales iguales que en Ajustes al subirla;Marca igual que en Ajustes al subirla") && filaCsv.includes(";Sí;No;"), filaCsv.slice(0, 200));
  check("las columnas calculadas también son inmutables en D1", (() => { try { db._base.prepare("UPDATE hojas SET marca_al_dia = 1 WHERE id = ?").run(otraMarca.id); return false; } catch (e) { return /no se puede modificar/.test(e.message); } })());

  // Firmada SIN CONEXIÓN con textos revisados y, antes de subirla, el titular cambia los textos.
  const textosRev = { declaracion: "D./D.ª {visitante} declara que ha visitado {inmueble} con {agente}, de {empresa}.", rgpdVisita: "Responsable: Pisos Norte Gestion SL, B00000000, Calle Mayor 1, Gijón." };
  await pide("/api/ajustes/textos", { metodo: "POST", cuerpo: { textos: textosRev }, cookie: cookieTitular });
  const rRev = await jsonDe(await pide("/api/ajustes/revisados", { metodo: "POST", cuerpo: { grupo: "visita", valor: true }, cookie: cookieTitular }));
  check("textos de la visita revisados en Ajustes", rRev.textos.visitaRevisados === true);
  const sinRed = hoja({ agente: { id: idAna, nombre: "Ana Agente" }, textos: textosDeHoja(rRev.textos, "visita") });
  check("con los textos revisados de Ajustes, «revisados: true» vale", sinRed.textos.revisados === true);
  const cambio = await jsonDe(await pide("/api/ajustes/textos", { metodo: "POST", cuerpo: { textos: { declaracion: textosRev.declaracion + " Texto nuevo." } }, cookie: cookieTitular }));
  check("el titular cambia los textos: vuelven a ser BORRADOR", cambio.textos.visitaRevisados === false);
  const rSinRed = await sube(sinRed, cookieAna);
  const jSinRed = await jsonDe(rSinRed);
  check("la hoja firmada sin conexión ANTES del cambio no se queda atascada → 201", rSinRed.status === 201, JSON.stringify(jSinRed));
  check("…y queda marcada con textos distintos de los de Ajustes", jSinRed.textosAlDia === false && db._base.prepare("SELECT textos_al_dia FROM hojas WHERE id = ?").get(sinRed.id).textos_al_dia === 0);
  const inventada = hoja({ agente: { id: idAna, nombre: "Ana Agente" }, textos: { ...textosDeHoja(rRev.textos, "visita"), declaracion: "Otra versión que nadie revisó {visitante}." } });
  check("pero unos textos que NUNCA se marcaron revisados siguen sin valer → 422", (await sube(inventada, cookieAna)).status === 422);
  const vieja = hoja({ agente: { id: idAna, nombre: "Ana Agente" }, textos: { declaracion: TEXTOS_DEFECTO.declaracion, rgpd: TEXTOS_DEFECTO.rgpdVisita, revisados: false } });
  const rVieja = await jsonDe(await sube(vieja, cookieAna));
  check("una hoja BORRADOR firmada con los textos de antes también entra (marcada como distinta)", rVieja.ok && rVieja.textosAlDia === false);
  // El titular cambia su nombre después de firmar sin conexión: su hoja tampoco se atasca.
  const delTitular = hoja({ agente: { id: 0, nombre: "Laura Prieto" } });
  await pide("/api/ajustes/marca", { metodo: "POST", cuerpo: { marca: { ...marcaAhora, titular: "Laura Prieto Díaz" } }, cookie: cookieTitular });
  const rTit = await jsonDe(await sube(delTitular, cookieTitular));
  check("hoja del titular firmada antes de cambiar su nombre → se acepta, con la marca marcada como distinta", rTit.ok && rTit.marcaAlDia === false);
}

console.log("\n👀 Worker: lo que ven los agentes");
{
  const deOtro = db._base.prepare("SELECT id FROM hojas WHERE agente_id <> ? LIMIT 1").get(idAna).id;
  const listaAna = await jsonDe(await pide("/api/hojas", { cookie: cookieAna }));
  check("por defecto un agente solo ve sus hojas en la lista", listaAna.hojas.length > 0 && listaAna.hojas.every((h) => h.agente === "Ana Agente") && listaAna.soloSuyas === true && listaAna.total === listaAna.hojas.length);
  check("y no puede abrir la de otro (403)", (await pide(`/api/hojas/${deOtro}`, { cookie: cookieAna })).status === 403);
  check("el agente no puede cambiar ese ajuste (403)", (await pide("/api/ajustes/permisos", { metodo: "POST", cuerpo: { agentesSoloSuyas: false }, cookie: cookieAna })).status === 403);
  check("el titular sí: «los agentes ven todas»", (await jsonDe(await pide("/api/ajustes/permisos", { metodo: "POST", cuerpo: { agentesSoloSuyas: false }, cookie: cookieTitular }))).permisos.agentesSoloSuyas === false);
  const todas = await jsonDe(await pide("/api/hojas", { cookie: cookieAna }));
  check("entonces el agente ve todas y puede abrir la de otro", todas.soloSuyas === false && todas.hojas.some((h) => h.agente !== "Ana Agente") && (await pide(`/api/hojas/${deOtro}`, { cookie: cookieAna })).status === 200);
  check("un valor que no es sí/no → 422", (await pide("/api/ajustes/permisos", { metodo: "POST", cuerpo: { agentesSoloSuyas: "no" }, cookie: cookieTitular })).status === 422);
  await pide("/api/ajustes/permisos", { metodo: "POST", cuerpo: { agentesSoloSuyas: true }, cookie: cookieTitular });
  check("se vuelve a encender y /api/yo lo dice", (await jsonDe(await pide("/api/yo", { cookie: cookieTitular }))).permisos.agentesSoloSuyas === true);
}

console.log("\n🏷️  Worker: avisos de marca para otra inmobiliaria");
{
  const yo = await jsonDe(await pide("/api/yo", { cookie: cookieTitular }));
  await pide("/api/ajustes/marca", { metodo: "POST", cuerpo: { marca: { ...yo.marca, encabezadoFirmas: "ASESORIA CASTRESANA INMO" } }, cookie: cookieTitular });
  const av = (await jsonDe(await pide("/api/yo", { cookie: cookieTitular }))).avisos.join(" | ");
  check("Pisos Norte con el logo de serie y «CASTRESANA» en el encabezado: dos avisos", /logo de serie/.test(av) && /Castresana».*encabezado de firmas/.test(av), av);
  await pide("/api/ajustes/marca", { metodo: "POST", cuerpo: { marca: { ...yo.marca, encabezadoFirmas: "PISOS NORTE GESTION SL", razonSocial: "Pisos Norte Gestion SL", cif: "B00000000" } }, cookie: cookieTitular });
  await pide("/api/ajustes/logo", { metodo: "POST", cuerpo: { quitar: true }, cookie: cookieTitular });
  const av2 = (await jsonDe(await pide("/api/yo", { cookie: cookieTitular }))).avisos.join(" | ");
  check("con su encabezado, sus datos y sin el logo de serie: sin avisos de marca", !/logo de serie|Castresana|PENDIENTE/.test(av2), av2);
  check("un agente no recibe avisos de marca", (await jsonDe(await pide("/api/yo", { cookie: cookieAna }))).avisos.length === 0);
}

console.log("\n🔒 Worker: anular de golpe, borrar con constancia y salir de verdad");
{
  const h = hojaVisita({ ahoraMs: reloj, sobre: { marca: (await jsonDe(await pide("/api/yo", { cookie: cookieTitular }))).marca, agente: { id: 0, nombre: "Laura" }, firmadaEn: new Date(reloj - 60_000).toISOString() } });
  check("hoja para anular subida", (await pide("/api/hojas", { metodo: "POST", cuerpo: { hoja: h, hash: await hashHoja(h) }, cookie: cookieTitular })).status === 201);
  // Si el INSERT en el registro falla, el UPDATE tampoco se queda (un solo batch).
  db._base.exec("CREATE TRIGGER prueba_falla BEFORE INSERT ON registro BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END;");
  const fallo = await pide(`/api/hojas/${h.id}/anular`, { metodo: "POST", cuerpo: { motivo: "Motivo de la prueba de fallo" }, cookie: cookieTitular });
  db._base.exec("DROP TRIGGER prueba_falla");
  check("si falla el registro, la hoja NO queda anulada (UPDATE e INSERT en el mismo batch)", fallo.status === 500 && db._base.prepare("SELECT estado FROM hojas WHERE id = ?").get(h.id).estado === "firmada");
  check("anular con el registro bien → 200 y una sola línea", (await pide(`/api/hojas/${h.id}/anular`, { metodo: "POST", cuerpo: { motivo: "Motivo de verdad" }, cookie: cookieTitular })).status === 200
    && db._base.prepare("SELECT COUNT(*) AS n FROM registro WHERE hoja = ? AND accion = 'anulada'").get(h.id).n === 1);
  check("anular otra vez no escribe otra línea", (await pide(`/api/hojas/${h.id}/anular`, { metodo: "POST", cuerpo: { motivo: "Otra vez lo mismo" }, cookie: cookieTitular })).status === 409
    && db._base.prepare("SELECT COUNT(*) AS n FROM registro WHERE hoja = ? AND accion = 'anulada'").get(h.id).n === 1);
  let sinConstancia = "";
  try { db._base.prepare("DELETE FROM hojas WHERE id = ?").run(h.id); } catch (e) { sinConstancia = e.message; }
  check("un DELETE directo en D1 sin «borrada» en el registro falla (trigger)", /solo se borra dejando constancia/.test(sinConstancia), sinConstancia);
  check("«Borrar datos» desde la app sí (el registro va antes que el DELETE)", (await pide(`/api/hojas/${h.id}/borrar`, { metodo: "POST", cuerpo: { confirmacion: "BORRAR" }, cookie: cookieTitular })).status === 200
    && !db._base.prepare("SELECT 1 FROM hojas WHERE id = ?").get(h.id));
  // Salir de un agente: su cookie deja de valer en el servidor.
  check("el agente sale y su cookie ya no vale", (await pide("/api/salir", { metodo: "POST", cuerpo: {}, cookie: cookieAna })).status === 200 && (await pide("/api/yo", { cookie: cookieAna })).status === 401);
}

console.log(`\nResultado hojas-firmadas: ${pasados} pasados, ${fallados} fallados.`);
if (fallados) process.exit(1);
