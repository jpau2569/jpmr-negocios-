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
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

/** Se compila el TypeScript de verdad: el test ejecuta el mismo código que la
 *  web, no una copia a la que se le han quitado los tipos con expresiones
 *  regulares y que se desincroniza al primer cambio. */
let cache = null;
async function cargar(archivoTs, salidaRelativa) {
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
  assert.equal(CAS.ajustes.review_url, null,
    "ni una review_url inventada");
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
