// ============================================================================
//  Tests de Cerebro Útil Pau (lógica pura + PDF + /api/cerebro) — npm test
//  Sin navegador ni red: la API de Claude y Supabase se simulan con fetch.
// ============================================================================

import { aISO, aNumero, cuando, diasEntre, euros, rellena, sumaDiasHabiles, telefonoWhatsapp, nombreArchivo, escapaHtml } from "../cerebro/utiles.js";
import { crearIcs, doblaLinea } from "../cerebro/calendario.js";
import { calculaValoracion, validaComparable, percentil, MIN_COMPARABLES } from "../cerebro/valoracion.js";
import { estadoPapel, ordenaPapeles, validaPapel, eventosPapeles, siguienteVencimiento } from "../cerebro/papeles.js";
import {
  nuevaOperacion, fasesDe, mueveFase, marcaPapel, papelesDe, pendientesHastaAhora, progreso, calculaPlazo,
  plazosDe, proximasFechas, eventosOperaciones, mensajesPara, validaFecha,
} from "../cerebro/operaciones.js";
import { DATOS_OPERACIONES, HOJA_VISITA_BORRADOR } from "../cerebro/operaciones-datos.js";
import { normaliza, copiaSeguridad, leeCopia, carga, guarda, estadoVacio } from "../cerebro/datos.js";
import { validaVisita, limpiaVisita, declaracionDe, buscaVisitas, esFirmaJpeg } from "../cerebro/visitas.js";
import { pdfHojaVisita, pdfValoracion } from "../cerebro/documentos.js";
import cerebro, { limpiaLectura } from "../api/_cerebro.js";
import { readFileSync } from "node:fs";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}
const texto = (bytes) => new TextDecoder("latin1").decode(bytes);

console.log("\n🧰 Utilidades");
const sinNbsp = (x) => x.replace(/\s/g, " ");
check("euros con punto de miles también en 4 cifras", sinNbsp(euros(1500)) === "1.500 €" && sinNbsp(euros(245000)) === "245.000 €", euros(1500));
check("aNumero entiende formatos españoles", aNumero("120.000") === 120000 && aNumero("1.234,5") === 1234.5 && aNumero("98000 €") === 98000 && Number.isNaN(aNumero("abc")));
check("días hábiles saltan el fin de semana", sumaDiasHabiles("2026-09-25", 1) === "2026-09-28" && sumaDiasHabiles("2026-09-25", 5) === "2026-10-02");
check("diasEntre y cuando", diasEntre("2026-09-26", "2026-10-01") === 5 && cuando("2026-09-27", "2026-09-26") === "mañana");
check("teléfono a WhatsApp", telefonoWhatsapp("663 26 38 42") === "34663263842" && telefonoWhatsapp("0034 600111222") === "34600111222" && telefonoWhatsapp("123") === "");
check("rellena marca lo que falta", rellena("Hola {comprador}, {x}", { comprador: "Ana" }) === "Hola Ana, [x]");
check("nombre de archivo sin tildes ni barras", nombreArchivo("Hoja visita Uría 12/3ºB") === "Hoja-visita-Uria-12-3-B", nombreArchivo("Hoja visita Uría 12/3ºB"));
check("escapaHtml", escapaHtml('<img onerror="x">') === "&lt;img onerror=&quot;x&quot;&gt;");

console.log("\n📅 Calendario (.ics)");
const ics = crearIcs([
  { uid: "a", fecha: "2026-10-05", hora: "10:30", titulo: "Firma en notaría, Uría 12", lugar: "Notaría X", avisoDias: 1 },
  { uid: "b", fecha: "2026-10-20", titulo: "Vence: ITV", avisoDias: 30 },
  { uid: "c", fecha: "no", titulo: "mal" },
]);
check("estructura VCALENDAR con 2 eventos válidos", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trim().endsWith("END:VCALENDAR") && ics.split("BEGIN:VEVENT").length === 3);
check("evento con hora y fin a la hora siguiente", ics.includes("DTSTART:20261005T103000") && ics.includes("DTEND:20261005T113000"));
check("evento de día completo", ics.includes("DTSTART;VALUE=DATE:20261020") && ics.includes("DTEND;VALUE=DATE:20261021"));
check("alarmas y comas escapadas", ics.includes("TRIGGER:-P1D") && ics.includes("TRIGGER:-P30DT0H") && ics.includes("Firma en notaría\\, Uría 12"));
check("ninguna línea pasa de 75 octetos", ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
check("doblaLinea parte líneas largas", doblaLinea("DESCRIPTION:" + "ñ".repeat(80)).includes("\r\n "));

console.log("\n📊 Valoración");
check("percentil con interpolación", percentil([1, 2, 3, 4], 0.5) === 2.5 && percentil([10], 0.25) === 10);
check("comparable sin precio no vale", !validaComparable({ direccion: "x", precio: "", m2: 80 }).ok);
const pocos = calculaValoracion([{ direccion: "a", precio: 100000, m2: 80 }, { direccion: "b", precio: 120000, m2: 90 }], 85);
check(`con menos de ${MIN_COMPARABLES} comparables no hay rango (no se inventa)`, !pocos.suficiente && pocos.faltan === 1 && !pocos.valor);
const sinM2 = calculaValoracion([{ direccion: "a", precio: 1, m2: 1 }, { direccion: "b", precio: 1, m2: 1 }, { direccion: "c", precio: 1, m2: 1 }], "");
check("sin superficie del inmueble tampoco", !sinM2.suficiente && !sinM2.valor);
const cuatro = calculaValoracion([
  { direccion: "Uría 20", precio: 250000, m2: 95 }, { direccion: "Campoamor 3", precio: 230000, m2: 90 },
  { direccion: "Fruela 8", precio: 210000, m2: 85, ajuste: 5 }, { direccion: "Pelayo 1", precio: 275000, m2: 100 },
  { direccion: "roto", precio: "x", m2: 90 },
], 92);
check("con 4 válidos: mediana, P25–P75 y el roto descartado", cuatro.suficiente && cuatro.n === 4 && cuatro.descartados.length === 1);
check("valor redondeado a 500 € y ordenado", cuatro.valor.bajo % 500 === 0 && cuatro.valor.bajo <= cuatro.valor.central && cuatro.valor.central <= cuatro.valor.alto, JSON.stringify(cuatro.valor));
check("el ajuste se aplica al €/m² (Fruela: 210000/85·1,05)", Math.abs(cuatro.porM2.min - (250000 / 95 < 210000 / 85 * 1.05 ? 230000 / 90 : 0)) < 1 || cuatro.porM2.min > 2500);
check("dispersión alta detectada", calculaValoracion([{ direccion: "a", precio: 100000, m2: 100 }, { direccion: "b", precio: 300000, m2: 100 }, { direccion: "c", precio: 150000, m2: 100 }], 90).dispersionAlta);

console.log("\n📁 Papeles");
const hoy = "2026-09-26";
check("estados: vencido, pronto y ok", estadoPapel({ vence: "2026-09-20", avisoDias: 30 }, hoy).estado === "vencido" && estadoPapel({ vence: "2026-10-10", avisoDias: 30 }, hoy).estado === "pronto" && estadoPapel({ vence: "2027-05-01", avisoDias: 30 }, hoy).estado === "ok");
check("ordena vencidos primero", ordenaPapeles([{ id: 1, vence: "2027-01-01" }, { id: 2, vence: "2026-09-01" }, { id: 3, vence: "2026-10-01" }], hoy).map((p) => p.id).join() === "2,3,1");
check("validación pide nombre y fecha", !validaPapel({ titulo: "", vence: "" }).ok && validaPapel({ tipo: "itv", titulo: "ITV", vence: "2027-01-01" }).papel.avisoDias === 30);
check("eventos con aviso", eventosPapeles([{ id: "p", tipo: "dni", titulo: "DNI", vence: "2027-01-01", avisoDias: 60 }])[0].avisoDias === 60);
check("renovación anual (ITV +1 año; DNI lo decide Pau)", siguienteVencimiento({ tipo: "itv", vence: "2026-10-15" }) === "2027-10-15" && siguienteVencimiento({ tipo: "dni", vence: "2026-10-15" }) === "");
check("29 de febrero no rompe la renovación", siguienteVencimiento({ tipo: "seguro-hogar", vence: "2028-02-29" }) === "2029-02-28", siguienteVencimiento({ tipo: "seguro-hogar", vence: "2028-02-29" }));

console.log("\n📑 Operaciones (datos de NURIA)");
for (const tipo of ["compraventa", "alquiler"]) {
  const ids = fasesDe(tipo).flatMap((f) => f.papeles.map((p) => p.id));
  check(`${tipo}: ids de papeles únicos`, ids.length === new Set(ids).size);
  check(`${tipo}: cada papel dice quién lo aporta y su carácter`, fasesDe(tipo).every((f) => f.papeles.every((p) => p.nombre && p.aporta && ["obligatorio", "habitual", "segun-caso"].includes(p.caracter))));
}
check("compraventa empieza en reserva y acaba después de la notaría", fasesDe("compraventa")[0].fase === "reserva" && fasesDe("compraventa").some((f) => f.fase === "notaria"));
check("alquiler usa propietario/inquilino (no vendedor/comprador)", fasesDe("alquiler").every((f) => f.papeles.every((p) => !["vendedor", "comprador"].includes(p.aporta))));
check("plazo FEIN: 10 días naturales (Ley 5/2019)", plazosDe({ tipo: "compraventa" }).some((p) => p.dias === 10 && p.tipoDias === "naturales"));
check("todos los papeles con fuente llevan https", fasesDe("compraventa").concat(fasesDe("alquiler")).every((f) => f.papeles.every((p) => !p.fuente || /^https:\/\//.test(p.fuente))));

let op = nuevaOperacion({ id: "op1", tipo: "compraventa", inmueble: "Uría 12", precio: "240000", parteA: { nombre: "Ana", telefono: "600111222" }, parteB: { nombre: "Luis" }, notaria: "Notaría Pérez" }, hoy);
check("nueva operación en la primera fase", op.fase === "reserva" && op.partes.comprador.nombre === "Ana" && op.precio === 240000);
op = mueveFase(mueveFase(op, 1), 1);
check("avanza de fase", op.fase === fasesDe("compraventa")[2].fase);
check("no pasa de la última ni de la primera", mueveFase({ ...op, fase: "reserva" }, -1).fase === "reserva");
const antes = pendientesHastaAhora(op).length;
const primero = pendientesHastaAhora(op)[0];
op = marcaPapel(op, primero.id, true);
check("marcar un papel lo quita de pendientes y sube el progreso", pendientesHastaAhora(op).length === antes - 1 && progreso(op).hechos === 1);
check("papelesDe refleja lo marcado", papelesDe(op).find((p) => p.id === primero.id).hecho);
check("calculaPlazo naturales y hábiles", calculaPlazo({ dias: 10, tipoDias: "naturales" }, "2026-10-01") === "2026-10-11" && calculaPlazo({ dias: 30, tipoDias: "habiles" }, "2026-10-01") === "2026-11-12");
check("validaFecha", !validaFecha({ nombre: "", fecha: "x" }).ok && validaFecha({ nombre: "Firma", fecha: "2026-10-05", hora: "10:30" }).ok);
op = { ...op, fechas: [{ id: "f1", nombre: "Firma en notaría", fecha: "2026-09-30", hora: "10:30", avisoDias: 1 }, { id: "f2", nombre: "Muy lejos", fecha: "2027-09-30", avisoDias: 1 }] };
const prox = proximasFechas([op, { ...op, id: "cerrada", cerrada: true }], hoy, 14);
check("próximas fechas: solo las cercanas y de operaciones abiertas", prox.length === 1 && prox[0].nombre === "Firma en notaría" && prox[0].faltan === 4);
check("eventos para el calendario con la notaría como lugar", eventosOperaciones([op])[0].lugar === "Notaría Pérez");
const msgs = mensajesPara(op, { agente: "Pau", empresa: "Asesoría Castresana" });
check("mensajes de compraventa con datos puestos", msgs.length > 0 && msgs.every((m) => m.tipo === "compraventa") && msgs.some((m) => m.texto.includes("Ana") && m.texto.includes("Uría 12")));
check("la fecha de notaría entra en los mensajes", msgs.some((m) => m.texto.includes("30/09/2026")));
const alq = nuevaOperacion({ id: "a1", tipo: "alquiler", inmueble: "Gijón 5", parteA: { nombre: "Iván" }, parteB: { nombre: "Marta" } });
const mAlq = mensajesPara(alq, { agente: "Pau" });
check("alquiler: mensajes a inquilino y propietario con sus nombres", mAlq.length === 2 && mAlq.some((m) => m.texto.includes("Iván")) && mAlq.some((m) => m.texto.includes("Marta")));

console.log("\n💾 Datos y copia de seguridad");
check("normaliza basura sin romper", normaliza("x").visitas.length === 0 && normaliza({ visitas: [null, { sinId: 1 }, { id: "v" }] }).visitas.length === 1);
check("ajustes con tipos correctos", normaliza({ ajustes: { textosRevisados: "sí", agente: 5 } }).ajustes.textosRevisados === false);
const est = estadoVacio(); est.papeles.push({ id: "p1", titulo: "ITV" });
const leida = leeCopia(copiaSeguridad(est));
check("copia de ida y vuelta", leida.ok && leida.estado.papeles[0].titulo === "ITV" && leida.resumen.includes("1 papeles"));
check("copia de otra app rechazada", !leeCopia(JSON.stringify({ app: "otra" })).ok && !leeCopia("{roto").ok);
const memoria = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
guarda(est, memoria);
check("guarda y carga", carga(memoria).papeles.length === 1);
const lleno = { getItem: () => null, setItem() { const e = new Error("lleno"); e.name = "QuotaExceededError"; throw e; } };
check("almacenamiento lleno se avisa, no revienta", guarda(est, lleno).error === "lleno");

console.log("\n✍️ Hoja de visita y PDF");
const JPEG = readFileSync(new URL("./cerebro-pdf.test.mjs", import.meta.url), "utf8").match(/[A-Za-z0-9+/=]{200,}/)[0];
const firma = "data:image/jpeg;base64," + JPEG;
const aj = { agente: "Pau Moralejo", empresa: "Asesoría Castresana", ciudad: "Oviedo", telefono: "985 210 468", web: "asesoriacastresana.com", textoDeclaracion: HOJA_VISITA_BORRADOR.declaracion, textoRgpd: HOJA_VISITA_BORRADOR.rgpd, textosRevisados: false };
const visita = { id: "vis-1", fecha: "2026-09-26", hora: "17:30", inmueble: "Uría 12, 3ºB", visitante: { nombre: "Ana García", dni: "12345678z", telefono: "600111222", email: "ana@x.es" }, aceptaRgpd: true, aceptaOfertas: false, firma, firmaAncho: 8, firmaAlto: 6 };
check("firma JPEG reconocida", esFirmaJpeg(firma) && !esFirmaJpeg("data:image/png;base64,AAAA"));
check("visita válida", validaVisita(visita).ok, validaVisita(visita).errores.join(" "));
const sinFirma = validaVisita({ ...visita, firma: "", aceptaRgpd: false, visitante: { nombre: "", email: "mal" } });
check("sin firma, sin RGPD, sin nombre y correo malo → 4 errores claros", sinFirma.errores.length === 4, sinFirma.errores.join(" | "));
check("limpiaVisita pone el DNI en mayúsculas y recorta", limpiaVisita({ ...visita, observaciones: "x".repeat(900) }).visitante.dni === "12345678Z" && limpiaVisita({ ...visita, observaciones: "x".repeat(900) }).observaciones.length === 600);
check("declaración con nombre, DNI, fecha larga e inmueble", declaracionDe(limpiaVisita(visita), aj).includes("Ana García, con DNI/NIE 12345678Z") && declaracionDe(visita, aj).includes("26 de septiembre de 2026"));
check("buscar visitas sin tildes", buscaVisitas([visita, { ...visita, id: "v2", visitante: { nombre: "Luis" } }], "garcia").length === 1);
const pdf1 = pdfHojaVisita(limpiaVisita(visita), aj);
const t1 = texto(pdf1);
check("PDF de hoja de visita válido", t1.startsWith("%PDF-1.4") && t1.trimEnd().endsWith("%%EOF") && t1.includes("/DCTDecode"));
check("PDF lleva el nombre, el inmueble y el aviso de BORRADOR", t1.includes("Ana Garc\xeda") && t1.includes("Ur\xeda 12") && t1.includes("BORRADOR"));
check("con textos revisados desaparece el BORRADOR", !texto(pdfHojaVisita(limpiaVisita(visita), { ...aj, textosRevisados: true })).includes("BORRADOR"));
check("observaciones larguísimas no rompen el PDF", texto(pdfHojaVisita(limpiaVisita({ ...visita, observaciones: "palabra ".repeat(80) }), aj)).includes("%%EOF"));
const largo = texto(pdfHojaVisita(limpiaVisita({ ...visita, observaciones: "Observación larga ".repeat(40), acompanantes: "Su pareja y su hermano" }), { ...aj, textoRgpd: aj.textoRgpd + " " + aj.textoRgpd }));
check("hoja con textos largos pasa a 2 páginas (la firma no pisa el pie)", largo.includes("/Count 2"));
const ys = [...largo.matchAll(/rg ([\d.]+) ([\d.]+) Td/g)].map((m) => Number(m[2]));
// El pie está a 36 pt del borde inferior y el aviso de BORRADOR a 58: el contenido nunca baja de 80.
const contenido = ys.filter((yy) => yy > 40 && Math.abs(yy - 57.89) > 0.5);
check("ningún texto del contenido invade el pie ni el aviso de BORRADOR", ys.length > 20 && contenido.every((yy) => yy >= 70), String(Math.min(...contenido)));
check("los emojis del cliente no salen como '?'", !texto(pdfHojaVisita(limpiaVisita({ ...visita, visitante: { ...visita.visitante, nombre: "Ana 😀 García" } }), aj)).includes("Ana ? Garc"));
const malicioso = normaliza({ operaciones: [{ id: "o", inmueble: "x", fechas: [{ id: "f", nombre: "Firma", fecha: "2026-10-01", avisoDias: "<img src=x onerror=alert(1)>" }] }], visitas: [{ id: 7, firma: "javascript:alert(1)" }], valoraciones: [{ id: "v", comparables: null }] });
check("copia manipulada: avisoDias numérico, firma vacía, ids en texto y listas sanas", malicioso.operaciones[0].fechas[0].avisoDias === 1 && malicioso.visitas[0].firma === "" && malicioso.visitas[0].id === "7" && Array.isArray(malicioso.valoraciones[0].comparables));
check("mensaje de alquiler rellena la fecha de firma del contrato", mensajesPara({ ...alq, fechas: [{ id: "x", nombre: "Firma del contrato de alquiler", fecha: "2026-10-03", hora: "12:00" }] }, {}).some((m) => m.texto.includes("03/10/2026") && m.texto.includes("12:00")));
check(".ics escapa el punto y coma", crearIcs([{ uid: "z", fecha: "2026-10-01", titulo: "Notaría; Uría" }]).includes("Notaría\\; Uría"));
const pdf2 = texto(pdfValoracion({ inmueble: { direccion: "Uría 12", zona: "Centro" }, propietario: "Luis" }, cuatro, aj, "2026-09-26"));
check("PDF de valoración con rango, comparables y aviso de no-tasación", pdf2.includes("INFORME DE VALORACI") && pdf2.includes("Pelayo 1") && pdf2.includes("AVISO IMPORTANTE") && pdf2.includes("ECO/805") && pdf2.includes("Muestra reducida") && pdf2.includes("/Count 2"));
check("PDF de valoración sin datos suficientes lo dice", texto(pdfValoracion({ inmueble: {} }, pocos, aj, "2026-09-26")).includes("No hay datos suficientes"));

console.log("\n🏘️ Ficha del piso (revisión de NICER)");
{
  const { limpiaFicha, CAMPOS_INMUEBLE } = await import("../cerebro/campos-piso.js");
  const { pdfCaptacion } = await import("../cerebro/documentos.js");
  const f = limpiaFicha({ m2Construidos: "85.5", comunidad: "45,50", precio: "120.000", banos: 1.5, ibi: "1.234,5" });
  check("decimales bien: 85.5 y 45,50 no se multiplican; 120.000 y 1.234,5 son miles", f.m2Construidos === 85.5 && f.comunidad === 45.5 && f.precio === 120000 && f.banos === 1.5 && f.ibi === 1234.5, JSON.stringify(f));
  check("la hoja de visita no lleva cargas, alquiler vigente ni precio mínimo", !CAMPOS_INMUEBLE.some((c) => ["cargas", "contratoAlquiler", "precioMinimo", "propNombre"].includes(c.id)));
  const largo = texto(pdfCaptacion({ direccion: "Calle Marqués de Santa Cruz 12", cargas: "Hipoteca con Caja Rural, quedan 45.000 €", derrama: "Derrama de 3.000 € por la fachada, aprobada", calefaccion: "Gas natural individual con caldera de condensación nueva", precioMinimo: 230000, propNombre: "Luis", contratoAlquiler: "600 €/mes hasta 2027" },
    { ...aj, textoCaptacion: "", textoRgpdCaptacion: "" }, { hoy: "2026-09-26" }));
  check("los valores largos no se recortan en el PDF", ["Cruz 12", "45.000", "aprobada", "nueva"].every((t) => largo.includes(t)), "falta algún trozo");
  check("el precio mínimo interno no sale en la captación", !largo.includes("230.000") && !largo.includes("Precio m\xednimo"));
}
const valFirmas = texto(pdfValoracion({ inmueble: { direccion: "Uría 12" } }, cuatro, { ...aj, firmaAgente: firma, firmaAgenteAncho: 8, firmaAgenteAlto: 6 }, "2026-09-26"));
check("el informe de valoración lleva la firma bajo ASESORIA CASTRESANA INMO", valFirmas.includes("ASESORIA CASTRESANA INMO"));

console.log("\n📷 /api/cerebro (leer documento con foto)");
const resMock = () => { const r = { code: 0, body: null }; return { r, status(c) { r.code = c; return this; }, json(b) { r.body = b; return this; }, setHeader() {} }; };
check("limpiaLectura descarta fechas imposibles y tipos raros", (() => { const l = limpiaLectura({ tipo: "cohete", titulo: "x", vence: "2026-02-30", otras_fechas: [{ que: "emisión", fecha: "2025-01-10" }, { que: "mal", fecha: "10/01/2025" }] }); return l.tipo === "otro" && l.vence === "" && l.otras_fechas.length === 1; })());
const realFetch = globalThis.fetch;
const claveOriginal = process.env.ANTHROPIC_API_KEY;
let rr = resMock();
await cerebro({ method: "GET" }, rr);
check("GET → 405", rr.r.code === 405);
delete process.env.ANTHROPIC_API_KEY;
rr = resMock();
await cerebro({ method: "POST", body: { accion: "leer-documento", imagen: { media_type: "image/jpeg", data: "aGVsbG8=" } } }, rr);
check("sin clave de Anthropic → 503 con explicación", rr.r.code === 503 && rr.r.body.error.includes("ANTHROPIC_API_KEY"));
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
rr = resMock();
await cerebro({ method: "POST", body: { accion: "leer-documento", imagen: { media_type: "application/pdf", data: "aGVsbG8=" } } }, rr);
check("tipo de archivo no admitido → 400", rr.r.code === 400);
rr = resMock();
await cerebro({ method: "POST", body: { accion: "leer-documento", imagen: { media_type: "image/jpeg", data: "aGVsbG8=" } } }, rr);
check("sin Supabase ni CEREBRO_CLAVE → 503 (nunca queda abierto)", rr.r.code === 503 && rr.r.body.error.includes("CEREBRO_CLAVE"));
process.env.CEREBRO_CLAVE = "propia";
rr = resMock();
await cerebro({ method: "POST", body: { accion: "leer-documento", clave: "otra", imagen: { media_type: "image/jpeg", data: "aGVsbG8=" } } }, rr);
check("sin Supabase, con CEREBRO_CLAVE: clave mala → 401", rr.r.code === 401);
delete process.env.CEREBRO_CLAVE;
process.env.SUPABASE_URL = "https://test.supabase.co"; process.env.SUPABASE_ANON_KEY = "anon";
const peticiones = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  peticiones.push(u);
  if (u.includes("clara_memoria_lee")) {
    const { clave } = JSON.parse(init.body);
    return clave === "buena" ? new Response(JSON.stringify("notas"), { status: 200 }) : new Response('{"message":"clave incorrecta"}', { status: 400 });
  }
  if (u.includes("anthropic.com")) {
    const body = JSON.parse(init.body);
    peticiones.push(body);
    return new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "x", stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 },
      content: [{ type: "tool_use", id: "t", name: "datos_documento", input: { legible: true, tipo: "itv", titulo: "ITV Seat León", vence: "2027-03-14", otras_fechas: [], notas: "Estación de Lugones" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error("fetch inesperado " + u);
};
rr = resMock();
await cerebro({ method: "POST", body: { accion: "leer-documento", imagen: { media_type: "image/jpeg", data: "aGVsbG8=" } } }, rr);
check("con nube: sin clave de sincronización → 401 y no llama a Claude", rr.r.code === 401 && !peticiones.some((p) => String(p).includes("anthropic")));
rr = resMock();
await cerebro({ method: "POST", body: { accion: "leer-documento", clave: "mala", imagen: { media_type: "image/jpeg", data: "aGVsbG8=" } } }, rr);
check("clave incorrecta → 401", rr.r.code === 401 && rr.r.body.error.includes("incorrecta"));
rr = resMock();
await cerebro({ method: "POST", body: { accion: "leer-documento", clave: "buena", imagen: { media_type: "image/jpeg", data: "aGVsbG8=" } } }, rr);
const peticionClaude = peticiones.find((p) => typeof p === "object");
check("clave buena → lectura limpia", rr.r.code === 200 && rr.r.body.lectura.vence === "2027-03-14" && rr.r.body.lectura.tipo === "itv", JSON.stringify(rr.r.body));
check("pide a Claude la herramienta forzada con la foto", peticionClaude?.tool_choice?.name === "datos_documento" && peticionClaude.messages[0].content[0].type === "image");
check("el prompt prohíbe inventar la fecha", peticionClaude.system.includes("no la calcules ni la supongas"));
globalThis.fetch = realFetch;
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
if (claveOriginal) process.env.ANTHROPIC_API_KEY = claveOriginal; else delete process.env.ANTHROPIC_API_KEY;

console.log(`\nResultado Cerebro: ${pasados} pasados, ${fallados} fallados.\n`);
process.exit(fallados === 0 ? 0 : 1);
