// ============================================================================
//  Módulo CATÁLOGO DE INMUEBLES (sector inmobiliaria)
// ----------------------------------------------------------------------------
//  Alimenta las tarjetas 3D y la lista 2D con la cartera real del cliente, en
//  cascada: el primer origen que devuelva inmuebles gana y, si fallan todos,
//  queda el respaldo del propio negocio.json. Así el escaparate NUNCA sale
//  vacío delante de un cliente.
//
//  El visitante marca los que le interesan y el botón de visita escribe el
//  mensaje SOLO con esos: es lo que convierte una web bonita en una visita.
// ============================================================================

import { crear, vaciar, euros, abrirModal, aviso, campo, valores, bloqueEnvio, icono } from "../js/ui.js";

export const meta = {
  id: "inmuebles",
  nombre: "Ver la cartera",
  modulo: "catalogoInmuebles",
  sector: "inmobiliaria",
  siempre: true,
  provee3D: true,
};

const numero = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

// Acepta las dos formas que ya usa el monorepo: {items:[…]} de /api/escaparate
// y {inmuebles:[…]} de pisos.json, además de un array pelado.
export function normalizarLista(datos) {
  const bruto = Array.isArray(datos) ? datos : datos?.items || datos?.inmuebles || [];
  return bruto
    .filter((x) => x && x.activo !== false)
    .map((x) => ({
      referencia: x.referencia || x.ref || null,
      titulo: x.titulo || x.nombre || "Inmueble disponible",
      operacion: (x.operacion || "venta").toLowerCase() === "alquiler" ? "alquiler" : "venta",
      zona: x.zona || x.localidad || "",
      precio: numero(x.precio),
      superficieConstruida: numero(x.superficieConstruida ?? x.superficie ?? x.m2),
      habitaciones: numero(x.habitaciones),
      banos: numero(x.banos ?? x.baños),
      foto: x.foto || (Array.isArray(x.fotos) ? x.fotos[0] : "") || "",
      url: x.url || x.enlace || "",
    }))
    .filter((x) => x.titulo);
}

export function crearModulo(ctx) {
  const { config, almacen } = ctx;
  const ajustes = config.inmuebles || {};
  const proxy = ajustes.proxyFotos || "";
  let lista = normalizarLista(ajustes.respaldo || []);
  let origen = "respaldo del propio negocio.json";
  const marcados = new Set();
  const filtros = { operacion: "todas", zona: "todas", precioMax: null, habitaciones: 0 };

  // WebGL no puede pintar fotos de otro dominio: pasan por el proxy del despliegue.
  function fotoUsable(url) {
    if (!url) return "";
    try {
      const u = new URL(url, location.href);
      if (u.origin === location.origin) return u.href;
      return proxy ? proxy + encodeURIComponent(u.href) : "";
    } catch {
      return "";
    }
  }

  async function cargar() {
    for (const url of ajustes.origenes || []) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;
        const items = normalizarLista(await r.json());
        if (items.length) {
          lista = items;
          origen = url;
          return { lista, origen };
        }
      } catch { /* siguiente origen */ }
    }
    return { lista, origen };
  }

  const precioTexto = (i) =>
    i.precio ? euros(i.precio) + (i.operacion === "alquiler" ? "/mes" : "") : "Consultar precio";

  const datosTexto = (i) => [
    i.zona,
    i.superficieConstruida ? `${i.superficieConstruida} m²` : null,
    i.habitaciones ? `${i.habitaciones} hab.` : null,
    i.banos ? `${i.banos} baño${i.banos > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  const claveDe = (i, indice) => i.referencia || `idx-${indice}`;

  function visibles() {
    return lista.filter((i) => {
      if (filtros.operacion !== "todas" && i.operacion !== filtros.operacion) return false;
      if (filtros.zona !== "todas" && i.zona !== filtros.zona) return false;
      if (filtros.precioMax && i.precio && i.precio > filtros.precioMax) return false;
      if (filtros.habitaciones && (i.habitaciones || 0) < filtros.habitaciones) return false;
      return true;
    });
  }

  function elementos3D() {
    return visibles().slice(0, Math.max(1, Number(ajustes.maxTarjetas3D) || 24)).map((i, n) => ({
      id: claveDe(i, n),
      titulo: i.titulo,
      lineas: [datosTexto(i)],
      precio: precioTexto(i),
      etiqueta: i.operacion === "alquiler" ? "Alquiler" : "Venta",
      foto: fotoUsable(i.foto),
      destacado: marcados.has(claveDe(i, n)),
      datos: i,
    }));
  }

  const fichaResumen = (elemento) => ({
    titulo: elemento.datos.titulo,
    datos: datosTexto(elemento.datos),
    precio: precioTexto(elemento.datos),
  });

  function abrirInmueble(elemento) {
    const i = elemento.datos || elemento;
    const clave = claveDe(i, lista.indexOf(i));
    const foto = fotoUsable(i.foto);
    abrirModal(i.titulo, crear("div", { clase: "formulario" }, [
      foto ? crear("img", { clase: "foto", src: foto, alt: i.titulo, loading: "lazy" }) : null,
      crear("p", { html: `<strong>${precioTexto(i)}</strong><br><span class="tenue">${datosTexto(i)}</span>` }),
      i.referencia ? crear("p", { clase: "pequeno tenue", texto: "Referencia " + i.referencia }) : null,
      crear("div", { clase: "botonera" }, [
        crear("button", {
          clase: "boton principal", type: "button",
          texto: marcados.has(clave) ? "Quitar de mis favoritos" : "Me interesa",
          onclick: (ev) => {
            if (marcados.has(clave)) marcados.delete(clave); else marcados.add(clave);
            ev.target.textContent = marcados.has(clave) ? "Quitar de mis favoritos" : "Me interesa";
            ctx.refrescar();
            aviso(marcados.has(clave) ? "Guardado. Pide visita cuando quieras." : "Quitado de tus favoritos.");
          },
        }),
        crear("button", { clase: "boton", type: "button", texto: "Pedir visita", onclick: () => { marcados.add(clave); pedirVisita(); } }),
        i.url ? crear("a", { clase: "boton plano", href: i.url, target: "_blank", rel: "noopener", texto: "Ficha completa" }) : null,
      ]),
    ]));
  }

  function seleccionados() {
    const elegidos = lista.filter((i, n) => marcados.has(claveDe(i, n)));
    return elegidos.length ? elegidos : [];
  }

  function mensajeVisita(elegidos, datos) {
    const recorte = elegidos.slice(0, Math.max(1, Number(ajustes.maxEnMensaje) || 12));
    return [
      `Hola, os escribo desde el escaparate de ${config.nombre}.`,
      elegidos.length ? "Me interesan estos inmuebles y me gustaría verlos:" : "Me gustaría que me llamarais para ver opciones.",
      "",
      ...recorte.map((i) => ` · ${i.titulo}${i.referencia ? ` (ref. ${i.referencia})` : ""} — ${precioTexto(i)}`),
      elegidos.length > recorte.length ? ` · …y ${elegidos.length - recorte.length} más.` : null,
      "",
      `Nombre: ${datos.nombre}`,
      datos.telefono ? `Teléfono: ${datos.telefono}` : null,
      datos.email ? `Correo: ${datos.email}` : null,
      datos.disponibilidad ? `Cuándo puedo: ${datos.disponibilidad}` : null,
      datos.notas ? `Notas: ${datos.notas}` : null,
    ].filter(Boolean).join("\n");
  }

  function pedirVisita() {
    const elegidos = seleccionados();
    const cuerpo = crear("form", { clase: "formulario", novalidate: true }, [
      crear("p", {
        clase: elegidos.length ? "pequeno tenue" : "aviso-demo",
        texto: elegidos.length
          ? `Vas a pedir visita de ${elegidos.length} inmueble(s) marcados.`
          : "No has marcado ninguno todavía: mándanos igual tus datos y te llamamos con lo que encaje.",
      }),
      crear("div", { clase: "fila" }, [
        campo({ id: "nombre", etiqueta: "Tu nombre", requerido: true, autocomplete: "name" }),
        campo({ id: "telefono", etiqueta: "Teléfono", tipo: "tel", autocomplete: "tel" }),
      ]),
      campo({ id: "email", etiqueta: "Correo", tipo: "email", autocomplete: "email" }),
      campo({ id: "disponibilidad", etiqueta: "¿Cuándo te viene bien?", placeholder: "Mañanas, tardes, sábado…" }),
      campo({ id: "notas", etiqueta: "Algo que debamos saber", tipo: "textarea" }),
      crear("div", { clase: "botonera" }, [
        crear("button", { clase: "boton principal", type: "submit", texto: "Pedir la visita" }),
      ]),
    ]);

    cuerpo.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const datos = valores(cuerpo);
      if (!datos.nombre) return aviso("Necesitamos al menos tu nombre.", { error: true });
      if (!datos.telefono && !datos.email) return aviso("Déjanos un teléfono o un correo para poder responderte.", { error: true });

      const resultado = await almacen.guardarLead({
        ...datos,
        tipo: "visita",
        origen: `escaparate3d-pro:${config.id}`,
        inmuebles: elegidos.map((i) => i.referencia || i.titulo),
      });
      const texto = mensajeVisita(elegidos, datos);
      abrirModal("Solicitud de visita lista", crear("div", {}, [
        crear("p", { html: `<strong>Referencia ${resultado.id}</strong>. ${resultado.enviado ? "Ya ha entrado en el sistema de la inmobiliaria." : "Guardada en este dispositivo."}` }),
        resultado.aviso ? crear("p", { clase: "aviso-demo", texto: resultado.aviso }) : null,
        crear("p", { clase: "pequeno tenue", texto: "Mándala también por WhatsApp o correo: así la ven al momento y te confirman hora." }),
        bloqueEnvio(config, { asunto: `Visita ${resultado.id} — ${config.nombre}`, mensaje: texto }),
      ]));
    });

    abrirModal("Pedir visita", cuerpo);
  }

  function montarSeccion(nodo) {
    vaciar(nodo);
    const zonas = [...new Set(lista.map((i) => i.zona).filter(Boolean))].sort();

    const barra = crear("div", { clase: "botonera", style: "margin-bottom:1rem" }, [
      ...[["todas", "Todo"], ["venta", "En venta"], ["alquiler", "En alquiler"]].map(([valor, texto]) =>
        crear("button", {
          clase: "boton chico" + (filtros.operacion === valor ? " activo" : ""),
          type: "button", texto,
          onclick: () => { filtros.operacion = valor; ctx.refrescar(); montarSeccion(nodo); },
        })),
      zonas.length > 1
        ? crear("select", {
            clase: "boton chico",
            onchange: (ev) => { filtros.zona = ev.target.value; ctx.refrescar(); montarSeccion(nodo); },
          }, [
            crear("option", { value: "todas", selected: filtros.zona === "todas" }, [document.createTextNode("Todas las zonas")]),
            ...zonas.map((z) => crear("option", { value: z, selected: filtros.zona === z }, [document.createTextNode(z)])),
          ])
        : null,
      crear("button", {
        clase: "boton chico" + (marcados.size ? " activo" : ""), type: "button",
        html: `${icono("mapa")}<span>Pedir visita${marcados.size ? ` (${marcados.size})` : ""}</span>`,
        onclick: pedirVisita,
      }),
    ]);

    const items = visibles();
    const rejilla = crear("div", { clase: "rejilla" }, items.map((i) => {
      const clave = claveDe(i, lista.indexOf(i));
      const foto = fotoUsable(i.foto);
      return crear("article", { clase: "tarjeta" + (marcados.has(clave) ? " marcada" : "") }, [
        foto ? crear("img", { clase: "foto", src: foto, alt: i.titulo, loading: "lazy" }) : null,
        crear("span", { clase: "etiqueta" + (i.operacion === "alquiler" ? "" : " acento"), texto: i.operacion === "alquiler" ? "Alquiler" : "Venta" }),
        crear("div", { clase: "titulo", texto: i.titulo }),
        crear("div", { clase: "pequeno tenue", texto: datosTexto(i) }),
        crear("div", { clase: "precio", texto: precioTexto(i) }),
        crear("div", { clase: "botonera" }, [
          crear("button", { clase: "boton chico", type: "button", texto: "Ver", onclick: () => abrirInmueble({ datos: i }) }),
          crear("button", {
            clase: "boton chico" + (marcados.has(clave) ? " principal" : ""),
            type: "button", texto: marcados.has(clave) ? "Marcado" : "Me interesa",
            onclick: () => {
              if (marcados.has(clave)) marcados.delete(clave); else marcados.add(clave);
              ctx.refrescar();
              montarSeccion(nodo);
            },
          }),
        ]),
      ]);
    }));

    nodo.append(
      barra,
      items.length ? rejilla : crear("p", { clase: "tenue", texto: "No hay inmuebles que encajen con ese filtro." }),
      crear("p", { clase: "pequeno tenue", texto: `${items.length} de ${lista.length} inmuebles · datos tomados de ${origen}` })
    );
  }

  return {
    meta,
    cargar,
    elementos3D,
    fichaResumen,
    alPulsarElemento: abrirInmueble,
    montarSeccion,
    tituloSeccion: "Nuestra cartera",
    insignia: () => marcados.size || "",
    abrir: () => document.getElementById("seccion-inmuebles")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    pedirVisita,
  };
}
