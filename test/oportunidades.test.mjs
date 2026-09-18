// ============================================================================
//  Tests de Oportunidades Únicas — npm test los ejecuta
// ----------------------------------------------------------------------------
//  No tocan Supabase: se intercepta fetch y se simulan las respuestas.
//  Verifican la validación (nada sin sanear llega a la base de datos), el
//  cálculo de coincidencias (el que en la app vieja daba "64018%") y el
//  handler: sesiones, permisos por rol, portal del comprador y errores.
// ============================================================================

import handler, { nubeConfigurada } from "../api/_oportunidades.js";
import fichaHandler, { paginaFicha, esc } from "../api/_oportunidades-ficha.js";
import {
  normalizarInmueble, normalizarCliente, coincidencia, mejoresClientes,
  dinero, entero, slug, referencia, tokenPortal, mensajeWhatsapp,
  normalizarFoto, rutaFoto, normalizarGaleria, MAX_FOTO_BYTES,
  CONTACTO, enlaceWhatsapp, normalizarVideo,
  CARACTERISTICAS, ESTADOS,
} from "../lib/oportunidades.js";

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

console.log(`\n${fallados === 0 ? "✅" : "❌"} Oportunidades Únicas: ${pasados} comprobaciones correctas, ${fallados} fallidas.\n`);
// `exitCode` en vez de `exit()`: así no se corta la salida al redirigirla.
process.exitCode = fallados === 0 ? 0 : 1;
