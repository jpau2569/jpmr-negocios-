// ============================================================================
//  Tests del producto Escaparate 3D Pro — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  Dos partes:
//   1. Lógica pura en Node: configuración, tema, QR, ZIP y requisitos de
//      producción. No sale a Internet.
//   2. Interfaz en un Chromium real (Playwright), con un servidor estático
//      local y /api/* interceptado: se abren las dos demos y se comprueba que
//      la carta, el carrito, la reserva, el QR y la cartera funcionan.
//  Si Playwright no está instalado, la parte 2 se salta avisando: los tests de
//  lógica tienen que seguir pasando en cualquier máquina.
// ============================================================================

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import zlib from "node:zlib";

import { normalizar, rutaConfigSegura, archivoDeNegocio, mezclar, enlaceSeguro, desdeFirestore } from "../escaparate3d-pro/js/config.js";
import { paleta, textoSobre, contraste, aNumero } from "../escaparate3d-pro/js/tema.js";
import { evaluar, parsearCarta, parsearInmuebles, readmeDespliegue } from "../escaparate3d-pro/js/produccion.js";
import { normalizarLista } from "../escaparate3d-pro/modules/inmuebles.js";
import { calcularRango } from "../escaparate3d-pro/modules/valoracion.js";
import { crc32, crearZip } from "../escaparate3d-pro/js/zip.js";
import { aFirestore } from "../escaparate3d-pro/js/datos.js";
import { matriz as matrizPro } from "../escaparate3d-pro/js/qr.js";
import { matriz as matrizFotos } from "../fotos-faciles/nucleo/qr.mjs";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

const RAIZ = new URL("..", import.meta.url).pathname;
const leerConfig = async (nombre) =>
  JSON.parse(await readFile(join(RAIZ, "escaparate3d-pro/config", nombre), "utf8"));

/* ========================================================================== */
console.log("\n🧩 Configuración white-label");

const CONFIGS = {
  activa: await leerConfig("negocio.json"),
  castresana: await leerConfig("ejemplos/inmobiliaria-castresana.json"),
  laVina: await leerConfig("ejemplos/restaurante-la-vina.json"),
  restauranteEjemplo: await leerConfig("ejemplos/restaurante-ejemplo.json"),
  inmobiliariaEjemplo: await leerConfig("ejemplos/inmobiliaria-ejemplo.json"),
};

for (const [nombre, cfg] of Object.entries(CONFIGS)) {
  check(`${nombre}: el JSON se normaliza sin perder el nombre`, normalizar(cfg).nombre === cfg.nombre);
}

check("cada ejemplo del catálogo existe como archivo",
  ["castresana", "la-vina", "inmobiliaria-ejemplo", "restaurante-ejemplo"].every((id) => archivoDeNegocio(id)));
check("un id inventado no resuelve a ningún archivo", archivoDeNegocio("no-existe") === "");

const restaurante = normalizar(CONFIGS.laVina);
check("un restaurante no enciende módulos de inmobiliaria",
  restaurante.modulos.catalogoInmuebles === false && restaurante.modulos.valoracionGratis === false);
const inmo = normalizar(CONFIGS.castresana);
check("una inmobiliaria no enciende módulos de restaurante",
  inmo.modulos.pedidosDomicilio === false && inmo.modulos.reservas === false && inmo.modulos.qrMesas === false);

check("sin WhatsApp configurado el dato queda vacío (los botones se ocultarán)",
  restaurante.contacto.whatsapp === "");
check("el WhatsApp real se queda solo con las cifras", inmo.contacto.whatsapp === "34672775721");

check("un enlace javascript: en redes se descarta",
  normalizar({ redes: { web: "javascript:alert(1)" } }).redes.web === "");
check("un enlace https en redes se conserva",
  enlaceSeguro("https://www.asesoriacastresana.com") === "https://www.asesoriacastresana.com/");
check("una ruta de config externa se rechaza", rutaConfigSegura("https://malo.example/x.json") === "");
check("una ruta con .. se rechaza", rutaConfigSegura("config/../../secreto.json") === "");
check("una ruta de config válida se acepta", rutaConfigSegura("config/ejemplos/x.json") === "config/ejemplos/x.json");

check("mezclar sustituye arrays enteros, no los fusiona",
  JSON.stringify(mezclar({ a: [1, 2, 3] }, { a: [9] })) === JSON.stringify({ a: [9] }));
check("mezclar conserva las claves que no vienen", mezclar({ a: 1, b: 2 }, { b: 3 }).a === 1);

check("desdeFirestore reconstruye el objeto",
  desdeFirestore(aFirestore({ nombre: "X", activo: true, n: 3 }).mapValue).n === 3);

/* ========================================================================== */
console.log("\n🔌 Backend que se lleva cada cliente");

//  escaparate3d-pro/ tiene su propio api/ y lib/ porque cada cliente se lleva
//  la carpeta entera a su despliegue. Son copias EXACTAS del monorepo: si
//  alguien toca un original y olvida la copia, esto lo caza.
for (const [original, copia] of [
  ["api/escaparate.js", "escaparate3d-pro/api/escaparate.js"],
  ["api/foto.js", "escaparate3d-pro/api/foto.js"],
  ["api/lead.js", "escaparate3d-pro/api/lead.js"],
  ["api/health.js", "escaparate3d-pro/api/health.js"],
  ["lib/cartera.js", "escaparate3d-pro/lib/cartera.js"],
  ["lib/memoria.js", "escaparate3d-pro/lib/memoria.js"],
]) {
  const a = await readFile(join(RAIZ, original), "utf8");
  const b = await readFile(join(RAIZ, copia), "utf8");
  check(`${copia} sigue siendo copia exacta de ${original}`, a === b);
}

const construir = await readFile(join(RAIZ, "escaparate3d-pro/admin/construir.js"), "utf8");
for (const archivo of ["api/lead.js", "lib/cartera.js", "package.json", "vercel.json"]) {
  check(`el paquete del cliente incluye ${archivo}`, construir.includes(`"${archivo}"`));
}

/* ========================================================================== */
console.log("\n🎨 Tema derivado de los colores del CONFIG");

const p = paleta(CONFIGS.castresana.colores);
check("el acento del JSON llega tal cual a la paleta", p.acento === "#c9a227");
check("sobre el dorado el texto elegido es el oscuro", textoSobre("#c9a227") === "#101418");
check("sobre el azul el texto elegido es el blanco", textoSobre("#2f6bff") === "#ffffff");
check("el texto elegido siempre gana en contraste al otro",
  ["#c9a227", "#2f6bff", "#d98324", "#8fbf6a", "#ffffff", "#111111"].every((c) => {
    const elegido = textoSobre(c);
    const otro = elegido === "#ffffff" ? "#101418" : "#ffffff";
    return contraste(c, elegido) >= contraste(c, otro);
  }));
check("el color pasa a número para los materiales 3D", aNumero("#c9a227") === 0xc9a227);
check("dos negocios distintos dan paletas distintas",
  paleta(CONFIGS.laVina.colores).acento !== paleta(CONFIGS.castresana.colores).acento);

/* ========================================================================== */
console.log("\n🏠 Cartera de inmuebles");

check("normalizarLista entiende la forma de /api/escaparate",
  normalizarLista({ items: [{ titulo: "Piso", precio: 1000 }] }).length === 1);
check("normalizarLista entiende la forma de pisos.json",
  normalizarLista({ inmuebles: [{ titulo: "Piso" }] }).length === 1);
check("normalizarLista descarta los marcados como retirados",
  normalizarLista({ items: [{ titulo: "A", activo: false }, { titulo: "B" }] }).length === 1);
check("el respaldo real de Castresana se normaliza entero",
  normalizarLista(CONFIGS.castresana.inmuebles.respaldo).length === CONFIGS.castresana.inmuebles.respaldo.length);
check("un alquiler se detecta como tal",
  normalizarLista([{ titulo: "X", operacion: "ALQUILER" }])[0].operacion === "alquiler");
check("un precio ausente queda en null, no en 0",
  normalizarLista([{ titulo: "X", precio: null }])[0].precio === null);

check("sin precios cargados por la agencia no se inventa ninguna valoración",
  calcularRango({ zona: "Oviedo", metros: 90, estado: "bien" }, []) === null);
const rango = calcularRango({ zona: "Oviedo", metros: 90, estado: "reformar" }, [{ zona: "Oviedo", minM2: 1800, maxM2: 2400 }]);
check("con precios de la agencia sale una horquilla coherente", rango && rango.min < rango.max && rango.min > 0);

/* ========================================================================== */
console.log("\n🍽️ Carta e importadores");

const carta = parsearCarta("Especialidades\nEspecialidades | Lechazo | Asado lento | 24\nPostres | Casadielles | | 5");
check("parsearCarta separa categorías", carta.length === 2);
check("parsearCarta lee el precio con coma", parsearCarta("A | Plato | | 9,50")[0].platos[0].precio === 9.5);
check("parsearCarta ignora las líneas vacías", parsearCarta("\n\nA | Plato | | 3\n\n")[0].platos.length === 1);

const cartera = parsearInmuebles("Piso en Mieres | Mieres | 120.000 | 90 | 3 | 1 | venta");
check("parsearInmuebles limpia los puntos de millar", cartera[0].precio === 120000);
check("parsearInmuebles detecta el alquiler",
  parsearInmuebles("Estudio | Oviedo | 480 | 40 | 1 | 1 | alquiler")[0].operacion === "alquiler");

/* ========================================================================== */
console.log("\n🚦 Requisitos de producción (demo vs. aplicación real)");

const informeVina = evaluar(normalizar(CONFIGS.laVina));
check("la demo de La Viña NO se da por lista para producción", !informeVina.listo);
check("la demo avisa de que los datos están sin confirmar",
  informeVina.items.find((i) => i.clave === "datos-verificados")?.ok === false);
check("la demo avisa de que los datos no tienen destino real",
  informeVina.items.find((i) => i.clave === "destino-datos")?.ok === false);

const informeCastresana = evaluar(normalizar(CONFIGS.castresana));
check("Castresana sí tiene contacto de producción",
  informeCastresana.items.find((i) => i.clave === "contacto")?.ok === true);
check("Castresana sí manda los leads a un endpoint real",
  informeCastresana.items.find((i) => i.clave === "destino-datos")?.ok === true);
check("Castresana sí tiene catálogo cargado",
  informeCastresana.items.find((i) => i.clave === "contenido")?.ok === true);

const completa = normalizar({
  ...CONFIGS.castresana,
  logoUrl: "data:image/png;base64,iVBORw0KGgo=",
  demo: { activa: false, aviso: "" },
  verificacion: { verificado: true, fuente: "", pendiente: [] },
});
check("una configuración completa sí pasa los 9 requisitos", evaluar(completa).listo, `${evaluar(completa).puntos}/9`);
check("dejar la paleta de plantilla se detecta como marca sin personalizar",
  evaluar(normalizar({ ...completa, colores: {} })).items.find((i) => i.clave === "marca").ok === false);

const readme = readmeDespliegue(normalizar(CONFIGS.laVina));
check("el README de despliegue nombra al negocio", readme.includes("Restaurante La Viña"));
check("el README avisa de que hay que servirlo por HTTP", readme.includes("file://"));

/* ========================================================================== */
console.log("\n🔳 QR y ZIP");

for (const texto of ["https://ejemplo.com/carta?mesa=3", "La Viña — Cenera ñ á", "x".repeat(120)]) {
  check(`el QR del producto es idéntico al de Fotos Fáciles (${texto.slice(0, 24)}…)`,
    JSON.stringify(matrizPro(texto)) === JSON.stringify(matrizFotos(texto)));
}
check("el QR crece de versión con textos largos", matrizPro("x".repeat(120)).tamano > matrizPro("x").tamano);

check("crc32 coincide con el de zlib",
  crc32(new TextEncoder().encode("hola")) === zlib.crc32(Buffer.from("hola")));

const zip = crearZip([{ nombre: "config/negocio.json", contenido: '{"a":1}' }, { nombre: "README.md", contenido: "# Hola" }]);
const bytesZip = new Uint8Array(await zip.arrayBuffer());
check("el ZIP empieza por la firma PK", bytesZip[0] === 0x50 && bytesZip[1] === 0x4b);
check("el ZIP lleva el directorio central de los dos archivos",
  Buffer.from(bytesZip).lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) > 0 &&
  Buffer.from(bytesZip).includes(Buffer.from("config/negocio.json")));

/* ========================================================================== */
//  Parte 2: navegador real
/* ========================================================================== */

let chromium = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("\n⚠️  Playwright no está instalado: me salto los tests de interfaz.");
}

if (chromium) {
  console.log("\n🌐 Interfaz en Chromium (las dos demos)");

  const MIME = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
  };

  const servidor = http.createServer(async (req, res) => {
    let ruta = decodeURIComponent(req.url.split("?")[0]);
    if (ruta.endsWith("/")) ruta += "index.html";   // /admin/ → /admin/index.html
    // El endpoint de leads del monorepo, respondido en local.
    if (ruta === "/api/lead") { res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}'); return; }
    if (ruta === "/api/escaparate") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
        ok: true,
        items: [
          { referencia: "T1", titulo: "Piso de prueba en Oviedo", operacion: "venta", zona: "Oviedo", precio: 150000, superficieConstruida: 80, habitaciones: 3, banos: 1 },
          { referencia: "T2", titulo: "Estudio de prueba en Mieres", operacion: "alquiler", zona: "Mieres", precio: 400, superficieConstruida: 40, habitaciones: 1, banos: 1 },
        ],
      }));
      return;
    }
    try {
      const datos = await readFile(join(RAIZ, ruta === "/" ? "/index.html" : ruta));
      res.writeHead(200, { "content-type": MIME[extname(ruta)] || "application/octet-stream" }).end(datos);
    } catch {
      res.writeHead(404).end("no encontrado");
    }
  });
  await new Promise((ok) => servidor.listen(8127, ok));
  const BASE_URL = "http://127.0.0.1:8127/escaparate3d-pro/";

  const navegador = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
  // Sin salida a Internet en los tests: three.js del CDN se bloquea a propósito
  // para comprobar que la web sigue entera con la lista 2D.
  await contexto.route("**unpkg.com/**", (ruta) => ruta.abort());
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(String(e)));

  /* --- Demo del restaurante --- */
  await pagina.goto(BASE_URL + "index.html?negocio=la-vina", { waitUntil: "networkidle" });
  check("la demo del restaurante pone su nombre en la cabecera",
    (await pagina.textContent("#marca-nombre")).includes("La Viña"));
  check("el título de la pestaña es el del negocio", (await pagina.title()).includes("La Viña"));
  check("sin WhatsApp no aparece ningún botón de WhatsApp",
    (await pagina.locator('#contacto-cabecera a[href*="wa.me"]').count()) === 0);
  check("sí aparece el botón de llamar con su teléfono real",
    (await pagina.locator('#contacto-cabecera a[href="tel:+34985426690"]').count()) === 1);
  check("el color de acento del JSON llega al CSS",
    (await pagina.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-acento").trim())) === "#d98324");
  check("sin 3D disponible se explica y no se deja la pantalla en blanco",
    await pagina.locator("#sin-3d").isVisible());
  check("el aviso de demo con los datos pendientes es visible",
    (await pagina.textContent("#aviso-demo")).includes("Carta completa y precios reales"));
  check("la carta real aparece en la página",
    (await pagina.textContent("#seccion-carta")).includes("Lechazo al horno"));
  const accionesRestaurante = (await pagina.locator("#acciones button").allTextContents()).join("|");
  check("los tres módulos del restaurante están en la barra de acciones",
    ["Pedir a domicilio", "Reservar mesa", "QR de las mesas"].every((t) => accionesRestaurante.includes(t)),
    accionesRestaurante);
  check("los módulos de inmobiliaria NO se han cargado", !accionesRestaurante.includes("Valoración"), accionesRestaurante);

  // Carrito y pedido
  await pagina.locator('#seccion-carta button:has-text("Añadir")').first().click();
  await pagina.locator('#acciones button[data-modulo="pedidos"]').click();
  check("el pedido se abre con el plato añadido",
    (await pagina.textContent("#modal-cuerpo")).includes("Lechazo"));
  await pagina.fill("#nombre", "Cliente de prueba");
  await pagina.fill("#telefono", "600000000");
  const totalAntes = await pagina.textContent(".total");
  await pagina.locator('#modal-cuerpo button[aria-label^="Añadir una unidad"]').first().click();
  check("subir la cantidad recalcula el total", (await pagina.textContent(".total")) !== totalAntes);
  await pagina.locator("#confirmar").click();
  await pagina.waitForSelector("#modal-titulo:has-text('Pedido preparado')");
  const mensajePedido = await pagina.textContent("#modal-cuerpo");
  check("el pedido confirmado da una referencia", /PED-\d{8}-[A-Z0-9]{4}/.test(mensajePedido));
  check("el pedido queda guardado en el dispositivo",
    await pagina.evaluate(() => (localStorage.getItem("escaparate3d-pro:registros") || "").includes("pedido")));
  check("el carrito se vacía tras confirmar",
    await pagina.evaluate(() => JSON.parse(localStorage.getItem("escaparate3d-pro:carrito:la-vina") || "[]").length === 0));
  await pagina.locator("#modal-cerrar").click();

  // Reserva
  await pagina.locator('#acciones button[data-modulo="reservas"]').click();
  await pagina.fill("#nombre", "Reserva de prueba");
  await pagina.fill("#telefono", "600111222");
  await pagina.locator('#modal-cuerpo button[type="submit"]').click();
  await pagina.waitForSelector("#modal-titulo:has-text('Reserva preparada')");
  check("la reserva da referencia propia", /RES-\d{8}-[A-Z0-9]{4}/.test(await pagina.textContent("#modal-cuerpo")));
  await pagina.locator("#modal-cerrar").click();

  // QR de mesas
  await pagina.locator('#acciones button[data-modulo="qr"]').click();
  await pagina.waitForSelector(".tarjeta-qr");
  check("se genera un QR por mesa configurada",
    (await pagina.locator(".tarjeta-qr").count()) === 14);
  check("el QR es un SVG dibujado, no una imagen de un servicio externo",
    (await pagina.locator(".tarjeta-qr svg").count()) === 14);
  await pagina.locator("#modal-cerrar").click();

  // Entrada por QR de mesa: con el carrito vacío el pedido no se abre a lo tonto,
  // manda a la carta; en cuanto hay un plato, ofrece servir en esa mesa.
  await pagina.goto(BASE_URL + "index.html?negocio=la-vina&mesa=7#pedido", { waitUntil: "networkidle" });
  check("entrando por el QR con el carrito vacío se avisa en vez de abrir un pedido vacío",
    (await pagina.textContent("#aviso")).includes("Añade algún plato"));
  await pagina.locator('#seccion-carta button:has-text("Añadir")').first().click();
  await pagina.locator('#acciones button[data-modulo="pedidos"]').click();
  await pagina.waitForSelector("#modal-titulo:has-text('Tu pedido')");
  check("entrando por el QR de una mesa, el pedido ofrece servir en esa mesa",
    (await pagina.textContent("#modal-cuerpo")).includes("Mesa 7"));
  await pagina.locator("#modal-cerrar").click();

  /* --- Demo de la inmobiliaria --- */
  await pagina.goto(BASE_URL + "index.html?negocio=castresana", { waitUntil: "networkidle" });
  check("la demo de la inmobiliaria carga la cartera del endpoint",
    (await pagina.textContent("#seccion-inmuebles")).includes("Piso de prueba en Oviedo"));
  check("aparece su WhatsApp real",
    (await pagina.locator('#contacto-cabecera a[href*="wa.me/34672775721"]').count()) === 1);
  check("los módulos de restaurante NO se han cargado",
    !(await pagina.locator("#acciones button").allTextContents()).join("|").includes("Reservar mesa"));

  await pagina.locator('#seccion-inmuebles button:has-text("Me interesa")').first().click();
  check("marcar un inmueble se refleja en el botón de visita",
    (await pagina.textContent("#seccion-inmuebles")).includes("Pedir visita (1)"));
  await pagina.locator('#seccion-inmuebles button:has-text("Pedir visita")').click();
  await pagina.fill("#nombre", "Comprador de prueba");
  await pagina.fill("#telefono", "600333444");
  await pagina.locator('#modal-cuerpo button[type="submit"]').click();
  await pagina.waitForSelector("#modal-titulo:has-text('Solicitud de visita lista')");
  const visita = await pagina.textContent("#modal-cuerpo");
  check("la solicitud de visita llega al endpoint de leads", visita.includes("Ya ha entrado en el sistema"));
  await pagina.locator("#modal-cuerpo details summary").click();
  check("el mensaje de visita lleva SOLO el inmueble marcado",
    (await pagina.textContent("#modal-cuerpo .mensaje")).includes("Piso de prueba en Oviedo") &&
    !(await pagina.textContent("#modal-cuerpo .mensaje")).includes("Estudio de prueba en Mieres"));
  await pagina.locator("#modal-cerrar").click();

  // Valoración
  await pagina.locator('#acciones button[data-modulo="valoracion"]').click();
  await pagina.fill("#zona", "Oviedo");
  await pagina.fill("#metros", "90");
  await pagina.fill("#nombre", "Propietario de prueba");
  await pagina.fill("#telefono", "600555666");
  await pagina.locator('#modal-cuerpo button[type="submit"]').click();
  await pagina.waitForSelector("#modal-titulo:has-text('Valoración')");
  check("sin precios cargados, la valoración no inventa una cifra",
    (await pagina.textContent("#modal-cuerpo")).includes("número inventado"));
  await pagina.locator("#modal-cerrar").click();

  // Apartado comercial
  await pagina.goto(BASE_URL + `index.html?negocio=castresana&t=${Date.now()}#demo`, { waitUntil: "networkidle" });
  await pagina.waitForSelector("#modal-titulo:has-text('negocio dentro')");
  check("el apartado «quiero mi demo» se abre desde el enlace directo",
    (await pagina.textContent("#modal-titulo")).includes("tu negocio dentro"));
  await pagina.fill("#negocio", "Bar de prueba");
  await pagina.fill("#nombre", "Dueño de prueba");
  await pagina.fill("#telefono", "600777888");
  await pagina.locator('#modal-cuerpo button[type="submit"]').click();
  await pagina.waitForSelector("#modal-titulo:has-text('Petición enviada')");
  check("la petición de demo apunta al WhatsApp comercial, no al del negocio",
    (await pagina.locator('#modal-cuerpo a[href*="wa.me/34672775721"]').count()) === 1);

  /* --- Paneles --- */
  await pagina.goto(BASE_URL + "admin/", { waitUntil: "networkidle" });
  check("el panel del negocio carga el formulario", (await pagina.locator("#formulario input").count()) > 5);
  await pagina.fill("#nombre", "Negocio Renombrado");
  check("el nombre editado se ve al momento en la vista previa lateral",
    (await pagina.textContent("#vista-nombre")) === "Negocio Renombrado");
  await pagina.locator("#color-acento").evaluate((el) => { el.value = "#ff0000"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  check("cambiar el color repinta el tema del panel",
    (await pagina.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--color-acento").trim())) === "#ff0000");

  await pagina.goto(BASE_URL + "admin/construir-total.html?negocio=la-vina", { waitUntil: "networkidle" });
  check("Construir Total marca la demo como no lista",
    (await pagina.textContent("#semaforo")).includes("Todavía es una demo"));
  await pagina.locator("#demo-activa").uncheck();
  await pagina.fill("#whatsapp", "34600000000");
  await pagina.selectOption("#modo", "api");
  check("al completar requisitos el semáforo sube",
    Number((await pagina.textContent("#semaforo")).match(/(\d+)\/9/)?.[1] || 0) >= 6);
  await pagina.fill("#carta", "Postres\nPostres | Arroz con leche | Casero | 5");
  await pagina.locator('button:has-text("Cargar la carta")').click();
  check("la carta pegada se carga en la configuración",
    (await pagina.textContent("#resumen-contenido")).includes("1 platos"));

  const descarga = pagina.waitForEvent("download");
  await pagina.locator('button:has-text("Descargar el paquete completo")').click();
  const archivo = await descarga;
  const rutaZip = await archivo.path();
  const contenidoZip = await readFile(rutaZip);
  check("el paquete descargado es un ZIP", contenidoZip[0] === 0x50 && contenidoZip[1] === 0x4b);
  check("el paquete lleva la configuración del cliente", contenidoZip.includes(Buffer.from("config/negocio.json")));
  check("el paquete lleva el producto entero", contenidoZip.includes(Buffer.from("modules/pedidos.js")) && contenidoZip.includes(Buffer.from("js/escena.js")));
  check("el paquete lleva el README de despliegue", contenidoZip.includes(Buffer.from("README.md")));

  /* --- La escena 3D de verdad, con Three.js servido en local -------------- */
  //  En los tests no hay salida a Internet, así que se sirve la copia de
  //  node_modules en lugar del CDN. Si no está instalada, se salta el bloque.
  let three = null;
  try { three = await readFile(join(RAIZ, "node_modules/three/build/three.module.js"), "utf8"); } catch { /* sin three */ }

  if (three) {
    const contexto3D = await navegador.newContext({ viewport: { width: 1200, height: 800 } });
    await contexto3D.route("**unpkg.com/three**", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: three }));
    const pagina3D = await contexto3D.newPage();
    const errores3D = [];
    pagina3D.on("pageerror", (e) => errores3D.push(String(e)));

    await pagina3D.goto(BASE_URL + "index.html?negocio=castresana", { waitUntil: "networkidle" });
    await pagina3D.waitForTimeout(2000);
    check("con Three.js disponible se pinta el lienzo 3D", await pagina3D.locator("#lienzo").isVisible());
    check("el aviso de «sin 3D» desaparece", !(await pagina3D.locator("#sin-3d").isVisible()));
    const primera = await pagina3D.textContent("#ficha-titulo");
    check("la ficha muestra el inmueble de delante", Boolean(primera) && primera.length > 3, primera);
    check("el contador dice cuántas tarjetas hay",
      /^1 de \d+$/.test((await pagina3D.textContent("#contador")).trim()));
    await pagina3D.locator("#siguiente").click();
    await pagina3D.waitForTimeout(800);
    check("la flecha gira el carrusel y cambia la ficha",
      (await pagina3D.textContent("#ficha-titulo")) !== primera);
    await pagina3D.locator("#ficha-abrir").click();
    await pagina3D.waitForSelector("#modal-caja");
    check("«Ver detalle» abre el inmueble que está de frente",
      (await pagina3D.textContent("#modal-titulo")) === (await pagina3D.textContent("#ficha-titulo")));
    await pagina3D.locator("#modal-cerrar").click();

    await pagina3D.goto(BASE_URL + "index.html?negocio=la-vina", { waitUntil: "networkidle" });
    await pagina3D.waitForTimeout(2000);
    check("la misma escena sirve para la carta del restaurante",
      (await pagina3D.textContent("#ficha-precio")).includes("€"));
    check("la escena 3D no lanza errores de JavaScript", errores3D.length === 0, errores3D.join(" | "));
    await contexto3D.close();
  } else {
    console.log("  ⚠️  three no está instalado (npm i): me salto la comprobación de la escena 3D.");
  }

  check("ninguna página ha lanzado errores de JavaScript", errores.length === 0, errores.join(" | "));

  await navegador.close();
  await new Promise((ok) => servidor.close(ok));
}

/* ========================================================================== */
console.log(`\n${fallados === 0 ? "✅" : "❌"} Escaparate 3D Pro: ${pasados} bien, ${fallados} mal\n`);
process.exit(fallados === 0 ? 0 : 1);
