// ============================================================================
//  CONSTRUIR TOTAL — de la demo a la aplicación real de un negocio
// ----------------------------------------------------------------------------
//  Esta pantalla es para quien vende el producto, no para el dueño del bar.
//  Sirve para coger una demo y convertirla en el despliegue definitivo de un
//  cliente: sus datos reales, sus módulos contratados, dónde caen de verdad los
//  pedidos y las reservas, y el paquete completo listo para subir.
//
//  Lo que la hace útil de verdad es el semáforo de producción: mientras quede
//  algo en rojo, eso sigue siendo una demo por mucho que se vea bonito.
// ============================================================================

import { fetchConfig, normalizar, CATALOGO, CLAVE_BORRADOR } from "../js/config.js";
import { aplicarTema } from "../js/tema.js";
import { evaluar, parsearCarta, parsearInmuebles, readmeDespliegue } from "../js/produccion.js";
import { crearZip, descargar } from "../js/zip.js";
import { $, crear, vaciar, aviso, campo } from "../js/ui.js";

const BASE = "../";

// Los archivos que componen el producto. El paquete del cliente es esto más su
// config/negocio.json y su README de despliegue.
const ARCHIVOS_PRODUCTO = [
  "index.html", "demos.html",
  "css/base.css",
  "js/app.js", "js/config.js", "js/tema.js", "js/ui.js", "js/datos.js",
  "js/carrito.js", "js/escena.js", "js/qr.js", "js/zip.js", "js/produccion.js",
  "modules/carta.js", "modules/pedidos.js", "modules/reservas.js", "modules/qr.js",
  "modules/inmuebles.js", "modules/valoracion.js", "modules/demo.js",
  "admin/index.html", "admin/admin.js", "admin/construir-total.html", "admin/construir.js",
  // El backend viaja con el cliente: sin esto, un despliegue en modo "api" se
  // quedaria sin /api/lead y la cartera no podria leerse.
  "api/escaparate.js", "api/foto.js", "api/lead.js", "api/health.js",
  "lib/cartera.js", "lib/memoria.js",
  "package.json", "vercel.json",
];

const NOMBRE_MODULO = {
  pedidosDomicilio: "Pedidos a domicilio / recogida",
  reservas: "Reservas de mesa",
  qrMesas: "QR de las mesas",
  catalogoInmuebles: "Catálogo de inmuebles",
  valoracionGratis: "Valoración gratis",
  pedirDemo: "Apartado «quiero esto para mi negocio»",
};
const sectorDe = (clave) =>
  clave === "pedirDemo" ? "todos"
    : ["catalogoInmuebles", "valoracionGratis"].includes(clave) ? "inmobiliaria" : "restaurante";

const parametros = new URLSearchParams(location.search);
let config = (await fetchConfig({ parametros, base: BASE })).config;

/* --- Pintado --------------------------------------------------------------- */

pintar();

function pintar() {
  aplicarTema(config);
  pintarPlantillas();
  pintarFormulario();
  pintarSemaforo();
}

function pintarPlantillas() {
  const selector = $("plantilla");
  if (selector.dataset.listo) return;
  selector.dataset.listo = "1";
  vaciar(selector).append(
    crear("option", { value: "" }, [document.createTextNode("— configuración actual —")]),
    ...CATALOGO.map((n) => crear("option", { value: n.id }, [document.createTextNode(`${n.nombre} (${n.sector})`)]))
  );
  selector.onchange = async () => {
    if (!selector.value) return;
    config = (await fetchConfig({ parametros: new URLSearchParams({ negocio: selector.value }), base: BASE })).config;
    pintar();
    aviso("Partiendo de esa configuración.");
  };
}

function pintarFormulario() {
  const f = vaciar($("formulario"));

  f.append(
    paso(1, "El negocio", [
      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Nombre real", requerido: true, value: config.nombre }),
        campo({ id: "id", etiqueta: "Identificador (carpeta y documento)", value: config.id, placeholder: "la-vina" }),
      ]),
      crear("div", { clase: "fila" }, [
        campo({ id: "sector", etiqueta: "Sector", tipo: "select", opciones: [
          { valor: "restaurante", texto: "Restaurante / hostelería" },
          { valor: "inmobiliaria", texto: "Inmobiliaria" },
        ] }),
        campo({ id: "eslogan", etiqueta: "Eslogan", value: config.eslogan }),
      ]),
      crear("label", { clase: "campo", style: "display:flex;flex-direction:row;align-items:center;gap:.5rem" }, [
        crear("input", { type: "checkbox", id: "demo-activa", checked: config.demo?.activa === true }),
        crear("span", { texto: "Sigue siendo una demo (muestra el aviso de datos sin confirmar)" }),
      ]),
    ]),

    paso(2, "Contacto real y marca", [
      crear("div", { clase: "fila" }, [
        campo({ id: "telefonoTexto", etiqueta: "Teléfono (como se lee)", value: config.contacto.telefonoTexto }),
        campo({ id: "telefono", etiqueta: "Teléfono (para marcar)", tipo: "tel", value: config.contacto.telefono }),
        campo({ id: "whatsapp", etiqueta: "WhatsApp (34…)", value: config.contacto.whatsapp }),
      ]),
      crear("div", { clase: "fila" }, [
        campo({ id: "email", etiqueta: "Correo", tipo: "email", value: config.contacto.email }),
        campo({ id: "direccion", etiqueta: "Dirección", value: config.contacto.direccion }),
        campo({ id: "horario", etiqueta: "Horario", value: config.contacto.horario }),
      ]),
      crear("div", { clase: "fila" }, [
        campo({ id: "web", etiqueta: "Web", tipo: "url", value: config.redes.web }),
        campo({ id: "instagram", etiqueta: "Instagram", tipo: "url", value: config.redes.instagram }),
        campo({ id: "facebook", etiqueta: "Facebook", tipo: "url", value: config.redes.facebook }),
        campo({ id: "tripadvisor", etiqueta: "TripAdvisor", tipo: "url", value: config.redes.tripadvisor }),
      ]),
      crear("div", { clase: "fila" }, [
        colorCampo("fondo", "Fondo"), colorCampo("acento", "Principal"),
        colorCampo("acento2", "Secundario"), colorCampo("texto", "Texto"),
      ]),
      crear("p", { clase: "pequeno tenue", texto: "El logo se sube desde el panel del negocio (/admin/), que es donde lo hará el propio cliente." }),
    ]),

    paso(3, "Qué se contrata", [
      ...["pedidosDomicilio", "reservas", "qrMesas", "catalogoInmuebles", "valoracionGratis", "pedirDemo"]
        .filter((clave) => sectorDe(clave) === "todos" || sectorDe(clave) === config.sector)
        .map((clave) => crear("label", { clase: "campo", style: "display:flex;flex-direction:row;align-items:center;gap:.5rem" }, [
          crear("input", { type: "checkbox", id: "modulo-" + clave, checked: Boolean(config.modulos[clave]) }),
          crear("span", { texto: NOMBRE_MODULO[clave] }),
        ])),
    ]),

    paso(4, "Dónde caen los pedidos, reservas y contactos", [
      campo({ id: "modo", etiqueta: "Modo de datos", tipo: "select", opciones: [
        { valor: "local", texto: "Local — solo el navegador (demo)" },
        { valor: "api", texto: "API del despliegue — /api/lead y compañía" },
        { valor: "firebase", texto: "Firebase / Firestore" },
      ] }),
      crear("div", { clase: "fila" }, [
        campo({ id: "api-lead", etiqueta: "Endpoint de leads", value: config.datos.api.lead }),
        campo({ id: "api-pedido", etiqueta: "Endpoint de pedidos", value: config.datos.api.pedido }),
        campo({ id: "api-reserva", etiqueta: "Endpoint de reservas", value: config.datos.api.reserva }),
      ]),
      crear("div", { clase: "fila" }, [
        campo({ id: "fb-projectId", etiqueta: "Firebase projectId", value: config.datos.firebase.projectId }),
        campo({ id: "fb-apiKey", etiqueta: "Firebase apiKey (web)", value: config.datos.firebase.apiKey }),
      ]),
      crear("p", { clase: "pequeno tenue", texto: "En modo local nada sale del móvil del cliente final: vale para enseñar, no para trabajar. Ese es el salto de demo a real." }),
    ]),

    paso(5, "Contenido real", config.sector === "restaurante" ? [
      campo({ id: "carta", etiqueta: "Pega la carta (Categoría | Plato | Descripción | Precio)", tipo: "textarea", rows: 8,
        placeholder: "Especialidades\nEspecialidades | Lechazo al horno | Asado lento | 24\nPostres | Casadielles | | 5" }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton", type: "button", texto: "Cargar la carta", onclick: cargarCarta }),
        crear("label", { clase: "campo", style: "display:flex;flex-direction:row;align-items:center;gap:.5rem" }, [
          crear("input", { type: "checkbox", id: "precios-ejemplo", checked: config.carta?.preciosEjemplo === true }),
          crear("span", { texto: "Los precios siguen siendo de muestra" }),
        ]),
      ]),
      crear("p", { clase: "pequeno tenue", id: "resumen-contenido" }),
    ] : [
      campo({ id: "origenes", etiqueta: "Orígenes de la cartera (uno por línea)", tipo: "textarea", rows: 3,
        value: (config.inmuebles.origenes || []).join("\n"), placeholder: "/api/escaparate" }),
      campo({ id: "proxyFotos", etiqueta: "Proxy de fotos", value: config.inmuebles.proxyFotos || "", placeholder: "/api/foto?u=" }),
      campo({ id: "inmuebles", etiqueta: "O pega la cartera (Título | Zona | Precio | m² | Hab | Baños | Operación)", tipo: "textarea", rows: 6 }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton", type: "button", texto: "Cargar la cartera", onclick: cargarInmuebles }),
      ]),
      crear("p", { clase: "pequeno tenue", id: "resumen-contenido" }),
    ]),

    paso(6, "Entregar", [
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "button", texto: "Descargar el paquete completo (.zip)", onclick: descargarPaquete }),
        crear("button", { clase: "boton", type: "button", texto: "Descargar solo negocio.json", onclick: descargarConfig }),
        crear("button", { clase: "boton", type: "button", texto: "Ver la vista previa", onclick: verVistaPrevia }),
        crear("button", { clase: "boton plano", type: "button", texto: "Copiar el JSON", onclick: copiarJson }),
      ]),
      crear("p", { clase: "pequeno tenue", texto: "El .zip trae el producto entero + la configuración del cliente + un README con los pasos de despliegue. Se sube tal cual a Vercel o a su hosting." }),
    ])
  );

  $("sector").value = config.sector;
  $("modo").value = config.datos.modo;
  $("sector").onchange = () => { recoger(); config = normalizar(config); pintar(); };
  f.addEventListener("input", () => { recoger(); pintarSemaforo(); aplicarTema(config); });
  resumenContenido();
}

function paso(numero, titulo, hijos) {
  return crear("details", { open: true, clase: "bloque-admin" }, [
    crear("summary", {}, [crear("strong", { texto: `${numero}. ${titulo}` })]),
    crear("div", { clase: "formulario", style: "margin-top:.8rem" }, hijos),
  ]);
}

function colorCampo(clave, etiqueta) {
  return crear("label", { clase: "campo" }, [
    crear("span", { texto: etiqueta }),
    crear("input", { type: "color", id: "color-" + clave, value: config.colores[clave] }),
  ]);
}

/* --- Recogida de datos ----------------------------------------------------- */

function recoger() {
  const v = (id) => ($(id) ? $(id).value.trim() : "");
  config.nombre = v("nombre") || config.nombre;
  config.id = (v("id") || config.id).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  config.sector = $("sector").value;
  config.eslogan = v("eslogan");
  config.demo.activa = $("demo-activa").checked;
  for (const clave of ["fondo", "acento", "acento2", "texto"]) config.colores[clave] = $("color-" + clave).value;
  Object.assign(config.contacto, {
    telefono: v("telefono"), telefonoTexto: v("telefonoTexto"), whatsapp: v("whatsapp"),
    email: v("email"), direccion: v("direccion"), horario: v("horario"),
  });
  Object.assign(config.redes, { web: v("web"), instagram: v("instagram"), facebook: v("facebook"), tripadvisor: v("tripadvisor") });
  for (const clave of Object.keys(NOMBRE_MODULO)) {
    const caja = $("modulo-" + clave);
    if (caja) config.modulos[clave] = caja.checked;
  }
  config.datos.modo = $("modo").value;
  Object.assign(config.datos.api, { lead: v("api-lead"), pedido: v("api-pedido"), reserva: v("api-reserva") });
  Object.assign(config.datos.firebase, { projectId: v("fb-projectId"), apiKey: v("fb-apiKey") });
  if ($("precios-ejemplo")) config.carta.preciosEjemplo = $("precios-ejemplo").checked;
  if ($("origenes")) {
    config.inmuebles.origenes = $("origenes").value.split("\n").map((s) => s.trim()).filter(Boolean);
    config.inmuebles.proxyFotos = v("proxyFotos");
  }
  // Al dejar de ser demo, se limpian los avisos: o está confirmado, o no lo está.
  if (!config.demo.activa) {
    config.demo.aviso = "";
    config.verificacion = { ...config.verificacion, verificado: true, pendiente: [] };
  }
  config = normalizar(config);
  return config;
}

function cargarCarta() {
  const categorias = parsearCarta($("carta").value);
  if (!categorias.length) return aviso("No he entendido ninguna línea. Usa: Categoría | Plato | Descripción | Precio", { error: true });
  config.carta.categorias = categorias;
  config.carta.preciosEjemplo = false;
  const platos = categorias.reduce((n, c) => n + c.platos.length, 0);
  aviso(`Cargados ${platos} platos en ${categorias.length} categorías.`);
  pintarSemaforo();
  resumenContenido();
}

function cargarInmuebles() {
  const lista = parsearInmuebles($("inmuebles").value);
  if (!lista.length) return aviso("No he entendido ninguna línea de la cartera.", { error: true });
  config.inmuebles.respaldo = lista;
  aviso(`Cargados ${lista.length} inmuebles como respaldo.`);
  pintarSemaforo();
  resumenContenido();
}

function resumenContenido() {
  const nodo = $("resumen-contenido");
  if (!nodo) return;
  nodo.textContent = config.sector === "restaurante"
    ? `Ahora mismo: ${(config.carta.categorias || []).reduce((n, c) => n + (c.platos?.length || 0), 0)} platos en ${(config.carta.categorias || []).length} categorías.`
    : `Ahora mismo: ${(config.inmuebles.origenes || []).length} origen(es) y ${(config.inmuebles.respaldo || []).length} inmuebles de respaldo.`;
}

/* --- Semáforo de producción ------------------------------------------------ */

function pintarSemaforo() {
  const informe = evaluar(config);
  const caja = vaciar($("semaforo"));
  caja.append(
    crear("div", { clase: "total" }, [
      crear("span", { texto: informe.listo ? "Listo para producción" : "Todavía es una demo" }),
      crear("span", { texto: `${informe.puntos}/${informe.total}` }),
    ]),
    crear("div", { clase: "barra" }, [crear("div", { clase: "barra-relleno", style: `width:${informe.porcentaje}%` })]),
    crear("ul", { clase: "lista-lineas" }, informe.items.map((i) => crear("li", {}, [
      crear("span", { texto: i.ok ? "✅" : "⬜" }),
      crear("span", { clase: "crece" }, [
        crear("strong", { texto: i.titulo }),
        i.ok ? null : crear("div", { clase: "pequeno tenue", texto: i.arreglo }),
      ]),
    ])))
  );
}

/* --- Entrega --------------------------------------------------------------- */

function nombreArchivo(extension) {
  return `escaparate3d-${config.id || "cliente"}.${extension}`;
}

function descargarConfig() {
  recoger();
  descargar(new Blob([JSON.stringify(config, null, 2)], { type: "application/json" }), "negocio.json");
  aviso("negocio.json descargado.");
}

async function copiarJson() {
  recoger();
  try { await navigator.clipboard.writeText(JSON.stringify(config, null, 2)); aviso("JSON copiado."); }
  catch { aviso("Tu navegador no deja copiar automáticamente.", { error: true }); }
}

function verVistaPrevia() {
  recoger();
  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(config));
    $("vista-previa").src = BASE + "index.html?" + Date.now();
    aviso("Vista previa actualizada con esta configuración.");
  } catch {
    aviso("Tu navegador no deja guardar el borrador.", { error: true });
  }
}

async function descargarPaquete() {
  recoger();
  const boton = document.activeElement;
  if (boton) boton.disabled = true;
  aviso("Preparando el paquete…");
  try {
    const archivos = [];
    for (const ruta of ARCHIVOS_PRODUCTO) {
      const r = await fetch(BASE + ruta, { cache: "no-store" });
      if (!r.ok) throw new Error(`No se pudo leer ${ruta} (HTTP ${r.status})`);
      archivos.push({ nombre: ruta, contenido: await r.text() });
    }
    // La configuración del cliente sustituye a la del despliegue de origen.
    archivos.push({ nombre: "config/negocio.json", contenido: JSON.stringify(config, null, 2) });
    archivos.push({ nombre: "README.md", contenido: readmeDespliegue(config) });
    descargar(crearZip(archivos), nombreArchivo("zip"));
    aviso(`Paquete listo: ${archivos.length} archivos.`);
  } catch (e) {
    aviso("No se pudo montar el paquete: " + e.message, { error: true });
  } finally {
    if (boton) boton.disabled = false;
  }
}
