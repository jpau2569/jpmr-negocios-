// ============================================================================
//  Tests de Oportunidades Únicas — npm test los ejecuta
// ----------------------------------------------------------------------------
//  No tocan Supabase: se intercepta fetch y se simulan las respuestas.
//  Verifican la validación (nada sin sanear llega a la base de datos), el
//  cálculo de coincidencias (el que en la app vieja daba "64018%") y el
//  handler: sesiones, permisos por rol, portal del comprador y errores.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import handler, { nubeConfigurada } from "../api/_oportunidades.js";
import fichaHandler, { paginaFicha, esc } from "../api/_oportunidades-ficha.js";
import {
  normalizarInmueble, normalizarCliente, coincidencia, mejoresClientes,
  dinero, entero, slug, referencia, tokenPortal, mensajeWhatsapp,
  normalizarFoto, rutaFoto, normalizarGaleria, MAX_FOTO_BYTES, MAX_FOTOS,
  CONTACTO, enlaceWhatsapp, normalizarVideo,
  CARACTERISTICAS, ESTADOS,
  numeroWhatsapp, enlaceWhatsappCliente, mensajesWhatsapp, mejoresInmuebles, mensajeRespuesta,
} from "../lib/oportunidades.js";
import {
  extraerFicha, altaLocal, normalizarAltaIA, pendientesSeguimiento, mensajeSeguimiento, datosTarjeta,
  validarVideo, rutaVideo, rutaVideoPropio, MAX_VIDEO_BYTES,
} from "../lib/oportunidades-extras.js";

let pasados = 0;
let fallados = 0;
function check(nombre, condicion, detalle = "") {
  if (condicion) {
    pasados++;
    console.log(`  ✅ ${nombre}`);
  } else {
    fallados++;
    console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`);
  }
}

function mockRes() {
  const r = { statusCode: 0, body: null, headers: {} };
  return {
    status(c) { r.statusCode = c; return this; },
    json(b) { r.body = b; return this; },
    setHeader(k, v) { r.headers[k] = v; },
    r,
  };
}

const realFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
console.log("\n— saneado de datos —");
// ---------------------------------------------------------------------------
check("precio con puntos de millar", dinero("185.000 €") === 185000);
check("precio con decimales europeos", dinero("1.250,50") === 1250.5);
check("precio negativo o absurdo → null", dinero("-90") === null && dinero("hola") === null);
check("metros con texto alrededor → número", entero("120 m²", 100000) === 120);
check("cantidad negativa → null (no se adivina)", entero("-4", 100) === null);
check("la referencia se genera si no la ponen", referencia("", 7, new Date("2026-03-01")) === "OU-2026-0007");
check("la referencia dada manda", referencia("ac-42", 7) === "AC-42");
check("el slug queda limpio para WhatsApp",
  slug("Ático con terraza en Somió", "Gijón", "OU-2026-0001") === "atico-con-terraza-en-somio-gijon-ou-2026-0001");

// ---------------------------------------------------------------------------
console.log("\n— inmuebles —");
// ---------------------------------------------------------------------------
let r = normalizarInmueble({ titulo: "Ático con terraza", ciudad: "Gijón", precio: "289.000 €", metros: "118", habitaciones: "3", estado: "disponible" });
check("inmueble válido pasa", r.ok && r.inmueble.precio === 289000 && r.inmueble.metros === 118);
check("sin título no pasa", !normalizarInmueble({ ciudad: "Oviedo" }).ok);
check("sin ciudad no pasa", !normalizarInmueble({ titulo: "Piso" }).ok);
check("estado inventado → borrador", normalizarInmueble({ titulo: "P", ciudad: "Oviedo", estado: "vendidisimo" }).inmueble.estado === "borrador");
check("operación inventada → venta", normalizarInmueble({ titulo: "P", ciudad: "Oviedo", operacion: "trueque" }).inmueble.operacion === "venta");

r = normalizarInmueble({
  titulo: "Piso", ciudad: "Oviedo", caracteristicas: ["terraza", "terraza", "helipuerto", 42],
  etiquetas: ["Exclusiva", "exclusiva", "  off-market  "], nombre_agente: "colar esto",
});
check("características fuera de catálogo descartadas", r.inmueble.caracteristicas.join(",") === "terraza");
check("etiquetas libres normalizadas sin repetir", r.inmueble.etiquetas.join(",") === "exclusiva,off-market");
check("campos desconocidos no se guardan", !("nombre_agente" in r.inmueble));

check("publicar sin precio no se permite",
  !normalizarInmueble({ titulo: "P", ciudad: "Oviedo", estado: "disponible", publico: true }).ok);
check("publicar un borrador no se permite",
  !normalizarInmueble({ titulo: "P", ciudad: "Oviedo", precio: "100000", estado: "borrador", publico: true }).ok);
r = normalizarInmueble({ titulo: "Piso en El Llano", ciudad: "Gijón", precio: "132000", estado: "disponible", publico: true });
check("inmueble publicable recibe slug", r.ok && r.inmueble.slug === "piso-en-el-llano-gijon-" + r.inmueble.referencia.toLowerCase());
check("sin publicar no hay slug", normalizarInmueble({ titulo: "P", ciudad: "Oviedo" }).inmueble.slug === null);
check("la dirección exacta se guarda pero es campo aparte",
  normalizarInmueble({ titulo: "P", ciudad: "Oviedo", direccion_privada: "C/ Uría 12, 3º B" }).inmueble.direccion_privada === "C/ Uría 12, 3º B");

// ---------------------------------------------------------------------------
console.log("\n— clientes —");
// ---------------------------------------------------------------------------
check("cliente con teléfono pasa", normalizarCliente({ nombre: "Marta", telefono: "600 111 222" }).ok);
check("cliente sin forma de contacto no pasa", !normalizarCliente({ nombre: "Marta" }).ok);
check("correo mal escrito no pasa", !normalizarCliente({ nombre: "M", email: "marta@" }).ok);
check("tipo inventado → comprador", normalizarCliente({ nombre: "M", telefono: "600", tipo: "okupa" }).cliente.tipo === "comprador");
check("presupuesto saneado", normalizarCliente({ nombre: "M", telefono: "600", presupuesto_max: "250.000 €" }).cliente.presupuesto_max === 250000);

// ---------------------------------------------------------------------------
console.log("\n— coincidencias (el bug del 64018 %) —");
// ---------------------------------------------------------------------------
const compradora = {
  nombre: "Lucía", operacion: "venta", presupuesto_max: 150000,
  zonas: ["oviedo"], habitaciones_min: 3, necesita: ["ascensor", "terraza"],
};
const encaja = { operacion: "venta", precio: 140000, ciudad: "Oviedo", zona: "Buenavista", habitaciones: 3, caracteristicas: ["ascensor", "terraza"] };
let m = coincidencia(compradora, encaja);
check("lo que encaja puntúa alto", m.puntos >= 90, String(m.puntos));
check("y explica por qué", m.motivos.length >= 3 && m.resumen.includes("presupuesto"));

const carisimo = { operacion: "venta", precio: 545000, ciudad: "Gijón", zona: "Somió", habitaciones: 4, caracteristicas: [] };
m = coincidencia(compradora, carisimo);
const porcentajes = m.peros.join(" ").match(/(\d+)%/g) || [];
check("el exceso de presupuesto es un número creíble",
  porcentajes.every((p) => Number.parseInt(p, 10) <= 999), m.peros.join(" | "));
check("263 % de más se dice tal cual", m.peros.some((p) => p.includes("263% por encima")), m.peros.join(" | "));
check("lo que no encaja baja la puntuación", m.puntos < 50, String(m.puntos));

// El caso que rompía la app vieja: presupuesto ridículo frente a precio alto.
m = coincidencia({ ...compradora, presupuesto_max: 500 }, carisimo);
check("presupuesto disparatado no produce 64018 %",
  m.peros.some((p) => p.includes("999% por encima")), m.peros.join(" | "));

m = coincidencia({ ...compradora, presupuesto_max: null, zonas: [] }, encaja);
check("sin presupuesto ni zonas lo dice, no lo inventa",
  m.peros.includes("no tiene presupuesto anotado") && m.peros.includes("no tiene zonas anotadas"));

m = coincidencia({ ...compradora, operacion: "alquiler" }, encaja);
check("operación distinta penaliza de verdad", m.puntos <= 65 && m.peros.includes("la operación no coincide"));

const mejores = mejoresClientes(encaja, [compradora, { ...compradora, nombre: "Ana", presupuesto_max: 90000 }, { nombre: "Fuera", anonimizado: true, operacion: "venta" }]);
check("el ranking ordena de mejor a peor", mejores[0].cliente.nombre === "Lucía" && mejores.length === 2);
check("los clientes anonimizados quedan fuera", !mejores.some((x) => x.cliente.nombre === "Fuera"));

// ---------------------------------------------------------------------------
console.log("\n— portal y mensajes —");
// ---------------------------------------------------------------------------
const t1 = tokenPortal();
check("el token del portal es largo y sin caracteres confusos", t1.length === 32 && !/[loi01]/.test(t1));
check("dos tokens no se repiten", t1 !== tokenPortal());

const mensaje = mensajeWhatsapp({
  cliente: { nombre: "Lucía" },
  inmuebles: [{ titulo: "Ático en Somió", metros: 118, habitaciones: 3 }, { titulo: "Piso en El Llano" }],
  enlacePortal: "https://ejemplo.com/oportunidades/portal.html#abc",
  firma: { agente: "Pau", empresa: "Asesoría Castresana" },
});
check("el mensaje saluda por el nombre", mensaje.startsWith("Hola Lucía"));
check("lista los inmuebles y el enlace",
  mensaje.includes("*Ático en Somió*") && mensaje.includes("3 hab") && mensaje.includes("118 m²") && mensaje.includes("#abc"));

// ---------------------------------------------------------------------------
console.log("\n— handler: sin configurar y validaciones —");
// ---------------------------------------------------------------------------
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
check("nubeConfigurada() detecta que falta", nubeConfigurada() === false);

let res = mockRes();
await handler({ method: "GET" }, res);
check("GET → 405", res.r.statusCode === 405);

res = mockRes();
await handler({ method: "POST", body: { accion: "panel" } }, res);
check("sin claves de Supabase → 503 explicado", res.r.statusCode === 503 && res.r.body.error.includes("SUPABASE_URL"));

process.env.SUPABASE_URL = "https://prueba.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-de-prueba";
process.env.SUPABASE_SERVICE_KEY = "service-de-prueba";

res = mockRes();
await handler({ method: "POST", body: { accion: "hackear" } }, res);
check("acción desconocida → 400", res.r.statusCode === 400);

res = mockRes();
await handler({ method: "POST", body: { accion: "panel" }, headers: {} }, res);
check("acción privada sin sesión → 401", res.r.statusCode === 401);

// ---------------------------------------------------------------------------
console.log("\n— handler: login (Supabase simulado) —");
// ---------------------------------------------------------------------------
const llamadas = [];
function simula(respuestas) {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    // El cuerpo de una subida de foto es binario: no se puede leer como JSON.
    let cuerpoLeido = null;
    if (typeof init?.body === "string") {
      try { cuerpoLeido = JSON.parse(init.body); } catch { cuerpoLeido = init.body; }
    } else if (init?.body) {
      cuerpoLeido = { binario: init.body.length };
    }
    llamadas.push({ url: u, metodo: init?.metodo || init?.method, cuerpo: cuerpoLeido, cabeceras: init?.headers });
    for (const [patron, salida] of respuestas) {
      if (u.includes(patron)) {
        const { estado = 200, datos = null } = typeof salida === "function" ? salida(u, init) : salida;
        return new Response(datos === null ? "" : JSON.stringify(datos), {
          status: estado,
          headers: { "content-type": "application/json" },
        });
      }
    }
    throw new Error("fetch inesperado: " + u);
  };
}

const PERFIL = { id: "u-1", nombre: "Pau", email: "pau@castresana.es", rol: "admin", activo: true };

simula([["/auth/v1/token", { estado: 400, datos: { error_description: "Invalid login credentials" } }]]);
res = mockRes();
await handler({ method: "POST", body: { accion: "login", email: "pau@castresana.es", password: "mala" } }, res);
check("contraseña incorrecta → 401 sin filtrar detalles", res.r.statusCode === 401 && res.r.body.error === "Correo o contraseña incorrectos.");

simula([
  ["/auth/v1/token", { datos: { access_token: "tok-1", refresh_token: "ref-1", expires_at: 999 } }],
  ["/rest/v1/ou_usuarios", { datos: [] }],
]);
res = mockRes();
await handler({ method: "POST", body: { accion: "login", email: "nadie@x.es", password: "buena" } }, res);
check("usuario sin alta en el despacho → 403 explicado", res.r.statusCode === 403 && res.r.body.error.includes("administrador"));

llamadas.length = 0;
simula([
  ["/auth/v1/token", { datos: { access_token: "tok-1", refresh_token: "ref-1", expires_at: 999 } }],
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
]);
res = mockRes();
await handler({ method: "POST", body: { accion: "login", email: "pau@castresana.es", password: "buena" } }, res);
check("login correcto devuelve token y perfil", res.r.statusCode === 200 && res.r.body.token === "tok-1" && res.r.body.usuario.rol === "admin");
check("el perfil se lee con el token del usuario, no con la clave anónima",
  llamadas.find((l) => l.url.includes("ou_usuarios"))?.cabeceras?.Authorization === "Bearer tok-1");

// ---------------------------------------------------------------------------
console.log("\n— handler: guardar inmueble y permisos —");
// ---------------------------------------------------------------------------
llamadas.length = 0;
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/rest/v1/ou_actividad", { datos: null }],
  ["/rest/v1/ou_inmuebles", (u, init) => {
    if ((init?.method || "GET") === "GET") return { datos: [{ id: "i-1" }, { id: "i-2" }] };
    return { datos: [{ id: "i-9", titulo: "Ático con terraza", referencia: "OU-2026-0003" }] };
  }],
]);
res = mockRes();
await handler({
  method: "POST",
  headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.guardar", inmueble: { titulo: "Ático con terraza", ciudad: "Gijón", precio: "289.000" } },
}, res);
check("guardar inmueble → 200", res.r.statusCode === 200 && res.r.body.inmueble.id === "i-9", JSON.stringify(res.r.body));
const insercion = llamadas.find((l) => l.url.includes("ou_inmuebles") && l.metodo === "POST");
check("se guarda el precio ya convertido a número", insercion?.cuerpo?.precio === 289000);
check("el inmueble queda asignado a quien lo crea", insercion?.cuerpo?.agente_id === "u-1");
check("la alta deja rastro en la actividad", llamadas.some((l) => l.url.includes("ou_actividad")));

res = mockRes();
await handler({
  method: "POST",
  headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.guardar", inmueble: { ciudad: "Gijón" } },
}, res);
check("inmueble inválido → 400 con el motivo", res.r.statusCode === 400 && res.r.body.errores.length > 0);

simula([["/rest/v1/ou_usuarios", { datos: [{ ...PERFIL, rol: "lector" }] }]]);
res = mockRes();
await handler({
  method: "POST",
  headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.guardar", inmueble: { titulo: "P", ciudad: "Oviedo" } },
}, res);
check("un lector no puede guardar → 403", res.r.statusCode === 403);

simula([["/rest/v1/ou_usuarios", { estado: 401, datos: { message: "JWT expired" } }]]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer caducado" }, body: { accion: "panel" } }, res);
check("sesión caducada → 401 en cristiano", res.r.statusCode === 401 && res.r.body.error.includes("caducado"));

// ---------------------------------------------------------------------------
console.log("\n— handler: portal del comprador (sin sesión) —");
// ---------------------------------------------------------------------------
llamadas.length = 0;
simula([["/rest/v1/rpc/ou_portal", { datos: { cliente: { nombre: "Lucía" }, inmuebles: [{ slug: "atico" }] } }]]);
res = mockRes();
await handler({ method: "POST", body: { accion: "portal.leer", token: "a".repeat(32) } }, res);
check("el portal abre con el token del cliente", res.r.statusCode === 200 && res.r.body.cliente.nombre === "Lucía");
check("el portal usa la clave de servicio, no la anónima",
  llamadas.find((l) => l.url.includes("ou_portal"))?.cabeceras?.apikey === "service-de-prueba");
check("el portal no devuelve teléfono ni notas del cliente",
  !JSON.stringify(res.r.body.cliente).match(/telefono|email|notas/));

simula([["/rest/v1/rpc/ou_portal", { datos: null }]]);
res = mockRes();
await handler({ method: "POST", body: { accion: "portal.leer", token: "token-malo" } }, res);
check("token de portal inválido → 404 amable", res.r.statusCode === 404 && res.r.body.error.includes("nuevo"));

res = mockRes();
await handler({ method: "POST", body: { accion: "portal.responder", token: "a".repeat(32), slug: "x", respuesta: "borrar_todo" } }, res);
check("respuesta del portal fuera de catálogo → 400", res.r.statusCode === 400);

simula([["/rest/v1/rpc/ou_portal_responde", { datos: { ok: true } }]]);
res = mockRes();
await handler({ method: "POST", body: { accion: "portal.responder", token: "a".repeat(32), slug: "atico", respuesta: "visita" } }, res);
check("respuesta válida se registra", res.r.statusCode === 200 && res.r.body.ok === true);

// ---------------------------------------------------------------------------
console.log("\n— fotos —");
// ---------------------------------------------------------------------------
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)]).toString("base64");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(60)]).toString("base64");

check("jpg con prefijo data: se acepta", normalizarFoto({ tipo: "image/jpeg", datos: "data:image/jpeg;base64," + JPG }).ok);
check("png se acepta", normalizarFoto({ tipo: "image/png", datos: PNG }).ok);
check("un PDF disfrazado no pasa", !normalizarFoto({ tipo: "application/pdf", datos: JPG }).ok);
check("un archivo que no es imagen no pasa (se mira la cabecera, no el nombre)",
  normalizarFoto({ tipo: "image/jpeg", datos: Buffer.from("<?php system($_GET[0]);").toString("base64") }).errores[0].includes("no parece una foto"));
check("base64 corrupto no pasa", !normalizarFoto({ tipo: "image/jpeg", datos: "@@@no-es-base64@@@" }).ok);
check("foto vacía no pasa", !normalizarFoto({ tipo: "image/jpeg", datos: "" }).ok);
const gorda = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(MAX_FOTO_BYTES + 100)]).toString("base64");
check("foto de más de 4 MB no pasa", normalizarFoto({ tipo: "image/jpeg", datos: gorda }).errores[0].includes("4 MB"));

const ruta = rutaFoto("../../etc/passwd", "jpg", () => 0.42);
check("la ruta no deja escapar de la carpeta del inmueble", !ruta.includes("..") && ruta.endsWith(".jpg"));
check("la galería descarta repetidas y acota",
  normalizarGaleria([{ url: "a", ruta: "r1" }, { url: "a", ruta: "r2" }, { url: "b", ruta: "r3" }]).length === 2);

llamadas.length = 0;
let inmuebleFalso = { id: "i-1", titulo: "Ático", fotos: [], portada_url: null };
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/storage/v1/object/inmuebles/", { datos: { Key: "ok" } }],
  ["/rest/v1/ou_inmuebles", (u, init) => {
    const metodo = init?.method || "GET";
    if (metodo === "GET") return { datos: [inmuebleFalso] };
    inmuebleFalso = { ...inmuebleFalso, ...JSON.parse(init.body) };
    return { datos: [inmuebleFalso] };
  }],
]);

res = mockRes();
await handler({
  method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "fotos.subir", id: "i-1", tipo: "image/jpeg", datos: JPG },
}, res);
check("subir foto → 200", res.r.statusCode === 200, JSON.stringify(res.r.body));
check("la foto queda en la galería con su ruta", res.r.body.inmueble.fotos.length === 1 && res.r.body.inmueble.fotos[0].ruta.startsWith("i-1/"));
check("la primera foto se pone de portada sola", res.r.body.inmueble.portada_url === res.r.body.inmueble.fotos[0].url);
const subida = llamadas.find((l) => l.url.includes("/storage/v1/object/inmuebles/"));
check("la foto sube con el token del usuario, no con la clave de servicio",
  subida?.cabeceras?.Authorization === "Bearer tok-1" && subida?.cabeceras?.apikey === "anon-de-prueba");
check("la foto sube con su tipo real", subida?.cabeceras?.["Content-Type"] === "image/jpeg");

res = mockRes();
await handler({
  method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "fotos.subir", id: "i-1", tipo: "image/jpeg", datos: "no-base64-@" },
}, res);
check("foto inválida → 400 sin tocar el almacén", res.r.statusCode === 400);

res = mockRes();
await handler({
  method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "fotos.subir", tipo: "image/jpeg", datos: JPG },
}, res);
check("sin inmueble guardado → avisa de que hay que guardarlo antes",
  res.r.statusCode === 400 && res.r.body.error.includes("Guarda el inmueble"));

// Portada de una foto que no es suya
res = mockRes();
await handler({
  method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "fotos.portada", id: "i-1", url: "https://otra-web.com/foto.jpg" },
}, res);
check("no se puede poner de portada una foto ajena", res.r.statusCode === 400);

// Borrar la portada la reasigna
inmuebleFalso = {
  id: "i-1", titulo: "Ático",
  fotos: [{ url: "u1", ruta: "i-1/a.jpg" }, { url: "u2", ruta: "i-1/b.jpg" }],
  portada_url: "u1",
};
res = mockRes();
await handler({
  method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "fotos.borrar", id: "i-1", ruta: "i-1/a.jpg" },
}, res);
check("al borrar la portada, la siguiente toma el relevo",
  res.r.statusCode === 200 && res.r.body.inmueble.portada_url === "u2" && res.r.body.inmueble.fotos.length === 1);

simula([["/rest/v1/ou_usuarios", { datos: [{ ...PERFIL, rol: "lector" }] }]]);
res = mockRes();
await handler({
  method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "fotos.subir", id: "i-1", tipo: "image/jpeg", datos: JPG },
}, res);
check("un lector no puede subir fotos → 403", res.r.statusCode === 403);

// ---------------------------------------------------------------------------
console.log("\n— vídeos y envío por WhatsApp —");
// ---------------------------------------------------------------------------
check("YouTube normal", normalizarVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.id === "dQw4w9WgXcQ");
check("YouTube corto", normalizarVideo("https://youtu.be/abc123XYZ_-")?.tipo === "youtube");
check("YouTube shorts (los reels de pisos)", normalizarVideo("https://www.youtube.com/shorts/xyz987abcde")?.tipo === "youtube");
check("Vimeo", normalizarVideo("https://vimeo.com/123456789")?.tipo === "vimeo");
check("archivo mp4 por https", normalizarVideo("https://midominio.com/tour.mp4")?.tipo === "archivo");
check("http sin cifrar se rechaza", normalizarVideo("http://inseguro.com/x.mp4") === null);
check("javascript: se rechaza", normalizarVideo("javascript:alert(1)") === null);
check("una web cualquiera se rechaza", normalizarVideo("https://sitio-raro.com/pagina") === null);
check("YouTube se incrusta sin cookies de seguimiento",
  normalizarVideo("https://youtu.be/abc123XYZ_-").embed.includes("youtube-nocookie.com"));
check("el inmueble guarda el vídeo ya normalizado",
  normalizarInmueble({ titulo: "P", ciudad: "Oviedo", video_url: "https://youtu.be/abc123XYZ_-" }).inmueble.video_url === "https://www.youtube.com/watch?v=abc123XYZ_-");
check("un vídeo no admitido no se guarda",
  normalizarInmueble({ titulo: "P", ciudad: "Oviedo", video_url: "https://sitio-raro.com/x" }).inmueble.video_url === null);

const msg = mensajeWhatsapp({
  cliente: { nombre: "Lucía" },
  inmuebles: [
    { titulo: "Ático en San Lorenzo", precio: 289000, habitaciones: 3, metros: 118, zona: "Centro", ciudad: "Gijón",
      slug: "atico-gijon", video_url: "https://www.youtube.com/watch?v=abc" },
    { titulo: "Piso sin publicar", precio: 132000, ciudad: "Oviedo" },
  ],
  enlacePortal: "https://ej.com/oportunidades/portal.html#tok",
  base: "https://ej.com",
  firma: { agente: "Pau" },
});
check("el mensaje saluda y firma", msg.startsWith("Hola Lucía, soy Pau de"));
// Intl pone un espacio duro antes del €: se normaliza para comparar.
const msgLlano = msg.replace(/\u00a0/g, " ");
check("cada inmueble lleva su precio y sus datos", msgLlano.includes("289.000 € · 3 hab · 118 m² · Centro, Gijón"), msgLlano.split("\n")[4]);
check("el publicado lleva su ficha", msg.includes("https://ej.com/p/atico-gijon"));
check("el que no está publicado no inventa enlace", !msg.includes("https://ej.com/p/\n") && !/\/p\/$/m.test(msg));
check("el vídeo va en el mensaje", msg.includes("Vídeo: https://www.youtube.com/watch?v=abc"));
check("y el enlace del portal al final", msg.includes("portal.html#tok"));

// La ficha pública incrusta el vídeo
const conVideo = paginaFicha({ slug: "x", referencia: "R", titulo: "Ático", precio: 200000, ciudad: "Gijón",
  operacion: "venta", caracteristicas: [], fotos: [], video_url: "https://www.youtube.com/watch?v=abc123XYZ" }, "https://ej.com");
check("la ficha incrusta el vídeo de YouTube", conVideo.includes("youtube-nocookie.com/embed/abc123XYZ"));
const videoMalo = paginaFicha({ slug: "x", referencia: "R", titulo: "Ático", precio: 200000, ciudad: "Gijón",
  operacion: "venta", caracteristicas: [], fotos: [], video_url: "https://sitio-raro.com/malo" }, "https://ej.com");
check("un enlace de vídeo no admitido no se incrusta",
  !videoMalo.includes("<iframe") && !videoMalo.includes("sitio-raro"));

// Envío: avisa de lo que el cliente no podrá ver
llamadas.length = 0;
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/rest/v1/ou_actividad", { datos: null }],
  ["/rest/v1/ou_clientes", { datos: [{ id: "c-1", nombre: "Lucía", telefono: "600111222", inmuebles_autorizados: [], token_portal: null }] }],
  ["/rest/v1/ou_inmuebles", { datos: [
    { id: "i-1", titulo: "Ático publicado", precio: 289000, slug: "atico", publico: true },
    { id: "i-2", titulo: "Piso en borrador", precio: 132000, slug: null, publico: false },
  ] }],
]);
res = mockRes();
await handler({
  method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "seleccion.enviar", cliente_id: "c-1", inmuebles: ["i-1", "i-2"], base_url: "https://ej.com" },
}, res);
check("enviar varios → 200", res.r.statusCode === 200, JSON.stringify(res.r.body).slice(0, 120));
check("avisa de los que el cliente no podrá abrir",
  res.r.body.sin_publicar?.join(",") === "Piso en borrador", JSON.stringify(res.r.body.sin_publicar));
check("el enlace del portal se genera con el dominio recibido",
  res.r.body.enlace.startsWith("https://ej.com/oportunidades/portal.html#"));

check("el envío trae los tres estilos de mensaje",
  ["completo", "corto", "formal"].every((e) => typeof res.r.body.mensajes?.[e] === "string" && res.r.body.mensajes[e].length > 20));
check("el mensaje de siempre no cambia (compatibilidad)", res.r.body.mensaje === res.r.body.mensajes.completo);

// ---------------------------------------------------------------------------
console.log("\n— WhatsApp pro: números, estilos, sugerencias y respuestas —");
// ---------------------------------------------------------------------------
check("móvil español de 9 cifras → con 34", numeroWhatsapp("663 26 38 42") === "34663263842");
check("+34 con espacios", numeroWhatsapp("+34 663-263-842") === "34663263842");
check("0034 delante", numeroWhatsapp("0034663263842") === "34663263842");
check("extranjero con prefijo se respeta", numeroWhatsapp("+44 7700 900123") === "447700900123");
check("un número incompleto no da enlace", numeroWhatsapp("12345") === "" && enlaceWhatsappCliente("12345", "hola") === "");
check("enlace a cliente con texto", enlaceWhatsappCliente("600111222", "Hola Ana") === "https://wa.me/34600111222?text=Hola%20Ana");

const estilos = mensajesWhatsapp({
  cliente: { nombre: "Lucía" },
  inmuebles: [{ titulo: "Ático", precio: 289000, slug: "atico", operacion: "venta" }],
  enlacePortal: "https://ej.com/oportunidades/portal.html#tok", base: "https://ej.com", firma: { agente: "Pau" },
});
check("estilo corto: breve y con la ficha", estilos.corto.length < estilos.completo.length && estilos.corto.includes("https://ej.com/p/atico"));
check("estilo formal: de usted", estilos.formal.includes("Le escribe Pau") && estilos.formal.includes("Quedo a su disposición"));
check("estilo formal con un solo inmueble no habla en plural", !estilos.formal.includes("verlos todos"));
check("alquiler lleva /mes en el corto",
  mensajesWhatsapp({ cliente: { nombre: "A" }, inmuebles: [{ titulo: "B", precio: 700, operacion: "alquiler" }] }).corto.includes("/mes"));

const cliLucia = { nombre: "Lucía", operacion: "venta", presupuesto_max: 200000, zonas: ["Oviedo"], inmuebles_autorizados: ["i-3"] };
const cartera = [
  { id: "i-1", titulo: "Encaja", operacion: "venta", precio: 180000, ciudad: "Oviedo", estado: "disponible" },
  { id: "i-2", titulo: "Caro", operacion: "venta", precio: 400000, ciudad: "Oviedo", estado: "disponible" },
  { id: "i-3", titulo: "Ya enviado", operacion: "venta", precio: 170000, ciudad: "Oviedo", estado: "disponible" },
  { id: "i-4", titulo: "Vendido", operacion: "venta", precio: 150000, ciudad: "Oviedo", estado: "vendido" },
  { id: "i-5", titulo: "Borrador", operacion: "venta", precio: 150000, ciudad: "Oviedo", estado: "borrador" },
];
const sug = mejoresInmuebles(cliLucia, cartera);
check("sugerencias: el que mejor encaja va primero", sug[0].inmueble.id === "i-1", sug.map((x) => x.inmueble.id).join());
check("sugerencias: lo ya enviado va al final y marcado", sug.at(-1).inmueble.id === "i-3" && sug.at(-1).ya_enviado === true);
check("sugerencias: no ofrece vendidos ni borradores", !sug.some((x) => ["i-4", "i-5"].includes(x.inmueble.id)));

const resp = mensajeRespuesta({ respuesta: "visita", cliente: { nombre: "Marta" }, inmueble: { titulo: "Piso Uría" }, firma: { agente: "Pau" } });
check("contestar a una petición de visita pregunta día y hora", resp.includes("Marta") && resp.includes("Piso Uría") && resp.includes("día"));
check("cada respuesta del portal tiene su contestación",
  ["interesa", "visita", "no_encaja", "similares"].every((r) => mensajeRespuesta({ respuesta: r, cliente: { nombre: "X" }, inmueble: { titulo: "Y" } }).length > 30));

// La ficha del cliente: enviados, respuestas y sugerencias
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/rest/v1/ou_clientes", { datos: [{ id: "c-1", ...cliLucia, telefono: "600111222" }] }],
  ["/rest/v1/ou_inmuebles", { datos: cartera }],
  ["/rest/v1/ou_respuestas", { datos: [
    { id: "r-1", respuesta: "visita", creado: "2026-09-20T10:00:00Z",
      cliente: { id: "c-1", nombre: "Lucía", telefono: "600111222" }, inmueble: { id: "i-3", titulo: "Ya enviado" } },
  ] }],
]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" }, body: { accion: "cliente.detalle", id: "c-1" } }, res);
check("cliente.detalle → 200", res.r.statusCode === 200, JSON.stringify(res.r.body).slice(0, 160));
check("dice qué le has mandado", res.r.body.enviados?.length === 1 && res.r.body.enviados[0].id === "i-3");
check("y qué ha contestado a cada uno", res.r.body.enviados?.[0].respuesta === "visita");
check("la respuesta trae el WhatsApp de contestación escrito", res.r.body.respuestas?.[0].mensaje.includes("visitar"));
check("sugiere los que encajan sin repetir el enviado arriba", res.r.body.sugeridos?.[0].inmueble.id === "i-1");

res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" }, body: { accion: "cliente.detalle" } }, res);
check("cliente.detalle sin id → 400", res.r.statusCode === 400);

// ---------------------------------------------------------------------------
console.log("\n— alta rápida, seguimientos y tarjeta —");
// ---------------------------------------------------------------------------
const alta1 = extraerFicha("Piso 3 hab en El Llano, Gijón. 185k. 2 baños, 90 m2, ascensor y terraza");
check("alta: precio en «185k»", alta1.precio === 185000);
check("alta: habitaciones, baños y metros", alta1.habitaciones === 3 && alta1.banos === 2 && alta1.metros === 90);
check("alta: ciudad y zona", alta1.ciudad === "Gijón" && alta1.zona === "El Llano", JSON.stringify(alta1));
check("alta: características del catálogo", alta1.caracteristicas.includes("ascensor") && alta1.caracteristicas.includes("terraza"));
check("alta: título armado solo con datos", alta1.titulo === "Piso de 3 habitaciones en El Llano, Gijón");
const alta2 = extraerFicha("alquilo apartamento amueblado en Avilés 650 €/mes, dos habitaciones, sin ascensor");
check("alta: alquiler con renta mensual", alta2.operacion === "alquiler" && alta2.precio === 650);
check("alta: números en palabras", alta2.habitaciones === 2);
check("alta: «sin ascensor» no marca ascensor", !alta2.caracteristicas.includes("ascensor"));
check("alta: formato 245.000 €", extraerFicha("ático en Oviedo 245.000 € tres habitaciones").precio === 245000);
const alta3 = altaLocal("casa con jardín en Llanes");
check("alta local: no inventa precio ni metros", !("precio" in alta3) && !("metros" in alta3));
check("alta local: dice lo que falta", alta3.faltan.includes("precio") && alta3.faltan.includes("metros"));
check("alta local: el anuncio no menciona datos que no hay", !/\d+ m²|€/.test(alta3.descripcion), alta3.descripcion);

const notasIA = "piso en Oviedo zona Buenavista, 3 habitaciones, 180.000 euros, terraza";
const ia = normalizarAltaIA({
  titulo: "Piso luminoso con terraza en Buenavista", operacion: "venta", precio: 180000, ciudad: "Oviedo", zona: "Buenavista",
  habitaciones: 3, banos: 2, metros: 110, caracteristicas: ["terraza", "vistas", "piscina", "inventada"],
  descripcion: "Texto de la IA", faltan: ["metros"],
}, notasIA);
check("IA: los datos que están en las notas se aceptan", ia.precio === 180000 && ia.habitaciones === 3 && ia.ciudad === "Oviedo");
check("IA: baños y metros inventados se descartan", !("banos" in ia) && !("metros" in ia), JSON.stringify(ia));
check("IA: vistas y piscina inventadas se descartan", ia.caracteristicas.join() === "terraza", ia.caracteristicas.join());
check("IA: una ciudad que no está en las notas no entra",
  !normalizarAltaIA({ titulo: "x", ciudad: "Madrid" }, "piso de 2 hab 90.000 €").ciudad);
check("IA: respuesta vacía → null (se usa el extractor local)", normalizarAltaIA(null, notasIA) === null);

const hoy = Date.parse("2026-09-22T10:00:00Z");
const dia = 86400000;
const segs = pendientesSeguimiento([
  { id: "a", nombre: "Ana", inmuebles_autorizados: ["x"], ultimo_contacto: new Date(hoy - 4 * dia).toISOString() },
  { id: "b", nombre: "Bea", inmuebles_autorizados: ["x"], ultimo_contacto: new Date(hoy - 8 * dia).toISOString() },
  { id: "c", nombre: "Carla", inmuebles_autorizados: ["x"], ultimo_contacto: new Date(hoy - 1 * dia).toISOString() },
  { id: "d", nombre: "Dani", inmuebles_autorizados: [], ultimo_contacto: new Date(hoy - 9 * dia).toISOString() },
  { id: "e", nombre: "Eva", inmuebles_autorizados: ["x"], ultimo_contacto: new Date(hoy - 5 * dia).toISOString() },
], [{ cliente_id: "e", creado: new Date(hoy - 2 * dia).toISOString() }], hoy);
check("seguimiento: solo quien lleva 3+ días sin contestar", segs.map((x) => x.cliente.id).join() === "b,a", segs.map((x) => x.cliente.id).join());
check("seguimiento: el que más espera va primero", segs[0].dias === 8);
check("seguimiento: 4 días → «¿pudiste echar un vistazo?»",
  mensajeSeguimiento({ cliente: { nombre: "Ana" }, dias: 4, enviados: 2 }).includes("echar un vistazo"));
check("seguimiento: 10+ días → «¿sigues buscando?»",
  mensajeSeguimiento({ cliente: { nombre: "Ana" }, dias: 12 }).includes("Sigues buscando"));
check("seguimiento: singular si solo mandaste uno",
  mensajeSeguimiento({ cliente: { nombre: "Ana" }, dias: 4, enviados: 1 }).includes("el piso que te pasé"));

const tj = datosTarjeta({ titulo: "Ático", precio: 289000, operacion: "venta", habitaciones: 3, metros: 118, caracteristicas: ["terraza"] });
check("tarjeta: precio, datos y extras", tj.precio.replace(/\u00a0/g, " ") === "289.000 €" && tj.datos.join() === "3 hab,118 m²" && tj.extras[0] === "Terraza");
check("tarjeta: sin precio no inventa", datosTarjeta({ titulo: "X" }).precio === "Consultar precio");

// Backend: alta rápida sin clave de IA → extractor local
delete process.env.ANTHROPIC_API_KEY;
simula([["/rest/v1/ou_usuarios", { datos: [PERFIL] }]]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.redactar", notas: "piso 2 hab en Mieres 95.000 €" } }, res);
check("redactar sin clave → 200 con el asistente local", res.r.statusCode === 200 && res.r.body.motor === "local" && res.r.body.ficha.precio === 95000);
check("y avisa de que falta la clave", /ANTHROPIC_API_KEY/.test(res.r.body.aviso || ""));
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" }, body: { accion: "inmuebles.redactar", notas: "hola" } }, res);
check("redactar con notas vacías → 400", res.r.statusCode === 400);
simula([["/rest/v1/ou_usuarios", { datos: [{ ...PERFIL, rol: "lector" }] }]]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.redactar", notas: "piso 2 hab en Mieres 95.000 €" } }, res);
check("un lector no redacta fichas → 403", res.r.statusCode === 403);

// Backend: marcar un seguimiento como hecho
llamadas.length = 0;
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/rest/v1/ou_actividad", { datos: null }],
  ["/rest/v1/ou_clientes", { datos: [{ id: "c-1", nombre: "Lucía", ultimo_contacto: "2026-09-22T10:00:00Z" }] }],
]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" }, body: { accion: "cliente.contactado", id: "c-1" } }, res);
check("cliente.contactado → 200", res.r.statusCode === 200);
check("pone la fecha de último contacto a hoy",
  llamadas.some((l) => l.url.includes("ou_clientes") && l.metodo === "PATCH" && l.cuerpo?.ultimo_contacto));
check("y lo apunta en la actividad", llamadas.some((l) => l.url.includes("ou_actividad") && l.cuerpo?.tipo === "seguimiento"));

// ---------------------------------------------------------------------------
console.log("\n— 18 fotos, vídeo propio e IA por herramienta —");
// ---------------------------------------------------------------------------
check("máximo 18 fotos por piso", MAX_FOTOS === 18);
check("vídeo MP4 de 30 MB → vale", validarVideo({ tipo: "video/mp4", tamano: 30 * 1048576 }).ok);
check("vídeo de iPhone (MOV) → vale", validarVideo({ tipo: "video/quicktime", tamano: 1000 }).ext === "mov");
check("vídeo de más de 50 MB → rechazado y explica cómo", /50 MB/.test(validarVideo({ tipo: "video/mp4", tamano: MAX_VIDEO_BYTES + 1 }).error || ""));
check("un PDF no es un vídeo", !validarVideo({ tipo: "application/pdf", tamano: 10 }).ok);
check("la ruta del vídeo va dentro de la carpeta del inmueble", /^i-1\/[a-z0-9]{10}\.mp4$/.test(rutaVideo("i-1", "mp4")));
check("reconoce un vídeo subido a nuestro almacén",
  rutaVideoPropio("https://x.supabase.co/storage/v1/object/public/videos/i-1/abc.mp4", "https://x.supabase.co") === "i-1/abc.mp4");
check("y no confunde un vídeo de YouTube con uno propio", rutaVideoPropio("https://youtu.be/abc", "https://x.supabase.co") === null);

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://x.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "srv";
llamadas.length = 0;
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/rest/v1/ou_inmuebles", { datos: [{ id: "i-1", titulo: "Ático", video_url: null, fotos: [] }] }],
  ["/storage/v1/bucket", { estado: 400, datos: { statusCode: "409", error: "Duplicate" } }],
  ["/storage/v1/object/upload/sign/videos/", { datos: { url: "/object/upload/sign/videos/i-1/abc.mp4?token=t" } }],
]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "video.preparar", id: "i-1", tipo: "video/mp4", tamano: 20 * 1048576 } }, res);
check("video.preparar → dirección firmada para subir directo al almacén",
  res.r.statusCode === 200 && res.r.body.subida.includes("/storage/v1/object/upload/sign/videos/") && res.r.body.ruta.startsWith("i-1/"),
  JSON.stringify(res.r.body));
check("si el bucket de vídeos ya existe, no falla", res.r.statusCode === 200);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "video.preparar", id: "i-1", tipo: "video/mp4", tamano: 80 * 1048576 } }, res);
check("video.preparar de 80 MB → 400", res.r.statusCode === 400);

simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/rest/v1/ou_actividad", { datos: null }],
  ["/storage/v1/object/public/videos/", { datos: null }],
  ["/rest/v1/ou_inmuebles", (u, init) => ({ datos: [{ id: "i-1", titulo: "Ático", fotos: [],
    video_url: (init?.method || init?.metodo) === "PATCH" ? JSON.parse(init.body).video_url : null }] })],
]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" }, body: { accion: "video.guardar", id: "i-1", ruta: "i-1/abc.mp4" } }, res);
check("video.guardar pone el vídeo en la ficha", res.r.statusCode === 200 && res.r.body.inmueble.video_url.endsWith("/videos/i-1/abc.mp4"), JSON.stringify(res.r.body).slice(0, 200));
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" }, body: { accion: "video.guardar", id: "i-1", ruta: "i-2/otro.mp4" } }, res);
check("no se puede colgar el vídeo de otro inmueble", res.r.statusCode === 400);

// La IA devuelve la ficha como llamada a herramienta
process.env.ANTHROPIC_API_KEY = "sk-prueba";
let pedido = null;
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["api.anthropic.com", (u, init) => { pedido = JSON.parse(init.body); return { datos: {
    id: "m", type: "message", role: "assistant", model: "x", stop_reason: "tool_use", stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: "tool_use", id: "t", name: "rellenar_ficha", input: {
      titulo: "Piso con terraza en El Llano", operacion: "venta", precio: 185000, ciudad: "Gijón", zona: "El Llano",
      habitaciones: 3, banos: 2, metros: 90, caracteristicas: ["terraza", "piscina"], descripcion: "Anuncio de la IA.", faltan: ["planta"] } }],
  } }; }],
]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.redactar", notas: "piso 3 hab en El Llano, Gijón, 185k, 2 baños, 90 m2, terraza" } }, res);
check("IA: la ficha llega por herramienta y se usa", res.r.body.motor === "ia" && res.r.body.ficha.titulo === "Piso con terraza en El Llano", JSON.stringify(res.r.body).slice(0, 200));
check("IA: se le obliga a usar la herramienta", pedido?.tool_choice?.name === "rellenar_ficha" && pedido?.max_tokens >= 3000);
check("IA: la piscina inventada se descarta también por esta vía", res.r.body.ficha.caracteristicas.join() === "terraza");
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["api.anthropic.com", { datos: { id: "m", type: "message", role: "assistant", model: "x", stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: "Lo siento" }] } }],
]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.redactar", notas: "piso 3 hab en Mieres 95.000 €" } }, res);
check("IA sin ficha → reintenta y cae al asistente local sin error", res.r.statusCode === 200 && res.r.body.motor === "local" && res.r.body.ficha.precio === 95000);
delete process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
console.log("\n— referencia = calle y número —");
// ---------------------------------------------------------------------------
check("la referencia admite calle y número tal cual", referencia("Uría 12, 3ºB") === "Uría 12, 3ºB");
check("se limpian espacios de más", referencia("  C/  Uría   12 ") === "C/ Uría 12");
check("los símbolos raros se quitan", referencia("Uría <b>12</b>") === "Uría b12/b");
const conRef = mensajesWhatsapp({
  cliente: { nombre: "Lucía" }, base: "https://ej.com", firma: { agente: "Pau" },
  inmuebles: [{ titulo: "Ático", precio: 289000, slug: "atico", referencia: "Uría 12, 3ºB" }],
});
check("el WhatsApp completo lleva la calle", conRef.completo.includes("📍 Uría 12, 3ºB"));
check("el corto también", conRef.corto.includes("📍 Uría 12, 3ºB"));
check("el de usted como «Referencia:»", conRef.formal.includes("Referencia: Uría 12, 3ºB"));
check("un código automático antiguo no se manda",
  !mensajesWhatsapp({ cliente: { nombre: "A" }, inmuebles: [{ titulo: "B", referencia: "OU-2026-0001" }] }).completo.includes("OU-2026"));
simula([
  ["/rest/v1/ou_usuarios", { datos: [PERFIL] }],
  ["/rest/v1/ou_inmuebles?select=id&", { datos: [] }],
  ["/rest/v1/ou_inmuebles", { estado: 409, datos: { message: 'duplicate key value violates unique constraint "ou_inmuebles_referencia_key"' } }],
]);
res = mockRes();
await handler({ method: "POST", headers: { authorization: "Bearer tok-1" },
  body: { accion: "inmuebles.guardar", inmueble: { titulo: "Piso", ciudad: "Oviedo", referencia: "Uría 12" } } }, res);
check("dos pisos con la misma calle → aviso claro, no error raro",
  res.r.statusCode === 409 && res.r.body.error.includes("Uría 12, 3ºB"), JSON.stringify(res.r.body));

// El comprobador de instalación
delete process.env.SUPABASE_URL;
res = mockRes();
await handler({ method: "POST", body: { accion: "estado" }, headers: {} }, res);
check("el comprobador funciona aunque no haya nada configurado",
  res.r.statusCode === 200 && res.r.body.listo === false);
check("y dice exactamente qué falta y dónde ponerlo",
  res.r.body.pasos.some((p) => !p.ok && p.arreglo.includes("Environment Variables")));
check("el comprobador no filtra ninguna clave",
  !JSON.stringify(res.r.body).includes("service-de-prueba") && !JSON.stringify(res.r.body).includes("anon-de-prueba"));
process.env.SUPABASE_URL = "https://prueba.supabase.co";

// ---------------------------------------------------------------------------
console.log("\n— ficha pública compartible (/p/<slug>) —");
// ---------------------------------------------------------------------------
check("el WhatsApp de contacto es el del despacho", CONTACTO.whatsapp === "663263842");
check("el enlace de WhatsApp lleva el prefijo de España",
  enlaceWhatsapp("hola").startsWith("https://wa.me/34663263842?text="));
check("el texto del enlace va codificado", enlaceWhatsapp("piso en Gijón & Oviedo").includes("%26"));

check("esc() cierra las comillas y los signos", esc('<img src=x onerror="alert(1)">') === "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

const FICHA = {
  slug: "atico-con-terraza-gijon-ou-2026-0001", referencia: "OU-2026-0001",
  titulo: "Ático con terraza en San Lorenzo", operacion: "venta", precio: 289000,
  ciudad: "Gijón", zona: "Centro", habitaciones: 3, banos: 2, metros: 118,
  caracteristicas: ["terraza", "vistas"], descripcion: "Ático exterior con terraza al sur.",
  portada_url: "https://ejemplo.com/foto1.jpg",
  fotos: [{ url: "https://ejemplo.com/foto1.jpg" }, { url: "https://ejemplo.com/foto2.jpg" }],
};
const html = paginaFicha(FICHA, "https://ejemplo.com");

check("la tarjeta de WhatsApp lleva título con precio",
  html.includes('<meta property="og:title" content="Ático con terraza en San Lorenzo · 289.000') , "og:title");
check("la tarjeta lleva la foto de portada",
  html.includes('<meta property="og:image" content="https://ejemplo.com/foto1.jpg"'));
check("la tarjeta lleva la dirección canónica",
  html.includes(`<meta property="og:url" content="https://ejemplo.com/p/${FICHA.slug}"`));
check("la descripción de la tarjeta usa datos reales",
  html.includes("3 hab · 2 baños · 118 m²"));
check("el enlace no se indexa en Google por defecto", html.includes('name="robots" content="noindex, nofollow"'));
check("el botón de visita escribe al WhatsApp del despacho",
  html.includes("wa.me/34663263842") && html.includes("Pedir visita por WhatsApp"));
check("el mensaje del botón cita la referencia", html.includes("OU-2026-0001"));
check("las características salen con su nombre, no con el identificador",
  html.includes(">Terraza<") && html.includes(">Vistas<") && !html.includes(">terraza<"));
check("la segunda foto también se muestra", html.includes("foto2.jpg"));
check("aparece el aviso de que los datos son orientativos", html.includes("no constituyen oferta contractual"));

// Lo que NUNCA debe salir en una ficha pública
const conPrivados = paginaFicha({ ...FICHA, direccion_privada: "C/ Uría 12, 3º B", agente_id: "u-1" }, "https://ejemplo.com");
check("la dirección exacta no aparece en la ficha pública", !conPrivados.includes("Uría"));

// Un título con comillas o etiquetas no rompe la página ni inyecta nada
const conTrampa = paginaFicha({ ...FICHA, titulo: '<script>alert(1)</script>"', descripcion: "<b>ojo</b>" }, "https://ejemplo.com");
check("un título con código se escapa en el cuerpo y en las etiquetas",
  !conTrampa.includes("<script>alert(1)</script>") && conTrampa.includes("&lt;script&gt;"));
check("la descripción también se escapa", !conTrampa.includes("<b>ojo</b>"));

// El handler
function mockResHtml() {
  const r = { statusCode: 0, cuerpo: "", headers: {} };
  return {
    status(c) { r.statusCode = c; return this; },
    send(t) { r.cuerpo = t; return this; },
    setHeader(k, v) { r.headers[k] = v; },
    r,
  };
}

let rh = mockResHtml();
await fichaHandler({ query: { slug: "" }, headers: {} }, rh);
check("sin slug → 400 con página amable", rh.r.statusCode === 400 && rh.r.cuerpo.includes("Enlace incompleto"));

simula([["/rest/v1/ou_publico", { datos: [] }]]);
rh = mockResHtml();
await fichaHandler({ query: { slug: "no-existe" }, headers: { host: "ejemplo.com" } }, rh);
check("inmueble retirado → 404 que invita a escribir",
  rh.r.statusCode === 404 && rh.r.cuerpo.includes("ya no está disponible") && rh.r.cuerpo.includes("wa.me/34663263842"));

llamadas.length = 0;
simula([["/rest/v1/ou_publico", { datos: [FICHA] }]]);
rh = mockResHtml();
await fichaHandler({ query: { slug: FICHA.slug }, headers: { host: "ejemplo.com" } }, rh);
check("ficha publicada → 200 con la página montada",
  rh.r.statusCode === 200 && rh.r.cuerpo.includes("Ático con terraza en San Lorenzo"));
check("se sirve como HTML", String(rh.r.headers["Content-Type"]).includes("text/html"));
check("se cachea un rato en el borde", String(rh.r.headers["Cache-Control"]).includes("s-maxage"));
check("la ficha se lee de la vista pública, no de la tabla",
  llamadas.some((l) => l.url.includes("ou_publico")) && !llamadas.some((l) => l.url.includes("ou_inmuebles")));

rh = mockResHtml();
await fichaHandler({ query: { slug: "../../ou_clientes?select=*" }, headers: { host: "ejemplo.com" } }, rh);
check("un slug con trampa se limpia antes de consultar",
  !llamadas.some((l) => l.url.includes("ou_clientes")), llamadas.map((l) => l.url).join(" "));

// ---------------------------------------------------------------------------
console.log("\n— el esquema SQL y la app van a una —");
// ---------------------------------------------------------------------------
const { readFileSync } = await import("node:fs");
const sql = readFileSync(new URL("../oportunidades/esquema.sql", import.meta.url), "utf8");
check("el esquema crea todas las tablas que usa el backend",
  ["ou_usuarios", "ou_inmuebles", "ou_clientes", "ou_actividad", "ou_tareas", "ou_respuestas"].every((t) => sql.includes(`create table if not exists public.${t}`)));
check("RLS activado en todas", (sql.match(/enable row level security/g) || []).length >= 6);
check("los estados del catálogo son los del check de la tabla",
  ESTADOS.every((e) => sql.includes(`'${e.id}'`)));
check("la vista pública no expone la dirección privada",
  !sql.split("create or replace view public.ou_publico")[1].split(";")[0].includes("direccion_privada"));
check("el esquema añade la columna del vídeo aunque la base ya existiera",
  sql.includes("add column if not exists video_url"));
check("la vista pública incluye el vídeo", sql.split("create or replace view public.ou_publico")[1].split(";")[0].includes("video_url"));
check("el esquema crea el almacén de fotos con límite y tipos",
  sql.includes("storage.buckets") && sql.includes("'image/webp'") && sql.includes("6291456"));
check("solo el personal sube o borra fotos",
  sql.includes("create policy ou_fotos_sube") && sql.includes("public.ou_es_staff()"));
check("las funciones del portal no las puede llamar cualquiera",
  sql.includes("revoke all on function public.ou_portal(text) from public, anon, authenticated"));

globalThis.fetch = realFetch;

/* ========================================================================== */
//  La interfaz en un Chromium real
//  --------------------------------------------------------------------------
//  Existe por un fallo que llegó a producción: el comprobador de instalación
//  terminaba escribiendo la palabra «null» debajo de los avisos. `el()`
//  descarta los hijos nulos, pero `replaceChildren()` del navegador los
//  convierte en texto, y aquí se pinta con `condición ? el(...) : null`.
//  Ahora todo pasa por `pintar()`; esto vigila que siga siendo así.
/* ========================================================================== */
let chromium = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("\n⚠️  Playwright no está instalado: me salto los tests de interfaz.");
}

if (chromium) {
  console.log("\n🌐 Interfaz en Chromium");

  const RAIZ = new URL("..", import.meta.url).pathname;
  const MIME = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png",
    ".webmanifest": "application/manifest+json",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  };

  // Lo que contestaría el backend. `estado` va sin ninguna variable puesta:
  // es justo el caso en el que aparecía el «null».
  const RESPUESTAS = {
    estado: {
      listo: false,
      pasos: [
        { nombre: "Dirección del proyecto (SUPABASE_URL)", ok: false, detalle: "falta", arreglo: "Vercel → Settings → Environment Variables." },
        { nombre: "Clave pública (SUPABASE_ANON_KEY)", ok: false, detalle: "falta", arreglo: "La clave anon public." },
        { nombre: "Tablas creadas", ok: true, detalle: "las 6 tablas existen" },
      ],
    },
    perfil: { usuario: { id: "u-1", nombre: "Pau", rol: "admin" } },
    panel: {
      usuario: { id: "u-1", nombre: "Pau", rol: "admin" },
      metricas: { disponibles: 2, borradores: 0, reservados: 0, vendidos: 0, total: 2 },
      inmuebles: [], tareas: [], actividad: [],
      seguimientos: [{
        cliente: { id: "c-9", nombre: "Bea", telefono: "611 222 333" }, dias: 5, enviados: 2,
        mensaje: "Hola Bea, soy Pau. ¿Pudiste echar un vistazo a los pisos que te pasé?",
      }],
      respuestas: [{
        id: "r-1", respuesta: "visita", creado: new Date().toISOString(),
        cliente: { id: "c-1", nombre: "Lucía", telefono: "600 111 222" },
        inmueble: { id: "i-1", titulo: "Ático en Uría" },
        mensaje: "Hola Lucía, soy Pau. He visto que quieres visitar *Ático en Uría*",
      }],
    },
    "clientes.listar": { clientes: [
      { id: "c-1", nombre: "Lucía", apellidos: "Gar", telefono: "600 111 222", tipo: "comprador",
        presupuesto_max: 200000, zonas: ["Oviedo"], inmuebles_autorizados: ["i-3"], ultimo_contacto: new Date().toISOString() },
      { id: "c-2", nombre: "Sin Móvil", tipo: "comprador", zonas: [], inmuebles_autorizados: [] },
    ] },
    "cliente.detalle": {
      cliente: { id: "c-1", nombre: "Lucía", telefono: "600 111 222", tipo: "comprador", operacion: "venta", zonas: ["Oviedo"], necesita: [] },
      enviados: [{ id: "i-3", titulo: "Piso ya enviado", precio: 170000, respuesta: "visita" }],
      respuestas: [{ id: "r-1", respuesta: "visita", inmueble: { id: "i-3", titulo: "Piso ya enviado" },
        cliente: { id: "c-1", nombre: "Lucía" }, mensaje: "Hola Lucía, ¿qué día te viene bien?" }],
      sugeridos: [
        { inmueble: { id: "i-1", titulo: "Ático en Uría", precio: 189000, operacion: "venta", publico: true, slug: "atico" }, puntos: 90, resumen: "encaja", ya_enviado: false },
        { inmueble: { id: "i-2", titulo: "Piso Buenavista", precio: 175000, operacion: "venta", publico: true, slug: "bv" }, puntos: 60, resumen: "zona", ya_enviado: false },
        { inmueble: { id: "i-4", titulo: "Bajo con patio", precio: 150000, operacion: "venta", publico: false, slug: null }, puntos: 30, resumen: "poco", ya_enviado: false },
        { inmueble: { id: "i-3", titulo: "Piso ya enviado", precio: 170000, operacion: "venta", publico: true, slug: "ya" }, puntos: 80, resumen: "ya", ya_enviado: true },
      ],
    },
    "seleccion.enviar": {
      cliente: { id: "c-1", nombre: "Lucía", telefono: "600 111 222" },
      enlace: "https://ej.com/oportunidades/portal.html#tok", sin_publicar: [],
      mensaje: "Hola Lucía, soy Pau (completo)",
      mensajes: { completo: "Hola Lucía, soy Pau (completo)", corto: "Hola Lucía! (corto)", formal: "Buenos días, Lucía (formal)" },
    },
    "cliente.contactado": { cliente: { id: "c-9", nombre: "Bea" } },
    "video.preparar": { subida: "http://127.0.0.1:8131/__subida?token=t", ruta: "i-1/abc.mp4", tipo: "video/mp4" },
    "video.guardar": { inmueble: { id: "i-1", titulo: "Ático", fotos: [],
      video_url: "https://x.supabase.co/storage/v1/object/public/videos/i-1/abc.mp4" } },
    "inmuebles.redactar": { motor: "local", aviso: "Rellenado sin IA.", ficha: {
      titulo: "Piso de 3 habitaciones en El Llano, Gijón", operacion: "venta", precio: 185000, ciudad: "Gijón",
      zona: "El Llano", habitaciones: 3, banos: 2, metros: 90, caracteristicas: ["terraza", "ascensor"],
      descripcion: "Piso en venta en El Llano, Gijón, con 90 m².", faltan: ["planta"] } },
    "inmuebles.listar": { inmuebles: [{
      id: "i-1", titulo: "Ático con terraza en Uría, uno de los mejores de la zona centro", precio: 289000, operacion: "venta",
      ciudad: "Oviedo", zona: "Uría", habitaciones: 3, banos: 2, metros: 118, estado: "disponible", publico: true,
      slug: "atico-uria", referencia: "OU-1", caracteristicas: ["terraza", "ascensor", "garaje"],
      portada_url: "/oportunidades/iconos/icono-512.png", fotos: [],
    }] },
    "portal.leer": {
      cliente: { nombre: "Marta" },
      inmuebles: [{
        id: "1", titulo: "Piso en el centro de Oviedo", precio: 189000,
        operacion: "venta", ciudad: "Oviedo", habitaciones: 3, metros: 90,
        // Sin descripción a propósito: esa rama pinta un null.
        galeria: [], respuesta: null,
      }],
    },
  };

  const ultimoCuerpo = {};
  const subidas = [];
  const servidor = http.createServer(async (req, res) => {
    const ruta = decodeURIComponent(req.url.split("?")[0]);
    if (ruta === "/__subida" && req.method === "PUT") {
      let n = 0;
      for await (const trozo of req) n += trozo.length;
      subidas.push({ bytes: n, tipo: req.headers["content-type"] });
      res.writeHead(200, { "content-type": "application/json" }).end('{"Key":"videos/i-1/abc.mp4"}');
      return;
    }
    if (ruta === "/api/oportunidades") {
      let cuerpo = "";
      for await (const trozo of req) cuerpo += trozo;
      const accion = JSON.parse(cuerpo || "{}").accion;
      ultimoCuerpo[accion] = JSON.parse(cuerpo || "{}");
      const datos = RESPUESTAS[accion];
      if (!datos) { res.writeHead(400, { "content-type": "application/json" }).end('{"error":"acción no simulada"}'); return; }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(datos));
      return;
    }
    try {
      const archivo = await readFile(join(RAIZ, ruta));
      res.writeHead(200, { "content-type": MIME[extname(ruta)] || "application/octet-stream" }).end(archivo);
    } catch {
      res.writeHead(404).end("no encontrado");
    }
  });
  await new Promise((ok) => servidor.listen(8131, ok));
  const BASE = "http://127.0.0.1:8131/oportunidades/";

  const navegador = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const contexto = await navegador.newContext({ viewport: { width: 1100, height: 900 } });
  // Three.js del logo 3D se sirve desde node_modules: el test no depende de la red.
  await contexto.route("https://unpkg.com/three@0.169.0/**", async (ruta) => {
    const archivo = ruta.request().url().split("three@0.169.0/")[1];
    ruta.fulfill({ contentType: "text/javascript", body: await readFile(join(RAIZ, "node_modules/three", archivo)) });
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(String(e)));

  /* --- El comprobador de instalación --- */
  await pagina.goto(BASE + "index.html", { waitUntil: "networkidle" });
  check("la pantalla de acceso firma como PAU. M.R.",
    (await pagina.textContent(".tarjeta-acceso .apunte")).includes("PAU. M.R.") &&
    !(await pagina.textContent(".tarjeta-acceso")).includes("Castresana"));
  await pagina.waitForSelector("#logo-acceso canvas", { timeout: 15000 }).catch(() => {});
  check("la pantalla de acceso muestra el logo 3D", (await pagina.locator("#logo-acceso canvas").count()) === 1);
  const iconos = await pagina.evaluate(async () => {
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    const urls = [...m.icons.map((i) => new URL(i.src, location.href).href),
      document.querySelector('link[rel=apple-touch-icon]').href, document.querySelector('link[rel=icon]').href];
    const estados = await Promise.all(urls.map((u) => fetch(u).then((r) => r.ok && r.headers.get("content-type")?.includes("png"))));
    return { nombre: m.name, maskable: m.icons.some((i) => i.purpose === "maskable"), todos: estados.every(Boolean), n: urls.length };
  });
  check("la app es instalable: manifiesto con nombre e icono maskable", iconos.nombre === "Oportunidades Únicas" && iconos.maskable);
  check("todos los iconos existen y son PNG", iconos.todos && iconos.n === 5, JSON.stringify(iconos));
  await pagina.locator("#btn-comprobar").click();
  await pagina.waitForSelector("#diagnostico .paso");

  const panel = await pagina.textContent("#diagnostico");
  check("el comprobador dice qué falta", panel.includes("Falta algo por configurar"));
  check("lista cada variable que falta", (await pagina.locator("#diagnostico .paso.mal").count()) === 2);
  check("y también lo que ya está bien", (await pagina.locator("#diagnostico .paso.bien").count()) === 1);
  check("el comprobador NO escribe «null» debajo de los avisos",
    !panel.includes("null"), panel.slice(-80));

  /* --- El portal del comprador --- */
  const pagina2 = await contexto.newPage();
  pagina2.on("pageerror", (e) => errores.push(String(e)));
  await pagina2.goto(BASE + "portal.html#abcdefghjkmnpqrstuvwxyz23456789", { waitUntil: "networkidle" });
  await pagina2.waitForSelector(".pieza");

  const portal = await pagina2.textContent("#contenido");
  check("el portal saluda al cliente por su nombre",
    (await pagina2.textContent("#saludo")).includes("Marta"));
  check("el portal muestra el inmueble con su precio", portal.includes("189.000"));
  check("un inmueble sin descripción no pinta «null» en el portal",
    !portal.includes("null"), portal.slice(0, 120));

  /* --- Un enlace incompleto se explica, no se rompe --- */
  const pagina3 = await contexto.newPage();
  pagina3.on("pageerror", (e) => errores.push(String(e)));
  await pagina3.goto(BASE + "portal.html#corto", { waitUntil: "networkidle" });
  check("un enlace cortado avisa en vez de quedarse en blanco",
    (await pagina3.textContent("#contenido")).includes("no está completo"));

  /* --- WhatsApp pro: con sesión iniciada --- */
  const ctxApp = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  await ctxApp.route("https://unpkg.com/**", (ruta) => ruta.abort());
  await ctxApp.addInitScript(() => localStorage.setItem("ou_sesion_v1",
    JSON.stringify({ token: "tok", usuario: { id: "u-1", nombre: "Pau", rol: "admin" } })));
  const app = await ctxApp.newPage();
  app.on("pageerror", (e) => errores.push(String(e)));
  await app.goto(BASE + "index.html#/panel", { waitUntil: "networkidle" });
  await app.waitForSelector("text=Respuestas de clientes");
  const panelTxt = await app.textContent("main");
  check("el panel enseña lo que han contestado los clientes", panelTxt.includes("Lucía quiere visitarlo"));
  check("la barra lateral lleva el icono de la marca",
    await app.locator(".marca .sigla-logo img").evaluate((i) => i.complete && i.naturalWidth === 64));
  const hrefContestar = await app.locator("a:has-text('Contestar')").first().getAttribute("href");
  check("«Contestar» abre el WhatsApp del cliente con 34 y el texto puesto",
    hrefContestar.startsWith("https://wa.me/34600111222?text=Hola%20Luc"), hrefContestar);

  check("el panel avisa de a quién toca hacer seguimiento", panelTxt.includes("Seguimientos de hoy") && panelTxt.includes("hace 5 días"));
  const hrefRecordar = await app.locator("a:has-text('Recordar')").getAttribute("href");
  check("«Recordar» abre su WhatsApp con el recordatorio escrito", hrefRecordar.startsWith("https://wa.me/34611222333?text=Hola%20Bea"), hrefRecordar);
  await app.locator("button:has-text('Hecho')").click();
  await app.waitForTimeout(300);
  check("«Hecho» lo apunta y lo quita de la lista",
    ultimoCuerpo["cliente.contactado"]?.id === "c-9" && !(await app.textContent("main")).includes("Bea"));

  /* Alta rápida */
  await app.locator("button:has-text('Añadir inmueble')").first().click();
  await app.waitForSelector(".alta-rapida[open]");
  await app.fill("#form-ficha [name=direccion_privada]", "C/ Uría 12, 3ºB, Oviedo");
  await app.locator("#form-ficha [name=direccion_privada]").dispatchEvent("change");
  check("al poner la dirección, la referencia se propone con calle y número",
    (await app.locator("#form-ficha [name=referencia]").inputValue()) === "C/ Uría 12");
  await app.fill(".notas-alta", "Piso 3 hab en El Llano, Gijón. 185k. 2 baños, 90 m2, ascensor y terraza");
  await app.locator("button:has-text('Rellenar ficha')").click();
  await app.waitForSelector(".resultado-alta");
  const val = (n) => app.locator(`#form-ficha [name=${n}]`).inputValue();
  check("alta rápida: rellena título, ciudad y zona",
    (await val("titulo")) === "Piso de 3 habitaciones en El Llano, Gijón" && (await val("ciudad")) === "Gijón" && (await val("zona")) === "El Llano");
  check("alta rápida: rellena precio, habitaciones, baños y metros",
    (await val("precio")) === "185.000" && (await val("habitaciones")) === "3" && (await val("banos")) === "2" && (await val("metros")) === "90");
  check("alta rápida: marca las características",
    await app.locator('#form-ficha input[value=terraza]').isChecked() && await app.locator('#form-ficha input[value=ascensor]').isChecked());
  check("alta rápida: dice qué falta para vender más", (await app.textContent(".resultado-alta")).includes("planta"));
  await app.screenshot({ path: "/tmp/ou-alta-movil.png", fullPage: false }).catch(() => {});
  await app.locator("#form-ficha button:has-text('Cancelar')").click();

  /* Tarjeta visual */
  await app.goto(BASE + "index.html#/pisos", { waitUntil: "networkidle" });
  await app.locator(".inmueble").first().click();
  await app.waitForSelector("#form-ficha h2:has-text('Editar inmueble')", { timeout: 5000 }).catch(() => {});
  check("un inmueble ya guardado se abre (antes se colgaba por la galería de fotos)",
    await app.locator("#form-ficha h2:has-text('Editar inmueble')").isVisible() && (await app.locator(".rejilla-fotos").count()) === 1);
  check("la galería dice el máximo de 18 fotos", (await app.textContent(".fotos")).includes("de 18"));
  await app.locator(".zona-video input[type=file]").setInputFiles({ name: "piso.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(300000, 1) });
  await app.waitForSelector(".video-previa", { timeout: 5000 }).catch(() => {});
  check("el vídeo se sube directo al almacén (no por Vercel)", subidas.length === 1 && subidas[0].bytes === 300000 && subidas[0].tipo === "video/mp4", JSON.stringify(subidas));
  check("y queda puesto en la ficha con su reproductor",
    ultimoCuerpo["video.guardar"]?.ruta === "i-1/abc.mp4" && (await app.locator(".video-previa").count()) === 1);
  check("el campo de enlace se actualiza con el vídeo subido",
    (await app.locator("#form-ficha [name=video_url]").inputValue()).endsWith("/videos/i-1/abc.mp4"));
  await app.locator("button:has-text('Tarjeta para WhatsApp')").click();
  await app.waitForFunction(() => document.querySelector(".lienzo-tarjeta")?.width === 1080);
  await app.waitForTimeout(400);
  const lienzo = await app.evaluate(() => {
    const c = document.querySelector(".lienzo-tarjeta");
    let exportable = true;
    try { c.toDataURL("image/png"); } catch { exportable = false; }
    return { w: c.width, h: c.height, exportable };
  });
  check("tarjeta de publicación 1080×1350 y exportable", lienzo.w === 1080 && lienzo.h === 1350 && lienzo.exportable, JSON.stringify(lienzo));
  await app.evaluate(() => { const a = document.createElement("a"); a.id = "png"; a.href = document.querySelector(".lienzo-tarjeta").toDataURL(); document.body.append(a); });
  const png = await app.evaluate(() => document.getElementById("png").href);
  await import("node:fs/promises").then((fs) => fs.writeFile("/tmp/ou-tarjeta.png", Buffer.from(png.split(",")[1], "base64")));
  await app.locator(".chip:has-text('Estado')").click();
  await app.waitForFunction(() => document.querySelector(".lienzo-tarjeta").height === 1920);
  check("formato estado 1080×1920", true);
  await app.waitForTimeout(300);
  const png2 = await app.evaluate(() => document.querySelector(".lienzo-tarjeta").toDataURL());
  await import("node:fs/promises").then((fs) => fs.writeFile("/tmp/ou-tarjeta-estado.png", Buffer.from(png2.split(",")[1], "base64")));
  check("la tarjeta no avisa de problemas con la foto", !(await app.locator(".aviso:not([hidden])").count()));
  await app.locator("button:has-text('Volver a la ficha')").click();
  check("«Volver a la ficha» vuelve a la ficha", await app.locator("#form-ficha h2:has-text('Editar inmueble')").isVisible());
  await app.keyboard.press("Escape");

  await app.goto(BASE + "index.html#/clientes", { waitUntil: "networkidle" });
  await app.waitForSelector(".fila-cliente");
  check("cada cliente con móvil tiene botón de WhatsApp",
    (await app.locator(".fila-cliente a.wa").count()) === 1);
  check("la lista dice cuántos pisos le has mandado", (await app.textContent("main")).includes("1 enviado "));
  await app.screenshot({ path: "/tmp/ou-clientes-movil.png", fullPage: true }).catch(() => {});

  await app.locator(".fila-cliente >> text=Enviar pisos").first().click();
  await app.waitForSelector("text=Enviar pisos a Lucía");
  const marcadosIni = await app.locator("#form-ficha .lista input[type=checkbox]:checked").count();
  check("se preparan marcados los que mejor encajan y aún no tiene (2 de 4)", marcadosIni === 2, String(marcadosIni));
  check("lo ya enviado sale marcado como tal", (await app.textContent("#form-ficha")).includes("ya enviado"));
  check("lo que no está publicado se avisa", (await app.textContent("#form-ficha")).includes("sin publicar"));
  await app.screenshot({ path: "/tmp/ou-enviar-movil.png", fullPage: true }).catch(() => {});

  await app.locator("text=Preparar WhatsApp").click();
  await app.waitForSelector(".caja-mensaje");
  check("se envían justo los marcados", JSON.stringify(ultimoCuerpo["seleccion.enviar"]?.inmuebles) === '["i-1","i-2"]',
    JSON.stringify(ultimoCuerpo["seleccion.enviar"]));
  const caja = app.locator(".caja-mensaje textarea");
  check("el mensaje se puede editar", (await caja.getAttribute("readonly")) === null);
  await app.locator(".chip:has-text('Corto')").click();
  check("cambiar a estilo corto cambia el texto", (await caja.inputValue()).includes("(corto)"));
  await caja.fill("Texto retocado a mano");
  const hrefWa = await app.locator(".caja-mensaje a.wa").getAttribute("href");
  check("el botón de WhatsApp lleva lo que has escrito", hrefWa === "https://wa.me/34600111222?text=Texto%20retocado%20a%20mano", hrefWa);
  await app.screenshot({ path: "/tmp/ou-mensaje-movil.png", fullPage: true }).catch(() => {});

  await app.locator("text=Volver a su ficha").click();
  await app.waitForSelector(".seguimiento .fila");
  check("la ficha del cliente dice qué le mandaste y qué contestó",
    (await app.textContent(".seguimiento")).includes("quiere visitarlo"));
  check("y tiene botón directo de WhatsApp y de enviarle pisos",
    (await app.locator("#form-ficha .pie-ficha a:has-text('WhatsApp')").count()) === 1 &&
    (await app.locator("#form-ficha .pie-ficha button:has-text('Enviarle pisos')").count()) === 1);
  await ctxApp.close();

  check("ninguna pantalla ha lanzado errores de JavaScript", errores.length === 0, errores.join(" | "));

  await navegador.close();
  await new Promise((ok) => servidor.close(ok));
}

console.log(`\n${fallados === 0 ? "✅" : "❌"} Oportunidades Únicas: ${pasados} comprobaciones correctas, ${fallados} fallidas.\n`);
// `exitCode` en vez de `exit()`: así no se corta la salida al redirigirla.
process.exitCode = fallados === 0 ? 0 : 1;
