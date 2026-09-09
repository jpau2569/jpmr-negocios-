// ============================================================================
//  Escaparate 3D Pro — orquestador
// ----------------------------------------------------------------------------
//  Lee la configuración del negocio, pinta el tema, carga SOLO los módulos que
//  ese cliente tiene contratados y monta la escena 3D con lo que el módulo
//  principal del sector le dé (platos o inmuebles). Si el navegador no puede
//  con WebGL, la misma información se ve en la lista 2D: nunca hay pantalla en
//  blanco delante de un cliente.
// ============================================================================

import { fetchConfig } from "./config.js";
import { aplicarTema } from "./tema.js";
import { crearCarrito } from "./carrito.js";
import { crearAlmacen } from "./datos.js";
import {
  $, crear, vaciar, icono, aviso, cerrarModal, hayWebGL,
  botonesRedes, enlaceMapa, enlaceWhatsapp,
} from "./ui.js";

// Registro de módulos: qué archivo, para qué sector y con qué interruptor de
// negocio.json se enciende. Añadir una función nueva al producto es añadir una
// línea aquí y un archivo en modules/.
const REGISTRO = [
  { id: "tour", ruta: "../modules/tour.js", sector: "todos", flag: "pedirDemo" },
  { id: "carta", ruta: "../modules/carta.js", sector: "restaurante", siempre: true },
  { id: "pedidos", ruta: "../modules/pedidos.js", sector: "restaurante", flag: "pedidosDomicilio" },
  { id: "reservas", ruta: "../modules/reservas.js", sector: "restaurante", flag: "reservas" },
  { id: "qr", ruta: "../modules/qr.js", sector: "restaurante", flag: "qrMesas" },
  { id: "inmuebles", ruta: "../modules/inmuebles.js", sector: "inmobiliaria", flag: "catalogoInmuebles" },
  { id: "valoracion", ruta: "../modules/valoracion.js", sector: "inmobiliaria", flag: "valoracionGratis" },
  { id: "demo", ruta: "../modules/demo.js", sector: "todos", flag: "pedirDemo" },
];

const parametros = new URLSearchParams(location.search);
const modulos = new Map();
let config = null, escena = null, paleta = null, ctx = null;

/* --- Arranque -------------------------------------------------------------- */

async function arrancar() {
  const { config: cfg, origen, noEncontrado } = await fetchConfig({ parametros });
  config = cfg;
  paleta = aplicarTema(config);
  document.title = `${config.nombre}${config.eslogan ? " · " + config.eslogan : ""}`;
  document.documentElement.lang = "es";

  ctx = {
    config,
    paleta,
    carrito: crearCarrito(config.id),
    almacen: crearAlmacen(config),
    mesa: (parametros.get("mesa") || "").replace(/\D/g, "") || null,
    abrirModulo: (id) => modulos.get(id)?.abrir?.(),
    modulos,          // el tour necesita alcanzar a demo.compartir()
    refrescar,
  };

  montarCabecera();
  montarPie();
  await cargarModulos();
  await montarEscena();   // antes de la barra: el botón "modo escaparate" solo
  montarAcciones();       // tiene sentido si la escena 3D ha podido arrancar
  montarSecciones();
  atajos();

  if (noEncontrado) {
    aviso(`No encuentro la demo «${noEncontrado}». Estás viendo ${config.nombre}. `
      + "Si acabas de publicarla, recarga forzando (Ctrl+F5) o vuelve a entrar en un minuto.",
      { error: true, ms: 12000 });
  }
  if (ctx.mesa) aviso(`Estás en la ${config.qr?.prefijoMesa || "Mesa"} ${ctx.mesa}.`);
  // Enlaces directos: #pedido desde el QR, #demo desde el hub comercial.
  if (location.hash === "#pedido") modulos.get("pedidos")?.abrir?.();
  if (location.hash === "#demo") modulos.get("demo")?.abrir?.();
  if (location.hash === "#reserva") modulos.get("reservas")?.abrir?.();
  if (location.hash === "#como-funciona") modulos.get("tour")?.abrir?.();
  if (location.hash === "#compartir") modulos.get("demo")?.compartir?.();
  console.info(`[escaparate3d-pro] configuración: ${origen} · sector ${config.sector} · datos en modo ${ctx.almacen.modo}`);
}

/* --- Módulos --------------------------------------------------------------- */

async function cargarModulos() {
  for (const ficha of REGISTRO) {
    const paraEsteSector = ficha.sector === "todos" || ficha.sector === config.sector;
    const encendido = ficha.siempre || config.modulos?.[ficha.flag];
    if (!paraEsteSector || !encendido) continue;
    try {
      const modulo = await import(ficha.ruta);
      const instancia = modulo.crearModulo(ctx);
      modulos.set(ficha.id, instancia);
      if (typeof instancia.cargar === "function") await instancia.cargar();
    } catch (e) {
      console.error(`[escaparate3d-pro] no se pudo cargar el módulo ${ficha.id}:`, e);
    }
  }
}

const moduloPrincipal = () =>
  [...modulos.values()].find((m) => typeof m.elementos3D === "function") || null;

/* --- Cabecera y pie -------------------------------------------------------- */

function montarCabecera() {
  const logo = $("logo");
  if (config.logoUrl) { logo.src = config.logoUrl; logo.alt = config.nombre; logo.hidden = false; }
  else logo.hidden = true;
  $("marca-nombre").textContent = config.nombre;
  $("marca-eslogan").textContent = config.eslogan || "";

  const acciones = vaciar($("contacto-cabecera"));
  if (config.contacto.telefono) {
    acciones.append(crear("a", {
      clase: "boton chico", href: "tel:" + config.contacto.telefono,
      html: `${icono("telefono", 18)}<span>${config.contacto.telefonoTexto || "Llamar"}</span>`,
    }));
  }
  const wasap = enlaceWhatsapp(config, `Hola, os escribo desde la web de ${config.nombre}.`);
  if (wasap) {
    acciones.append(crear("a", {
      clase: "boton chico principal", href: wasap, target: "_blank", rel: "noopener",
      html: `${icono("whatsapp", 18)}<span>WhatsApp</span>`,
    }));
  }
  const mapa = enlaceMapa(config);
  if (mapa) {
    acciones.append(crear("a", {
      clase: "boton chico", href: mapa, target: "_blank", rel: "noopener",
      html: `${icono("mapa", 18)}<span>Cómo llegar</span>`,
    }));
  }
}

function montarPie() {
  const columnas = vaciar($("pie-columnas"));
  columnas.append(
    crear("div", {}, [
      crear("h3", { texto: config.nombre }),
      config.contacto.direccion ? crear("p", { clase: "pequeno", texto: config.contacto.direccion }) : null,
      config.contacto.horario ? crear("p", { clase: "pequeno tenue", texto: config.contacto.horario }) : null,
    ]),
    crear("div", {}, [
      crear("h3", { texto: "Contacto" }),
      config.contacto.telefono ? crear("p", { clase: "pequeno" }, [crear("a", { href: "tel:" + config.contacto.telefono, texto: config.contacto.telefonoTexto || config.contacto.telefono })]) : null,
      config.contacto.email ? crear("p", { clase: "pequeno" }, [crear("a", { href: "mailto:" + config.contacto.email, texto: config.contacto.email })]) : null,
    ]),
    crear("div", {}, [
      crear("h3", { texto: "Dónde estamos en internet" }),
      crear("div", { clase: "botonera" }, botonesRedes(config)),
    ])
  );

  // Aviso de demo: honestidad por delante. Si la config dice que hay datos sin
  // confirmar, se ve en la propia página, no solo en el JSON.
  const avisoDemo = $("aviso-demo");
  const pendientes = config.verificacion?.pendiente || [];
  if (config.demo?.activa || pendientes.length) {
    vaciar(avisoDemo).append(
      crear("strong", { texto: "Demo · datos por confirmar" }),
      config.demo?.aviso ? crear("p", { clase: "pequeno", texto: config.demo.aviso }) : null,
      pendientes.length
        ? crear("ul", { clase: "pequeno" }, pendientes.map((p) => crear("li", { texto: p })))
        : null,
      config.verificacion?.fuente ? crear("p", { clase: "pequeno tenue", texto: "Origen de los datos públicos: " + config.verificacion.fuente }) : null
    );
    avisoDemo.hidden = false;
  } else {
    avisoDemo.hidden = true;
  }
}

/* --- Barra de acciones ----------------------------------------------------- */

function montarAcciones() {
  const barra = vaciar($("acciones"));
  for (const [id, modulo] of modulos) {
    if (typeof modulo.abrir !== "function") continue;
    const boton = crear("button", {
      clase: "boton" + (id === "demo" ? " secundario" : id === "pedidos" || id === "valoracion" ? " principal" : ""),
      type: "button",
      datos: { modulo: id },
      texto: modulo.meta?.nombre || id,
      onclick: () => modulo.abrir(),
    });
    barra.append(boton);
  }
  if (escena) {
    barra.append(crear("button", {
      clase: "boton plano", type: "button", id: "boton-auto",
      texto: "Modo escaparate",
      onclick: (ev) => {
        const encendido = !escena.estaAuto();
        escena.auto(encendido);
        ev.target.classList.toggle("activo", encendido);
        aviso(encendido ? "Modo escaparate: gira solo." : "Modo escaparate apagado.");
      },
    }));
  }
  refrescarInsignias();
}

function refrescarInsignias() {
  for (const [id, modulo] of modulos) {
    const boton = document.querySelector(`#acciones [data-modulo="${id}"]`);
    if (!boton) continue;
    const insignia = modulo.insignia?.();
    boton.textContent = insignia ? `${modulo.meta.nombre} (${insignia})` : modulo.meta.nombre;
  }
}

/* --- Secciones ------------------------------------------------------------- */

function montarSecciones() {
  const zona = vaciar($("secciones"));
  for (const [id, modulo] of modulos) {
    if (typeof modulo.montarSeccion !== "function") continue;
    const cuerpo = crear("div", { id: `cuerpo-${id}` });
    const seccion = crear("section", { clase: "bloque", id: `seccion-${id}` }, [
      crear("div", { clase: "contenedor" }, [
        modulo.tituloSeccion ? crear("h2", { texto: modulo.tituloSeccion }) : null,
        cuerpo,
      ]),
    ]);
    zona.append(seccion);
    modulo.montarSeccion(cuerpo);
  }
}

function refrescar() {
  const principal = moduloPrincipal();
  if (escena && principal) escena.montar(principal.elementos3D());
  refrescarInsignias();
}

/* --- Escena ---------------------------------------------------------------- */

async function montarEscena() {
  const principal = moduloPrincipal();
  const elementos = principal ? principal.elementos3D() : [];
  const lienzo = $("lienzo");

  if (!hayWebGL() || !elementos.length) {
    lienzo.hidden = true;
    $("flechas").hidden = true;
    $("ficha").hidden = true;
    $("sin-3d").hidden = false;
    $("sin-3d").textContent = elementos.length
      ? "Tu navegador no puede con el 3D. Abajo tienes todo el catálogo igual de completo."
      : "Todavía no hay contenido cargado en el escaparate.";
    return;
  }

  // Three.js viene de un CDN: si no hay red (o el CDN falla), la web sigue
  // funcionando entera con la lista 2D en vez de quedarse en blanco.
  let crearEscena;
  try {
    ({ crearEscena } = await import("./escena.js"));
  } catch (e) {
    console.warn("[escaparate3d-pro] sin escena 3D:", e);
    lienzo.hidden = true;
    $("flechas").hidden = true;
    $("ficha").hidden = true;
    $("sin-3d").hidden = false;
    $("sin-3d").textContent = "No se ha podido cargar el 3D (sin conexión). Abajo tienes todo el catálogo.";
    return;
  }

  escena = crearEscena({
    lienzo,
    paleta,
    alPulsar: (elemento) => principal.alPulsarElemento?.(elemento),
    alCambiar: (elemento, indice, total) => {
      if (!elemento) return;
      const ficha = principal.fichaResumen?.(elemento) || { titulo: elemento.titulo, datos: "", precio: elemento.precio };
      $("ficha-titulo").textContent = ficha.titulo || "";
      $("ficha-datos").textContent = ficha.datos || "";
      $("ficha-precio").textContent = ficha.precio || "";
      $("contador").textContent = `${indice + 1} de ${total}`;
    },
  });
  escena.montar(elementos);

  $("anterior").onclick = () => escena.anterior();
  $("siguiente").onclick = () => escena.siguiente();
  $("ficha-abrir").onclick = () => {
    const actual = escena.elementoActual();
    if (actual) principal.alPulsarElemento?.(actual);
  };

  // Modo escaparate automático: ?auto=1 para la tele del local.
  if (parametros.get("auto") === "1") escena.auto(true);
}

/* --- Atajos ---------------------------------------------------------------- */

function atajos() {
  document.addEventListener("keydown", (ev) => {
    if (ev.target.matches("input, textarea, select")) return;
    if (ev.key === "Escape") cerrarModal();
    if (!escena) return;
    if (ev.key === "ArrowRight") escena.siguiente();
    if (ev.key === "ArrowLeft") escena.anterior();
    if (ev.key === "Enter" && $("modal").hidden) $("ficha-abrir").click();
  });
  $("modal-cerrar").onclick = cerrarModal;
  $("modal").addEventListener("click", (ev) => { if (ev.target.id === "modal") cerrarModal(); });
}

arrancar().catch((e) => {
  console.error(e);
  const sin3d = $("sin-3d");
  sin3d.hidden = false;
  sin3d.textContent = "No se pudo cargar la configuración del negocio. Revisa config/negocio.json.";
});
