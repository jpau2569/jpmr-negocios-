// ============================================================================
//  PULSO LOCAL AI — pruebas del sector inmobiliaria
// ----------------------------------------------------------------------------
//  Se prueba lo que hace daño si falla:
//
//    · el lector de cartera, porque de él sale lo que se imprime en el
//      escaparate: un tipo mal leído es un garaje anunciado como piso
//    · el certificado energético, porque el RD 390/2021 obliga a enseñarlo y
//      la tentación de rellenarlo a ojo existe
//    · el precio, porque "780.000 €" leído como 780 es una reclamación
//    · el enlace privado, porque toda la promesa del boca a boca vive ahí
//
//  El HTML de muestra está en test/fixtures/. NO es una captura de la web
//  real: reproduce la estructura Inmoweb documentada en el propio lector, con
//  casos incómodos puestos a mano.
//
//  Uso:  node --test pulso-local-ai/test/*.test.mjs
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

/** Se compila el TypeScript de verdad: el test ejecuta el mismo código que la
 *  web, no una copia a la que se le han quitado los tipos con expresiones
 *  regulares y que se desincroniza al primer cambio. */
let cache = null;
/**
 * @param copiar  Archivos .mjs que el módulo importa tal cual. tsc no los
 *   copia a la carpeta de salida (no son TypeScript), así que sin esto el
 *   import de lib/qr/nucleo.mjs no resuelve.
 */
async function cargar(archivoTs, salidaRelativa, copiar = []) {
  if (cache?.[archivoTs]) return cache[archivoTs];
  const salida = mkdtempSync(join(RAIZ, ".test-build-"));
  const config = join(salida, "tsconfig.json");
  writeFileSync(config, JSON.stringify({
    extends: resolve(RAIZ, "tsconfig.json"),
    compilerOptions: {
      noEmit: false, outDir: salida, rootDir: RAIZ,
      module: "esnext", target: "es2022", incremental: false,
    },
    include: [],
    files: [resolve(RAIZ, archivoTs)],
  }));
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", "--project", config], { cwd: RAIZ, stdio: "pipe" });
  for (const relativo of copiar) {
    const destino = join(salida, relativo);
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(join(RAIZ, relativo), destino);
  }
  const modulo = await import(pathToFileURL(join(salida, salidaRelativa)).href);
  cache = { ...(cache ?? {}), [archivoTs]: modulo };
  return modulo;
}

const cargarParseo = () => cargar("lib/cartera/parseo.ts", "lib/cartera/parseo.js");
const cargarTipos = () => cargar("types/negocio.ts", "types/negocio.js");

const HTML = readFileSync(join(AQUI, "fixtures", "inmoweb-resultados.html"), "utf8");
const BASE = "https://www.asesoriacastresana.com";

// ============================================================================
//  EL LECTOR DE CARTERA
// ============================================================================

test("lee las 4 fichas y no duplica la que aparece dos veces", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const items = parsearInmuebles(HTML, "venta", BASE);
  assert.equal(items.length, 4, "hay 4 inmuebles distintos en el HTML");
  const refs = items.map((i) => i.reference);
  assert.deepEqual([...new Set(refs)].sort(), ["CHA0044", "GAR0031", "LOC0007", "PIS0210"]);
});

test("lee el precio en céntimos, no en euros ni truncado", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const items = parsearInmuebles(HTML, "venta", BASE);
  const piso = items.find((i) => i.reference === "PIS0210");
  const chalet = items.find((i) => i.reference === "CHA0044");
  // 780.000 € → 78.000.000 céntimos. Leerlo como 780 sería una reclamación.
  assert.equal(piso.price_cents, 78_000_000);
  assert.equal(chalet.price_cents, 125_000_000, "el separador de miles no lo parte");
});

test("un local sin precio queda a null, nunca en cero ni inventado", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const local = parsearInmuebles(HTML, "venta", BASE).find((i) => i.reference === "LOC0007");
  assert.equal(local.price_cents, null);
  assert.equal(local.rooms, null, "un local no tiene habitaciones");
});

test("el tipo se deduce del título y un garaje NO acaba de piso", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const items = parsearInmuebles(HTML, "venta", BASE);
  const porRef = Object.fromEntries(items.map((i) => [i.reference, i]));
  assert.equal(porRef.PIS0210.kind, "piso");
  assert.equal(porRef.CHA0044.kind, "chalet");
  assert.equal(porRef.LOC0007.kind, "local");
  assert.equal(porRef.GAR0031.kind, "garaje");
});

test("ante un título que no reconoce dice 'otro' en vez de suponer piso", async () => {
  const { tipoDesdeTitulo } = await cargarParseo();
  assert.equal(tipoDesdeTitulo("Oportunidad única en zona prime"), "otro");
  assert.equal(tipoDesdeTitulo("Ático con terraza"), "atico");
  assert.equal(tipoDesdeTitulo("Nave industrial en Lugones"), "nave");
});

test("decodifica las entidades HTML: nada de Cam&iacute;n en un cartel", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const chalet = parsearInmuebles(HTML, "venta", BASE).find((i) => i.reference === "CHA0044");
  assert.equal(chalet.title, "Chalet en Mieres del Camín");
  assert.match(chalet.municipality, /Mieres/);
  assert.ok(!/&[a-z]+;/.test(chalet.description), "no quedan entidades sin decodificar");
});

test("coge la foto de verdad y se salta el logo y los iconos", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const piso = parsearInmuebles(HTML, "venta", BASE).find((i) => i.reference === "PIS0210");
  assert.match(piso.foto, /piso-oviedo-01\.jpg$/);
  assert.ok(!piso.foto.includes("logo") && !piso.foto.includes("icon"));
});

test("las superficies y las habitaciones salen bien", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const piso = parsearInmuebles(HTML, "venta", BASE).find((i) => i.reference === "PIS0210");
  assert.equal(piso.surface_built_m2, 165);
  assert.equal(piso.rooms, 4);
  assert.equal(piso.bathrooms, 2);
});

test("la URL de origen se resuelve absoluta contra el dominio de la agencia", async () => {
  const { parsearInmuebles } = await cargarParseo();
  for (const i of parsearInmuebles(HTML, "venta", BASE)) {
    assert.ok(i.source_url.startsWith(`${BASE}/`), `${i.reference} tiene URL absoluta`);
  }
});

test("el lector no está atado a Castresana: funciona con otro dominio", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const otra = parsearInmuebles(HTML, "venta", "https://www.otra-agencia.es");
  assert.ok(otra[0].source_url.startsWith("https://www.otra-agencia.es/"));
  assert.equal(otra.length, 4, "misma lectura, otro dominio");
});

// ============================================================================
//  CERTIFICADO ENERGÉTICO (RD 390/2021)
// ============================================================================

test("NADA de lo leído se inventa el certificado energético", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const items = parsearInmuebles(HTML, "venta", BASE);
  for (const i of items) {
    assert.equal(i.energy_status, "pendiente",
      `${i.reference}: la web no publica la etiqueta, así que queda pendiente`);
  }
  assert.ok(!("energy_rating" in items[0]) || items[0].energy_rating == null,
    "y desde luego no se inventa una letra");
});

test("el estado del certificado tiene texto para los cuatro casos", async () => {
  const { ESTADO_ENERGIA_ES } = await cargarTipos();
  for (const estado of ["disponible", "en_tramite", "exento", "pendiente"]) {
    assert.equal(typeof ESTADO_ENERGIA_ES[estado], "string");
    assert.ok(ESTADO_ENERGIA_ES[estado].length > 5);
  }
});

// ============================================================================
//  SLUGS Y PRECIO POR METRO
// ============================================================================

test("el slug es estable, legible y sin acentos", async () => {
  const { slugDeInmueble } = await cargarParseo();
  assert.equal(slugDeInmueble("Chalet en Mieres del Camín", "CHA0044"),
    "chalet-en-mieres-del-camin-cha0044");
  assert.equal(slugDeInmueble("Ático", "A-1"), "atico-a-1");
  assert.ok(!/--|^-|-$/.test(slugDeInmueble("  ¡¡Piso!!  ", "P 1")),
    "sin guiones dobles ni sueltos en los extremos");
});

test("dos inmuebles distintos no comparten slug", async () => {
  const { parsearInmuebles } = await cargarParseo();
  const slugs = parsearInmuebles(HTML, "venta", BASE).map((i) => i.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("el precio por m2 no se calcula si falta el precio o la superficie", async () => {
  const { precioPorM2 } = await cargarTipos();
  const base = { price_cents: 78_000_000, surface_built_m2: 165 };
  assert.equal(precioPorM2(base), 4727);
  assert.equal(precioPorM2({ ...base, price_cents: null }), null);
  assert.equal(precioPorM2({ ...base, surface_built_m2: null }), null);
  assert.equal(precioPorM2({ ...base, surface_built_m2: 0 }), null,
    "y no divide entre cero");
});

// ============================================================================
//  LO QUE PROMETE EL ESQUEMA
// ============================================================================

test("el SQL del sector no deja al público leer inmuebles de enlace privado", () => {
  const sql = readFileSync(join(RAIZ, "sql", "04_inmobiliaria.sql"), "utf8");
  const politica = sql.match(/create policy inmuebles_publico[\s\S]*?;/);
  assert.ok(politica, "existe la política de lectura pública");
  assert.match(politica[0], /visibility = 'publico'/,
    "y exige explícitamente visibilidad pública");
  assert.ok(!/grant[^;]*visit_requests[^;]*anon/i.test(sql),
    "visit_requests no se le concede jamás a anon");
});

test("el enlace privado no puede existir sin token, ni al revés", () => {
  const sql = readFileSync(join(RAIZ, "sql", "04_inmobiliaria.sql"), "utf8");
  assert.match(sql, /constraint enlace_privado_con_token check/);
  assert.match(sql, /constraint energia_coherente check/);
  assert.match(sql, /constraint precio_coherente check/);
});

// ============================================================================
//  EL TIPO Y EL SQL TIENEN QUE DECIR LO MISMO
// ----------------------------------------------------------------------------
//  TipoEventoAnalitica (TypeScript) y el enum analytics_event (PostgreSQL) son
//  la misma lista escrita dos veces. Si se separan, el typecheck pasa, el
//  build pasa, y la inserción revienta en producción con un evento que la base
//  no conoce. Esta prueba es el único sitio donde eso se nota a tiempo.
// ============================================================================

test("los eventos de analítica del sector existen en el tipo y en el enum SQL", () => {
  const tipos = readFileSync(join(RAIZ, "types", "negocio.ts"), "utf8");
  const sql = readFileSync(join(RAIZ, "sql", "04_inmobiliaria.sql"), "utf8");

  const delSql = [...sql.matchAll(/alter type analytics_event add value if not exists '([a-z_]+)'/g)]
    .map((m) => m[1]);
  assert.ok(delSql.length >= 8, "el SQL añade los eventos del sector");

  // El bloque del tipo: desde qr_print_preview (último de hostelería) hasta el
  // punto y coma que cierra la unión.
  const bloque = tipos.slice(tipos.indexOf('| "ai_chat_open"'));
  const delTipo = new Set([...bloque.slice(0, bloque.indexOf(";")).matchAll(/"([a-z_]+)"/g)]
    .map((m) => m[1]));

  for (const evento of delSql) {
    assert.ok(delTipo.has(evento),
      `«${evento}» está en el SQL pero NO en TipoEventoAnalitica: la inserción reventaría`);
  }
});

test("los estados y tipos de inmueble coinciden entre TypeScript y el SQL", () => {
  const tipos = readFileSync(join(RAIZ, "types", "negocio.ts"), "utf8");
  const sql = readFileSync(join(RAIZ, "sql", "04_inmobiliaria.sql"), "utf8");

  const enumSql = (nombre) => {
    const m = sql.match(new RegExp(`create type ${nombre} as enum \\(([^)]+)\\)`));
    assert.ok(m, `existe el enum ${nombre}`);
    return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  };

  const clavesDe = (constante) => {
    const m = tipos.match(new RegExp(`${constante}[^=]*= \\{([\\s\\S]*?)\\n\\};`));
    assert.ok(m, `existe ${constante}`);
    return [...m[1].matchAll(/^\s{2}([a-z_]+):/gm)].map((x) => x[1]).sort();
  };

  assert.deepEqual(clavesDe("TIPOS_INMUEBLE_ES"), enumSql("property_kind"),
    "cada tipo de inmueble del SQL tiene su texto en español, y ninguno sobra");
  assert.deepEqual(clavesDe("ESTADO_OPERACION_ES"), enumSql("property_deal_state"));
  assert.deepEqual(clavesDe("ESTADO_ENERGIA_ES"), enumSql("energy_status"));
});

// ============================================================================
//  ASESORÍA CASTRESANA: LOS DATOS REALES
// ----------------------------------------------------------------------------
//  La agencia es de Pau y los carteles se imprimen con estos datos. Un correo
//  mal escrito o un horario viejo no se arregla después de la tirada.
// ============================================================================

const demo = JSON.parse(readFileSync(join(RAIZ, "lib", "datos-demo.json"), "utf8"));
const CAS = demo["asesoria-castresana"];

test("la agencia está en el respaldo y es del sector inmobiliaria", () => {
  assert.ok(CAS, "existe asesoria-castresana en datos-demo.json");
  assert.equal(CAS.negocio.sector, "inmobiliaria");
  assert.equal(CAS.negocio.name, "Asesoría Castresana");
});

test("el correo es el de inmobiliaria, no el que estaba mal fichado", () => {
  assert.equal(CAS.ajustes.email, "inmobiliariacastresana@gmail.com");
  assert.notEqual(CAS.ajustes.email, "asesoriacastresana@gmail.com");
});

test("el WhatsApp es móvil y el fijo queda de segunda opción", () => {
  assert.match(CAS.ajustes.whatsapp, /^34[67]\d{8}$/);
  assert.equal(CAS.ajustes.phone_alt, "+34985210468");
  assert.ok(!CAS.ajustes.whatsapp.includes("985210468"),
    "el fijo NO se usa como WhatsApp");
  assert.ok(!String(CAS.ajustes.phone).includes("985210468"),
    "ni como teléfono principal");
  // Los dos móviles de la agencia tienen que aparecer en alguna parte: el
  // segundo va en la etiqueta del contacto alternativo.
  assert.ok(
    `${CAS.ajustes.whatsapp}${CAS.ajustes.phone_alt_label}`.includes("672 77 57 21")
    || CAS.ajustes.whatsapp === "34672775721",
    "el segundo móvil no se pierde",
  );
});

test("el horario de oficina es el nuevo: 10-14 y 17-19, de lunes a viernes", () => {
  const h = CAS.ajustes.opening_hours;
  assert.equal(h.length, 7);
  assert.deepEqual(h[0].ranges, [], "domingo cerrado");
  assert.deepEqual(h[6].ranges, [], "sábado cerrado");
  for (const dow of [1, 2, 3, 4, 5]) {
    assert.deepEqual(h[dow].ranges, [["10:00", "14:00"], ["17:00", "19:00"]],
      `el día ${dow} abre en dos tramos`);
  }
});

test("no hay ni un inmueble inventado en la demo de una agencia real", () => {
  assert.deepEqual(CAS.inmuebles, [],
    "la cartera se sincroniza desde su web, no se siembra a mano");
  // El enlace de Google es el que dio el dueño, no uno construido a mano:
  // una reseña que acaba en la ficha equivocada no se recupera.
  assert.match(CAS.ajustes.review_url,
    /^https:\/\/(maps\.app\.goo\.gl|g\.page|search\.google\.com)\//,
    "la review_url es un enlace de Google");
});

test("la agencia declara por escrito lo que le falta", () => {
  assert.ok(CAS.ajustes.pending_notes.length >= 4);
  const texto = CAS.ajustes.pending_notes.join(" ");
  assert.match(texto, /energ/i, "avisa de que falta la etiqueta energética");
  assert.match(texto, /Google/, "avisa de que falta el enlace de reseñas");
});

test("los módulos de hostelería nacen apagados en una inmobiliaria", () => {
  for (const m of ["menu", "daily_menu", "reservations", "groups"]) {
    assert.equal(CAS.ajustes.modules[m], false, `${m} apagado`);
  }
  for (const m of ["properties", "visits", "private_listings", "qr"]) {
    assert.equal(CAS.ajustes.modules[m], true, `${m} encendido`);
  }
});

test("el identificador del respaldo es el MISMO que el del seed SQL", () => {
  const sql = readFileSync(join(RAIZ, "sql", "05_castresana.sql"), "utf8");
  assert.ok(sql.includes(CAS.negocio.id),
    "si no coinciden, Supabase y el respaldo dan dos versiones del mismo negocio");
});

test("la plantilla 'inmobiliaria' dice lo mismo en el generador y en el SQL", async () => {
  const { PLANTILLAS } = await import(
    pathToFileURL(join(RAIZ, "herramientas", "comun.mjs")).href);
  const plantilla = PLANTILLAS.find((p) => p.key === "inmobiliaria");
  assert.ok(plantilla, "existe en el generador");

  const sql = readFileSync(join(RAIZ, "sql", "04_inmobiliaria.sql"), "utf8");
  const bloque = sql.slice(sql.indexOf("'modules', jsonb_build_object("));
  const delSql = {};
  for (const m of bloque.slice(0, bloque.indexOf("),")).matchAll(/'([a-z_]+)', (true|false)/g)) {
    delSql[m[1]] = m[2] === "true";
  }
  assert.deepEqual(plantilla.defaults.modules, delSql,
    "un negocio nacería con módulos distintos según viniera de Supabase o del respaldo");
});

test("la etiqueta del contacto alternativo dice lo mismo en el respaldo y en el SQL", () => {
  const sql = readFileSync(join(RAIZ, "sql", "05_castresana.sql"), "utf8");
  assert.ok(sql.includes(CAS.ajustes.phone_alt_label),
    "si no coinciden, un número de la agencia se pierde en uno de los dos caminos");
});

// ============================================================================
//  SINCRONIZACIÓN: QUÉ SE TOCA Y QUÉ NO
// ----------------------------------------------------------------------------
//  Aquí es donde se puede hacer daño de verdad y en silencio: vaciar la
//  cartera de un escaparate, o pisar la captación de boca a boca que la
//  agencia dio de alta a mano. Las cuatro reglas se prueban una a una.
// ============================================================================

const cargarFusion = () => cargar("lib/cartera/fusion.ts", "lib/cartera/fusion.js");

const leido = (reference, extra = {}) => ({
  reference, slug: reference.toLowerCase(), title: `Piso ${reference}`,
  description: null, operation: "venta", kind: "piso", price_cents: 10_000_000,
  surface_built_m2: 80, rooms: 3, bathrooms: 1, municipality: "Oviedo",
  energy_status: "pendiente", source_url: `https://x.test/${reference}.html`,
  foto: null, ...extra,
});
const guardado = (reference, source = "web", status = "published") =>
  ({ id: `id-${reference}`, reference, source, status });

test("REGLA 1: si no se lee nada, no se toca NADA", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  const plan = planificarSincronizacion([], [guardado("A"), guardado("B")]);
  assert.ok(plan.abortado, "aborta en vez de seguir");
  assert.deepEqual(plan.retirados, [], "y sobre todo NO retira la cartera entera");
  assert.deepEqual(plan.nuevos, []);
  assert.deepEqual(plan.actualizados, []);
  assert.match(plan.abortado, /no se ha tocado nada/i);
});

test("REGLA 2: lo dado de alta a mano NO se toca jamás", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  // El boca a boca: existe en la base, no está en la web. No debe retirarse.
  const plan = planificarSincronizacion(
    [leido("WEB-1")],
    [guardado("WEB-1"), guardado("BOCA-1", "manual")],
  );
  assert.deepEqual(plan.retirados, [], "el manual no se retira aunque no esté en la web");
  assert.equal(plan.intocables.length, 1);
  assert.equal(plan.intocables[0].reference, "BOCA-1");
});

test("REGLA 2 bis: ni aunque la web use la misma referencia", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  const plan = planificarSincronizacion([leido("X-1")], [guardado("X-1", "manual")]);
  assert.deepEqual(plan.actualizados, [], "no lo actualiza");
  assert.deepEqual(plan.nuevos, [], "ni lo duplica");
  assert.equal(plan.intocables[0].reference, "X-1");
});

test("REGLA 3: solo se refrescan los campos que la web conoce", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  const plan = planificarSincronizacion([leido("A")], [guardado("A")]);
  const campos = plan.actualizados[0].campos;
  // Lo que la web sí sabe:
  assert.equal(campos.price_cents, 10_000_000);
  assert.equal(campos.title, "Piso A");
  // Lo que pone la agencia y la sincronización NO debe pisar:
  for (const suyo of [
    "energy_rating", "energy_status", "visibility", "deal_state",
    "street", "street_is_public", "has_lift", "featured", "private_token",
  ]) {
    assert.ok(!(suyo in campos), `la sincronización no debe tocar ${suyo}`);
  }
});

test("REGLA 4: lo que desaparece de la web se despublica, no se borra", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  const plan = planificarSincronizacion([leido("A")], [guardado("A"), guardado("B")]);
  assert.equal(plan.retirados.length, 1);
  assert.equal(plan.retirados[0].reference, "B");
  assert.ok(!("borrados" in plan), "no existe siquiera el concepto de borrar");
});

test("una lectura a medias no retira nada", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  // Se leyó la página de venta pero falló la de alquiler: los de alquiler
  // seguirían existiendo, y retirarlos sería un destrozo.
  const plan = planificarSincronizacion(
    [leido("VENTA-1")],
    [guardado("VENTA-1"), guardado("ALQ-1")],
    { huboErrores: true },
  );
  assert.deepEqual(plan.retirados, [], "con errores de lectura no se retira nada");
  assert.equal(plan.actualizados.length, 1);
});

test("un inmueble ya despublicado no se vuelve a retirar", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  const plan = planificarSincronizacion([leido("A")], [guardado("A"), guardado("B", "web", "draft")]);
  assert.deepEqual(plan.retirados, [], "B ya estaba en borrador");
});

test("lo nuevo entra y lo existente se actualiza, a la vez", async () => {
  const { planificarSincronizacion } = await cargarFusion();
  const plan = planificarSincronizacion(
    [leido("A"), leido("NUEVO")],
    [guardado("A")],
  );
  assert.equal(plan.nuevos.length, 1);
  assert.equal(plan.nuevos[0].reference, "NUEVO");
  assert.equal(plan.actualizados.length, 1);
  assert.equal(plan.actualizados[0].reference, "A");
  assert.equal(plan.abortado, null);
});

test("el resumen se entiende sin saber programar", async () => {
  const { planificarSincronizacion, resumenDelPlan } = await cargarFusion();
  const plan = planificarSincronizacion(
    [leido("A"), leido("NUEVO")],
    [guardado("A"), guardado("VIEJO"), guardado("BOCA", "manual")],
  );
  const texto = resumenDelPlan(plan);
  assert.match(texto, /1 nuevos/);
  assert.match(texto, /1 actualizados/);
  assert.match(texto, /1 retirados/);
  assert.match(texto, /alta manual, sin tocar/);
});

// ============================================================================
//  EL ENLACE PRIVADO, POR DENTRO
// ============================================================================

test("la página del enlace privado se resuelve en servidor y no se indexa", () => {
  const codigo = readFileSync(
    join(RAIZ, "app", "b", "[slug]", "(vivo)", "privado", "[token]", "page.tsx"), "utf8");

  assert.match(codigo, /robots:\s*\{\s*index:\s*false/,
    "un enlace privado que Google indexa deja de ser privado");
  assert.match(codigo, /dynamic\s*=\s*"force-dynamic"/,
    "no debe prerenderizarse: cada token se resuelve al pedirlo");
  assert.match(codigo, /\.eq\("visibility",\s*"enlace_privado"\)/,
    "solo resuelve inmuebles marcados como de enlace privado");
  assert.match(codigo, /\.eq\("business_id",\s*negocio\.id\)/,
    "y siempre filtrando por negocio: aquí service_role salta RLS");
  assert.match(codigo, /notFound\(\)/,
    "un token que no resuelve da 404, no un mensaje que confirme el mecanismo");
  // Sin los comentarios: el propio archivo explica por qué NO se dice
  // "token incorrecto", y esa explicación no debe hacer fallar la prueba.
  const sinComentarios = codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/token incorrecto|token no v[áa]lido/i.test(sinComentarios),
    "nada de decirle a quien prueba tokens que va por buen camino");
});

test("el alta manual nace con source manual, que es lo que la protege", () => {
  const codigo = readFileSync(join(RAIZ, "app", "api", "panel", "inmueble", "route.ts"), "utf8");
  assert.match(codigo, /source:\s*"manual"/,
    "sin esto, la siguiente sincronización se llevaría por delante el boca a boca");
  assert.match(codigo, /randomBytes/, "el token del enlace privado es aleatorio");
  assert.match(codigo, /actual\.private_token \?\? tokenPrivado\(\)/,
    "no se regenera un token ya repartido: el enlace que mandó la agencia debe seguir abriendo");
});

test("la sincronización nunca borra, solo despublica", () => {
  const codigo = readFileSync(
    join(RAIZ, "app", "api", "panel", "sincronizar-cartera", "route.ts"), "utf8");
  assert.ok(!/\.delete\(\)/.test(codigo),
    "la sincronización no debe borrar ni una fila");
  assert.match(codigo, /status:\s*"draft"/, "lo retirado se despublica");
  assert.match(codigo, /\.eq\("business_id",\s*negocio\.id\)/,
    "toda escritura filtra por negocio: service_role salta RLS");
  assert.match(codigo, /plan\.abortado/,
    "respeta la negativa del plan cuando no se ha podido leer la web");
});

// ============================================================================
//  EL CARTEL A4 DEL ESCAPARATE
// ----------------------------------------------------------------------------
//  Es el que se imprime y se pega al cristal. Un QR mal en un cartel ya
//  impreso no se arregla, así que se comprueba que dentro lleva exactamente
//  la URL de ESE inmueble, reconstruyendo la matriz por separado.
// ============================================================================

const cargarQr = () => cargar("lib/qr/index.ts", "lib/qr/index.js", ["lib/qr/nucleo.mjs"]);

test("el cartel A4 mide un A4 de verdad", async () => {
  const { cartelA4Inmueble } = await cargarQr();
  const svg = cartelA4Inmueble({
    url: "https://x.test/b/a/inmueble/piso-p1?qr=p-P1",
    negocio: "Agencia", titulo: "Piso", precio: "165.000 €",
  });
  assert.match(svg, /width="210mm" height="297mm"/);
});

test("el cartel lleva el precio y el resumen, y nunca un cero", async () => {
  const { cartelA4Inmueble } = await cargarQr();
  const svg = cartelA4Inmueble({
    url: "https://x.test/b/a/inmueble/p?qr=t",
    negocio: "Asesoría Castresana", titulo: "Piso en el centro",
    precio: "Consultar", resumen: "3 hab · 2 baños · 90 m²", referencia: "PIS0210",
  });
  assert.match(svg, /Consultar/);
  assert.match(svg, /3 hab/);
  assert.match(svg, /PIS0210/);
  assert.ok(!/>0 €</.test(svg), "un precio a consultar no se pinta como 0 €");
});

test("un vendido lleva su sello y uno disponible no", async () => {
  const { cartelA4Inmueble } = await cargarQr();
  const base = { url: "https://x.test/b/a/inmueble/p?qr=t", negocio: "A", titulo: "T", precio: "1 €" };
  assert.match(cartelA4Inmueble({ ...base, sello: "Vendido" }), /VENDIDO/);
  assert.ok(!/VENDIDO/.test(cartelA4Inmueble(base)), "sin sello no se pinta nada");
});

test("el título largo se corta sin partir palabras", async () => {
  const { cartelA4Inmueble } = await cargarQr();
  const svg = cartelA4Inmueble({
    url: "https://x.test/b/a/inmueble/p?qr=t", negocio: "A", precio: "1 €",
    titulo: "Piso reformado de tres habitaciones con ascensor y plaza de garaje en el centro de Oviedo",
  });
  assert.match(svg, /…/, "se recorta");
  assert.ok(!/garaj</.test(svg), "no parte una palabra por la mitad");
});

test("la URL del QR de un inmueble apunta a ESE inmueble", async () => {
  const { urlDeQr } = await cargarQr();
  assert.equal(
    urlDeQr("https://pulso.test", "asesoria-castresana", "p-PIS0210", "property", "piso-en-oviedo-pis0210"),
    "https://pulso.test/b/asesoria-castresana/inmueble/piso-en-oviedo-pis0210?qr=p-PIS0210",
  );
  // Y los destinos del sector que no son un inmueble concreto:
  assert.match(urlDeQr("https://p.test", "a", "t", "listings"), /\/b\/a\/inmuebles\?qr=t$/);
  assert.match(urlDeQr("https://p.test", "a", "t", "valuation"), /\/b\/a\/valoracion\?qr=t$/);
});

test("el QR impreso en el A4 codifica esa URL exacta, no otra", async () => {
  const { cartelA4Inmueble } = await cargarQr();
  const { matriz } = await import(resolve(RAIZ, "lib/qr/nucleo.mjs"));

  const url = "https://pulso-local-ai.vercel.app/b/asesoria-castresana/inmueble/piso-oviedo-pis0210?qr=p-PIS0210";
  const svg = cartelA4Inmueble({ url, negocio: "Asesoría Castresana", titulo: "Piso", precio: "165.000 €" });

  // Se reconstruye la ruta igual que qrIncrustado, a mano y aquí: si el
  // generador se equivoca, esta prueba no se equivoca con él.
  const { tamano, modulos } = matriz(url, { nivel: "Q" });
  const margen = 4, total = tamano + margen * 2, paso = 100 / total;
  let d = "";
  for (let f = 0; f < tamano; f += 1) {
    for (let c = 0; c < tamano; c += 1) {
      if (modulos[f][c]) {
        d += `M${(55 + (c + margen) * paso).toFixed(2)} ${(110 + (f + margen) * paso).toFixed(2)}`
          + `h${paso.toFixed(2)}v${paso.toFixed(2)}h-${paso.toFixed(2)}z`;
      }
    }
  }
  assert.ok(svg.includes(`d="${d}"`), "el QR del cartel no lleva dentro esa URL");

  // Control: otra referencia tiene que dar un QR distinto. Si no, la prueba
  // no valdría nada y dos pisos compartirían cartel.
  const otro = cartelA4Inmueble({
    url: url.replace("PIS0210", "PIS0211"), negocio: "Asesoría Castresana",
    titulo: "Piso", precio: "165.000 €",
  });
  assert.notEqual(svg, otro, "dos inmuebles distintos no pueden dar el mismo cartel");
});

test("el token del QR no choca entre dos agencias con la misma referencia", async () => {
  const { tokenDeInmueble } = await cargarQr();
  const a = "c58209b6-f648-519c-b92d-7eb6b48083a8";
  const b = "aaaaaaaa-0000-4000-8000-000000000001";
  // PIS0210 lo usan las dos sin saberlo la una de la otra, y qr_codes.token
  // es único en TODA la base: sin prefijo, la segunda se quedaría sin QR.
  assert.notEqual(tokenDeInmueble(a, "PIS0210"), tokenDeInmueble(b, "PIS0210"));
});

test("el token es determinista: un cartel impreso sigue valiendo", async () => {
  const { tokenDeInmueble } = await cargarQr();
  const id = "c58209b6-f648-519c-b92d-7eb6b48083a8";
  assert.equal(tokenDeInmueble(id, "PIS0210"), tokenDeInmueble(id, "PIS0210"));
});

test("el token siempre cumple lo que exige la base", async () => {
  const { tokenDeInmueble } = await cargarQr();
  const id = "c58209b6-f648-519c-b92d-7eb6b48083a8";
  // constraint token_valido: ^[a-zA-Z0-9_-]{4,32}$
  for (const ref of ["PIS0210", "REF/2024-A", "ÁTICO Nº3", "€€€", "A".repeat(40)]) {
    const t = tokenDeInmueble(id, ref);
    assert.match(t, /^[a-zA-Z0-9_-]{4,32}$/, `«${ref}» genera un token que la base rechazaría: ${t}`);
  }
});

test("las dos vías de alta registran el QR del inmueble", () => {
  for (const ruta of ["sincronizar-cartera", "inmueble"]) {
    const codigo = readFileSync(join(RAIZ, "app", "api", "panel", ruta, "route.ts"), "utf8");
    assert.match(codigo, /tokenDeInmueble/, `${ruta} debe registrar el QR`);
    assert.match(codigo, /target:\s*"property"/, `${ruta} debe marcarlo como QR de inmueble`);
    assert.match(codigo, /ignoreDuplicates:\s*true/,
      `${ruta}: un inmueble que ya tenía QR conserva el suyo, para que el cartel impreso siga valiendo`);
  }
});
