// ============================================================================
//  Módulo CARTA (sector restaurante)
// ----------------------------------------------------------------------------
//  Es el catálogo del restaurante: alimenta las tarjetas 3D y la lista 2D, y
//  deja añadir platos al carrito compartido. Se carga siempre que el sector sea
//  "restaurante"; que luego se pueda pedir a domicilio depende del módulo
//  pedidosDomicilio, pero la carta se ve igual (por ejemplo desde el QR).
// ============================================================================

import { crear, vaciar, euros, abrirModal, aviso, icono } from "../js/ui.js";

export const meta = {
  id: "carta",
  nombre: "Ver la carta",
  sector: "restaurante",
  siempre: true,
  provee3D: true,
};

// La ficha flotante tapa la tarjeta si el texto es largo: se recorta ahí, no
// en el dato, que el detalle completo se ve al abrir el plato.
const recortar = (t, max) => (t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t);

const platosDe = (config) =>
  (config.carta?.categorias || []).flatMap((c) =>
    (c.platos || []).map((p) => ({ ...p, categoria: c.nombre, categoriaId: c.id })));

export function crearModulo(ctx) {
  const { config, carrito } = ctx;
  const moneda = config.carta?.moneda || "€";
  const todos = platosDe(config);
  let filtro = "todas";

  // --- Tarjetas para la escena 3D ---
  //  Una carta de 45 platos no cabe en un carrusel: al 3D van los destacados
  //  primero y hasta 24. La carta entera sigue completa en la lista de abajo.
  function elementos3D() {
    const orden = [...todos].sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)));
    return orden.slice(0, Math.max(1, Number(config.carta?.maxTarjetas3D) || 24)).map((p) => ({
      id: p.id,
      titulo: p.nombre,
      lineas: [p.categoria, p.descripcion].filter(Boolean),
      precio: p.precio ? euros(p.precio, { decimales: p.precio % 1 ? 2 : 0 }) : "",
      etiqueta: p.destacado ? "De la casa" : p.categoria,
      foto: p.foto || "",
      destacado: Boolean(p.destacado),
      datos: p,
    }));
  }

  function fichaResumen(elemento) {
    const p = elemento.datos;
    return {
      titulo: p.nombre,
      datos: recortar([p.categoria, p.descripcion].filter(Boolean).join(" · "), 150),
      precio: p.precio ? euros(p.precio, { decimales: p.precio % 1 ? 2 : 0 }) : "",
    };
  }

  // --- Detalle de un plato ---
  function abrirPlato(elemento) {
    const p = elemento.datos || elemento;
    const cuerpo = crear("div", { clase: "formulario" }, [
      p.foto ? crear("img", { clase: "foto", src: p.foto, alt: p.nombre, loading: "lazy" }) : null,
      p.descripcion ? crear("p", { texto: p.descripcion }) : null,
      p.precio ? crear("p", { clase: "ficha-precio", html: `<strong>${euros(p.precio, { decimales: p.precio % 1 ? 2 : 0 })}</strong>` }) : null,
      p.alergenos?.length ? crear("p", { clase: "pequeno tenue", texto: "Alérgenos declarados: " + p.alergenos.join(", ") }) : null,
      p.confirmado === false ? crear("p", { clase: "pequeno tenue", texto: "Plato de muestra: el restaurante confirma nombre y precio antes de publicar." }) : null,
      crear("div", { clase: "botonera" }, [
        config.modulos.pedidosDomicilio
          ? crear("button", {
              clase: "boton principal", type: "button", texto: "Añadir al pedido",
              onclick: () => { carrito.anadir(p); aviso(`${p.nombre} añadido al pedido.`); },
            })
          : null,
        config.modulos.reservas
          ? crear("button", { clase: "boton", type: "button", texto: "Reservar mesa", onclick: () => ctx.abrirModulo("reservas") })
          : null,
      ]),
    ]);
    abrirModal(p.nombre, cuerpo);
  }

  // --- Lista 2D completa (y única vista si no hay WebGL) ---
  function montarSeccion(nodo) {
    vaciar(nodo);
    const categorias = config.carta?.categorias || [];
    if (!todos.length) {
      nodo.append(crear("p", { clase: "tenue", texto: "La carta todavía no está cargada." }));
      return;
    }

    if (config.carta?.aviso) {
      nodo.append(crear("p", { clase: "aviso-demo", html: `${icono("web")}<span>${config.carta.aviso}</span>` }));
    }

    const filtros = crear("div", { clase: "botonera", style: "margin-bottom:1rem" }, [
      crear("button", { clase: "boton chico" + (filtro === "todas" ? " activo" : ""), type: "button", texto: "Toda la carta", onclick: () => { filtro = "todas"; montarSeccion(nodo); } }),
      ...categorias.map((c) => crear("button", {
        clase: "boton chico" + (filtro === c.id ? " activo" : ""),
        type: "button", texto: c.nombre,
        onclick: () => { filtro = c.id; montarSeccion(nodo); },
      })),
    ]);
    nodo.append(filtros);

    for (const categoria of categorias) {
      if (filtro !== "todas" && filtro !== categoria.id) continue;
      nodo.append(crear("h3", { texto: categoria.nombre }));
      nodo.append(crear("div", { clase: "rejilla", style: "margin-bottom:1.4rem" },
        (categoria.platos || []).map((p) => crear("article", { clase: "tarjeta" }, [
          p.foto ? crear("img", { clase: "foto", src: p.foto, alt: p.nombre, loading: "lazy" }) : null,
          crear("div", { clase: "titulo", texto: p.nombre }),
          p.descripcion ? crear("div", { clase: "pequeno tenue", texto: p.descripcion }) : null,
          crear("div", { clase: "precio", texto: p.precio ? euros(p.precio, { decimales: p.precio % 1 ? 2 : 0 }) + (config.carta?.preciosEjemplo ? " *" : "") : "Consultar" }),
          crear("div", { clase: "botonera" }, [
            crear("button", { clase: "boton chico", type: "button", texto: "Ver", onclick: () => abrirPlato({ datos: p }) }),
            config.modulos.pedidosDomicilio
              ? crear("button", { clase: "boton chico principal", type: "button", texto: "Añadir", onclick: () => { carrito.anadir(p); aviso(`${p.nombre} añadido al pedido.`); } })
              : null,
          ]),
        ]))));
    }

    if (config.carta?.preciosEjemplo) {
      nodo.append(crear("p", { clase: "pequeno tenue", texto: `* Precios de muestra en ${moneda}, pendientes de confirmar por el restaurante.` }));
    }
  }

  return {
    meta,
    elementos3D,
    fichaResumen,
    alPulsarElemento: abrirPlato,
    montarSeccion,
    tituloSeccion: "La carta",
    abrir: () => document.getElementById("seccion-carta")?.scrollIntoView({ behavior: "smooth", block: "start" }),
  };
}
