// ============================================================================
//  PULSO LOCAL AI — pruebas de la lógica que decide cosas
// ----------------------------------------------------------------------------
//  Se prueba lo que, si falla, hace daño de verdad:
//    · el horario, porque decir "abierto" cuando está cerrado espanta clientes
//    · el trial, porque decide si un espacio se sirve o no
//    · el WhatsApp, porque un número inventado es peor que ningún botón
//    · el QR, porque un cartel impreso mal no se puede arreglar
//    · los esquemas, porque son la única defensa de los endpoints públicos
//
//  Uso:  node --test pulso-local-ai/test/*.test.mjs
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");

/** Para probar lib/horarios.ts se COMPILA con el compilador de verdad, no se
 *  le quitan los tipos a mano con expresiones regulares. Así el test ejecuta
 *  exactamente el mismo código que la web, sin una copia que se desincronice. */
let panelCache = null;
/** Igual que cargarHorarios: se compila el TypeScript de verdad. */
async function cargarPanel() {
  if (panelCache) return panelCache;
  const salida = mkdtempSync(join(RAIZ, ".test-build-"));
  const config = join(salida, "tsconfig.json");
  writeFileSync(config, JSON.stringify({
    extends: resolve(RAIZ, "tsconfig.json"),
    compilerOptions: {
      noEmit: false, outDir: salida, rootDir: RAIZ,
      module: "esnext", target: "es2022", incremental: false,
    },
    include: [],
    files: [resolve(RAIZ, "lib/schemas/panel.ts")],
  }));
  execFileSync(process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", "--project", config], { cwd: RAIZ, stdio: "pipe" });
  panelCache = await import(pathToFileURL(join(salida, "lib", "schemas", "panel.js")).href);
  return panelCache;
}

let horariosCache = null;
async function cargarHorarios() {
  if (horariosCache) return horariosCache;
  const salida = mkdtempSync(join(RAIZ, ".test-build-"));
  // Un tsconfig propio: hereda los alias del proyecto (@/...) y compila solo
  // este archivo. Sin él, tsc no sabe resolver "@/types/negocio".
  const configTemporal = join(salida, "tsconfig.json");
  writeFileSync(configTemporal, JSON.stringify({
    extends: resolve(RAIZ, "tsconfig.json"),
    compilerOptions: { noEmit: false, outDir: salida, rootDir: RAIZ, module: "esnext", target: "es2022", incremental: false },
    // include vacío: el extends arrastraría todo el proyecto (y .next/types).
    include: [],
    files: [resolve(RAIZ, "lib/horarios.ts")],
  }));
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsc", "--project", configTemporal],
    { cwd: RAIZ, stdio: "pipe" },
  );
  horariosCache = await import(pathToFileURL(join(salida, "lib", "horarios.js")).href);
  return horariosCache;
}

/* ========================================================================== */
/*  Horarios                                                                   */
/* ========================================================================== */

// La lógica vive en TypeScript, así que para probarla sin compilar se replica
// aquí la parte pura y se comprueba que el fichero real no ha cambiado de
// forma (la firma de las funciones). Es el mismo truco que usa el repo con el
// QR: probar el comportamiento, no la sintaxis.
const horariosTs = readFileSync(resolve(RAIZ, "lib/horarios.ts"), "utf8");

test("horarios: exporta lo que el resto del código espera", () => {
  for (const fn of ["aMinutos", "estadoEn", "estadoAhora", "textoApertura", "horarioLegible"]) {
    assert.ok(horariosTs.includes(`export function ${fn}`) || horariosTs.includes(`export const ${fn}`),
      `falta ${fn}`);
  }
});

test("horarios: contempla los tramos que cruzan la medianoche", () => {
  // Un viernes de 11:00 a 01:00 es lo normal en una taberna. Si el código no
  // lo contempla, a las 00:30 diría "cerrado" con el local lleno.
  assert.ok(horariosTs.includes("medianoche"), "no hay tratamiento de la medianoche");
  assert.ok(horariosTs.match(/ayer/), "no se mira el tramo del día anterior");
});

test("horarios: sin horario configurado no se afirma nada", () => {
  assert.ok(horariosTs.includes('return { estado: "desconocido" }'),
    "debe devolver desconocido cuando no hay horario");
});

/* ========================================================================== */
/*  QR                                                                         */
/* ========================================================================== */

test("el QR es copia literal del de Fotos Fáciles", () => {
  // Reescribir un codificador QR correcto es la mejor forma de introducir un
  // fallo que solo se ve cuando un cliente escanea un cartel ya impreso.
  const aqui = readFileSync(resolve(RAIZ, "lib/qr/nucleo.mjs"), "utf8");
  const original = readFileSync(resolve(RAIZ, "../fotos-faciles/nucleo/qr.mjs"), "utf8");
  assert.equal(
    createHash("sha256").update(aqui).digest("hex"),
    createHash("sha256").update(original).digest("hex"),
    "lib/qr/nucleo.mjs ha dejado de ser copia literal de fotos-faciles/nucleo/qr.mjs",
  );
});

test("el QR codifica una URL de la demo", async () => {
  const { matriz } = await import(resolve(RAIZ, "lib/qr/nucleo.mjs"));
  const { tamano, modulos } = matriz("https://pulsolocal.ai/b/thewhitebar-mieres?qr=twb-mesa", { nivel: "Q" });
  assert.ok(tamano >= 21 && tamano <= 57, `tamaño raro: ${tamano}`);
  // Un QR lleva patrón de búsqueda en TRES esquinas (no en la inferior
  // derecha, que es zona de datos y puede salir oscura o clara según el
  // contenido: comprobarla sería un test que falla por azar).
  // El patrón es un anillo 7x7: fila llena, después borde con hueco.
  const fila = (f, desde) => Array.from({ length: 7 }, (_, i) => (modulos[f][desde + i] ? 1 : 0)).join("");
  const esBuscador = (f0, c0) => fila(f0, c0) === "1111111" && fila(f0 + 1, c0) === "1000001";

  assert.ok(esBuscador(0, 0), "falta el buscador de arriba a la izquierda");
  assert.ok(esBuscador(0, tamano - 7), "falta el buscador de arriba a la derecha");
  assert.ok(esBuscador(tamano - 7, 0), "falta el buscador de abajo a la izquierda");
});

test("los carteles llevan medidas reales de papel", () => {
  const qr = readFileSync(resolve(RAIZ, "lib/qr/index.ts"), "utf8");
  assert.ok(qr.includes('width="148mm" height="210mm"'), "el A5 no mide un A5");
  assert.ok(qr.includes('width="70mm" height="90mm"'), "la pegatina de mesa no mide lo que dice");
  assert.ok(qr.includes('nivel = "Q"'), "el nivel de corrección debe ser Q para aguantar manchas");
});

/* ========================================================================== */
/*  Datos de las demos                                                         */
/* ========================================================================== */

const datos = JSON.parse(readFileSync(resolve(RAIZ, "lib/datos-demo.json"), "utf8"));

test("las dos demos están cargadas", () => {
  assert.ok(datos["thewhitebar-mieres"], "falta La Taberna");
  assert.ok(datos["la-vina-cenera"], "falta La Viña");
});

test("La Taberna trae su carta real completa", () => {
  const t = datos["thewhitebar-mieres"];
  assert.equal(t.platos.length, 44);
  assert.ok(t.platos.some((p) => p.name.includes("Cachopo especial")));
  assert.ok(t.platos.some((p) => p.name.includes("Jamón ibérico")));
});

test("lo no confirmado por el negocio va marcado", () => {
  const t = datos["thewhitebar-mieres"];
  const sinConfirmar = t.platos.filter((p) => p.is_demo).length;
  assert.equal(sinConfirmar, 30, "deben ser 30 los platos sin confirmar");
  assert.equal(t.platos.length - sinConfirmar, 14, "y 14 los ya confirmados");
  assert.equal(t.menuDeHoy.is_demo, true, "el menú del día de muestra debe ir marcado");
});

test("no se inventa ningún enlace de reseñas", () => {
  for (const [slug, esp] of Object.entries(datos)) {
    assert.equal(esp.ajustes.review_url, null, `${slug} tiene review_url inventada`);
  }
});

test("el contacto va al móvil, nunca al fijo", () => {
  // Regla de Pau: "siempre a ambos al móvil, no al fijo". Quien escanea el QR
  // desde la mesa escribe por WhatsApp, y eso solo funciona en un móvil.
  // Los fijos de los dos locales (984 25 33 52 y 985 42 66 90) existen, pero
  // no son los que se pintan.
  const FIJOS = ["984253352", "985426690"];

  for (const [slug, esp] of Object.entries(datos)) {
    const { phone, whatsapp } = esp.ajustes;
    assert.ok(whatsapp, `${slug} debería tener WhatsApp`);
    // Móvil español: empieza por 6 o 7 después del prefijo 34.
    assert.match(whatsapp, /^34[67]\d{8}$/, `el WhatsApp de ${slug} no es un móvil español`);
    for (const fijo of FIJOS) {
      assert.ok(!phone.includes(fijo), `${slug} está usando un fijo (${fijo}) como teléfono`);
      assert.ok(!whatsapp.includes(fijo), `${slug} está usando un fijo (${fijo}) para WhatsApp`);
    }
  }

  assert.equal(datos["thewhitebar-mieres"].ajustes.phone, "+34684650516");
  assert.equal(datos["thewhitebar-mieres"].ajustes.whatsapp, "34684650516");
  assert.equal(datos["la-vina-cenera"].ajustes.phone, "+34620583770");
  assert.equal(datos["la-vina-cenera"].ajustes.whatsapp, "34620583770");
});

test("los fijos siguen ahí, como segunda opción", () => {
  // Quitarlos sería perder al cliente que prefiere llamar al local de toda la
  // vida. Van en el pie, etiquetados, no en el botón grande de la cabecera.
  assert.equal(datos["thewhitebar-mieres"].ajustes.phone_alt, "+34984253352");
  assert.match(datos["thewhitebar-mieres"].ajustes.phone_alt_label, /984 25 33 52/);
  assert.equal(datos["la-vina-cenera"].ajustes.phone_alt, "+34985426690");
  assert.match(datos["la-vina-cenera"].ajustes.phone_alt_label, /985 42 66 90/);
});

test("el horario confirmado es el que dio el negocio", () => {
  // Confirmado el 2026-09-14 con la ficha de Google delante. Si alguien lo
  // toca sin confirmarlo con el local, este test lo caza.
  const taberna = datos["thewhitebar-mieres"].ajustes.opening_hours;
  assert.deepEqual(taberna.find((d) => d.dow === 0).ranges, [["11:00", "17:00"]], "domingo de La Taberna");
  assert.deepEqual(taberna.find((d) => d.dow === 3).ranges, [], "La Taberna cierra los miércoles");
  assert.deepEqual(taberna.find((d) => d.dow === 5).ranges, [["11:00", "01:00"]], "viernes hasta la 1");

  const vina = datos["la-vina-cenera"].ajustes.opening_hours;
  assert.deepEqual(vina.find((d) => d.dow === 2).ranges, [], "La Viña cierra los martes");
  for (const dow of [0, 1, 3, 4, 5, 6]) {
    assert.deepEqual(vina.find((d) => d.dow === dow).ranges, [["12:00", "02:00"]], `La Viña el día ${dow}`);
  }
});

test("los tramos que cruzan la medianoche se cuentan como abiertos", async () => {
  // La Viña cierra a las 2:00. A la 00:30 de un sábado está ABIERTA, y la web
  // tiene que decirlo: si dijera "cerrado" con el local lleno, el cliente que
  // mira el móvil desde la puerta se va a otro sitio.
  const horario = datos["la-vina-cenera"].ajustes.opening_hours;
  const { estadoEn } = await cargarHorarios();

  // Sábado (6) a las 23:30 → abierto, cierra a las 02:00.
  const sabadoNoche = estadoEn(horario, 6, 23 * 60 + 30);
  assert.equal(sabadoNoche.estado, "abierto");
  assert.equal(sabadoNoche.cierraA, "02:00");

  // Domingo (0) a las 00:30 → sigue abierto por el tramo del sábado.
  assert.equal(estadoEn(horario, 0, 30).estado, "abierto");

  // Domingo a las 09:00 → cerrado, abre a las 12:00.
  const domingoManana = estadoEn(horario, 0, 9 * 60);
  assert.equal(domingoManana.estado, "cerrado");
  assert.equal(domingoManana.abreA, "12:00");

  // Martes (2) → cerrado todo el día; el siguiente que abre es el miércoles.
  const martes = estadoEn(horario, 2, 14 * 60);
  assert.equal(martes.estado, "cerrado");
  assert.equal(martes.diaQueAbre, "mañana");
});

test("cada negocio dice qué le falta por confirmar", () => {
  for (const [slug, esp] of Object.entries(datos)) {
    assert.ok(Array.isArray(esp.ajustes.pending_notes), `${slug} sin lista de pendientes`);
    assert.ok(esp.ajustes.pending_notes.length > 0, `${slug} debería declarar lo que le falta`);
    assert.ok(
      esp.ajustes.pending_notes.some((n) => /Google Reviews/i.test(n)),
      `${slug} debe avisar de que falta el enlace de Google`,
    );
  }
  // Tener el número no es lo mismo que saber que lo atienden por WhatsApp:
  // hasta confirmarlo con el local, se dice.
  for (const [slug, esp] of Object.entries(datos)) {
    assert.ok(
      esp.ajustes.pending_notes.some((n) => /WhatsApp activo/i.test(n)),
      `${slug} debe avisar de que falta confirmar el WhatsApp`,
    );
  }
});

test("los alérgenos son solo de los 14 oficiales", () => {
  const OFICIALES = new Set([
    "gluten", "crustaceos", "huevos", "pescado", "cacahuetes", "soja", "lacteos",
    "frutos_de_cascara", "apio", "mostaza", "sesamo", "sulfitos", "altramuces", "moluscos",
  ]);
  for (const esp of Object.values(datos)) {
    for (const p of esp.platos) {
      for (const a of p.alergenos) {
        assert.ok(OFICIALES.has(a), `alérgeno no oficial: "${a}" en ${p.name}`);
      }
    }
  }
});

test("cada plantilla enciende los módulos de su tipo de local", () => {
  // La Taberna es urbana: menú del día sí, grupos no.
  assert.equal(datos["thewhitebar-mieres"].ajustes.modules.daily_menu, true);
  assert.equal(datos["thewhitebar-mieres"].ajustes.modules.groups, false);
  // La Viña es de valle: grupos y celebraciones sí.
  assert.equal(datos["la-vina-cenera"].ajustes.modules.groups, true);
});

test("los identificadores del respaldo coinciden con los del seed de Supabase", () => {
  // Si no coincidieran, la analítica guardaría subject_id que no existen en la
  // base en cuanto se pasara del modo respaldo al modo Supabase.
  const seed = readFileSync(resolve(RAIZ, "sql/03_seed.sql"), "utf8");
  for (const p of datos["thewhitebar-mieres"].platos) {
    assert.ok(seed.includes(p.id), `el id de "${p.name}" no está en el seed`);
  }
});

/* ========================================================================== */
/*  Reglas que no se pueden romper                                             */
/* ========================================================================== */

test("el botón de Google NO depende de la puntuación", () => {
  // Filtrar reseñas por nota ("review gating") incumple las políticas de
  // Google y puede costarle al negocio TODAS sus reseñas. Este test existe
  // para que nadie lo "optimice" dentro de seis meses.
  const opinion = readFileSync(resolve(RAIZ, "components/publico/formulario-opinion.tsx"), "utf8");
  const sospechosas = [
    /rating\s*[><]=?\s*\d[^)]*\?\s*.{0,40}reviewUrl/s,
    /reviewUrl\s*&&\s*rating/,
    /rating\s*[><]=?\s*[45]\s*&&\s*reviewUrl/,
    /nota\s*[><]=?\s*\d\s*&&\s*botonGoogle/,
  ];
  for (const patron of sospechosas) {
    assert.ok(!patron.test(opinion), `el botón de Google parece condicionado a la nota: ${patron}`);
  }
  assert.ok(opinion.includes("const botonGoogle"), "el botón debe definirse una sola vez");
});

test("la reserva nace siempre pendiente", () => {
  const ruta = readFileSync(resolve(RAIZ, "app/api/public/reservation/route.ts"), "utf8");
  assert.ok(ruta.includes('status: "pending"'), "la reserva debe nacer en pending");
  assert.ok(!ruta.includes('status: "confirmed"'), "la web no puede confirmar una mesa");
});

test("el asistente no inventa: remite al local cuando no sabe", () => {
  const ia = readFileSync(resolve(RAIZ, "app/api/ai/ask/route.ts"), "utf8");
  assert.ok(ia.includes("contacta directamente con el local"), "falta la salida honesta");
  assert.ok(ia.includes("contaminación cruzada"), "falta el aviso de alergias");
  // Lo que se vigila es una LLAMADA real a un modelo, no que se nombre al
  // proveedor: el comentario de cabecera explica justamente por qué no se hace.
  assert.ok(!/api\.anthropic\.com|api\.openai\.com/i.test(ia), "no debe llamar a un modelo por HTTP");
  assert.ok(!/@anthropic-ai\/|from ["']openai["']/i.test(ia), "no debe importar un SDK de modelo");
  assert.ok(!/\bfetch\s*\(/.test(ia), "el asistente del MVP no sale a la red");
});

test("los endpoints públicos llevan honeypot y límite de peticiones", () => {
  const api = readFileSync(resolve(RAIZ, "lib/api.ts"), "utf8");
  assert.ok(api.includes("honeypot") || api.includes("Honeypot"), "falta el honeypot");
  assert.ok(api.includes("limitar("), "falta el límite de peticiones");
  assert.ok(api.includes("huellaIp"), "la IP no debe guardarse en claro");
});

test("la clave de servicio nunca es pública", () => {
  const supa = readFileSync(resolve(RAIZ, "lib/supabase/servidor.ts"), "utf8");
  assert.ok(supa.includes('import "server-only"'), "el módulo debe ser solo de servidor");
  assert.ok(!supa.includes("NEXT_PUBLIC_SUPABASE_SERVICE"), "la clave de servicio no lleva NEXT_PUBLIC_");
});

test("la analítica no guarda datos personales", () => {
  const track = readFileSync(resolve(RAIZ, "app/api/public/track/route.ts"), "utf8");
  assert.ok(!/\bip:\s/.test(track), "no debe guardar la IP");
  const esquemas = readFileSync(resolve(RAIZ, "lib/schemas/formularios.ts"), "utf8");
  const bloque = esquemas.slice(esquemas.indexOf("esquemaEvento"));
  for (const campo of ["name", "phone", "email"]) {
    assert.ok(!bloque.slice(0, 600).includes(`${campo}:`), `el evento no debe llevar ${campo}`);
  }
});

test("no hay archivos compilados junto al código fuente", () => {
  // Un `tsc` sin outDir deja un .js al lado de cada .ts. Si ese .js se
  // commitea, Next puede acabar usando next.config.js en vez de
  // next.config.ts y ejecutando una versión vieja de la configuración.
  // Pasó una vez; este test existe para que no vuelva a pasar.
  const sobrantes = [];
  const recorrer = (dir) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (["node_modules", ".next", ".git", "public"].includes(entrada.name)) continue;
        recorrer(ruta);
      } else if (/\.(js|jsx)$/.test(entrada.name)) {
        const base = ruta.replace(/\.(js|jsx)$/, "");
        if (existsSync(`${base}.ts`) || existsSync(`${base}.tsx`)) sobrantes.push(ruta);
      }
    }
  };
  recorrer(RAIZ);
  assert.deepEqual(sobrantes, [], "hay salida de tsc commiteada junto al fuente");
});

test("el menú pegado se reparte solo en primeros, segundos y postres", async () => {
  // El hostelero no rellena quince campos a las once de la mañana: pega lo que
  // ya tiene escrito y el programa lo entiende.
  const { interpretarMenuPegado } = await cargarPanel();

  const pegado = [
    "PRIMEROS", "- Fabada", "- Ensalada mixta",
    "SEGUNDOS:", "1. Merluza a la plancha", "2. Entrecot con patatas",
    "Postres", "• Arroz con leche",
  ].join("\n");

  const { platos } = interpretarMenuPegado(pegado);
  assert.equal(platos.length, 5, "debe encontrar 5 platos");
  assert.deepEqual(platos[0], { course: "primero", name: "Fabada" });
  assert.deepEqual(platos[2], { course: "segundo", name: "Merluza a la plancha" });
  assert.deepEqual(platos[4], { course: "postre", name: "Arroz con leche" });
});

test("un plato que empieza como un encabezado NO se confunde con uno", async () => {
  const { interpretarMenuPegado } = await cargarPanel();
  // "Primero de pasta" es un plato; "Primeros:" es una sección.
  const { platos } = interpretarMenuPegado("Primeros:\nPrimero de pasta");
  assert.equal(platos.length, 1);
  assert.equal(platos[0].name, "Primero de pasta");
  assert.equal(platos[0].course, "primero");
});

test("el precio se entiende como lo teclea una persona", async () => {
  const { precioEuros } = await cargarPanel();
  // Con coma, con punto, con espacios: todo vale. Vacío es "sin precio".
  assert.equal(precioEuros.parse("12,50"), 1250);
  assert.equal(precioEuros.parse("12.50"), 1250);
  assert.equal(precioEuros.parse(" 14 "), 1400);
  assert.equal(precioEuros.parse(""), null);
  assert.equal(precioEuros.parse(null), null);
  assert.equal(precioEuros.parse("gratis"), null);
  assert.equal(precioEuros.parse("-5"), null, "un precio negativo no vale");
});

test("guardar el menú del día le quita la marca de muestra", () => {
  const ruta = readFileSync(resolve(RAIZ, "app/api/panel/menu-dia/route.ts"), "utf8");
  assert.match(ruta, /is_demo:\s*false/,
    "lo que escribe el dueño ya no es una muestra");
  assert.match(ruta, /revalidatePath/,
    "hay que refrescar la web pública o el cambio tarda un minuto en verse");
});

test("la cabecera del menú da el precio y no se cuela como plato", async () => {
  const { interpretarMenuPegado } = await cargarPanel();
  const leido = interpretarMenuPegado([
    "MENU DE HOY 14€ bebida incluida",
    "PRIMEROS", "Fabada asturiana",
    "SEGUNDOS", "Merluza rebozada",
  ].join("\n"));

  assert.equal(leido.platos.length, 2, "la cabecera no es un plato");
  assert.equal(leido.platos[0].name, "Fabada asturiana");
  assert.equal(leido.precioCents, 1400, "debe coger el precio de la cabecera");
  assert.equal(leido.bebidaIncluida, true);
});

test("el precio de la cabecera se entiende con coma y con la palabra euros", async () => {
  const { interpretarMenuPegado } = await cargarPanel();
  assert.equal(interpretarMenuPegado("Menú del día - 12,50 euros\nFabada").precioCents, 1250);
  assert.equal(interpretarMenuPegado("Menu 9€\nFabada").precioCents, 900);
  assert.equal(interpretarMenuPegado("PRIMEROS\nFabada").precioCents, null, "sin cabecera, sin precio");
});
