// ============================================================================
//  Piezas compartidas por los generadores
// ----------------------------------------------------------------------------
//  El seed de Supabase y el respaldo JSON del front salen de LA MISMA fuente y
//  con LOS MISMOS identificadores. Si no, la analítica guardaría un subject_id
//  que no existe en la base en cuanto se pase de un modo a otro.
// ============================================================================

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, "../..");
export const EJEMPLOS = resolve(RAIZ, "escaparate3d-pro/config/ejemplos");

/** UUID v5 determinista: el seed es idempotente y los QR impresos siguen valiendo. */
const NS = "pulsolocal.ai";
export function uuid(...partes) {
  const h = createHash("sha1").update(NS + "|" + partes.join("|")).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const s = b.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

/* --- Alérgenos ---------------------------------------------------------------
   Del texto libre al enum cerrado de los 14 oficiales. Lo que no se reconoce NO
   se inventa: se avisa y se deja fuera. */
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

export const sinReconocer = new Set();

export function alergeno(texto) {
  const clave = String(texto || "").trim().toLowerCase();
  const mapeado = ALERGENOS[clave];
  if (!mapeado) sinReconocer.add(clave);
  return mapeado || null;
}

export function alergenosDe(plato) {
  return [...new Set((plato.alergenos || []).map(alergeno).filter(Boolean))];
}

export const leer = (archivo) => {
  const ruta = resolve(EJEMPLOS, archivo);
  if (!existsSync(ruta)) {
    console.error(
      `\n❌ No encuentro ${archivo}.\n\n` +
      "   Los generadores leen las fichas verificadas de escaparate3d-pro, que\n" +
      "   vive en el monorepo de Pau. En este repositorio suelto no está.\n\n" +
      "   No hace falta para desplegar: sql/03_seed.sql y lib/datos-demo.json ya\n" +
      "   están generados y versionados. Solo necesitas los generadores si vas a\n" +
      "   cambiar los datos de las demos, y para eso trabaja desde el monorepo.\n",
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(ruta, "utf8"));
};

export const centimos = (precio) =>
  Number.isFinite(Number(precio)) && precio !== null && precio !== "" && precio !== undefined
    ? Math.round(Number(precio) * 100)
    : null;

/** Las plantillas de sector: qué módulos nacen encendidos en cada tipo de local. */
export const PLANTILLAS = [
  {
    key: "taberna-urbana",
    name: "Taberna urbana",
    description: "Bar restaurante de ciudad: menú del día, carta y raciones para compartir.",
    defaults: {
      modules: {
        menu: true, daily_menu: true, special_menus: true, reservations: true,
        groups: false, events: true, promotions: true, feedback: true,
        loyalty: true, assistant: true, qr: true,
      },
    },
  },
  {
    key: "parrilla-grupos",
    name: "Parrilla y grupos",
    description: "Restaurante de valle con parrilla, celebraciones y grupos grandes.",
    defaults: {
      modules: {
        menu: true, daily_menu: false, special_menus: true, reservations: true,
        groups: true, events: true, promotions: true, feedback: true,
        loyalty: true, assistant: true, qr: true,
      },
    },
  },
  {
    // Debe decir EXACTAMENTE lo mismo que la plantilla 'inmobiliaria' de
    // sql/04_inmobiliaria.sql. Hay una prueba que compara las dos listas: si
    // se separan, un negocio nacería con módulos distintos según viniera de
    // Supabase o del respaldo, y nadie lo notaría hasta tenerlo delante.
    key: "inmobiliaria",
    name: "Inmobiliaria",
    description:
      "Agencia inmobiliaria: cartera con ficha por inmueble, petición de visita, "
      + "inmuebles de enlace privado para el boca a boca y un QR por piso para el "
      + "escaparate.",
    defaults: {
      modules: {
        properties: true, visits: true, private_listings: true, valuation: false,
        feedback: true, promotions: true, qr: true, assistant: false,
        menu: false, daily_menu: false, special_menus: false,
        reservations: false, groups: false, loyalty: false,
      },
    },
  },
];

/** Los QR que se crean de serie con cada negocio. */
export const QRS = {
  "thewhitebar-mieres": [
    { token: "twb-mesa", label: "Mesas", target: "landing", location: "table" },
    { token: "twb-barra", label: "Barra", target: "daily_menu", location: "bar" },
    { token: "twb-ticket", label: "Ticket", target: "review", location: "ticket" },
    { token: "twb-escap", label: "Escaparate", target: "menu", location: "window" },
    { token: "twb-redes", label: "Redes sociales", target: "landing", location: "social" },
  ],
  "la-vina-cenera": [
    { token: "lv-mesa", label: "Mesas", target: "landing", location: "table" },
    { token: "lv-grupos", label: "Cartel de grupos", target: "group", location: "window" },
    { token: "lv-ticket", label: "Ticket", target: "review", location: "ticket" },
    { token: "lv-redes", label: "Redes sociales", target: "landing", location: "social" },
  ],
  // Los QR de negocio de la agencia. El QR POR INMUEBLE no va aquí: se genera
  // uno por ficha cuando la cartera está sincronizada.
  "asesoria-castresana": [
    { token: "cas-escap", label: "Escaparate (cartera completa)", target: "listings", location: "window" },
    { token: "cas-balcon", label: "Cartel de balcón (SE VENDE)", target: "listings", location: "balcony" },
    { token: "cas-vendido", label: "Cartel VENDIDO (¿cuánto vale el tuyo?)", target: "valuation", location: "sold_sign" },
    { token: "cas-tarjeta", label: "Tarjeta y carpeta de documentación", target: "landing", location: "other" },
  ],
};

/** Los dos negocios de las demos. */
export const NEGOCIOS = [
  { slug: "thewhitebar-mieres", archivo: "restaurante-la-taberna.json", plantilla: "taberna-urbana" },
  { slug: "la-vina-cenera", archivo: "restaurante-la-vina.json", plantilla: "parrilla-grupos" },
];

export function avisarAlergenos() {
  if (!sinReconocer.size) return;
  console.log("\n⚠️  Alérgenos sin reconocer (NO se han inventado, se han dejado fuera):");
  for (const a of sinReconocer) console.log(`   · "${a}"`);
  console.log("   Añádelos al mapa ALERGENOS de herramientas/comun.mjs si son de los 14 oficiales.");
}
