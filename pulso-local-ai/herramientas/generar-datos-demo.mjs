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
import { confirmadoDe } from "./confirmado.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = resolve(AQUI, "../lib/datos-demo.json");

const modulosDe = (clave) => PLANTILLAS.find((p) => p.key === clave)?.defaults?.modules ?? {};

function construir({ slug, archivo, plantilla }) {
  const cfg = leer(archivo);
  const c = cfg.contacto ?? {};
  const r = cfg.redes ?? {};
  const bid = uuid("business", slug);
  // Lo que el negocio (o Pau con la ficha delante) ha confirmado manda sobre
  // lo que se encontró por ahí. Ver herramientas/confirmado.mjs.
  const ok = confirmadoDe(slug);

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
      address: ok.direccion || c.direccion || null,
      lat: c.mapaLat ?? null,
      lng: c.mapaLng ?? null,
      phone: ok.telefono || c.telefono || null,
      phone_alt: ok.telefonoAlt || null,
      phone_alt_label: ok.telefonoAltEtiqueta || null,
      // Sin número de móvil confirmado, NO se pinta el botón de WhatsApp.
      // Un botón que lleva a un chat que nadie lee es peor que no tenerlo.
      whatsapp: ok.whatsapp || c.whatsapp || null,
      email: ok.email || c.email || null,
      // PENDIENTE. Sin enlace oficial no hay botón de Google. Jamás se inventa.
      review_url: null,
      website: r.web || null,
      instagram: ok.instagram || r.instagram || null,
      facebook: r.facebook || null,
      tiktok: r.tiktok || null,
      tripadvisor: ok.tripadvisor || r.tripadvisor || null,
      // Solo se pinta el estado abierto/cerrado si el horario está CONFIRMADO.
      // Sin confirmar, vacío: preferimos no decir nada a decirlo mal.
      opening_hours: ok.horario ?? [],
      theme: cfg.colores ?? {},
      logo_url: null,
      cover_url: null,
      modules: modulosDe(plantilla),
      pending_notes: ok.pendiente ?? [],
      reactivation_whatsapp: null,
    },
    categorias,
    platos,
    menuDeHoy,
    menusEspeciales,
    eventos: [],
    promociones: [],
    inmuebles: [],
  };
}

/**
 * Una agencia inmobiliaria. No lee ningún fichero de configuración: sale
 * entera de herramientas/confirmado.mjs, que es donde vive lo que alguien ha
 * confirmado de verdad.
 *
 * `inmuebles` va VACÍO a propósito. La cartera se carga desde la web oficial
 * pulsando «Sincronizar» en el panel. Sembrar pisos de mentira en la demo de
 * una agencia real sería pedir que alguien acabe enseñándoselos a un cliente.
 */
function construirAgencia({ slug, nombre, eslogan, plantilla }) {
  const ok = confirmadoDe(slug);
  const bid = uuid("business", slug);
  return {
    negocio: {
      id: bid, slug, name: nombre, sector: "inmobiliaria", status: "trial",
      // Demo siempre viva en el respaldo. En Supabase manda trial_ends_at.
      trial_ends_at: null,
    },
    ajustes: {
      business_id: bid,
      tagline: eslogan,
      address: ok.direccion ?? null,
      lat: null, lng: null,
      phone: ok.telefono ?? null,
      phone_alt: ok.telefonoAlt ?? null,
      phone_alt_label: ok.telefonoAltEtiqueta ?? null,
      whatsapp: ok.whatsapp ?? null,
      email: ok.email ?? null,
      // PENDIENTE. Sin enlace oficial no hay botón de Google. Jamás se inventa.
      review_url: null,
      website: ok.web ?? null,
      instagram: ok.instagram ?? null,
      facebook: null, tiktok: null, tripadvisor: null,
      opening_hours: ok.horario ?? [],
      // Dorado sobre negro, como el rótulo del local.
      theme: {
        fondo: "#11161d", superficie: "#1a222c",
        acento: "#c9a227", acento2: "#2f6bff", texto: "#eef2f6",
      },
      logo_url: null, cover_url: null,
      modules: modulosDe(plantilla),
      pending_notes: ok.pendiente ?? [],
      reactivation_whatsapp: null,
    },
    categorias: [], platos: [], menuDeHoy: null,
    menusEspeciales: [], eventos: [], promociones: [],
    inmuebles: [],
  };
}

const AGENCIAS = [
  {
    slug: "asesoria-castresana",
    nombre: "Asesoría Castresana",
    eslogan: "Inmobiliaria en el centro de Oviedo",
    plantilla: "inmobiliaria",
  },
];

const salida = {};
for (const n of NEGOCIOS) salida[n.slug] = construir(n);
for (const a of AGENCIAS) salida[a.slug] = construirAgencia(a);

writeFileSync(SALIDA, `${JSON.stringify(salida, null, 2)}\n`, "utf8");

console.log(`✅ ${SALIDA}`);
for (const [slug, esp] of Object.entries(salida)) {
  const sinConfirmar = esp.platos.filter((p) => p.is_demo).length;
  console.log(`   ${slug}: ${esp.categorias.length} categorías, ${esp.platos.length} platos (${sinConfirmar} sin confirmar)`);
}
avisarAlergenos();
