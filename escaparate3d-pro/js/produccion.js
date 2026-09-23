// ============================================================================
//  Escaparate 3D Pro — "de demo a producción"
// ----------------------------------------------------------------------------
//  La diferencia entre una demo bonita y una aplicación real es una lista de
//  cosas concretas: que los datos sean del negocio, que el contacto funcione,
//  que los pedidos vayan a algún sitio que no sea el navegador del cliente…
//  Aquí vive esa lista, en código y comprobable, para que "Construir Total"
//  diga en cada momento qué falta para poder cobrar por esto.
//
//  Módulo puro (sin DOM): lo usa el panel y también los tests.
// ============================================================================

/** Comprobaciones de producción. `ok(config)` devuelve true si ya está resuelto. */
import { POR_DEFECTO } from "./config.js";

// Los cuatro colores tal cual salen de la plantilla: si no se ha tocado ninguno,
// es que nadie ha mirado la marca del cliente todavía.
const coloresDePlantilla = (colores = {}) =>
  ["fondo", "acento", "acento2", "texto"].every(
    (clave) => String(colores[clave] || "").toLowerCase() === POR_DEFECTO.colores[clave]);

export const REQUISITOS = [
  {
    clave: "datos-verificados",
    titulo: "Datos confirmados por el negocio",
    ok: (c) => c.verificacion?.verificado === true && !(c.verificacion?.pendiente || []).length,
    arreglo: "Repasa con el cliente teléfono, dirección, horario y precios, y deja verificacion.verificado a true con la lista de pendientes vacía.",
  },
  {
    clave: "sin-aviso-demo",
    titulo: "Ya no se anuncia como demo",
    ok: (c) => c.demo?.activa !== true,
    arreglo: "Pon demo.activa a false cuando el contenido sea el definitivo.",
  },
  {
    clave: "contacto",
    titulo: "Teléfono y un canal escrito (WhatsApp o correo)",
    ok: (c) => Boolean(c.contacto?.telefono) && Boolean(c.contacto?.whatsapp || c.contacto?.email),
    arreglo: "Sin teléfono no hay llamadas y sin WhatsApp ni correo no hay pedidos ni visitas: pídeselos al cliente.",
  },
  {
    clave: "direccion",
    titulo: "Dirección y horario",
    ok: (c) => Boolean(c.contacto?.direccion) && Boolean(c.contacto?.horario),
    arreglo: "Complétalos: son lo que más se consulta desde el móvil.",
  },
  {
    clave: "marca",
    titulo: "Logo y colores propios",
    ok: (c) => Boolean(c.logoUrl) && !coloresDePlantilla(c.colores),
    arreglo: "Sube el logo del cliente y coge los colores de su marca (no dejes los del ejemplo).",
  },
  {
    clave: "redes",
    titulo: "Al menos una red o web enlazada",
    ok: (c) => Object.values(c.redes || {}).some(Boolean),
    arreglo: "Añade su web, Instagram, Facebook o su ficha de Google: es tráfico y confianza gratis.",
  },
  {
    clave: "contenido",
    titulo: "Catálogo real cargado",
    ok: (c) => c.sector === "restaurante"
      ? (c.carta?.categorias || []).some((cat) => (cat.platos || []).length) && c.carta?.preciosEjemplo !== true
      : Boolean((c.inmuebles?.origenes || []).length || (c.inmuebles?.respaldo || []).length),
    arreglo: "Carga la carta real con sus precios, o los orígenes de la cartera de inmuebles.",
  },
  {
    clave: "destino-datos",
    titulo: "Pedidos, reservas y leads con destino real",
    ok: (c) => c.datos?.modo === "firebase"
      ? Boolean(c.datos?.firebase?.projectId)
      : c.datos?.modo === "api" && Boolean(c.datos?.api?.lead),
    arreglo: "En modo local todo se queda en el navegador del cliente final. Pasa a «api» (endpoints del despliegue) o a «firebase» con su proyecto.",
  },
  {
    clave: "modulos",
    titulo: "Algún módulo de negocio encendido",
    ok: (c) => Object.entries(c.modulos || {}).some(([clave, valor]) => valor && clave !== "pedirDemo"),
    arreglo: "Enciende lo que el cliente ha contratado: pedidos, reservas, QR, catálogo o valoración.",
  },
];

export function evaluar(config) {
  const items = REQUISITOS.map((r) => ({
    clave: r.clave,
    titulo: r.titulo,
    arreglo: r.arreglo,
    ok: (() => { try { return Boolean(r.ok(config)); } catch { return false; } })(),
  }));
  const puntos = items.filter((i) => i.ok).length;
  return {
    items,
    puntos,
    total: items.length,
    porcentaje: Math.round((puntos / items.length) * 100),
    listo: puntos === items.length,
  };
}

/* --- Importadores rápidos de contenido ------------------------------------ */

// Carta pegada desde un Word, un PDF o un WhatsApp del cliente.
// Formato por línea:  Categoría | Plato | Descripción | Precio
// Una línea con un solo campo abre categoría nueva.
export function parsearCarta(texto) {
  const categorias = [];
  let actual = null;
  let contador = 0;

  for (const linea of String(texto || "").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia) continue;
    const partes = limpia.split("|").map((p) => p.trim());

    if (partes.length === 1) {
      actual = { id: `c${++contador}`, nombre: partes[0], platos: [] };
      categorias.push(actual);
      continue;
    }

    let [categoria, nombre, descripcion, precio] = partes;
    if (partes.length === 2) { nombre = partes[0]; precio = partes[1]; descripcion = ""; categoria = actual?.nombre || "Carta"; }
    else if (partes.length === 3) { nombre = partes[1]; descripcion = ""; precio = partes[2]; }

    if (!actual || (partes.length >= 3 && categoria && categoria !== actual.nombre)) {
      actual = categorias.find((c) => c.nombre === categoria);
      if (!actual) { actual = { id: `c${++contador}`, nombre: categoria || "Carta", platos: [] }; categorias.push(actual); }
    }

    const importe = Number(String(precio || "").replace(",", ".").replace(/[^\d.]/g, ""));
    actual.platos.push({
      id: `p${++contador}`,
      nombre: nombre || "Plato",
      descripcion: descripcion || "",
      precio: Number.isFinite(importe) ? importe : 0,
      foto: "",
      destacado: false,
      confirmado: true,
      alergenos: [],
    });
  }
  return categorias.filter((c) => c.platos.length);
}

// Cartera pegada desde una hoja de cálculo.
// Formato por línea: Título | Zona | Precio | m2 | Hab | Baños | Operación | Foto | URL
export function parsearInmuebles(texto) {
  const numero = (v) => {
    const n = Number(String(v || "").replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return String(texto || "").split(/\r?\n/).map((linea) => {
    const p = linea.split("|").map((x) => x.trim());
    if (!p[0]) return null;
    return {
      referencia: null,
      titulo: p[0],
      zona: p[1] || "",
      precio: numero(p[2]),
      superficieConstruida: numero(p[3]),
      habitaciones: numero(p[4]),
      banos: numero(p[5]),
      operacion: (p[6] || "venta").toLowerCase().startsWith("alq") ? "alquiler" : "venta",
      foto: p[7] || "",
      url: p[8] || "",
    };
  }).filter(Boolean);
}

/* --- Documentación que se entrega con el paquete -------------------------- */

export function readmeDespliegue(config, { fecha = new Date() } = {}) {
  const informe = evaluar(config);
  const pendientes = informe.items.filter((i) => !i.ok);
  return `# Escaparate 3D — ${config.nombre}

Paquete generado el ${fecha.toLocaleDateString("es-ES")} desde «Construir Total».
Sector: **${config.sector}**. Identificador del despliegue: \`${config.id}\`.

## Qué es esto

Una web completa con el catálogo del negocio en 3D y ${
  config.sector === "restaurante"
    ? "pedidos, reservas y QR de mesas"
    : "catálogo de inmuebles, favoritos, solicitud de visita y valoración"
} funcionando. Todo lo que se puede personalizar está en \`config/negocio.json\`.

## Cómo publicarlo

1. Sube esta carpeta a cualquier hosting estático (Vercel, Netlify, un subdominio propio).
   En Vercel: \`vercel deploy\` desde la carpeta, o arrástrala en la web de Vercel.
2. Comprueba que se abre \`index.html\` y que se ven las tarjetas.
3. El dueño del negocio entra en \`/admin/\` para cambiar textos, colores o carta.

**Importante**: hay que servirlo por HTTP. Abriendo el archivo con doble clic
(\`file://\`) el navegador bloquea los módulos y la página sale en blanco.
Para probarlo en local: \`python3 -m http.server 8080\` dentro de la carpeta.

## Dónde caen los pedidos, reservas y contactos

Modo actual: **${config.datos?.modo}**.

- \`local\`: solo en el navegador del cliente final. Vale para enseñar, no para trabajar.
- \`api\`: se envían a los endpoints del despliegue (\`${config.datos?.api?.lead || "/api/lead"}\`).
- \`firebase\`: se guardan en Firestore${config.datos?.firebase?.projectId ? ` (proyecto \`${config.datos.firebase.projectId}\`)` : ""}.

## Estado: ${informe.puntos} de ${informe.total} requisitos de producción

${informe.items.map((i) => `- [${i.ok ? "x" : " "}] ${i.titulo}`).join("\n")}

${pendientes.length ? `### Lo que falta antes de cobrar por esto\n\n${pendientes.map((i) => `- **${i.titulo}**: ${i.arreglo}`).join("\n")}` : "Todo listo para producción."}
`;
}
