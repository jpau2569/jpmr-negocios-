// ============================================================================
//  Tests de cloudflare/castresana-web (Worker de Cloudflare) — npm test
//  1) Lógica pura: horario con zona horaria (invierno, verano y cambio de
//     hora), antelación, festivos y bloqueos, validación, CSV y cookie.
//  2) El Worker entero con una D1 simulada sobre SQLite (node:sqlite):
//     reservas simultáneas, límite por IP, panel sin clave, cancelación…
//  Sin red: Telegram y Turnstile se simulan con un fetch falso.
// ============================================================================
import {
  madridAUtc, enMadrid, desfaseMinutos, huecosDelDia, huecosLibres, diasConHuecos, compruebaHueco,
  configVisitas, leeHorario, estaBloqueado, sumaDias, etiquetaLarga, hoyEnMadrid,
} from "../cloudflare/castresana-web/src/horario.js";
import {
  telefonoEspanol, validaValoracion, validaReserva, limpia, leeListaInmuebles, enlaceSeguro, esReferencia, correoValido,
} from "../cloudflare/castresana-web/src/validacion.js";
import { aCsv, celda, BOM } from "../cloudflare/castresana-web/src/csv.js";
import {
  creaSesion, sesionValida, igualesSeguro, cabeceraCookie, leeCookie, COOKIE,
} from "../cloudflare/castresana-web/src/sesion.js";
import { textoValoracion, textoVisita, avisaTelegram } from "../cloudflare/castresana-web/src/telegram.js";
import { enlaceWhatsapp, textoWhatsappVisita } from "../cloudflare/castresana-web/src/mensajes.js";
import { esc, paginaValora } from "../cloudflare/castresana-web/src/html.js";
import { crearManejador, LIMITE } from "../cloudflare/castresana-web/src/index.js";
import { creaD1, creaAssets } from "../cloudflare/castresana-web/herramientas/d1-local.mjs";
import { readFileSync, readdirSync } from "node:fs";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}
const iso = (ms) => (ms === null ? null : new Date(ms).toISOString());
const cfgDefecto = configVisitas({});

// ============================================================================
console.log("\n🕰️  Zona horaria Europe/Madrid");
check("invierno: 10:00 en Madrid son las 09:00 UTC", iso(madridAUtc("2026-01-15", "10:00")) === "2026-01-15T09:00:00.000Z", iso(madridAUtc("2026-01-15", "10:00")));
check("verano: 10:00 en Madrid son las 08:00 UTC", iso(madridAUtc("2026-07-15", "10:00")) === "2026-07-15T08:00:00.000Z", iso(madridAUtc("2026-07-15", "10:00")));
check("cambio de marzo 2026: sábado 28 todavía +1, lunes 30 ya +2",
  desfaseMinutos(madridAUtc("2026-03-28", "10:00")) === 60 && desfaseMinutos(madridAUtc("2026-03-30", "10:00")) === 120);
check("cambio de octubre 2026: sábado 24 todavía +2, lunes 26 ya +1",
  desfaseMinutos(madridAUtc("2026-10-24", "10:00")) === 120 && desfaseMinutos(madridAUtc("2026-10-26", "10:00")) === 60);
check("el 29-03-2026 las 02:30 no existen (el reloj salta de 2:00 a 3:00)", madridAUtc("2026-03-29", "02:30") === null);
check("el 29-03-2026 las 03:00 son la 01:00 UTC", iso(madridAUtc("2026-03-29", "03:00")) === "2026-03-29T01:00:00.000Z");
check("el 25-10-2026 las 02:30 existen y vuelven a dar 02:30", (() => { const t = madridAUtc("2026-10-25", "02:30"); return t !== null && enMadrid(t).hora === "02:30"; })());
check("ida y vuelta UTC → Madrid", enMadrid(Date.parse("2026-12-31T23:30:00Z")).fecha === "2027-01-01" && enMadrid(Date.parse("2026-12-31T23:30:00Z")).hora === "00:30");
check("fechas imposibles → null", madridAUtc("2026-02-30", "10:00") === null && madridAUtc("2026-01-15", "25:00") === null);
check("sumaDias cruza meses y años", sumaDias("2026-12-30", 3) === "2027-01-02" && sumaDias("2026-03-01", -1) === "2026-02-28");
check("etiqueta larga en español", etiquetaLarga("2026-10-13") === "martes 13 de octubre de 2026", etiquetaLarga("2026-10-13"));

// ============================================================================
console.log("\n📅 Huecos del horario por defecto");
{
  const lunes = huecosDelDia("2026-01-12", cfgDefecto);
  check("lunes de invierno: 8 de mañana + 6 de tarde = 14 huecos", lunes.length === 14, String(lunes.length));
  check("primer hueco 10:00 y último 19:00 (el de 19:00 acaba a las 19:30)", lunes[0].hora === "10:00" && lunes.at(-1).hora === "19:00");
  check("no hay hueco a las 14:00 ni a las 16:00", !lunes.some((h) => ["14:00", "16:00", "13:45"].includes(h.hora)) && lunes.some((h) => h.hora === "16:30"));
  check("invierno: el hueco de 10:00 es a las 09:00 UTC", iso(lunes[0].utc) === "2026-01-12T09:00:00.000Z");
  const lunesVerano = huecosDelDia("2026-07-13", cfgDefecto);
  check("verano: el hueco de 10:00 es a las 08:00 UTC", iso(lunesVerano[0].utc) === "2026-07-13T08:00:00.000Z" && lunesVerano.length === 14);
  check("sábado: 10:00 a 12:30 (6 huecos)", huecosDelDia("2026-01-17", cfgDefecto).map((h) => h.hora).join(",") === "10:00,10:30,11:00,11:30,12:00,12:30");
  check("domingo: sin huecos", huecosDelDia("2026-01-18", cfgDefecto).length === 0);
  check("viernes 27-03 (antes del cambio): 10:00 = 09:00 UTC; lunes 30-03 (después): 10:00 = 08:00 UTC",
    iso(huecosDelDia("2026-03-27", cfgDefecto)[0].utc) === "2026-03-27T09:00:00.000Z" && iso(huecosDelDia("2026-03-30", cfgDefecto)[0].utc) === "2026-03-30T08:00:00.000Z");

  const madrugada = configVisitas({ HORARIO: "D 01:00-04:00" });
  const marzo = huecosDelDia("2026-03-29", madrugada).map((h) => h.hora);
  check("día del cambio de marzo: se saltan las 02:00 y 02:30, que no existen", marzo.join(",") === "01:00,01:30,03:00,03:30", marzo.join(","));
  const octubre = huecosDelDia("2026-10-25", madrugada);
  check("día del cambio de octubre: 6 huecos sin repetir", octubre.length === 6 && new Set(octubre.map((h) => h.fechaHora)).size === 6);
  check("en octubre la 01:00 (+2) y las 03:00 (+1) están a 3 h reales", (octubre.find((h) => h.hora === "03:00").utc - octubre[0].utc) === 3 * 3600000);
}

console.log("\n⏳ Antelación, días vista, festivos y bloqueos");
{
  // Viernes 27-03-2026 a las 09:30 de Madrid (08:30 UTC).
  const ahoraMs = Date.parse("2026-03-27T08:30:00Z");
  const libres = huecosLibres("2026-03-27", { ahoraMs, cfg: cfgDefecto }).map((h) => h.hora);
  check("con 2 h de antelación a las 09:30, el primero es el de 11:30 (justo 2 h)", libres[0] === "11:30" && !libres.includes("11:00"), libres.join(","));
  check("compruebaHueco rechaza las 11:00 por antelación", compruebaHueco("2026-03-27T11:00", { ahoraMs, cfg: cfgDefecto }).ok === false);
  check("compruebaHueco acepta las 11:30", compruebaHueco("2026-03-27T11:30", { ahoraMs, cfg: cfgDefecto }).ok === true);
  check("compruebaHueco rechaza una hora fuera del horario (15:00) y una que no es de bloque (10:15)",
    !compruebaHueco("2026-03-30T15:00", { ahoraMs, cfg: cfgDefecto }).ok && !compruebaHueco("2026-03-30T10:15", { ahoraMs, cfg: cfgDefecto }).ok);
  check("compruebaHueco rechaza domingo y basura", !compruebaHueco("2026-03-29T10:00", { ahoraMs, cfg: cfgDefecto }).ok && !compruebaHueco("<script>", { ahoraMs, cfg: cfgDefecto }).ok);

  const lunes = Date.parse("2026-01-12T08:00:00Z"); // lunes 09:00 en Madrid
  check("30 días vista: el 11-02 (hoy + 30) sí, el 12-02 no",
    compruebaHueco("2026-02-11T19:00", { ahoraMs: lunes, cfg: cfgDefecto }).ok && !compruebaHueco("2026-02-12T10:00", { ahoraMs: lunes, cfg: cfgDefecto }).ok);
  const dias = diasConHuecos({ ahoraMs: lunes, cfg: cfgDefecto });
  check("los días con huecos van de hoy al 11-02 y sin domingos", dias[0].fecha === "2026-01-12" && dias.at(-1).fecha === "2026-02-11" && !dias.some((d) => d.fecha === "2026-01-18"));

  const conFestivo = configVisitas({ FESTIVOS: "2026-01-13, 2026-01-14" });
  check("un festivo no tiene huecos", huecosDelDia("2026-01-13", conFestivo).length === 0 && huecosDelDia("2026-01-15", conFestivo).length === 14);
  check("bloqueo de día entero y de un solo hueco",
    estaBloqueado("2026-01-15", "10:00", [{ fecha: "2026-01-15", hora: "" }]) && estaBloqueado("2026-01-15", "10:00", [{ fecha: "2026-01-15", hora: "10:00" }]) && !estaBloqueado("2026-01-15", "10:30", [{ fecha: "2026-01-15", hora: "10:00" }]));
  const bloqueos = [{ fecha: "2026-01-13", hora: "" }, { fecha: "2026-01-14", hora: "11:00" }];
  const libres14 = huecosLibres("2026-01-14", { ahoraMs: lunes, cfg: cfgDefecto, bloqueos }).map((h) => h.hora);
  check("huecosLibres quita bloqueos y ocupados",
    huecosLibres("2026-01-13", { ahoraMs: lunes, cfg: cfgDefecto, bloqueos }).length === 0 && !libres14.includes("11:00") &&
    !huecosLibres("2026-01-14", { ahoraMs: lunes, cfg: cfgDefecto, ocupados: new Set(["2026-01-14T12:00"]) }).some((h) => h.hora === "12:00"));
  check("compruebaHueco rechaza un hueco bloqueado", !compruebaHueco("2026-01-14T11:00", { ahoraMs: lunes, cfg: cfgDefecto, bloqueos }).ok);
}

console.log("\n⚙️  Configuración desde vars");
{
  check("el horario por defecto se lee bien", leeHorario("L-V 10:00-14:00 16:30-19:30; S 10:00-13:00").ok);
  check("admite listas de días", (() => { const h = leeHorario("L,X 09:00-11:00"); return h.ok && h.dias[1].length === 1 && h.dias[3].length === 1 && h.dias[2].length === 0; })());
  check("rechaza tramos al revés y rangos de días al revés", !leeHorario("L-V 14:00-10:00").ok && !leeHorario("V-L 10:00-14:00").ok && !leeHorario("hola").ok);
  const mala = configVisitas({ HORARIO: "lunes de 10 a 2", BLOQUE_MINUTOS: "abc", FESTIVOS: "2026-13-45" });
  check("un horario mal escrito usa el de por defecto y avisa", mala.dias[1].length === 2 && mala.avisos.some((a) => a.startsWith("HORARIO")));
  check("un número mal escrito usa el de por defecto y avisa", mala.bloque === 30 && mala.avisos.some((a) => a.startsWith("BLOQUE_MINUTOS")));
  check("un festivo mal escrito se ignora y avisa", mala.festivos.size === 0 && mala.avisos.some((a) => a.startsWith("FESTIVOS")));
  const propia = configVisitas({ BLOQUE_MINUTOS: "45", ANTELACION_HORAS: "1,5", DIAS_VISTA: "15" });
  check("valores propios: bloque 45, antelación 1,5 h, 15 días", propia.bloque === 45 && propia.antelacionMs === 5400000 && propia.diasVista === 15 && propia.avisos.length === 0);
}

// ============================================================================
console.log("\n✅ Validación");
{
  check("teléfonos españoles válidos", ["600112233", "600 11 22 33", "+34 600-11-22-33", "0034600112233", "34600112233", "985 12 34 56", "(985) 123456"].every((t) => telefonoEspanol(t)));
  check("teléfono normalizado a 9 cifras", telefonoEspanol("+34 600 11 22 33") === "600112233");
  check("teléfonos no válidos", ["", "12345", "500112233", "6001122334", "+44 7700 900123", "600-11-22-3a"].every((t) => !telefonoEspanol(t)));
  check("correo", correoValido("ana@ejemplo.es") && !correoValido("ana@") && !correoValido("a b@c.es"));
  const ok = validaValoracion({ nombre: "  Ana   Pérez ", telefono: "600112233", operacion: "vender", tipo: "piso", zona: "Uría, Oviedo", metros: "85", habitaciones: "3", privacidad: "on" });
  check("valoración correcta: limpia espacios y convierte números", ok.ok && ok.valor.nombre === "Ana Pérez" && ok.valor.metros === 85 && ok.valor.habitaciones === 3 && ok.valor.correo === "");
  const mal = validaValoracion({ nombre: "A".repeat(81), telefono: "123", operacion: "regalar", tipo: "castillo", zona: "", metros: "8x", privacidad: "" });
  check("valoración con errores: un mensaje por campo",
    !mal.ok && ["nombre", "telefono", "operacion", "tipo", "zona", "metros", "privacidad"].every((k) => mal.errores[k]), Object.keys(mal.errores).join(","));
  check("sin aceptar la privacidad no pasa", !validaValoracion({ ...ok.valor, telefono: "600112233", privacidad: "" }).ok);
  check("los m² y habitaciones son opcionales", validaValoracion({ nombre: "Ana", telefono: "600112233", operacion: "alquilar", tipo: "otro", zona: "Gijón", privacidad: "on" }).ok);
  check("limpia quita caracteres de control y bidi", limpia("Ana\u0000‮ Pérez").texto === "Ana Pérez");
  check("comentario de más de 1000 caracteres rechazado", !validaValoracion({ nombre: "Ana", telefono: "600112233", operacion: "vender", tipo: "piso", zona: "Oviedo", comentario: "x".repeat(1001), privacidad: "on" }).ok);
  const res = validaReserva({ referencia: "PIS0190", fecha_hora: "2026-01-12T11:00", nombre: "Luis", telefono: "611223344", privacidad: "on" });
  check("reserva correcta", res.ok && res.valor.fechaHora === "2026-01-12T11:00");
  check("reserva sin hora ni privacidad", (() => { const r = validaReserva({ referencia: "PIS0190", nombre: "Luis", telefono: "611223344" }); return !r.ok && r.errores.fecha_hora && r.errores.privacidad; })());
  check("referencias", esReferencia("PIS0190") && esReferencia("Uría 12, 3ºB") && !esReferencia("<b>") && !esReferencia("x"));
  check("enlaces: solo https", enlaceSeguro("https://www.asesoriacastresana.com/x") && enlaceSeguro("javascript:alert(1)") === null && enlaceSeguro("http://a.es") === null && enlaceSeguro("") === "");
  const lineas = leeListaInmuebles("# comentario\nPIS0190; Piso en Uría; Centro; https://www.asesoriacastresana.com/p\nCAS0007");
  check("lista de inmuebles por líneas", lineas.ok && lineas.lista.length === 2 && lineas.lista[0].titulo === "Piso en Uría" && lineas.lista[1].titulo === "");
  const json = leeListaInmuebles('[{"referencia":"PIS0190","titulo":"Piso"},{"referencia":"pis0190"}]');
  check("lista JSON: detecta referencias repetidas", !json.ok && json.errores.some((e) => e.includes("repetida")));
  check("lista JSON rota o enlace no https: errores claros",
    !leeListaInmuebles("[{").ok && leeListaInmuebles("PIS1; t; z; http://x.es").errores.some((e) => e.includes("https")));
}

console.log("\n📄 CSV para Excel");
{
  const csv = aCsv(["Nombre", "Comentario"], [["Ana; Pérez", 'Dijo "hola"\nadiós'], ["=HYPERLINK(\"x\")", "-5"], [null, 7]]);
  check("empieza por el BOM de UTF-8", csv.startsWith(BOM));
  check("separador «;» y CRLF", csv.slice(1).split("\r\n")[0] === "Nombre;Comentario" && csv.endsWith("\r\n"));
  check("comillas en celdas con ; o saltos y comillas dobladas", csv.includes('"Ana; Pérez";"Dijo ""hola""\nadiós"'));
  check("fórmulas neutralizadas (inyección CSV)", celda("=1+1") === "'=1+1" && celda("+34600") === "'+34600" && celda("@x") === "'@x" && csv.includes("'-5"));
  check("vacíos y números", csv.includes("\r\n;7\r\n"));
}

console.log("\n🍪 Cookie de sesión firmada");
{
  const clave = "una-clave-de-panel-larga";
  const ahora = Date.parse("2026-01-12T08:00:00Z");
  const s = await creaSesion(clave, ahora);
  check("formato v1.<caducidad>.<firma>", /^v1\.\d+\.[A-Za-z0-9_-]{43}$/.test(s), s);
  check("la sesión recién creada vale", await sesionValida(s, clave, ahora + 1000));
  check("caduca a las 12 horas", !(await sesionValida(s, clave, ahora + 12 * 3600 * 1000 + 1)));
  const [v, cad, firma] = s.split(".");
  check("si se cambia la caducidad, la firma ya no vale", !(await sesionValida(`${v}.${Number(cad) + 99999}.${firma}`, clave, ahora)));
  check("si se toca la firma, no vale", !(await sesionValida(`${v}.${cad}.${firma.slice(0, -1)}${firma.endsWith("A") ? "B" : "A"}`, clave, ahora)));
  check("con otra clave de panel, no vale (cambiar la clave cierra sesiones)", !(await sesionValida(s, clave + "x", ahora)));
  check("basura y vacío no valen", !(await sesionValida("", clave, ahora)) && !(await sesionValida("v1.x.y", clave, ahora)) && !(await sesionValida(s, "", ahora)));
  check("comparación segura", (await igualesSeguro("abc", "abc")) && !(await igualesSeguro("abc", "abd")) && !(await igualesSeguro("abc", "abcd")));
  const cab = cabeceraCookie(s);
  check("cookie HttpOnly, Secure, SameSite=Strict y __Host-", cab.startsWith(`${COOKIE}=`) && COOKIE.startsWith("__Host-") && /HttpOnly/.test(cab) && /Secure/.test(cab) && /SameSite=Strict/.test(cab) && /Path=\//.test(cab));
  check("leeCookie", leeCookie(`otra=1; ${COOKIE}=${s}; x=2`) === s && leeCookie("otra=1") === "");
}

console.log("\n🧼 HTML escapado, Telegram y WhatsApp");
{
  check("esc escapa los 5 caracteres", esc(`<a href="x" onclick='y'>&</a>`) === "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  const pag = paginaValora({ valores: { nombre: '"><script>alert(1)</script>', zona: "<img src=x onerror=alert(1)>" }, errores: { nombre: "<b>mal</b>" } });
  check("lo que escribe el cliente vuelve escapado al formulario", !pag.includes("<script>alert") && !pag.includes("<img src=x") && pag.includes("&lt;script&gt;") && pag.includes("&lt;b&gt;mal"));
  check("sin estilos ni scripts en línea (la CSP los bloquearía)", !/<script>(?!<\/script>)|style="|<style|\son[a-z]+="/i.test(pag.replace(/<script src="[^"]+"( async)? defer><\/script>/g, "")));
  check("la página dice que no da precio y que Pau llamará", /No damos precios automáticos/.test(pag) && /Pau te llamará/.test(pag));
  check("privacidad: BORRADOR, Asesoría Castresana y [PENDIENTE: CIF y dirección]", pag.includes("BORRADOR") && pag.includes("Asesoría Castresana. [PENDIENTE: CIF y dirección]"));
  const tv = textoValoracion({ nombre: "Ana", telefono: "600112233", correo: "", operacion: "vender", tipo: "piso", zona: "Uría", metros: 85, habitaciones: null, comentario: "" });
  check("aviso de valoración legible y sin líneas vacías sobrantes", tv.includes("Teléfono: 600 11 22 33") && tv.includes("vender · Piso") && !tv.includes("Correo") && !tv.includes("Habitaciones") && !tv.includes("\n\n\n"), tv);
  const tvis = textoVisita({ fechaHora: "2026-01-14T11:00", referencia: "PIS0190", titulo: "Piso en Uría", nombre: "Luis", telefono: "611223344", comentario: "" });
  check("aviso de visita con fecha en español", tvis.includes("miércoles 14 de enero de 2026 a las 11:00") && tvis.includes("PIS0190 · Piso en Uría"));
  let llamadas = 0;
  const falso = async () => { llamadas++; return new Response("{}", { status: 200 }); };
  check("sin secretos de Telegram no se llama a nadie", (await avisaTelegram({}, "x", falso)) === false && llamadas === 0);
  let cuerpo = null;
  const ok = await avisaTelegram({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" }, "hola", async (u, o) => { cuerpo = JSON.parse(o.body); return new Response("{}"); });
  check("con secretos se manda texto plano (sin parse_mode)", ok && cuerpo.text === "hola" && cuerpo.chat_id === "1" && !("parse_mode" in cuerpo));
  check("si Telegram falla no rompe nada", (await avisaTelegram({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1" }, "x", async () => { throw new Error("sin red"); })) === false);
  const wa = enlaceWhatsapp("611223344", textoWhatsappVisita({ nombre: "Luis Gómez", referencia: "PIS0190", fecha_hora: "2026-01-14T11:00" }));
  check("WhatsApp: wa.me con 34 y texto preparado", wa.startsWith("https://wa.me/34611223344?text=") && decodeURIComponent(wa.split("text=")[1]).startsWith("Hola Luis, soy Pau"));
  check("un fijo no tiene enlace de WhatsApp", enlaceWhatsapp("985123456", "x") === "");
}

// ============================================================================
//  El Worker entero con D1 simulada
// ============================================================================
console.log("\n🧪 Worker con D1 (SQLite en memoria)");
const CLAVE = "clave-del-panel-de-prueba";
const LUNES = Date.parse("2026-01-12T08:00:00Z"); // lunes 12-01-2026, 09:00 en Madrid
let ahora = LUNES;
const telegramEnviados = [];
const fetchFalso = async (url, opciones) => {
  if (String(url).includes("api.telegram.org")) { telegramEnviados.push(JSON.parse(opciones.body)); return new Response('{"ok":true}'); }
  if (String(url).includes("turnstile")) {
    const b = JSON.parse(opciones.body);
    return new Response(JSON.stringify({ success: b.response === "token-bueno" && b.secret === "secreto-ts" }));
  }
  throw new Error("Red no permitida en las pruebas: " + url);
};
const worker = crearManejador({ reloj: () => ahora, hazFetch: fetchFalso });
const BASE = "https://castresana-web.ejemplo.workers.dev";

function creaEntorno(extra = {}) {
  return { DB: creaD1(), ASSETS: creaAssets(), PANEL_CLAVE: CLAVE, TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "1", ...extra };
}
async function pide(env, ruta, { metodo = "GET", form = null, ip = "203.0.113.1", cookie = "", origen = BASE, cabeceras = {} } = {}) {
  const h = new Headers({ "cf-connecting-ip": ip, ...cabeceras });
  if (cookie) h.set("cookie", cookie);
  let body;
  if (form) {
    h.set("content-type", "application/x-www-form-urlencoded");
    if (origen) h.set("origin", origen);
    body = new URLSearchParams(form).toString();
  }
  const pendientes = [];
  const r = await worker(new Request(BASE + ruta, { method: metodo, headers: h, body }), env, { waitUntil: (p) => pendientes.push(p) });
  await Promise.all(pendientes);
  return r;
}
const valoracionBuena = { nombre: "Ana Pérez", telefono: "600 11 22 33", correo: "ana@ejemplo.es", operacion: "vender", tipo: "piso", zona: "Calle Uría, Oviedo", metros: "85", habitaciones: "3", comentario: "Reformado en 2020", privacidad: "on" };
async function entra(env, ip = "198.51.100.9") {
  const r = await pide(env, "/panel/entrar", { metodo: "POST", form: { clave: CLAVE }, ip });
  const c = r.headers.get("set-cookie") || "";
  return c.split(";")[0];
}

{
  const env = creaEntorno();
  const r = await pide(env, "/valora");
  const csp = r.headers.get("content-security-policy") || "";
  check("GET /valora → 200 con CSP sin 'unsafe-inline'", r.status === 200 && csp.includes("default-src 'self'") && !csp.includes("unsafe-inline") && csp.includes("frame-ancestors 'none'"));
  check("cabeceras de seguridad (Referrer-Policy same-origin: con no-referrer Chromium manda Origin: null)", r.headers.get("x-content-type-options") === "nosniff" && r.headers.get("x-frame-options") === "DENY" && r.headers.get("referrer-policy") === "same-origin");

  const ok = await pide(env, "/valora", { metodo: "POST", form: valoracionBuena });
  const html = await ok.text();
  const filas = env.DB._base.prepare("SELECT * FROM valoraciones").all();
  check("POST /valora válido → 200, guardado y «Pau te llamará»", ok.status === 200 && filas.length === 1 && html.includes("Pau te llamará") && filas[0].telefono === "600112233");
  check("no da ningún precio", !/€|euros/i.test(html));
  check("aviso a Telegram enviado en texto plano", telegramEnviados.length === 1 && telegramEnviados[0].text.includes("VALORACIÓN") && !("parse_mode" in telegramEnviados[0]));

  const mal = await pide(env, "/valora", { metodo: "POST", form: { ...valoracionBuena, telefono: "123", nombre: "<script>x</script>" } });
  const htmlMal = await mal.text();
  check("POST /valora inválido → 422 con el error y el texto escapado", mal.status === 422 && htmlMal.includes("teléfono español") && !htmlMal.includes("<script>x") && htmlMal.includes("&lt;script&gt;x"));

  const robot = await pide(env, "/valora", { metodo: "POST", form: { ...valoracionBuena, web: "http://spam" } });
  check("campo trampa relleno: responde normal pero no guarda", robot.status === 200 && env.DB._base.prepare("SELECT COUNT(*) n FROM valoraciones").get().n === 1);

  const otraWeb = await pide(env, "/valora", { metodo: "POST", form: valoracionBuena, origen: "https://malo.example" });
  check("POST desde otra web → 403", otraWeb.status === 403);
  check("Sec-Fetch-Site cross-site → 403 aunque Origin no venga", (await pide(env, "/valora", { metodo: "POST", form: valoracionBuena, origen: "", cabeceras: { "sec-fetch-site": "cross-site" } })).status === 403);
  check("Origin «null» con Sec-Fetch-Site same-origin se acepta (privacidad del navegador)",
    (await pide(env, "/valora", { metodo: "POST", form: valoracionBuena, origen: "null", cabeceras: { "sec-fetch-site": "same-origin" }, ip: "203.0.113.250" })).status === 200);
  const enorme = await pide(env, "/valora", { metodo: "POST", form: { ...valoracionBuena, comentario: "x".repeat(20000) } });
  check("cuerpo demasiado grande → 413", enorme.status === 413);
  const json = await worker(new Request(BASE + "/valora", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: "{}" }), env, {});
  check("formato que no es de formulario → 415", json.status === 415);

  // Límite por IP: 5 por hora (ya lleva 1 esta IP).
  const estados = [];
  for (let i = 0; i < 5; i++) estados.push((await pide(env, "/valora", { metodo: "POST", form: valoracionBuena })).status);
  check(`límite por IP: el ${LIMITE.valoraPorHora + 1}.º envío en la hora → 429`, estados.slice(0, 4).every((s) => s === 200) && estados[4] === 429, estados.join(","));
  check("otra IP sí puede enviar", (await pide(env, "/valora", { metodo: "POST", form: valoracionBuena, ip: "203.0.113.2" })).status === 200);
  ahora += 3600 * 1000;
  check("pasada la hora, la primera IP vuelve a poder", (await pide(env, "/valora", { metodo: "POST", form: valoracionBuena })).status === 200);
  ahora = LUNES;
  const limites = env.DB._base.prepare("SELECT clave FROM limites").all();
  check("la IP no se guarda en claro", limites.length > 0 && limites.every((l) => !l.clave.includes("203.0.113")));

  const estatico = await pide(env, "/static/estilos.css");
  check("/static/* sale de ASSETS con cabeceras de seguridad", estatico.status === 200 && estatico.headers.get("x-content-type-options") === "nosniff" && (await estatico.text()).includes("--azul"));
  check("ruta desconocida → 404; método raro → 405", (await pide(env, "/nada")).status === 404 && (await pide(env, "/valora", { metodo: "PUT" })).status === 405);
}

console.log("\n🔐 Panel");
{
  const sinClave = creaEntorno({ PANEL_CLAVE: undefined });
  check("sin PANEL_CLAVE el panel está apagado (503), nunca abierto", (await pide(sinClave, "/panel")).status === 503 && (await pide(sinClave, "/panel/exportar?que=valoraciones")).status === 503);
  check("con una PANEL_CLAVE corta, también apagado", (await pide(creaEntorno({ PANEL_CLAVE: "corta" }), "/panel")).status === 503);

  const env = creaEntorno();
  const r = await pide(env, "/panel");
  const t = await r.text();
  check("panel sin sesión → 401 con el formulario de entrar", r.status === 401 && t.includes('type="password"') && r.headers.get("x-robots-tag")?.includes("noindex"));
  check("exportar sin sesión → 401 y sin datos", (await pide(env, "/panel/exportar?que=valoraciones")).status === 401);
  check("cancelar sin sesión → 401", (await pide(env, "/panel/visitas/cancelar", { metodo: "POST", form: { id: "1" } })).status === 401);
  const cookieFalsa = `${COOKIE}=v1.9999999999.${"A".repeat(43)}`;
  check("cookie inventada → 401", (await pide(env, "/panel", { cookie: cookieFalsa })).status === 401);

  const mala = await pide(env, "/panel/entrar", { metodo: "POST", form: { clave: "no-es-la-clave" }, ip: "198.51.100.50" });
  check("clave incorrecta → 401 sin cookie", mala.status === 401 && !mala.headers.get("set-cookie"));
  const buena = await pide(env, "/panel/entrar", { metodo: "POST", form: { clave: CLAVE }, ip: "198.51.100.9" });
  const sc = buena.headers.get("set-cookie") || "";
  check("clave correcta → 303 y cookie HttpOnly; Secure; SameSite=Strict", buena.status === 303 && buena.headers.get("location") === "/panel" && /HttpOnly/.test(sc) && /Secure/.test(sc) && /SameSite=Strict/.test(sc));
  const cookie = sc.split(";")[0];
  const dentro = await pide(env, "/panel", { cookie });
  check("con la cookie se ve el panel", dentro.status === 200 && (await dentro.text()).includes("Valoraciones"));

  for (let i = 0; i < LIMITE.fallosLoginIp; i++) await pide(env, "/panel/entrar", { metodo: "POST", form: { clave: "mal" + i }, ip: "198.51.100.77" });
  const bloqueada = await pide(env, "/panel/entrar", { metodo: "POST", form: { clave: CLAVE }, ip: "198.51.100.77" });
  check(`tras ${LIMITE.fallosLoginIp} fallos, esa IP no entra ni con la clave buena (429)`, bloqueada.status === 429 && !bloqueada.headers.get("set-cookie"));
  check("otra IP sí puede entrar", (await pide(env, "/panel/entrar", { metodo: "POST", form: { clave: CLAVE }, ip: "198.51.100.78" })).status === 303);
  ahora += 16 * 60 * 1000;
  check("a los 15 minutos esa IP vuelve a poder", (await pide(env, "/panel/entrar", { metodo: "POST", form: { clave: CLAVE }, ip: "198.51.100.77" })).status === 303);
  ahora = LUNES;
  check("POST del panel desde otra web → 403 aunque haya cookie", (await pide(env, "/panel/bloqueos/quitar", { metodo: "POST", form: { id: "1" }, cookie, origen: "https://malo.example" })).status === 403);
  const salir = await pide(env, "/panel/salir", { metodo: "POST", form: {}, cookie });
  check("salir borra la cookie", salir.status === 303 && /Max-Age=0/.test(salir.headers.get("set-cookie") || ""));
}

console.log("\n🏠 Visitas sin choques");
{
  const env = creaEntorno();
  check("sin inmuebles, /visitas lo dice", (await (await pide(env, "/visitas")).text()).includes("no hay inmuebles con visitas abiertas"));
  const cookie = await entra(env);
  const carga = await pide(env, "/panel/inmuebles/cargar", { metodo: "POST", cookie, form: { lista: "PIS0190; Piso en Uría; Centro; https://www.asesoriacastresana.com/x\nCAS0007; Casa en Mieres; Mieres" } });
  check("cargar inmuebles desde el panel → 303", carga.status === 303 && env.DB._base.prepare("SELECT COUNT(*) n FROM inmuebles").get().n === 2);
  const malCarga = await pide(env, "/panel/inmuebles/cargar", { metodo: "POST", cookie, form: { lista: "<x>; t" } });
  check("una lista con errores no guarda nada y explica el fallo", malCarga.status === 422 && (await malCarga.text()).includes("Referencia"));

  const pagina = await (await pide(env, "/visitas?ref=PIS0190&fecha=2026-01-12")).text();
  check("hoy (lunes 09:00) el primer hueco es a las 11:00 (2 h de antelación)", pagina.includes('value="2026-01-12T11:00"') && !pagina.includes('value="2026-01-12T10:30"'));
  check("la lista de días no incluye domingos", !pagina.includes('value="2026-01-18"') && pagina.includes('value="2026-01-17"'));

  const reserva = (extra = {}) => ({ referencia: "PIS0190", fecha: "2026-01-13", fecha_hora: "2026-01-13T10:00", nombre: "Luis Gómez", telefono: "611 22 33 44", privacidad: "on", ...extra });

  // Dos personas a la vez, mismo hueco, distinta IP.
  const [a, b] = await Promise.all([
    pide(env, "/visitas", { metodo: "POST", form: reserva(), ip: "203.0.113.10" }),
    pide(env, "/visitas", { metodo: "POST", form: reserva({ nombre: "Marta", telefono: "622334455", referencia: "CAS0007" }), ip: "203.0.113.11" }),
  ]);
  const estados = [a.status, b.status].sort().join(",");
  const activas = env.DB._base.prepare("SELECT COUNT(*) n FROM visitas WHERE fecha_hora = '2026-01-13T10:00' AND estado = 'activa'").get().n;
  check("dos reservas simultáneas del mismo hueco: una 200 y otra 409", estados === "200,409", estados);
  check("y en la base de datos solo queda una", activas === 1);
  const perdedora = a.status === 409 ? await a.text() : await b.text();
  check("la que llega tarde recibe un mensaje claro", perdedora.includes("acaba de reservarla otra persona"));

  let choque = "";
  try {
    env.DB._base.prepare("INSERT INTO visitas (fecha_hora, inicio_utc, referencia, nombre, telefono, creada) VALUES ('2026-01-13T10:00','x','PIS0190','X','600000000','x')").run();
  } catch (e) { choque = e.message; }
  check("el índice único parcial lo impide aunque se salte la comprobación", /UNIQUE constraint failed/.test(choque), choque);

  // Las dos a la vez en huecos distintos sí entran.
  const [c, d] = await Promise.all([
    pide(env, "/visitas", { metodo: "POST", form: reserva({ fecha_hora: "2026-01-13T10:30" }), ip: "203.0.113.12" }),
    pide(env, "/visitas", { metodo: "POST", form: reserva({ fecha_hora: "2026-01-13T11:00" }), ip: "203.0.113.13" }),
  ]);
  check("dos reservas simultáneas en huecos distintos: las dos entran", c.status === 200 && d.status === 200);
  check("se avisa a Telegram de cada visita", telegramEnviados.filter((t) => t.text.includes("VISITA")).length >= 3);

  check("hora con menos de 2 h de antelación → 409", (await pide(env, "/visitas", { metodo: "POST", form: reserva({ fecha: "2026-01-12", fecha_hora: "2026-01-12T10:00" }), ip: "203.0.113.20" })).status === 409);
  check("hora fuera del horario → 409", (await pide(env, "/visitas", { metodo: "POST", form: reserva({ fecha_hora: "2026-01-13T15:00" }), ip: "203.0.113.21" })).status === 409);
  check("más allá de 30 días → 409", (await pide(env, "/visitas", { metodo: "POST", form: reserva({ fecha: "2026-02-12", fecha_hora: "2026-02-12T10:00" }), ip: "203.0.113.22" })).status === 409);
  check("inmueble que no existe → 409", (await pide(env, "/visitas", { metodo: "POST", form: reserva({ referencia: "NOEXISTE", fecha_hora: "2026-01-13T12:00" }), ip: "203.0.113.23" })).status === 409);
  check("datos mal → 422", (await pide(env, "/visitas", { metodo: "POST", form: reserva({ telefono: "1", fecha_hora: "2026-01-13T12:00" }), ip: "203.0.113.24" })).status === 422);

  // Bloqueos desde el panel.
  check("bloquear un hueco → 303", (await pide(env, "/panel/bloqueos/nuevo", { metodo: "POST", cookie, form: { fecha: "2026-01-14", hora: "11:00", motivo: "Notaría" } })).status === 303);
  check("bloquear un día entero → 303", (await pide(env, "/panel/bloqueos/nuevo", { metodo: "POST", cookie, form: { fecha: "2026-01-15", hora: "", motivo: "" } })).status === 303);
  const conBloqueo = await (await pide(env, "/visitas?ref=PIS0190&fecha=2026-01-14")).text();
  check("el hueco bloqueado no se ofrece", !conBloqueo.includes('value="2026-01-14T11:00"') && conBloqueo.includes('value="2026-01-14T11:30"'));
  check("el día bloqueado no sale en la lista de días", !conBloqueo.includes('value="2026-01-15"'));
  check("reservar un hueco bloqueado → 409", (await pide(env, "/visitas", { metodo: "POST", form: reserva({ fecha: "2026-01-14", fecha_hora: "2026-01-14T11:00" }), ip: "203.0.113.30" })).status === 409);
  check("bloqueo con hora mal escrita → 422", (await pide(env, "/panel/bloqueos/nuevo", { metodo: "POST", cookie, form: { fecha: "2026-01-16", hora: "25:00" } })).status === 422);
  const conVisita = await pide(env, "/panel/bloqueos/nuevo", { metodo: "POST", cookie, form: { fecha: "2026-01-13", hora: "10:30" } });
  check("bloquear un hueco que ya tiene visita avisa", conVisita.headers.get("location")?.includes("bloqueo-con-visita"));

  // Panel de visitas y cancelación.
  const panelVisitas = await (await pide(env, "/panel?vista=visitas&desde=2026-01-12", { cookie })).text();
  check("el panel enseña las visitas por día con WhatsApp preparado", panelVisitas.includes("martes 13 de enero de 2026") && panelVisitas.includes("https://wa.me/34611223344?text="));
  const id = env.DB._base.prepare("SELECT id FROM visitas WHERE fecha_hora = '2026-01-13T10:00' AND estado = 'activa'").get().id;
  const cancela = await pide(env, "/panel/visitas/cancelar", { metodo: "POST", cookie, form: { id: String(id) } });
  check("cancelar → 303 y queda como cancelada (no se borra)", cancela.status === 303 && env.DB._base.prepare("SELECT estado FROM visitas WHERE id = ?").get(id).estado === "cancelada");
  const otraVez = await pide(env, "/visitas", { metodo: "POST", form: reserva({ nombre: "Nuevo", telefono: "633445566" }), ip: "203.0.113.40" });
  check("tras cancelar, el hueco se puede volver a reservar", otraVez.status === 200 && (await otraVez.text()).includes("Visita reservada"));
  check("cancelar dos veces no rompe nada", (await pide(env, "/panel/visitas/cancelar", { metodo: "POST", cookie, form: { id: String(id) } })).headers.get("location").includes("ya-cancelada"));
  check("id de visita no válido → 400", (await pide(env, "/panel/visitas/cancelar", { metodo: "POST", cookie, form: { id: "1 OR 1=1" } })).status === 400);

  // Desactivar un inmueble lo quita de las reservas.
  await pide(env, "/panel/inmuebles/estado", { metodo: "POST", cookie, form: { referencia: "CAS0007", accion: "desactivar" } });
  check("un inmueble desactivado no sale ni se puede reservar",
    !(await (await pide(env, "/visitas")).text()).includes("CAS0007") &&
    (await pide(env, "/visitas", { metodo: "POST", form: reserva({ referencia: "CAS0007", fecha_hora: "2026-01-16T10:00", fecha: "2026-01-16" }), ip: "203.0.113.41" })).status === 409);

  // Límite por IP en reservas.
  const est = [];
  const horas = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
  for (const h of horas) est.push((await pide(env, "/visitas", { metodo: "POST", form: reserva({ fecha: "2026-01-16", fecha_hora: `2026-01-16T${h}` }), ip: "203.0.113.99" })).status);
  check(`límite por IP en reservas: la ${LIMITE.visitasPorHora + 1}.ª → 429`, est.slice(0, 5).every((x) => x === 200) && est[5] === 429, est.join(","));

  // CSV.
  const csvV = await pide(env, "/panel/exportar?que=visitas", { cookie });
  // Ojo: Response.text() quita el BOM al decodificar; hay que mirar los bytes.
  const bytesV = new Uint8Array(await csvV.arrayBuffer());
  const textoV = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytesV);
  check("CSV de visitas: adjunto, con BOM (EF BB BF) y «;»", csvV.headers.get("content-disposition")?.startsWith("attachment;") && bytesV[0] === 0xEF && bytesV[1] === 0xBB && bytesV[2] === 0xBF && textoV.slice(1).split("\r\n")[0] === "Día;Hora;Inmueble;Nombre;Teléfono;Comentario;Estado;Reservada el;Cancelada el");
  check("el CSV incluye la cancelada", textoV.includes(";cancelada;"));
  const envV = creaEntorno();
  await pide(envV, "/valora", { metodo: "POST", form: { ...valoracionBuena, nombre: "=Pepe" } });
  const bytesVal = new Uint8Array(await (await pide(envV, "/panel/exportar?que=valoraciones", { cookie: await entra(envV) })).arrayBuffer());
  const textoVal = new TextDecoder().decode(bytesVal);
  check("CSV de valoraciones con BOM y la fórmula neutralizada", bytesVal[0] === 0xEF && textoVal.includes(";'=Pepe;") && !textoVal.includes(";=Pepe"));
}

console.log("\n🤖 Turnstile (opcional)");
{
  const env = creaEntorno({ TURNSTILE_SITEKEY: "1x00000000000000000000AA", TURNSTILE_SECRET: "secreto-ts" });
  const pag = await pide(env, "/valora");
  const csp = pag.headers.get("content-security-policy");
  const html = await pag.text();
  check("con Turnstile: widget y script de challenges.cloudflare.com permitido por la CSP",
    html.includes('class="cf-turnstile"') && html.includes("challenges.cloudflare.com/turnstile/v0/api.js") && csp.includes("script-src 'self' https://challenges.cloudflare.com") && csp.includes("frame-src https://challenges.cloudflare.com"));
  check("sin token → 400 y no se guarda", (await pide(env, "/valora", { metodo: "POST", form: valoracionBuena })).status === 400 && env.DB._base.prepare("SELECT COUNT(*) n FROM valoraciones").get().n === 0);
  check("token malo → 400", (await pide(env, "/valora", { metodo: "POST", form: { ...valoracionBuena, "cf-turnstile-response": "malo" } })).status === 400);
  check("token bueno → 200", (await pide(env, "/valora", { metodo: "POST", form: { ...valoracionBuena, "cf-turnstile-response": "token-bueno" } })).status === 200);
  const solo = creaEntorno({ TURNSTILE_SECRET: "secreto-ts" });
  check("solo con el secreto (sin clave pública) no se activa: el formulario sigue funcionando", (await pide(solo, "/valora", { metodo: "POST", form: valoracionBuena })).status === 200);
}

console.log("\n🔒 Nada de claves en el código");
{
  const carpeta = new URL("../cloudflare/castresana-web/", import.meta.url);
  const archivos = ["cloudflare.config.ts", "wrangler.config.ts", "schema.sql", "package.json", ...readdirSync(new URL("src/", carpeta)).map((f) => "src/" + f), "public/static/app.js"];
  const sospechoso = /(\d{8,10}:[A-Za-z0-9_-]{30,})|(0x4AAAA[A-Za-z0-9_-]{10,})|(sk-[A-Za-z0-9]{20,})|PANEL_CLAVE\s*[:=]\s*["'][^"']+["']/;
  const encontrados = archivos.filter((f) => sospechoso.test(readFileSync(new URL(f, carpeta), "utf8")));
  check("ningún token de Telegram, clave de Turnstile ni contraseña escritos", encontrados.length === 0, encontrados.join(","));
  const sql = readFileSync(new URL("src/datos.js", carpeta), "utf8");
  check("el SQL no concatena valores (solo ? y la lista de ? generada)", !/prepare\(`[^`]*\$\{(?!huecos\})/.test(sql));
  check(".gitignore protege los archivos de secretos", /\.secretos\.env/.test(readFileSync(new URL(".gitignore", carpeta), "utf8")) && /\.dev\.vars/.test(readFileSync(new URL(".gitignore", carpeta), "utf8")));
  check("el horario por defecto de cloudflare.config.ts es el pedido", readFileSync(new URL("cloudflare.config.ts", carpeta), "utf8").includes('HORARIO: bindings.text("L-V 10:00-14:00 16:30-19:30; S 10:00-13:00")'));
  check("hoyEnMadrid de medianoche UTC en verano ya es el día siguiente", hoyEnMadrid(Date.parse("2026-07-14T22:30:00Z")) === "2026-07-15");
}

console.log(`\n${fallados ? "❌" : "✅"} cloudflare-web: ${pasados} correctas, ${fallados} fallidas\n`);
if (fallados) process.exit(1);
