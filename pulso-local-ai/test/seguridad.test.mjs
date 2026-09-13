// ============================================================================
//  Seguridad: aislamiento multi-tenant, RLS y datos que no pueden salir
// ----------------------------------------------------------------------------
//  Estos tests leen las migraciones y el código fuente. No sustituyen a probar
//  las políticas contra una base de datos real (para eso está el guion de
//  `docs/pruebas-rls.md`), pero sí impiden los descuidos que de verdad ocurren:
//  una tabla nueva sin RLS, una columna privada colada en una vista pública o un
//  `import` de la clave de service role desde un componente de cliente.
// ============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function leerSql() {
  const dir = path.join(raiz, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

function ficherosFuente(dir = path.join(raiz, "src"), acumulado = []) {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const completa = path.join(dir, entrada.name);
    if (entrada.isDirectory()) ficherosFuente(completa, acumulado);
    else if (/\.(ts|tsx|mjs)$/.test(entrada.name)) acumulado.push(completa);
  }
  return acumulado;
}

const SQL = leerSql();
const FUENTES = ficherosFuente();

// --- Tablas y RLS -----------------------------------------------------------
const TABLAS = [...SQL.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);

test("las migraciones crean todas las tablas del modelo", () => {
  const obligatorias = [
    "profiles", "businesses", "business_members", "business_templates", "subscriptions",
    "trial_settings", "business_settings", "services", "service_categories", "properties",
    "property_media", "property_features", "property_inquiries", "visit_requests",
    "valuation_requests", "buyer_requests", "leads", "lead_notes", "lead_assignments",
    "feedback", "qr_codes", "qr_scan_events", "analytics_events", "campaigns",
    "campaign_audiences", "faqs", "ai_knowledge_entries", "legal_text_versions", "consent_records",
  ];
  for (const tabla of obligatorias) {
    assert.ok(TABLAS.includes(tabla), `falta la tabla ${tabla}`);
  }
});

test("TODAS las tablas tienen row level security activado", () => {
  for (const tabla of TABLAS) {
    assert.match(
      SQL,
      new RegExp(`alter table public\\.${tabla}\\s+enable row level security`),
      `la tabla ${tabla} se ha creado sin activar RLS`,
    );
  }
});

test("el rol anónimo no conserva privilegios sobre ninguna tabla", () => {
  assert.match(SQL, /revoke all on all tables in schema public from anon, authenticated/);

  const concesiones = [...SQL.matchAll(/grant\s+([\w\s,]+?)\s+on\s+([^;]+?)\s+to\s+([^;]+);/gs)];
  for (const [, , objetos, roles] of concesiones) {
    if (!roles.includes("anon")) continue;
    // `grant usage on schema public` es imprescindible para poder leer siquiera
    // las vistas: no concede acceso a ninguna tabla.
    if (/^schema\s/.test(objetos.trim())) continue;
    const nombres = objetos.split(",").map((o) => o.trim());
    for (const nombre of nombres) {
      assert.ok(
        nombre.includes("public.v_"),
        `a anon solo se le pueden conceder vistas públicas, y se le concede "${nombre}"`,
      );
    }
  }
});

test("anon solo puede leer: nunca insertar, actualizar ni borrar", () => {
  const concesiones = [...SQL.matchAll(/grant\s+([\w\s,]+?)\s+on\s+[^;]+?\s+to\s+([^;]+);/gs)];
  for (const [, privilegios, roles] of concesiones) {
    if (!roles.includes("anon")) continue;
    for (const prohibido of ["insert", "update", "delete", "truncate", "all"]) {
      assert.ok(
        !privilegios.toLowerCase().includes(prohibido),
        `anon no puede tener "${prohibido}": los formularios públicos escriben desde el servidor`,
      );
    }
  }
});

// --- Qué se puede ver desde fuera -------------------------------------------
test("la vista pública de inmuebles no expone la dirección privada", () => {
  const vista = SQL.slice(
    SQL.indexOf("create or replace view public.v_inmuebles_publicos"),
    SQL.indexOf("create or replace view public.v_media_publica"),
  );
  assert.ok(vista.length > 100, "no se encuentra la vista de inmuebles públicos");
  assert.ok(!/\bp\.private_address\b/.test(vista), "private_address no puede salir en la vista pública");
  assert.match(vista, /case when p\.show_public_address/, "la dirección pública depende del interruptor");
  assert.match(vista, /public\.negocio_publicable\(p\.business_id\)/, "debe filtrar por negocio publicable");
});

test("ninguna vista pública expone leads, consentimientos ni notas internas", () => {
  const vistas = [...SQL.matchAll(/create or replace view public\.(v_\w+)[\s\S]*?;/g)].map((m) => m[0]);
  const prohibidas = ["leads", "consent_records", "lead_notes", "business_admin_notes", "ai_chat_logs", "visit_requests"];

  for (const vista of vistas) {
    for (const tabla of prohibidas) {
      assert.ok(
        !new RegExp(`from public\\.${tabla}\\b`).test(vista),
        `una vista pública está leyendo de ${tabla}`,
      );
    }
  }
});

test("todas las vistas públicas filtran por negocio activo o demo vigente", () => {
  const vistas = [...SQL.matchAll(/create or replace view public\.(v_\w+)([\s\S]*?);/g)];
  const exentas = ["v_textos_legales_vigentes"];

  for (const [cuerpo, nombre] of vistas.map((m) => [m[0], m[1]])) {
    if (exentas.includes(nombre)) continue;
    assert.match(cuerpo, /negocio_publicable/, `la vista ${nombre} no comprueba si el negocio puede publicarse`);
  }
});

test("negocio_publicable exige demo no caducada, y lo comprueba con la hora del servidor", () => {
  const funcion = SQL.slice(
    SQL.indexOf("create or replace function public.negocio_publicable"),
    SQL.indexOf("-- Marca como `expired`"),
  );
  assert.match(funcion, /b\.status = 'active'/);
  assert.match(funcion, /b\.trial_ends_at > now\(\)/);
  assert.match(funcion, /deleted_at is null/);
});

// --- Funciones de autorización ----------------------------------------------
test("las funciones SECURITY DEFINER fijan search_path", () => {
  const definidas = [...SQL.matchAll(/create or replace function public\.(\w+)[\s\S]*?\$\$/g)];
  for (const [cuerpo, nombre] of definidas.map((m) => [m[0], m[1]])) {
    if (!/security definer/.test(cuerpo)) continue;
    assert.match(
      cuerpo,
      /set search_path = (public, pg_temp|public)/,
      `la función ${nombre} es SECURITY DEFINER y no fija search_path`,
    );
  }
});

test("las RPC del panel comprueban la pertenencia antes de leer nada", () => {
  for (const rpc of ["resumen_negocio", "serie_eventos", "ranking_inmuebles", "rendimiento_qr"]) {
    const inicio = SQL.indexOf(`create or replace function public.${rpc}`);
    assert.ok(inicio > -1, `falta la RPC ${rpc}`);
    const cuerpo = SQL.slice(inicio, inicio + 2500);
    assert.match(cuerpo, /if not public\.es_miembro\(p_business_id\) then/, `${rpc} no comprueba es_miembro`);
  }

  const saas = SQL.slice(SQL.indexOf("create or replace function public.metricas_saas"));
  assert.match(saas, /if not public\.es_superadmin\(\) then/);
});

test("nadie puede darse a sí mismo el rol de superadministrador", () => {
  assert.match(SQL, /revoke update \(is_superadmin\) on public\.profiles from authenticated/);
});

// --- Código de la aplicación -------------------------------------------------
test("la clave de service role nunca se importa desde un componente de cliente", () => {
  for (const fichero of FUENTES) {
    const contenido = readFileSync(fichero, "utf8");
    if (!contenido.startsWith('"use client"')) continue;
    assert.ok(
      !contenido.includes("clienteAdmin") && !contenido.includes("SERVICE_ROLE"),
      `${path.relative(raiz, fichero)} es un componente de cliente y toca la clave de service role`,
    );
  }
});

test("los módulos que usan service role están marcados como solo de servidor", () => {
  const fichero = path.join(raiz, "src", "lib", "supabase", "servidor.ts");
  assert.match(readFileSync(fichero, "utf8"), /^import "server-only";/m);
});

test("todos los endpoints públicos pasan por el envoltorio con cupo y honeypot", () => {
  const dir = path.join(raiz, "src", "app", "api", "publico");
  for (const carpeta of readdirSync(dir)) {
    const ruta = path.join(dir, carpeta, "route.ts");
    const contenido = readFileSync(ruta, "utf8");
    assert.match(contenido, /manejarFormulario\(/, `${carpeta} no usa manejarFormulario`);
    assert.match(contenido, /ambito:/, `${carpeta} no declara su ámbito de cupo`);
  }
});

test("el alta de leads comprueba que el negocio sigue activo", () => {
  const captacion = readFileSync(path.join(raiz, "src", "lib", "captacion.ts"), "utf8");
  assert.match(captacion, /negocio\.status === "active"/);
  assert.match(captacion, /new Date\(negocio\.trial_ends_at\) > new Date\(\)/);
  assert.match(captacion, /negocio_inactivo/);
});

test("el consentimiento se guarda con versión, fecha y hash: nunca la IP en claro", () => {
  const captacion = readFileSync(path.join(raiz, "src", "lib", "captacion.ts"), "utf8");
  assert.match(captacion, /consent_records/);
  assert.match(captacion, /legal_text_version/);
  assert.match(captacion, /ip_hash: hashConSal\(ip\)/);
  assert.ok(!/ip_address/.test(captacion), "no debe existir ninguna columna con la IP en claro");
});

test("la analítica descarta cualquier clave con datos personales", () => {
  const analitica = readFileSync(path.join(raiz, "src", "lib", "analitica.ts"), "utf8");
  for (const clave of ["nombre", "telefono", "email", "mensaje"]) {
    assert.ok(analitica.includes(`"${clave}"`), `la lista de claves prohibidas no incluye ${clave}`);
  }
});

test("el endpoint de eventos no acepta los eventos de conversión desde el navegador", () => {
  const ruta = readFileSync(path.join(raiz, "src", "app", "api", "publico", "evento", "route.ts"), "utf8");
  const permitidos = ruta.slice(ruta.indexOf("EVENTOS_PERMITIDOS"), ruta.indexOf("]);"));
  for (const evento of ["lead_submit", "valuation_submit", "visit_request_submit", "feedback_submit"]) {
    assert.ok(!permitidos.includes(evento), `${evento} lo escribe el servidor, no el cliente`);
  }
});

test("el cron de caducidad exige su secreto", () => {
  const cron = readFileSync(path.join(raiz, "src", "app", "api", "cron", "caducar-demos", "route.ts"), "utf8");
  assert.match(cron, /Bearer \$\{cronSecret\}/);
  assert.match(cron, /status: 401/);
});

test("el seed marca como demo todo lo que no es un dato real del negocio", () => {
  const seed = readFileSync(
    path.join(raiz, "supabase", "seed", "seed_asesoria_castresana.sql"),
    "utf8",
  );
  assert.match(seed, /is_demo_data/);
  assert.match(seed, /Datos de demostración/i);
  // El enlace de reseñas no se inventa: lo pega el propietario.
  assert.match(seed, /El enlace oficial de Google lo pega el propietario/);
});
