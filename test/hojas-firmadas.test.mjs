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
  bytesDeBase64, MAX_FIRMA_BYTES, VERSION_HOJA, CAMPOS_CAPTACION, nombreDePila,
} from "../cloudflare/hojas-firmadas/public/static/nucleo/hoja.js";
import {
  MARCA_DEFECTO, TEXTOS_DEFECTO, validaMarca, marcaCompleta, textosCompletos, cambiaTextos, marcaRevisados, textoSobre, contraste,
  coloresInterfaz, lineaLegal, pendientesMarca, AVISO_SUPRESION,
} from "../cloudflare/hojas-firmadas/public/static/nucleo/marca.js";
import { pdfDeHoja, textoPieHoja, nombrePdf } from "../cloudflare/hojas-firmadas/public/static/nucleo/pdf-hoja.js";
import { decideTrasSubida } from "../cloudflare/hojas-firmadas/public/static/app/cola.js";
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
  }, { ahoraMs: AHORA });
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
  check("usa el color principal configurado y no el azul de Castresana", pdf.includes("0.043 0.365 0.118 rg") && !pdf.includes("0.063 0.125 0.227 rg"));
  check("dos firmas incrustadas (visitante y agente) + logo opcional", (pdf.match(/\/Subtype \/Image/g) || []).length === 2);
  const conLogo = latin1(pdfDeHoja(h, { hash: huella }, { logo: { bytes: new Uint8Array(JPEG), ancho: 500, alto: 201 } }));
  check("con logo: tres imágenes", (conLogo.match(/\/Subtype \/Image/g) || []).length === 3);
  check("sin registrar todavía: lo dice al pie", conLogo.includes("Pendiente de registrar en el servidor"));
  const pie = textoPieHoja(h, { hash: huella, recibida: new Date(AHORA).toISOString() });
  check("la primera línea del pie cabe en una línea del PDF", pdf.includes(`(${pie[0].replace(/[()]/g, (c) => `\\${c}`)})`), pie[0]);
  const anulada = latin1(pdfDeHoja(h, { hash: huella, recibida: new Date(AHORA).toISOString(), estado: "anulada", anulada: new Date(AHORA + 3600_000).toISOString(), motivo: "Datos del visitante equivocados" }));
  check("una hoja anulada lo dice al pie con el motivo", anulada.includes("ANULADA el 13/10/2026 a las 11:30. Motivo: Datos del visitante equivocados"));
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
  check("logo: más de 200 KB se rechaza", /200 KB/.test(validaLogo({ dataUrl: "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(210 * 1024)]).toString("base64"), ancho: 50, alto: 50 }).error || ""));
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

console.log(`\nResultado hojas-firmadas: ${pasados} pasados, ${fallados} fallados.`);
if (fallados) process.exit(1);
