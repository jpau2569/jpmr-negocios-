// ============================================================================
//  PULSO LOCAL AI — respaldo de datos para el front
// ----------------------------------------------------------------------------
//  Genera lib/datos-demo.json a partir de las mismas fichas verificadas que el
//  seed de Supabase, y con los mismos identificadores.
//
//  Existe por una razón de negocio: Pau tiene que poder enseñar la demo en el
//  bar, desde su móvil, antes de que exista el proyecto de Supabase. Y si un
//  día la base falla, quien escanee el QR ve la carta igual.
//
//  Uso:  node pulso-local-ai/herramientas/generar-datos-demo.mjs
// ============================================================================

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  uuid, leer, alergenosDe, centimos, avisarAlergenos, PLANTILLAS, NEGOCIOS,
} from "./comun.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, "../lib/datos-demo.json");

const modulosDe = (clave) => PLANTILLAS.find((p) => p.key === clave)?.defaults?.modules ?? {};

function construir({ slug, archivo, plantilla }) {
  const cfg = leer(archivo);
  const c = cfg.contacto ?? {};
  const r = cfg.redes ?? {};
  const bid = uuid("business", slug);

  const categorias = [];
  const platos = [];

  (cfg.carta?.categorias ?? [])
    .filter((cat) => cat.id !== "menu-dia")
    .forEach((cat, i) => {
      const cid = uuid("category", slug, cat.id);
      categorias.push({
        id: cid,
        name: cat.nombre,
        description: cat.descripcion ?? null,
        position: i,
        is_demo: false,
      });
      (cat.platos ?? []).forEach((p, j) => {
        platos.push({
          id: uuid("item", slug, cat.id, p.id),
          category_id: cid,
          name: p.nombre,
          description: p.descripcion || null,
          price_cents: centimos(p.precio),
          price_from: false,
          image_url: p.foto || null,
          tags: p.destacado ? ["recomendado"] : [],
          position: j,
          status: "published",
          // El negocio todavía no lo ha confirmado: la página lo dirá.
          is_demo: p.confirmado === false,
          alergenos: alergenosDe(p),
        });
      });
    });

  // Los dos formatos de menú de La Taberna son datos reales de su carta y su
  // pizarra: van como menús especiales porque describen precio y condiciones.
  const menuDia = (cfg.carta?.categorias ?? []).find((cat) => cat.id === "menu-dia");
  const menusEspeciales = (menuDia?.platos ?? []).map((m, i) => ({
    id: uuid("special", slug, m.id),
    kind: i === 0 ? "other" : "weekend",
    name: m.nombre,
    description: m.descripcion || null,
    image_url: null,
    price_cents: centimos(m.precio),
    conditions: null,
    starts_on: null,
    ends_on: null,
    courses: [],
    is_demo: m.confirmado === false,
  }));

  // El menú del día REAL cambia cada día y no lo sabemos. Se carga uno de
  // muestra, marcado como tal, para que la sección se pueda enseñar.
  const menuDeHoy = plantilla === "taberna-urbana"
    ? {
        id: uuid("daily", slug, "hoy"),
        service_date: null,
        price_cents: null,
        includes_drink: true,
        notes: "Menú de muestra para enseñar cómo funciona la sección. El negocio carga el de cada día desde el panel.",
        status: "published",
        is_demo: true,
        platos: [
          { id: uuid("dailyitem", slug, "0"), course: "primero", name: "Primero de muestra", description: null, position: 0 },
          { id: uuid("dailyitem", slug, "1"), course: "primero", name: "Otro primero de muestra", description: null, position: 1 },
          { id: uuid("dailyitem", slug, "2"), course: "segundo", name: "Segundo de muestra", description: null, position: 2 },
          { id: uuid("dailyitem", slug, "3"), course: "segundo", name: "Otro segundo de muestra", description: null, position: 3 },
          { id: uuid("dailyitem", slug, "4"), course: "postre", name: "Postre de muestra", description: null, position: 4 },
        ],
      }
    : null;

  return {
    negocio: {
      id: bid,
      slug,
      name: cfg.nombre,
      sector: "hosteleria",
      status: "trial",
      // Demo siempre viva en el respaldo: si caducara, Pau no podría enseñarla.
      // En Supabase manda trial_ends_at de verdad.
      trial_ends_at: null,
    },
    ajustes: {
      business_id: bid,
      tagline: cfg.eslogan || null,
      address: c.direccion || null,
      lat: c.mapaLat ?? null,
      lng: c.mapaLng ?? null,
      phone: c.telefono || null,
      // PENDIENTE de que el negocio lo dé. Sin número, no se pinta el botón.
      whatsapp: c.whatsapp || null,
      email: c.email || null,
      // PENDIENTE. Sin enlace oficial no hay botón de Google. Jamás se inventa.
      review_url: null,
      website: r.web || null,
      instagram: r.instagram || null,
      facebook: r.facebook || null,
      tiktok: r.tiktok || null,
      // Vacío a propósito: en la ficha hay un horario, pero sin confirmar por
      // el local. Preferimos no decir si está abierto a decirlo mal.
      opening_hours: [],
      theme: cfg.colores ?? {},
      logo_url: null,
      cover_url: null,
      modules: modulosDe(plantilla),
      reactivation_whatsapp: null,
    },
    categorias,
    platos,
    menuDeHoy,
    menusEspeciales,
    eventos: [],
    promociones: [],
  };
}

const salida = {};
for (const n of NEGOCIOS) salida[n.slug] = construir(n);

writeFileSync(SALIDA, `${JSON.stringify(salida, null, 2)}\n`, "utf8");

console.log(`✅ ${SALIDA}`);
for (const [slug, esp] of Object.entries(salida)) {
  const sinConfirmar = esp.platos.filter((p) => p.is_demo).length;
  console.log(`   ${slug}: ${esp.categorias.length} categorías, ${esp.platos.length} platos (${sinConfirmar} sin confirmar)`);
}
avisarAlergenos();
