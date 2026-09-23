// ============================================================================
//  PULSO LOCAL AI — generar el seed desde los datos ya verificados
// ----------------------------------------------------------------------------
//  La carta de La Taberna (46 platos, sacados de fotos de su carta impresa) y
//  la ficha de La Viña ya están verificadas en escaparate3d-pro. Volver a
//  teclearlas sería volver a equivocarse, así que este script las traduce a
//  SQL conservando UNA COSA POR ENCIMA DE TODO: qué está confirmado por el
//  negocio y qué no. `confirmado: false` en el JSON → `is_demo = true` en la
//  base → la web lo pinta como dato sin confirmar.
//
//  Uso:  node pulso-local-ai/herramientas/generar-seed.mjs
//  Sale: pulso-local-ai/sql/03_seed.sql
// ============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { confirmadoDe } from "./confirmado.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../..");
const EJEMPLOS = resolve(RAIZ, "escaparate3d-pro/config/ejemplos");
const SALIDA = resolve(AQUI, "../sql/03_seed.sql");

/* --- UUID determinista (v5, namespace propio) -------------------------------
   Hace el seed idempotente: lanzarlo dos veces no duplica nada, y los ids no
   cambian entre ejecuciones, así que el QR impreso sigue valiendo. */
const NS = "pulsolocal.ai";
function uuid(...partes) {
  const h = createHash("sha1").update(NS + "|" + partes.join("|")).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;           // versión 5
  b[8] = (b[8] & 0x3f) | 0x80;           // variante RFC 4122
  const s = b.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/* --- Escapado SQL --- */
const sql = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? String(Number(v)) : "null");
const bool = (v) => (v ? "true" : "false");
const centimos = (precio) => (Number.isFinite(Number(precio)) ? String(Math.round(Number(precio) * 100)) : "null");

/* --- Alérgenos ---------------------------------------------------------------
   Del texto libre del JSON al enum cerrado del esquema. Lo que no se reconoce
   NO se inventa: se avisa por consola y se deja fuera, porque un alérgeno mal
   declarado es un problema sanitario, no un detalle de formato. */
const ALERGENOS = {
  gluten: "gluten", trigo: "gluten",
  crustaceos: "crustaceos", crustáceos: "crustaceos", marisco: "crustaceos",
  huevo: "huevos", huevos: "huevos",
  pescado: "pescado",
  cacahuete: "cacahuetes", cacahuetes: "cacahuetes",
  soja: "soja",
  leche: "lacteos", lacteos: "lacteos", lácteos: "lacteos", lactosa: "lacteos",
  "frutos secos": "frutos_de_cascara", "frutos de cascara": "frutos_de_cascara",
  "frutos de cáscara": "frutos_de_cascara", nueces: "frutos_de_cascara",
  apio: "apio", mostaza: "mostaza",
  sesamo: "sesamo", sésamo: "sesamo",
  sulfitos: "sulfitos", altramuces: "altramuces",
  moluscos: "moluscos",
};
const sinReconocer = new Set();
function alergeno(texto) {
  const clave = String(texto || "").trim().toLowerCase();
  const mapeado = ALERGENOS[clave];
  if (!mapeado) sinReconocer.add(clave);
  return mapeado || null;
}

/* --- Lectura de las fichas ya verificadas ---
   Solo existen en el monorepo. En el repositorio suelto del producto no hacen
   falta: el seed ya está generado y versionado. */
const leer = (archivo) => {
  const ruta = resolve(EJEMPLOS, archivo);
  if (!existsSync(ruta)) {
    console.error(
      `\n❌ No encuentro ${archivo}. Los generadores necesitan el monorepo` +
      " (escaparate3d-pro).\n   Para desplegar no hacen falta: sql/03_seed.sql ya está generado.\n",
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(ruta, "utf8"));
};

const lineas = [];
const w = (t = "") => lineas.push(t);

w("-- ============================================================================");
w("--  PULSO LOCAL AI — seed");
w("-- ----------------------------------------------------------------------------");
w("--  GENERADO por herramientas/generar-seed.mjs. No editar a mano: vuelve a");
w("--  lanzarlo. Los datos vienen de escaparate3d-pro/config/ejemplos/, que a su");
w("--  vez salen de fichas públicas y de fotos de las cartas.");
w("--");
w("--  is_demo = true significa QUE EL NEGOCIO NO LO HA CONFIRMADO TODAVÍA. La");
w("--  web lo pinta como tal. No se quita hasta que el dueño lo valide.");
w("-- ============================================================================");
w();
w("begin;");
w();

// Plantillas de sector: deciden con qué módulos nace un negocio nuevo.
w("-- --- Plantillas de sector ---");
const plantillas = [
  { key: "taberna-urbana", name: "Taberna urbana",
    description: "Bar restaurante de ciudad: menú del día, carta y raciones para compartir.",
    defaults: { modules: { daily_menu: true, menu: true, reservations: true, groups: false, feedback: true, loyalty: true, qr: true } } },
  { key: "parrilla-grupos", name: "Parrilla y grupos",
    description: "Restaurante de valle con parrilla, celebraciones y grupos grandes.",
    defaults: { modules: { daily_menu: false, menu: true, reservations: true, groups: true, events: true, feedback: true, loyalty: true, qr: true } } },
];
for (const p of plantillas) {
  w(`insert into business_templates (id, key, name, description, defaults) values (`);
  w(`  ${sql(uuid("template", p.key))}, ${sql(p.key)}, ${sql(p.name)}, ${sql(p.description)}, ${sql(JSON.stringify(p.defaults))}::jsonb)`);
  w(`on conflict (key) do nothing;`);
}
w();

// Texto legal: sin una versión guardada, el consentimiento no se puede probar.
const LEGAL_ID = uuid("legal", "marketing", "v1");
w("-- --- Texto legal versionado (sin esto un consentimiento no se puede demostrar) ---");
w(`insert into legal_text_versions (id, business_id, kind, version, body) values (`);
w(`  ${sql(LEGAL_ID)}, null, 'marketing_consent', 'v1',`);
w(`  ${sql("Acepto recibir el menú del día, novedades y eventos del negocio por el canal que he indicado. Puedo darme de baja en cualquier momento escribiendo al propio negocio. Mis datos no se ceden a terceros.")})`);
w(`on conflict (business_id, kind, version) do nothing;`);
w();

/* --- Un negocio completo ---------------------------------------------------- */
function negocio({ slug, plantilla, fuente, trialDias = 7, qrs }) {
  const cfg = leer(fuente);
  const bid = uuid("business", slug);
  const c = cfg.contacto || {};
  const r = cfg.redes || {};
  const ver = cfg.verificacion || {};

  w("-- ==========================================================================");
  w(`--  ${cfg.nombre}  (/b/${slug})`);
  if (ver.fuente) w(`--  Origen de los datos: ${ver.fuente}`);
  w("-- ==========================================================================");
  w(`insert into businesses (id, slug, name, sector, status, trial_ends_at) values (`);
  w(`  ${sql(bid)}, ${sql(slug)}, ${sql(cfg.nombre)}, 'hosteleria', 'trial', now() + interval '${trialDias} days')`);
  w(`on conflict (slug) do nothing;`);
  w();

  // Lo confirmado por el negocio manda sobre lo que se encontró por ahí.
  // El horario solo se carga si está CONFIRMADO: sin él, la web no dice si
  // está abierto, porque decirlo mal hace que la gente se plante en la puerta.
  const ok = confirmadoDe(slug);
  w(`insert into business_settings (business_id, tagline, address, phone, phone_alt, phone_alt_label, whatsapp, email,`);
  w(`  website, instagram, facebook, tripadvisor, review_url, opening_hours, theme, modules, pending_notes) values (`);
  w(`  ${sql(bid)}, ${sql(cfg.eslogan)}, ${sql(ok.direccion || c.direccion)}, ${sql(ok.telefono || c.telefono)},`);
  w(`  ${sql(ok.telefonoAlt || null)}, ${sql(ok.telefonoAltEtiqueta || null)},`);
  w(`  ${sql(ok.whatsapp ?? c.whatsapp ?? null)},  -- sin móvil confirmado, el botón de WhatsApp no se pinta`);
  w(`  ${sql(ok.email || c.email || null)}, ${sql(r.web || null)},`);
  w(`  ${sql(ok.instagram || r.instagram || null)}, ${sql(r.facebook || null)},`);
  w(`  ${sql(ok.tripadvisor || r.tripadvisor || null)},`);
  w(`  null,  -- review_url: PENDIENTE de que el negocio dé su enlace oficial de Google`);
  w(`  ${sql(JSON.stringify(ok.horario ?? []))}::jsonb,${ok.horario ? `  -- confirmado: ${ok.origen}` : "  -- sin confirmar por el local"}`);
  w(`  ${sql(JSON.stringify(cfg.colores || {}))}::jsonb,`);
  w(`  ${sql(JSON.stringify(plantillas.find((p) => p.key === plantilla)?.defaults?.modules || {}))}::jsonb,`);
  w(`  ${sql(JSON.stringify(ok.pendiente ?? []))}::jsonb)`);
  w(`on conflict (business_id) do nothing;`);
  w();
  w(`insert into trial_settings (business_id, trial_days) values (${sql(bid)}, ${trialDias})`);
  w(`on conflict (business_id) do nothing;`);
  w();

  // --- Carta ---
  let nPlatos = 0, nSinConfirmar = 0;
  const categorias = (cfg.carta?.categorias || []).filter((cat) => cat.id !== "menu-dia");
  categorias.forEach((cat, i) => {
    const cid = uuid("category", slug, cat.id);
    w(`insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (`);
    w(`  ${sql(cid)}, ${sql(bid)}, ${sql(cat.nombre)}, ${sql(cat.descripcion || null)}, ${i}, 'published', false)`);
    w(`on conflict (id) do nothing;`);

    (cat.platos || []).forEach((p, j) => {
      const pid = uuid("item", slug, cat.id, p.id);
      const demo = p.confirmado === false;
      nPlatos += 1;
      if (demo) nSinConfirmar += 1;
      const tags = [p.destacado ? "recomendado" : null].filter(Boolean);
      w(`insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (`);
      w(`  ${sql(pid)}, ${sql(bid)}, ${sql(cid)}, ${sql(p.nombre)}, ${sql(p.descripcion || null)}, ${centimos(p.precio)},`);
      w(`  array[${tags.map(sql).join(", ")}]::text[], ${j}, 'published', ${bool(demo)})`);
      w(`on conflict (id) do nothing;`);

      const mapeados = [...new Set((p.alergenos || []).map(alergeno).filter(Boolean))];
      for (const a of mapeados) {
        w(`insert into menu_item_allergens (item_id, allergen) values (${sql(pid)}, '${a}') on conflict do nothing;`);
      }
    });
    w();
  });

  // --- QR ---
  w("-- QR de este negocio (el token viaja en la URL: /b/" + slug + "?qr=<token>)");
  for (const q of qrs) {
    w(`insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (`);
    w(`  ${sql(uuid("qr", slug, q.token))}, ${sql(bid)}, ${sql(q.token)}, ${sql(q.label)}, '${q.target}', '${q.location}', ${sql(q.ref || null)})`);
    w(`on conflict (token) do nothing;`);
  }
  w();

  return { bid, cfg, nPlatos, nSinConfirmar, categorias: categorias.length };
}

/* --- La Taberna · The White Bar (Mieres) --- */
const taberna = negocio({
  slug: "thewhitebar-mieres",
  plantilla: "taberna-urbana",
  fuente: "restaurante-la-taberna.json",
  qrs: [
    { token: "twb-mesa", label: "Mesas", target: "landing", location: "table" },
    { token: "twb-barra", label: "Barra", target: "daily_menu", location: "bar" },
    { token: "twb-ticket", label: "Ticket", target: "review", location: "ticket" },
    { token: "twb-escap", label: "Escaparate", target: "menu", location: "window" },
    { token: "twb-redes", label: "Redes sociales", target: "landing", location: "social" },
  ],
});

// El menú del día real cambia cada día y NO lo sabemos: se carga uno de
// muestra, marcado como demo, para que el negocio vea la pieza funcionando.
// Su precio y formato SÍ son datos reales tomados de su pizarra.
w("-- --- Menú del día de MUESTRA (el real lo carga el negocio cada día) ---");
const menuHoy = uuid("daily", "thewhitebar-mieres", "hoy");
w(`insert into daily_menus (id, business_id, service_date, price_cents, includes_drink, notes, status, is_demo) values (`);
w(`  ${sql(menuHoy)}, ${sql(taberna.bid)}, current_date, null, true,`);
w(`  ${sql("Menú de muestra para enseñar cómo funciona la sección. El negocio carga el de cada día desde el panel. Formato y precio reales se toman de su pizarra una vez confirmados.")},`);
w(`  'published', true)`);
w(`on conflict (business_id, service_date) do nothing;`);
for (const [i, [curso, nombre]] of [
  ["primero", "Primero de muestra"],
  ["primero", "Otro primero de muestra"],
  ["segundo", "Segundo de muestra"],
  ["segundo", "Otro segundo de muestra"],
  ["postre", "Postre de muestra"],
].entries()) {
  w(`insert into daily_menu_items (id, daily_menu_id, course, name, position) values (`);
  w(`  ${sql(uuid("dailyitem", "thewhitebar-mieres", String(i)))}, ${sql(menuHoy)}, ${sql(curso)}, ${sql(nombre)}, ${i})`);
  w(`on conflict (id) do nothing;`);
}
w();

// Los dos formatos de menú SÍ son reales (de la carta y la pizarra): se
// guardan como menús especiales porque describen precio y condiciones.
w("-- --- Formatos de menú tomados de su carta y su pizarra ---");
const cfgTaberna = leer("restaurante-la-taberna.json");
const menuDia = (cfgTaberna.carta?.categorias || []).find((c) => c.id === "menu-dia");
(menuDia?.platos || []).forEach((m, i) => {
  w(`insert into special_menus (id, business_id, kind, name, description, price_cents, status, is_demo) values (`);
  w(`  ${sql(uuid("special", "thewhitebar-mieres", m.id))}, ${sql(taberna.bid)}, '${i === 0 ? "other" : "weekend"}',`);
  w(`  ${sql(m.nombre)}, ${sql(m.descripcion || null)}, ${centimos(m.precio)}, 'published', ${bool(m.confirmado === false)})`);
  w(`on conflict (id) do nothing;`);
});
w();

/* --- La Viña (Cenera) --- */
const vina = negocio({
  slug: "la-vina-cenera",
  plantilla: "parrilla-grupos",
  fuente: "restaurante-la-vina.json",
  qrs: [
    { token: "lv-mesa", label: "Mesas", target: "landing", location: "table" },
    { token: "lv-grupos", label: "Cartel de grupos", target: "group", location: "window" },
    { token: "lv-ticket", label: "Ticket", target: "review", location: "ticket" },
    { token: "lv-redes", label: "Redes sociales", target: "landing", location: "social" },
  ],
});

w("commit;");
w();
w("-- ============================================================================");
w("--  RESUMEN");
w(`--   La Taberna · The White Bar : ${taberna.categorias} categorías, ${taberna.nPlatos} platos (${taberna.nSinConfirmar} sin confirmar)`);
w(`--   Restaurante La Viña        : ${vina.categorias} categorías, ${vina.nPlatos} platos (${vina.nSinConfirmar} sin confirmar)`);
w("--");
w("--  PENDIENTE antes de publicar con datos reales (no lo puede inventar nadie):");
w("--   · WhatsApp de cada negocio");
w("--   · review_url oficial de Google de cada negocio");
w("--   · Horario confirmado por el local");
w("--   · Fotos de los platos");
w("--   · Precios marcados is_demo, confirmados uno a uno");
w("-- ============================================================================");

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, lineas.join("\n") + "\n", "utf8");

console.log(`✅ ${SALIDA}`);
console.log(`   La Taberna: ${taberna.categorias} categorías, ${taberna.nPlatos} platos (${taberna.nSinConfirmar} sin confirmar)`);
console.log(`   La Viña   : ${vina.categorias} categorías, ${vina.nPlatos} platos (${vina.nSinConfirmar} sin confirmar)`);
if (sinReconocer.size) {
  console.log(`\n⚠️  Alérgenos sin reconocer (NO se han inventado, se han dejado fuera):`);
  for (const a of sinReconocer) console.log(`   · "${a}"`);
  console.log(`   Añádelos al mapa ALERGENOS si corresponden a uno de los 14 oficiales.`);
}
