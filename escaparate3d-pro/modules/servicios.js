// ============================================================================
//  Módulo SERVICIOS (sector servicios: peluquería, clínica, taller…)
// ----------------------------------------------------------------------------
//  Es el catálogo del negocio de cita previa: alimenta las tarjetas 3D y la
//  lista 2D, y de cada servicio se salta directamente a pedir la cita con ese
//  servicio ya elegido — que es el paso que de verdad gana dinero.
//
//  Lo que cambia entre una peluquería, una clínica y un taller son las palabras
//  ("cita" / "hora" / "cita de taller") y los datos, no la lógica: por eso el
//  vocabulario vive en servicios.vocabulario de negocio.json.
// ============================================================================

import { crear, vaciar, euros, abrirModal, aviso, icono } from "../js/ui.js";

export const meta = {
  id: "servicios",
  nombre: "Ver los servicios",
  sector: "servicios",
  siempre: true,
  provee3D: true,
};

const recortar = (t, max) => (t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t);

// "45 min", "1 h", "1 h 30 min": en un sector de cita previa la duración es
// tan importante como el precio, porque es lo que el cliente tiene que reservar.
export function duracionTexto(minutos) {
  const m = Number(minutos);
  if (!Number.isFinite(m) || m <= 0) return "";
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

// El precio de un servicio a menudo es "desde": un tinte depende del pelo y una
// reparación de lo que se encuentre el mecánico. Decirlo es más honesto que dar
// una cifra cerrada que luego no se cumple.
export function precioTexto(servicio, moneda = "€") {
  const precio = Number(servicio?.precio);
  if (!Number.isFinite(precio) || precio <= 0) return servicio?.precioTexto || "Presupuesto";
  const cifra = euros(precio, { decimales: precio % 1 ? 2 : 0 });
  return servicio.desde ? `Desde ${cifra}` : cifra;
}

const serviciosDe = (config) =>
  (config.servicios?.categorias || []).flatMap((c) =>
    (c.items || []).map((s) => ({ ...s, categoria: c.nombre, categoriaId: c.id })));

export function crearModulo(ctx) {
  const { config } = ctx;
  const ajustes = config.servicios || {};
  const moneda = ajustes.moneda || "€";
  const vocabulario = ajustes.vocabulario || {};
  const accion = vocabulario.accion || "Pedir cita";
  const todos = serviciosDe(config);
  let filtro = "todas";

  const hayCitas = () => Boolean(config.modulos?.citas);
  const pedirCita = (servicio) => ctx.abrirModulo("citas", servicio);

  /* --- Tarjetas para la escena 3D --- */
  function elementos3D() {
    const orden = [...todos].sort((a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)));
    return orden.slice(0, Math.max(1, Number(ajustes.maxTarjetas3D) || 24)).map((s) => ({
      id: s.id,
      titulo: s.nombre,
      lineas: [s.categoria, duracionTexto(s.duracion), s.descripcion].filter(Boolean),
      precio: precioTexto(s, moneda),
      etiqueta: s.destacado ? "Lo más pedido" : s.categoria,
      foto: s.foto || "",
      destacado: Boolean(s.destacado),
      datos: s,
    }));
  }

  function fichaResumen(elemento) {
    const s = elemento.datos;
    return {
      titulo: s.nombre,
      datos: recortar([s.categoria, duracionTexto(s.duracion), s.descripcion].filter(Boolean).join(" · "), 150),
      precio: precioTexto(s, moneda),
    };
  }

  /* --- Detalle de un servicio --- */
  function abrirServicio(elemento) {
    const s = elemento.datos || elemento;
    const cuerpo = crear("div", { clase: "formulario" }, [
      s.foto ? crear("img", { clase: "foto", src: s.foto, alt: s.nombre, loading: "lazy" }) : null,
      s.descripcion ? crear("p", { texto: s.descripcion }) : null,
      crear("p", { clase: "ficha-precio", html: `<strong>${precioTexto(s, moneda)}</strong>` }),
      duracionTexto(s.duracion)
        ? crear("p", { clase: "pequeno tenue", texto: `Duración aproximada: ${duracionTexto(s.duracion)}.` })
        : null,
      s.incluye?.length
        ? crear("ul", { clase: "pequeno" }, s.incluye.map((i) => crear("li", { texto: i })))
        : null,
      s.aviso ? crear("p", { clase: "pequeno tenue", texto: s.aviso }) : null,
      s.confirmado === false
        ? crear("p", { clase: "pequeno tenue", texto: "Servicio de muestra: el negocio confirma nombre, duración y precio antes de publicar." })
        : null,
      crear("div", { clase: "botonera" }, [
        hayCitas()
          ? crear("button", { clase: "boton principal", type: "button", texto: accion, onclick: () => pedirCita(s) })
          : null,
      ]),
    ]);
    abrirModal(s.nombre, cuerpo);
  }

  /* --- Lista 2D completa (y única vista si no hay WebGL) --- */
  function montarSeccion(nodo) {
    vaciar(nodo);
    const categorias = ajustes.categorias || [];
    if (!todos.length) {
      nodo.append(crear("p", { clase: "tenue", texto: "Los servicios todavía no están cargados." }));
      return;
    }

    if (ajustes.aviso) {
      nodo.append(crear("p", { clase: "aviso-demo", html: `${icono("web")}<span>${ajustes.aviso}</span>` }));
    }

    nodo.append(crear("div", { clase: "botonera", style: "margin-bottom:1rem" }, [
      crear("button", {
        clase: "boton chico" + (filtro === "todas" ? " activo" : ""), type: "button",
        texto: "Todo", onclick: () => { filtro = "todas"; montarSeccion(nodo); },
      }),
      ...categorias.map((c) => crear("button", {
        clase: "boton chico" + (filtro === c.id ? " activo" : ""),
        type: "button", texto: c.nombre,
        onclick: () => { filtro = c.id; montarSeccion(nodo); },
      })),
    ]));

    for (const categoria of categorias) {
      if (filtro !== "todas" && filtro !== categoria.id) continue;
      nodo.append(crear("h3", { texto: categoria.nombre }));
      if (categoria.descripcion) nodo.append(crear("p", { clase: "pequeno tenue", texto: categoria.descripcion }));
      nodo.append(crear("div", { clase: "rejilla", style: "margin-bottom:1.4rem" },
        (categoria.items || []).map((s) => crear("article", { clase: "tarjeta" }, [
          s.foto ? crear("img", { clase: "foto", src: s.foto, alt: s.nombre, loading: "lazy" }) : null,
          crear("div", { clase: "titulo", texto: s.nombre }),
          s.descripcion ? crear("div", { clase: "pequeno tenue", texto: s.descripcion }) : null,
          duracionTexto(s.duracion)
            ? crear("div", { clase: "pequeno tenue", texto: duracionTexto(s.duracion) })
            : null,
          crear("div", { clase: "precio", texto: precioTexto(s, moneda) + (ajustes.preciosEjemplo ? " *" : "") }),
          crear("div", { clase: "botonera" }, [
            crear("button", { clase: "boton chico", type: "button", texto: "Ver", onclick: () => abrirServicio({ datos: s }) }),
            hayCitas()
              ? crear("button", { clase: "boton chico principal", type: "button", texto: accion, onclick: () => pedirCita(s) })
              : null,
          ]),
        ]))));
    }

    if (ajustes.preciosEjemplo) {
      nodo.append(crear("p", { clase: "pequeno tenue", texto: `* Precios de muestra en ${moneda}, pendientes de confirmar por el negocio.` }));
    }
  }

  return {
    meta,
    elementos3D,
    fichaResumen,
    alPulsarElemento: abrirServicio,
    montarSeccion,
    tituloSeccion: vocabulario.seccion || "Nuestros servicios",
    abrir: () => document.getElementById("seccion-servicios")?.scrollIntoView({ behavior: "smooth", block: "start" }),
  };
}
