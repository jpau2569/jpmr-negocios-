#!/usr/bin/env node
// ============================================================================
//  PULSO LOCAL AI — comprobación previa antes de enseñar un espacio a nadie
// ----------------------------------------------------------------------------
//  Las pruebas de `npm test` miran el código. Esto mira el despliegue REAL: si
//  la landing carga, si el QR redirige, si los formularios rechazan lo que
//  tienen que rechazar y si falta algún dato que haga quedar mal delante de un
//  cliente.
//
//  Pásalo SIEMPRE antes de mandar un enlace o imprimir un cartel:
//
//    node herramientas/comprobar-despliegue.mjs --url https://app.tudominio.com
//    node herramientas/comprobar-despliegue.mjs --url https://… --negocio otro-slug
//
//  Cada comprobación sale como OK, AVISO (se puede enseñar, pero mejor
//  arreglarlo) o FALLO (no lo enseñes). Sale con código 1 si hay algún fallo,
//  para poder encadenarlo en un script.
// ============================================================================

const argumentos = process.argv.slice(2);
function opcion(nombre, porDefecto = null) {
  const i = argumentos.indexOf(`--${nombre}`);
  return i >= 0 && argumentos[i + 1] ? argumentos[i + 1] : porDefecto;
}

const base = (opcion("url") ?? "").replace(/\/+$/, "");
const negocio = opcion("negocio", "asesoria-castresana");
const codigoQr = opcion("qr", null);

if (!base) {
  console.error("Falta --url. Ejemplo:\n  node herramientas/comprobar-despliegue.mjs --url https://app.asesoriacastresana.com");
  process.exit(1);
}

const resultados = [];
const anotar = (estado, titulo, detalle = "") => resultados.push({ estado, titulo, detalle });

async function pedir(ruta, opciones = {}) {
  try {
    const respuesta = await fetch(`${base}${ruta}`, { redirect: "manual", ...opciones });
    const tipo = respuesta.headers.get("content-type") ?? "";
    const cuerpo = tipo.includes("json") || tipo.includes("html") || tipo.includes("text")
      ? await respuesta.text()
      : "";
    return { estado: respuesta.status, cabeceras: respuesta.headers, cuerpo };
  } catch (error) {
    return { estado: 0, cabeceras: new Headers(), cuerpo: "", error: error.message };
  }
}

function json(datos) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) };
}

// --- 1. ¿Responde el sitio? --------------------------------------------------
const portada = await pedir("/");
if (portada.estado === 200) anotar("OK", "La web responde");
else anotar("FALLO", "La web no responde", portada.error ?? `código ${portada.estado}`);

// --- 2. ¿Carga el espacio del negocio? --------------------------------------
//  Si esto falla, las comprobaciones de contenido que vienen detrás estarían
//  leyendo la página de error y darían un «OK» mentiroso. Por eso se marcan
//  como no comprobadas en vez de inventarse un resultado.
const landing = await pedir(`/b/${negocio}`);
const paginaDeError = (cuerpo) => /no carga ahora mismo|Aquí no hay nada/i.test(cuerpo);
const landingViva = landing.estado === 200 && !paginaDeError(landing.cuerpo);
if (landing.estado === 404) {
  anotar("FALLO", `El negocio "${negocio}" no existe`, "¿Has pasado el SQL de instalación por Supabase?");
} else if (landing.cuerpo.includes("no carga ahora mismo")) {
  anotar("FALLO", "La base de datos no responde", "Revisa las variables de Supabase en Vercel.");
} else if (landing.estado === 200) {
  anotar("OK", "La landing del negocio carga");
} else if ([301, 302, 307, 308].includes(landing.estado)) {
  const destino = landing.cabeceras.get("location") ?? "";
  anotar(destino.includes("trial-expired") ? "FALLO" : "AVISO",
    destino.includes("trial-expired") ? "La demo de este negocio ha caducado" : "La landing redirige",
    destino);
} else {
  anotar("FALLO", "La landing devuelve un error", `código ${landing.estado}`);
}

// --- 3. ¿Hay inmuebles publicados? ------------------------------------------
const catalogo = await pedir(`/b/${negocio}/inmuebles`);
if (!landingViva) {
  anotar("AVISO", "Catálogo sin comprobar", "Primero tiene que cargar la landing.");
} else if (catalogo.estado === 200 && !paginaDeError(catalogo.cuerpo)) {
  const vacio = /no hay inmuebles que encajen|Todavía no hay/i.test(catalogo.cuerpo);
  anotar(vacio ? "AVISO" : "OK",
    vacio ? "El catálogo está vacío" : "El catálogo tiene inmuebles",
    vacio ? "Publica al menos un inmueble antes de enseñarlo." : "");
} else {
  anotar("AVISO", "No se ha podido leer el catálogo", `código ${catalogo.estado}`);
}

// --- 4. ¿El QR corto redirige? ----------------------------------------------
const qr = await pedir(`/q/${codigoQr ?? negocio.split("-")[0]}`);
const destinoQr = qr.cabeceras.get("location") ?? "";
const esRaiz = (() => {
  try {
    return new URL(destinoQr).pathname === "/";
  } catch {
    return destinoQr === "/";
  }
})();

if ([301, 302, 307, 308].includes(qr.estado) && destinoQr.includes(`/b/${negocio}`)) {
  anotar("OK", "El QR corto resuelve al negocio", destinoQr);
} else if ([301, 302, 307, 308].includes(qr.estado) && esRaiz) {
  // Redirigir a la portada es lo que hace un código que no existe.
  anotar("AVISO", "Ese código de QR no existe todavía",
    "Crea uno en /dashboard/qr y vuelve a comprobarlo con --qr <codigo>.");
} else {
  anotar("AVISO", "No he podido comprobar un QR corto",
    "Prueba con un código real del panel: /q/<codigo>");
}

// --- 5. Un formulario sin consentimiento NO puede pasar ----------------------
const sinConsentimiento = await pedir("/api/publico/contacto", json({
  businessSlug: negocio, tipo: "seller", nombre: "Comprobación", telefono: "600000000", consent: false,
}));
if (sinConsentimiento.estado === 422) anotar("OK", "Sin consentimiento no se guarda el contacto");
else if (sinConsentimiento.estado === 410) anotar("FALLO", "El negocio no está activo", "La demo ha caducado o está suspendido.");
else anotar("FALLO", "Un formulario sin consentimiento NO fue rechazado", `código ${sinConsentimiento.estado}`);

// --- 6. El honeypot responde «ok» sin guardar nada ---------------------------
const bot = await pedir("/api/publico/contacto", json({
  businessSlug: negocio, tipo: "seller", nombre: "Bot", telefono: "600000001",
  consent: true, companyWebsite: "https://spam.example",
}));
if (bot.estado === 200 && bot.cuerpo.includes('"ok":true')) {
  anotar("OK", "La trampa anti-bots funciona", "Responde «recibido» sin crear el contacto.");
} else {
  anotar("AVISO", "La trampa anti-bots no respondió como se espera", `código ${bot.estado}`);
}

// --- 7. El cron está protegido ----------------------------------------------
const cron = await pedir("/api/cron/caducar-demos");
if (cron.estado === 401) anotar("OK", "El cron exige su secreto");
else anotar("FALLO", "El cron NO está protegido", `código ${cron.estado}`);

// --- 8. Una demo no debe indexarse en Google --------------------------------
if (landingViva) {
  const noIndexado = /name="robots"[^>]*noindex/i.test(landing.cuerpo);
  anotar(noIndexado ? "OK" : "AVISO",
    noIndexado ? "El espacio en demo no se indexa en Google" : "El espacio es indexable",
    noIndexado ? "" : "Correcto si ya es cliente activo; revísalo si sigue en demo.");
}

// --- 9. Huecos que hacen quedar mal delante de un cliente --------------------
const opinion = await pedir(`/b/${negocio}/opinion`);
if (landingViva && opinion.estado === 200) {
  const hayGoogle = /Escribir una reseña en Google/i.test(opinion.cuerpo);
  anotar(hayGoogle ? "OK" : "AVISO",
    hayGoogle ? "El enlace de reseñas de Google está configurado" : "Falta el enlace de reseñas de Google",
    hayGoogle ? "" : "Pégalo en /dashboard/configuracion: sin él, la opinión no lleva a la reseña pública.");
}

if (landingViva) {
  const hayDemo = /Datos de demostración/i.test(landing.cuerpo);
  if (hayDemo) {
    anotar("AVISO", "El espacio enseña datos de demostración",
      "Correcto para una demo comercial. Quítalo antes de que sea la web real del negocio.");
  }
}

// --- Informe -----------------------------------------------------------------
const iconos = { OK: "✓", AVISO: "!", FALLO: "✗" };
console.log(`\nComprobación de ${base}/b/${negocio}\n`);
for (const r of resultados) {
  console.log(`  ${iconos[r.estado]}  ${r.titulo}${r.detalle ? `\n       ${r.detalle}` : ""}`);
}

const fallos = resultados.filter((r) => r.estado === "FALLO").length;
const avisos = resultados.filter((r) => r.estado === "AVISO").length;

console.log(
  fallos
    ? `\n${fallos} fallo(s) y ${avisos} aviso(s). NO lo enseñes todavía.\n`
    : avisos
      ? `\nTodo lo crítico está bien, con ${avisos} aviso(s) que conviene mirar.\n`
      : "\nTodo correcto. Se puede enseñar.\n",
);

process.exit(fallos ? 1 : 0);
