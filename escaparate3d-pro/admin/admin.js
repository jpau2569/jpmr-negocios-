// ============================================================================
//  Panel del negocio — edita negocio.json sin tocar código
// ----------------------------------------------------------------------------
//  Está pensado para el dueño del bar o de la inmobiliaria: cambia el nombre,
//  los colores, el teléfono, las redes, enciende o apaga módulos y edita la
//  carta. Guarda un borrador en su navegador (la web lo coge al instante para
//  la vista previa), descarga el negocio.json definitivo y, si el cliente está
//  en Firebase, lo publica sin volver a desplegar.
// ============================================================================

import { fetchConfig, normalizar, CATALOGO, CLAVE_BORRADOR, urlFirestore, POR_DEFECTO } from "../js/config.js";
import { aplicarTema } from "../js/tema.js";
import { aFirestore } from "../js/datos.js";
import { $, crear, vaciar, aviso, campo, icono } from "../js/ui.js";

const BASE = "../";
let config = null;

const CAMPOS_CONTACTO = [
  ["telefonoTexto", "Teléfono (como se lee)", "text"],
  ["telefono", "Teléfono (para marcar)", "tel"],
  ["whatsapp", "WhatsApp (solo cifras, con 34)", "text"],
  ["email", "Correo", "email"],
  ["direccion", "Dirección", "text"],
  ["horario", "Horario", "text"],
];

const CAMPOS_REDES = [
  ["web", "Web oficial"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["tiktok", "TikTok"],
  ["googleBusiness", "Ficha de Google"],
];

const MODULOS = [
  ["pedidosDomicilio", "Pedidos a domicilio / para recoger", "restaurante"],
  ["reservas", "Reservas de mesa", "restaurante"],
  ["qrMesas", "QR para las mesas", "restaurante"],
  ["catalogoInmuebles", "Catálogo de inmuebles", "inmobiliaria"],
  ["valoracionGratis", "Valoración gratis para propietarios", "inmobiliaria"],
  ["pedirDemo", "Apartado «quiero esto para mi negocio»", "todos"],
];

/* --- Arranque -------------------------------------------------------------- */

const parametros = new URLSearchParams(location.search);
const { config: inicial, origen } = await fetchConfig({ parametros, base: BASE });
config = inicial;
$("origen").textContent = `Cargado de: ${origen}`;
pintarSelector();
pintarFormulario();
aplicar();

/* --- Selector de configuración de partida ---------------------------------- */

function pintarSelector() {
  const selector = $("plantilla");
  vaciar(selector).append(
    crear("option", { value: "" }, [document.createTextNode("— partir de la configuración actual —")]),
    ...CATALOGO.map((n) => crear("option", { value: n.id }, [document.createTextNode(`${n.nombre} (${n.sector})`)]))
  );
  selector.onchange = async () => {
    if (!selector.value) return;
    const { config: cargada } = await fetchConfig({ parametros: new URLSearchParams({ negocio: selector.value }), base: BASE });
    config = cargada;
    pintarFormulario();
    aplicar();
    aviso("Configuración cargada como punto de partida.");
  };
}

/* --- Formulario ------------------------------------------------------------ */

function pintarFormulario() {
  const f = vaciar($("formulario"));

  f.append(
    seccion("Identidad", [
      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Nombre del negocio", requerido: true, value: config.nombre }),
        campo({ id: "sector", etiqueta: "Sector", tipo: "select", opciones: [
          { valor: "restaurante", texto: "Restaurante / hostelería" },
          { valor: "inmobiliaria", texto: "Inmobiliaria" },
        ] }),
      ]),
      campo({ id: "eslogan", etiqueta: "Eslogan", value: config.eslogan }),
      crear("label", { clase: "campo" }, [
        crear("span", { texto: "Logo (se guarda dentro de la configuración)" }),
        crear("input", { type: "file", accept: "image/*", id: "logo-archivo" }),
      ]),
      crear("div", { clase: "botonera" }, [
        crear("img", { id: "logo-vista", clase: "foto", style: "width:64px;height:64px;object-fit:contain", src: config.logoUrl || "", hidden: !config.logoUrl }),
        config.logoUrl ? crear("button", { clase: "boton chico plano", type: "button", texto: "Quitar el logo", onclick: () => { config.logoUrl = ""; pintarFormulario(); aplicar(); } }) : null,
      ]),
    ]),

    seccion("Colores de la marca", [
      crear("div", { clase: "fila" }, [
        color("fondo", "Fondo"),
        color("acento", "Color principal"),
        color("acento2", "Color secundario"),
        color("texto", "Texto"),
      ]),
      crear("p", { clase: "pequeno tenue", texto: "Estos cuatro colores tiñen toda la web y también la escena 3D: el borde de las tarjetas, la luz y el suelo." }),
    ]),

    seccion("Contacto", [
      crear("div", { clase: "fila" }, CAMPOS_CONTACTO.map(([clave, etiqueta, tipo]) =>
        campo({ id: "contacto-" + clave, etiqueta, tipo, value: config.contacto[clave] ?? "" }))),
      crear("p", { clase: "pequeno tenue", texto: "Si dejas el WhatsApp vacío, los botones de WhatsApp desaparecen solos y queda el teléfono." }),
    ]),

    seccion("Redes y web", [
      crear("div", { clase: "fila" }, CAMPOS_REDES.map(([clave, etiqueta]) =>
        campo({ id: "redes-" + clave, etiqueta, tipo: "url", placeholder: "https://…", value: config.redes[clave] || "" }))),
      crear("p", { clase: "pequeno tenue", texto: "Cada enlace que rellenes se convierte en un botón real en la web. Los que dejes vacíos no se muestran." }),
    ]),

    seccion("Qué quiere el negocio", MODULOS
      .filter(([, , sector]) => sector === "todos" || sector === config.sector)
      .map(([clave, etiqueta]) => crear("label", { clase: "campo", style: "flex-direction:row;align-items:center;gap:.5rem;display:flex" }, [
        crear("input", { type: "checkbox", id: "modulo-" + clave, checked: Boolean(config.modulos[clave]) }),
        crear("span", { texto: etiqueta }),
      ]))),

    config.sector === "restaurante" ? seccionCarta() : seccionInmuebles(),

    seccion("Avanzado", [
      crear("p", { clase: "pequeno tenue", texto: "Aquí está la configuración completa. Todo lo que no cabe en el formulario (turnos, zonas de reparto, orígenes de la cartera, Firebase) se edita aquí." }),
      crear("textarea", { id: "json", rows: 14, style: "width:100%", spellcheck: "false" }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton chico", type: "button", texto: "Aplicar el JSON", onclick: aplicarJson }),
      ]),
    ])
  );

  $("sector").value = config.sector;
  $("sector").onchange = () => { recoger(); config.sector = $("sector").value; config = normalizar(config); pintarFormulario(); aplicar(); };
  $("logo-archivo").onchange = cargarLogo;
  f.addEventListener("input", () => { recoger(); aplicar(); });
  $("json").value = JSON.stringify(config, null, 2);
}

function seccion(titulo, hijos) {
  return crear("details", { open: true, clase: "bloque-admin" }, [
    crear("summary", {}, [crear("strong", { texto: titulo })]),
    crear("div", { clase: "formulario", style: "margin-top:.8rem" }, hijos),
  ]);
}

function color(clave, etiqueta) {
  return crear("label", { clase: "campo", for: "color-" + clave }, [
    crear("span", { texto: etiqueta }),
    crear("input", { type: "color", id: "color-" + clave, value: config.colores[clave] }),
  ]);
}

function seccionCarta() {
  const lista = crear("div", { clase: "formulario" });
  const dibujar = () => {
    vaciar(lista);
    (config.carta.categorias || []).forEach((categoria, ci) => {
      lista.append(crear("div", { clase: "tarjeta", style: "cursor:default" }, [
        crear("div", { clase: "fila" }, [
          crear("input", { value: categoria.nombre, "aria-label": "Nombre de la categoría", oninput: (ev) => { categoria.nombre = ev.target.value; } }),
          crear("button", { clase: "boton chico plano", type: "button", texto: "Borrar categoría", onclick: () => { config.carta.categorias.splice(ci, 1); dibujar(); } }),
        ]),
        ...(categoria.platos || []).map((plato, pi) => crear("div", { clase: "fila" }, [
          crear("input", { value: plato.nombre, "aria-label": "Plato", oninput: (ev) => { plato.nombre = ev.target.value; } }),
          crear("input", { value: plato.descripcion || "", "aria-label": "Descripción", oninput: (ev) => { plato.descripcion = ev.target.value; } }),
          crear("input", { type: "number", step: "0.5", value: plato.precio ?? "", "aria-label": "Precio", oninput: (ev) => { plato.precio = Number(ev.target.value) || 0; } }),
          crear("button", { clase: "boton chico plano", type: "button", texto: "✕", "aria-label": "Borrar plato", onclick: () => { categoria.platos.splice(pi, 1); dibujar(); } }),
        ])),
        crear("button", {
          clase: "boton chico", type: "button", texto: "Añadir plato",
          onclick: () => {
            categoria.platos = categoria.platos || [];
            categoria.platos.push({ id: `p${Date.now().toString(36)}`, nombre: "Plato nuevo", descripcion: "", precio: 0, foto: "", destacado: false, alergenos: [] });
            dibujar();
          },
        }),
      ]));
    });
    lista.append(crear("button", {
      clase: "boton", type: "button", texto: "Añadir categoría",
      onclick: () => {
        config.carta.categorias = config.carta.categorias || [];
        config.carta.categorias.push({ id: `c${Date.now().toString(36)}`, nombre: "Categoría nueva", platos: [] });
        dibujar();
      },
    }));
  };
  dibujar();
  return seccion("La carta", [lista, crear("p", { clase: "pequeno tenue", texto: "Los cambios de la carta se ven en la vista previa al guardar el borrador." })]);
}

function seccionInmuebles() {
  return seccion("La cartera", [
    campo({ id: "origenes", etiqueta: "Orígenes de los inmuebles (uno por línea)", tipo: "textarea",
      value: (config.inmuebles.origenes || []).join("\n") }),
    campo({ id: "proxyFotos", etiqueta: "Proxy de fotos (para fotos de otro dominio)", value: config.inmuebles.proxyFotos || "", placeholder: "/api/foto?u=" }),
    crear("p", { clase: "pequeno tenue", texto: "Se prueban en orden: gana el primero que devuelva inmuebles. Si fallan todos, se usa la lista de respaldo del JSON (pestaña Avanzado)." }),
  ]);
}

/* --- Recoger, aplicar, guardar --------------------------------------------- */

function recoger() {
  config.nombre = $("nombre").value.trim() || config.nombre;
  config.eslogan = $("eslogan").value.trim();
  for (const clave of Object.keys(config.colores)) config.colores[clave] = $("color-" + clave).value;
  for (const [clave] of CAMPOS_CONTACTO) config.contacto[clave] = $("contacto-" + clave).value.trim();
  for (const [clave] of CAMPOS_REDES) config.redes[clave] = $("redes-" + clave).value.trim();
  for (const [clave, , sector] of MODULOS) {
    const caja = $("modulo-" + clave);
    if (caja && (sector === "todos" || sector === config.sector)) config.modulos[clave] = caja.checked;
  }
  if ($("origenes")) {
    config.inmuebles.origenes = $("origenes").value.split("\n").map((s) => s.trim()).filter(Boolean);
    config.inmuebles.proxyFotos = $("proxyFotos").value.trim();
  }
  config = normalizar(config);
  $("json").value = JSON.stringify(config, null, 2);
  return config;
}

function aplicarJson() {
  try {
    config = normalizar(JSON.parse($("json").value));
    pintarFormulario();
    aplicar();
    aviso("JSON aplicado.");
  } catch (e) {
    aviso("Ese JSON no es válido: " + e.message, { error: true });
  }
}

function aplicar() {
  aplicarTema(config);
  $("vista-nombre").textContent = config.nombre;
  $("vista-eslogan").textContent = config.eslogan || "";
  const logo = $("vista-logo");
  logo.src = config.logoUrl || "";
  logo.hidden = !config.logoUrl;
  const activos = Object.entries(config.modulos).filter(([, v]) => v).map(([k]) => k);
  $("vista-modulos").textContent = activos.length ? "Módulos: " + activos.join(", ") : "Sin módulos activos";
}

// El logo se guarda dentro del propio JSON reducido a 256 px: así el cliente no
// necesita hosting de imágenes ni se descuadra el diseño con un PNG enorme.
function cargarLogo(ev) {
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    const img = new Image();
    img.onload = () => {
      const lado = 256;
      const escala = Math.min(lado / img.width, lado / img.height, 1);
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
      config.logoUrl = lienzo.toDataURL("image/png");
      pintarFormulario();
      aplicar();
      aviso("Logo cargado.");
    };
    img.onerror = () => aviso("Ese archivo no se pudo leer como imagen.", { error: true });
    img.src = lector.result;
  };
  lector.readAsDataURL(archivo);
}

/* --- Botones --------------------------------------------------------------- */

$("guardar").onclick = () => {
  recoger();
  try {
    localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(config));
    aviso("Borrador guardado: la web ya lo está usando.");
    $("vista-previa").src = BASE + "index.html?" + Date.now();
  } catch {
    aviso("Tu navegador no deja guardar el borrador.", { error: true });
  }
};

$("descargar").onclick = () => {
  recoger();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "negocio.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  aviso("Descargado. Súbelo a config/negocio.json de tu despliegue.");
};

$("limpiar").onclick = () => {
  try { localStorage.removeItem(CLAVE_BORRADOR); } catch { /* nada que borrar */ }
  aviso("Borrador borrado: la web vuelve a su configuración publicada.");
  $("vista-previa").src = BASE + "index.html?borrador=0&" + Date.now();
};

$("publicar").onclick = async () => {
  recoger();
  const fb = config.datos?.firebase;
  if (config.datos?.modo !== "firebase" || !fb?.projectId) {
    aviso("Este negocio no está en Firebase: usa «Descargar» y sube el archivo.", { error: true });
    return;
  }
  try {
    const r = await fetch(urlFirestore(fb, fb.coleccionConfig || "negocios", config.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: aFirestore(config).mapValue.fields }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    aviso("Publicado en Firebase: los cambios ya están en la web.");
  } catch (e) {
    aviso("No se pudo publicar: " + e.message, { error: true });
  }
};

$("restablecer").onclick = () => {
  config = normalizar({ ...POR_DEFECTO, id: config.id, sector: config.sector });
  pintarFormulario();
  aplicar();
  aviso("Formulario vacío, listo para empezar de cero.");
};
