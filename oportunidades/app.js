/* ==========================================================================
   OPORTUNIDADES ÚNICAS — aplicación
   --------------------------------------------------------------------------
   Módulo ES sin empaquetador, como el resto del monorepo. El navegador solo
   habla con /api/oportunidades: aquí no hay ninguna clave ni ninguna consulta
   a la base de datos.

   Todo lo que se pinta con datos del servidor se escribe con `textContent`,
   nunca con innerHTML: el nombre de un cliente no puede ejecutar código.
   ========================================================================== */

const CATALOGO = {
  estados: [
    { id: "borrador", nombre: "Borrador" },
    { id: "disponible", nombre: "Disponible" },
    { id: "enviado", nombre: "Enviado" },
    { id: "reservado", nombre: "Reservado" },
    { id: "vendido", nombre: "Vendido" },
    { id: "archivado", nombre: "Archivado" },
  ],
  operaciones: [
    { id: "venta", nombre: "Venta" },
    { id: "alquiler", nombre: "Alquiler" },
  ],
  tipos: [
    { id: "comprador", nombre: "Comprador" },
    { id: "inversor", nombre: "Inversor" },
    { id: "propietario", nombre: "Propietario" },
    { id: "inquilino", nombre: "Inquilino" },
  ],
  caracteristicas: [
    { id: "terraza", nombre: "Terraza" }, { id: "ascensor", nombre: "Ascensor" },
    { id: "garaje", nombre: "Garaje" }, { id: "trastero", nombre: "Trastero" },
    { id: "jardin", nombre: "Jardín" }, { id: "piscina", nombre: "Piscina" },
    { id: "reformado", nombre: "Reformado" }, { id: "amueblado", nombre: "Amueblado" },
    { id: "calefaccion", nombre: "Calefacción" }, { id: "exterior", nombre: "Exterior" },
    { id: "vistas", nombre: "Vistas" }, { id: "obra-nueva", nombre: "Obra nueva" },
  ],
};

const CLAVE_SESION = "ou_sesion_v1";
const $ = (id) => document.getElementById(id);

let sesion = null;   // { token, usuario }
let cache = { inmuebles: [], clientes: [] };

/* ---------- utilidades de DOM ---------- */
function el(etiqueta, props = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "clase") nodo.className = v;
    else if (k === "texto") nodo.textContent = v;
    else if (k === "html") nodo.innerHTML = v; // solo con literales nuestros
    else if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
    else if (k === "datos") Object.assign(nodo.dataset, v);
    else nodo.setAttribute(k, v === true ? "" : v);
  }
  for (const h of [].concat(hijos)) {
    if (h === null || h === undefined || h === false) continue;
    nodo.append(typeof h === "string" ? document.createTextNode(h) : h);
  }
  return nodo;
}

// Vaciar un nodo y volver a pintarlo. Existe porque `replaceChildren()` del
// navegador escribe literalmente «null» cuando le llega uno, y aquí se pinta a
// base de `condición ? el(...) : null`. Todo el render pasa por aquí para que
// los hijos se comporten igual que dentro de el().
function pintar(nodo, ...hijos) {
  nodo.replaceChildren(
    ...hijos.flat().filter((h) => h !== null && h !== undefined && h !== false)
  );
}

const euros = (n) =>
  n === null || n === undefined || n === "" ? "Sin precio"
    : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n));

function cuando(iso) {
  if (!iso) return "";
  const dias = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 31) return `hace ${dias} días`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function toast(mensaje) {
  const t = $("toast");
  t.textContent = mensaje;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 3000);
}

const cargando = (on) => $("cargando").classList.toggle("on", on);

/* ---------- llamadas al backend ---------- */
async function api(accion, datos = {}) {
  cargando(true);
  try {
    const resp = await fetch("/api/oportunidades", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sesion?.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
      },
      body: JSON.stringify({ accion, ...datos }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // La sesión caducada saca al usuario en vez de dejarlo con la app muerta.
      if (resp.status === 401 && sesion) {
        cerrarSesion("Tu sesión ha caducado. Vuelve a entrar.");
      }
      const err = new Error(cuerpo.error || `Error ${resp.status}`);
      err.status = resp.status;
      err.errores = cuerpo.errores;
      throw err;
    }
    return cuerpo;
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error("No hay conexión con el servidor. Comprueba que estás en línea.");
    }
    throw e;
  } finally {
    cargando(false);
  }
}

/* ---------- sesión ---------- */
function guardarSesion(s) {
  sesion = s;
  try { localStorage.setItem(CLAVE_SESION, JSON.stringify(s)); } catch { /* modo privado */ }
}

function leerSesion() {
  try { return JSON.parse(localStorage.getItem(CLAVE_SESION) || "null"); } catch { return null; }
}

function cerrarSesion(motivo) {
  sesion = null;
  cache = { inmuebles: [], clientes: [] };
  try { localStorage.removeItem(CLAVE_SESION); } catch { /* nada */ }
  $("app").hidden = true;
  $("acceso").hidden = false;
  if (motivo) mostrarAviso($("aviso-acceso"), motivo);
}

function mostrarAviso(nodo, texto, ok = false) {
  nodo.textContent = texto || "";
  nodo.hidden = !texto;
  nodo.classList.toggle("ok", ok);
}

/* ---------- vistas ---------- */
function pintarCabecera(titulo, acciones = []) {
  return el("div", { clase: "cab" }, [
    el("div", {}, [el("h2", { texto: titulo })]),
    el("div", { clase: "acciones" }, acciones),
  ]);
}

function tarjetaInmueble(inm, alPulsar, seleccion = null) {
  const estado = CATALOGO.estados.find((e) => e.id === inm.estado);
  const datos = [
    inm.habitaciones ? `${inm.habitaciones} hab` : null,
    inm.banos ? `${inm.banos} baños` : null,
    inm.metros ? `${inm.metros} m²` : null,
  ].filter(Boolean);

  const foto = el("div", { clase: "foto" }, [
    inm.portada_url ? "" : "⌂",
    el("span", { clase: `pastilla ${inm.estado}`, texto: estado?.nombre || inm.estado }),
  ]);
  if (inm.portada_url) foto.style.backgroundImage = `url(${CSS.escape(inm.portada_url)})`;

  const tarjeta = el("button", { clase: "inmueble", type: "button", onclick: () => alPulsar(inm) }, [
    foto,
    el("div", { clase: "cuerpo" }, [
      el("div", { clase: "precio", texto: euros(inm.precio) + (inm.operacion === "alquiler" ? "/mes" : "") }),
      el("h3", { texto: inm.titulo }),
      el("div", { clase: "datos" }, [
        el("span", { texto: [inm.zona, inm.ciudad].filter(Boolean).join(", ") }),
      ]),
      el("div", { clase: "datos", style: "margin-top:4px" }, datos.map((d) => el("span", { texto: d }))),
      el("div", {}, [
        ...(inm.video_url ? [el("span", { clase: "etiqueta video", texto: "▶ con vídeo" })] : []),
        ...(inm.etiquetas || []).slice(0, 3).map((t) => el("span", { clase: "etiqueta", texto: t })),
      ]),
    ]),
  ]);

  // Sin selección (panel, coincidencias) la tarjeta va sola. En la cartera se
  // envuelve para poder marcarla y mandar varias de una vez.
  if (!seleccion) return tarjeta;

  const casilla = el("input", {
    type: "checkbox", clase: "marcar", checked: seleccion.marcados.has(inm.id),
    title: "Marcar para enviar",
    onchange: (ev) => {
      ev.target.checked ? seleccion.marcados.add(inm.id) : seleccion.marcados.delete(inm.id);
      seleccion.alCambiar();
    },
  });
  return el("div", { clase: "inmueble-caja" }, [tarjeta, el("label", { clase: "marcar-caja" }, [casilla])]);
}

async function vistaPanel() {
  const datos = await api("panel");
  cache.inmuebles = datos.inmuebles || [];
  const m = datos.metricas;

  const metricas = el("div", { clase: "metricas" }, [
    [m.disponibles, "Disponibles"], [m.borradores, "Borradores"],
    [m.reservados, "Reservados"], [m.vendidos, "Vendidos"], [m.total, "En total"],
  ].map(([n, t]) => el("div", { clase: "metrica" }, [el("b", { texto: String(n) }), el("span", { texto: t })])));

  const recientes = datos.inmuebles.length
    ? el("div", { clase: "rejilla" }, datos.inmuebles.map((i) => tarjetaInmueble(i, abrirInmueble)))
    : el("div", { clase: "vacio", texto: "Todavía no hay inmuebles. Empieza por dar de alta el primero." });

  const tareas = datos.tareas.length
    ? el("div", { clase: "lista" }, datos.tareas.map((t) =>
        el("div", { clase: "fila" }, [
          el("div", {}, [el("b", { texto: t.titulo }), el("div", { clase: "apunte", texto: t.vence ? `vence ${cuando(t.vence)}` : "sin fecha" })]),
        ])))
    : el("div", { clase: "vacio", texto: "Ninguna tarea pendiente." });

  const actividad = datos.actividad.length
    ? el("div", { clase: "lista" }, datos.actividad.map((a) =>
        el("div", { clase: "fila" }, [
          el("div", {}, [el("b", { texto: a.resumen }), el("div", { clase: "apunte", texto: `${a.autor_nombre || "—"} · ${cuando(a.creado)}` })]),
        ])))
    : el("div", { clase: "vacio", texto: "Sin actividad todavía." });

  const respuestas = (datos.respuestas || []).length
    ? el("div", { clase: "lista" }, datos.respuestas.map((r) =>
        el("div", { clase: "fila" }, [
          el("div", { style: "min-width:0" }, [
            el("b", { texto: `${ICONO_RESPUESTA[r.respuesta] || ""} ${r.cliente.nombre} ${TEXTO_RESPUESTA[r.respuesta] || r.respuesta}` }),
            el("div", { clase: "apunte", texto: `${r.inmueble.titulo} · ${cuando(r.creado)}` }),
          ]),
          numeroWa(r.cliente.telefono)
            ? el("a", { clase: "btn fino wa", target: "_blank", rel: "noopener", texto: "Contestar",
                href: enlaceWa(r.cliente.telefono, r.mensaje) })
            : null,
        ])))
    : el("div", { clase: "vacio", texto: "Cuando un cliente marque en su portal que un piso le interesa o quiere verlo, aparecerá aquí." });

  return el("div", {}, [
    pintarCabecera(`Hola, ${sesion.usuario.nombre}`, [
      el("button", { clase: "btn", type: "button", texto: "Añadir inmueble", onclick: () => abrirInmueble(null) }),
      el("button", { clase: "btn claro", type: "button", texto: "Añadir cliente", onclick: () => abrirCliente(null) }),
    ]),
    metricas,
    el("div", { clase: "columnas" }, [
      el("section", {}, [el("h3", { texto: "Últimos movimientos", style: "margin-bottom:12px" }), recientes]),
      el("div", {}, [
        el("section", { style: "margin-bottom:20px" }, [el("h3", { texto: "Respuestas de clientes", style: "margin-bottom:12px" }), respuestas]),
        el("section", { style: "margin-bottom:20px" }, [el("h3", { texto: "Tareas pendientes", style: "margin-bottom:12px" }), tareas]),
        el("section", {}, [el("h3", { texto: "Actividad", style: "margin-bottom:12px" }), actividad]),
      ]),
    ]),
  ]);
}

async function vistaPisos() {
  const contenedor = el("div", {});
  const rejilla = el("div", {});
  const barra = el("div", { clase: "barra-marcados", hidden: true });

  // Lo que hay marcado para mandar por WhatsApp. Sobrevive a los filtros:
  // puedes buscar en Oviedo, marcar dos, buscar en Gijón y marcar otro.
  const seleccion = {
    marcados: new Set(),
    alCambiar: () => {
      const n = seleccion.marcados.size;
      barra.hidden = n === 0;
      if (n) {
        pintar(barra, 
          el("b", { texto: n === 1 ? "1 inmueble marcado" : `${n} inmuebles marcados` }),
          el("div", { clase: "acciones" }, [
            el("button", {
              clase: "btn claro fino", type: "button", texto: "Quitar marcas",
              onclick: () => { seleccion.marcados.clear(); seleccion.alCambiar(); recargar(); },
            }),
            el("button", {
              clase: "btn oro", type: "button", texto: "Enviar por WhatsApp",
              onclick: () => enviarSeleccion([...seleccion.marcados]),
            }),
          ])
        );
      }
    },
  };

  const busca = el("input", { type: "search", placeholder: "Buscar por título, referencia o zona…" });
  const filtroEstado = el("select", {}, [
    el("option", { value: "", texto: "Todos los estados" }),
    ...CATALOGO.estados.map((e) => el("option", { value: e.id, texto: e.nombre })),
  ]);
  const filtroOperacion = el("select", {}, [
    el("option", { value: "", texto: "Venta y alquiler" }),
    ...CATALOGO.operaciones.map((o) => el("option", { value: o.id, texto: o.nombre })),
  ]);

  async function recargar() {
    const { inmuebles } = await api("inmuebles.listar", {
      busca: busca.value, estado: filtroEstado.value, operacion: filtroOperacion.value,
    });
    cache.inmuebles = inmuebles;
    pintar(rejilla, 
      inmuebles.length
        ? el("div", { clase: "rejilla" }, inmuebles.map((i) => tarjetaInmueble(i, abrirInmueble, seleccion)))
        : el("div", { clase: "vacio", texto: "Ningún inmueble con esos filtros." })
    );
    seleccion.alCambiar();
  }

  let reloj;
  busca.addEventListener("input", () => { clearTimeout(reloj); reloj = setTimeout(recargar, 350); });
  filtroEstado.addEventListener("change", recargar);
  filtroOperacion.addEventListener("change", recargar);

  contenedor.append(
    pintarCabecera("Inmuebles", [
      el("button", { clase: "btn", type: "button", texto: "Añadir inmueble", onclick: () => abrirInmueble(null) }),
    ]),
    el("p", { clase: "apunte", style: "margin:-10px 0 16px", texto: "Marca varios inmuebles para mandárselos juntos a un cliente por WhatsApp." }),
    el("div", { clase: "filtros" }, [busca, filtroEstado, filtroOperacion]),
    rejilla,
    barra
  );
  await recargar();
  return contenedor;
}

async function vistaClientes() {
  const { clientes } = await api("clientes.listar");
  cache.clientes = clientes;

  const lista = clientes.length
    ? el("div", { clase: "lista" }, clientes.map((c) =>
        el("div", { clase: "fila fila-cliente" }, [
          el("button", { clase: "fila-principal", type: "button", onclick: () => abrirCliente(c) }, [
            el("b", { texto: [c.nombre, c.apellidos].filter(Boolean).join(" ") }),
            el("div", { clase: "apunte", texto: [
              CATALOGO.tipos.find((t) => t.id === c.tipo)?.nombre,
              c.presupuesto_max ? `hasta ${euros(c.presupuesto_max)}` : "sin presupuesto anotado",
              (c.zonas || []).join(", "),
            ].filter(Boolean).join(" · ") }),
            el("div", { clase: "apunte", texto: [
              c.telefono || c.email || "",
              (c.inmuebles_autorizados || []).length
                ? `${c.inmuebles_autorizados.length} ${c.inmuebles_autorizados.length === 1 ? "enviado" : "enviados"}` : "",
              c.ultimo_contacto ? `último envío ${cuando(c.ultimo_contacto)}` : "",
            ].filter(Boolean).join(" · ") }),
          ]),
          el("div", { clase: "acciones-fila" }, [
            numeroWa(c.telefono) ? el("a", { clase: "btn fino wa", target: "_blank", rel: "noopener", title: "Abrir su WhatsApp",
              texto: "WhatsApp", href: enlaceWa(c.telefono) }) : null,
            el("button", { clase: "btn fino oro", type: "button", texto: "Enviar pisos", onclick: () => enviarACliente(c) }),
          ]),
        ])))
    : el("div", { clase: "vacio", texto: "Todavía no hay clientes." });

  return el("div", {}, [
    pintarCabecera("Clientes", [
      el("button", { clase: "btn", type: "button", texto: "Añadir cliente", onclick: () => abrirCliente(null) }),
    ]),
    lista,
  ]);
}

async function vistaActividad() {
  const datos = await api("panel");
  return el("div", {}, [
    pintarCabecera("Actividad"),
    datos.actividad.length
      ? el("div", { clase: "lista" }, datos.actividad.map((a) =>
          el("div", { clase: "fila" }, [
            el("div", {}, [
              el("b", { texto: a.resumen }),
              el("div", { clase: "apunte", texto: `${a.autor_nombre || "—"} · ${cuando(a.creado)}` }),
            ]),
          ])))
      : el("div", { clase: "vacio", texto: "Sin actividad todavía." }),
  ]);
}

/* ---------- fotos ---------- */
//  Las fotos de un móvil pesan 4-8 MB y no hacen falta: para una ficha sobra
//  con 1600 px de lado largo. Se reducen aquí, en el propio navegador, antes
//  de mandarlas — así la subida es rápida aunque Pau esté en la calle con
//  cobertura regular, y nunca se pasa del límite del servidor.
const LADO_MAX = 1600;

function comprimirFoto(archivo) {
  return new Promise((resuelve, rechaza) => {
    if (!archivo.type.startsWith("image/")) {
      return rechaza(new Error(`"${archivo.name}" no es una foto.`));
    }
    const lector = new FileReader();
    lector.onerror = () => rechaza(new Error(`No se pudo leer "${archivo.name}".`));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rechaza(new Error(`"${archivo.name}" no se pudo abrir como imagen.`));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        const ctx = lienzo.getContext("2d");
        ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        // JPEG al 82 %: la diferencia no se ve y el archivo baja muchísimo.
        resuelve({ tipo: "image/jpeg", datos: lienzo.toDataURL("image/jpeg", 0.82) });
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

/**
 * Zona de fotos de la ficha. Solo aparece con el inmueble ya guardado: las
 * fotos se guardan contra su identificador, así que antes no hay dónde ponerlas.
 */
function zonaFotos(inm, alCambiar) {
  const caja = el("div", { clase: "fotos" });
  const entrada = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, hidden: true });
  const aviso = el("p", { clase: "aviso", hidden: true });

  function pintar(actual) {
    const galeria = Array.isArray(actual.fotos) ? actual.fotos : [];
    pintar(caja, 
      el("div", { clase: "rejilla-fotos" }, [
        ...galeria.map((f) => {
          const esPortada = actual.portada_url === f.url;
          const miniatura = el("div", { clase: "mini" + (esPortada ? " portada" : "") });
          miniatura.style.backgroundImage = `url(${CSS.escape(f.url)})`;
          return el("div", { clase: "mini-caja" }, [
            miniatura,
            esPortada ? el("span", { clase: "sello-portada", texto: "Portada" }) : null,
            el("div", { clase: "mini-acciones" }, [
              esPortada ? null : el("button", {
                clase: "btn fino claro", type: "button", texto: "Portada",
                onclick: () => cambiar("fotos.portada", { id: actual.id, url: f.url }),
              }),
              el("button", {
                clase: "btn fino peligro", type: "button", texto: "Quitar",
                onclick: () => cambiar("fotos.borrar", { id: actual.id, ruta: f.ruta }),
              }),
            ]),
          ]);
        }),
        el("button", {
          clase: "mini-anadir", type: "button", onclick: () => entrada.click(),
        }, [el("span", { texto: "+" }), el("small", { texto: galeria.length ? "Añadir" : "Añadir fotos" })]),
      ]),
      el("p", { clase: "apunte", texto: `${galeria.length} de 20 · se reducen solas antes de subirse` }),
      aviso,
      entrada
    );
  }

  async function cambiar(accion, datos) {
    try {
      const r = await api(accion, datos);
      pintar(r.inmueble);
      alCambiar?.(r.inmueble);
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }

  entrada.addEventListener("change", async () => {
    const archivos = [...entrada.files];
    entrada.value = "";
    mostrarAviso(aviso, "");
    let ultimo = null;
    for (const [i, archivo] of archivos.entries()) {
      try {
        cargando(true);
        const foto = await comprimirFoto(archivo);
        cargando(false);
        const r = await api("fotos.subir", { id: inm.id, ...foto });
        ultimo = r.inmueble;
        pintar(r.inmueble);
        toast(`Foto ${i + 1} de ${archivos.length} subida.`);
      } catch (e) {
        cargando(false);
        mostrarAviso(aviso, e.message);
        break;
      }
    }
    if (ultimo) alCambiar?.(ultimo);
  });

  pintar(inm);
  return caja;
}

/* ---------- ficha de inmueble ---------- */
function campo(etiqueta, nodo) {
  return el("label", { clase: "campo" }, [el("span", { texto: etiqueta }), nodo]);
}

function abrirInmueble(inm) {
  const d = $("ficha");
  const f = $("form-ficha");
  const v = inm || {};

  const entrada = (nombre, valor, extra = {}) => el("input", { name: nombre, value: valor ?? "", ...extra });
  const titulo = entrada("titulo", v.titulo, { required: true, maxlength: 120 });
  const ciudad = entrada("ciudad", v.ciudad, { required: true, maxlength: 60 });
  const zona = entrada("zona", v.zona, { maxlength: 80 });
  const precio = entrada("precio", v.precio, { inputmode: "decimal", placeholder: "185.000" });
  const referencia = entrada("referencia", v.referencia, { placeholder: "se genera sola", maxlength: 24 });
  const habitaciones = entrada("habitaciones", v.habitaciones, { type: "number", min: "0", max: "60" });
  const banos = entrada("banos", v.banos, { type: "number", min: "0", max: "40" });
  const metros = entrada("metros", v.metros, { type: "number", min: "0" });
  const direccion = entrada("direccion_privada", v.direccion_privada, { maxlength: 160 });
  const portada = entrada("portada_url", v.portada_url, { type: "url", placeholder: "https://…" });
  const video = entrada("video_url", v.video_url, { type: "url", placeholder: "https://youtu.be/… o Vimeo" });
  const descripcion = el("textarea", { name: "descripcion", maxlength: 4000 }, [v.descripcion || ""]);

  const operacion = el("select", { name: "operacion" }, CATALOGO.operaciones.map((o) =>
    el("option", { value: o.id, texto: o.nombre, selected: v.operacion === o.id })));
  const estado = el("select", { name: "estado" }, CATALOGO.estados.map((e) =>
    el("option", { value: e.id, texto: e.nombre, selected: (v.estado || "borrador") === e.id })));

  const publico = el("input", { type: "checkbox", name: "publico", checked: v.publico === true });
  const casillas = el("div", { clase: "casillas" }, CATALOGO.caracteristicas.map((c) =>
    el("label", {}, [
      el("input", { type: "checkbox", value: c.id, name: "caracteristicas", checked: (v.caracteristicas || []).includes(c.id) }),
      c.nombre,
    ])));

  const aviso = el("p", { clase: "aviso", hidden: true });

  pintar(f, 
    el("h2", { texto: inm ? "Editar inmueble" : "Nuevo inmueble", style: "margin-bottom:18px" }),
    campo("Título comercial", titulo),
    el("div", { clase: "tres" }, [campo("Operación", operacion), campo("Precio (€)", precio), campo("Estado", estado)]),
    el("div", { clase: "dos" }, [campo("Ciudad", ciudad), campo("Zona o barrio", zona)]),
    el("div", { clase: "tres" }, [campo("Habitaciones", habitaciones), campo("Baños", banos), campo("Metros", metros)]),
    campo("Dirección exacta (privada, nunca se publica)", direccion),
    campo("Referencia interna", referencia),
    el("p", { clase: "apunte", texto: "Características", style: "margin-bottom:8px" }),
    casillas,
    campo("Descripción", descripcion),
    inm
      ? el("div", {}, [
          el("p", { clase: "apunte", texto: "Fotos", style: "margin-bottom:8px" }),
          zonaFotos(inm, (actualizado) => { inm = actualizado; portada.value = actualizado.portada_url || ""; }),
        ])
      : el("p", { clase: "apunte", texto: "Guarda el inmueble y podrás añadirle fotos.", style: "margin-bottom:14px" }),
    campo("Foto de portada (dirección web, opcional si subes fotos)", portada),
    campo("Vídeo del inmueble (YouTube, Vimeo o enlace directo)", video),
    el("label", { clase: "casillas" }, [el("label", {}, [publico, "Publicar la ficha (hace falta precio y estado disponible)"])]),
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Cancelar", onclick: () => d.close() }),
      inm && inm.slug ? el("button", {
        clase: "btn claro", type: "button", texto: "Compartir ficha",
        onclick: () => compartirFicha(inm),
      }) : null,
      inm ? el("button", {
        clase: "btn claro", type: "button", texto: "Ver coincidencias",
        onclick: () => verCoincidencias(inm),
      }) : null,
      el("button", { clase: "btn", type: "button", texto: "Guardar", onclick: guardar }),
    ])
  );

  async function guardar() {
    const datos = {
      titulo: titulo.value, ciudad: ciudad.value, zona: zona.value, precio: precio.value,
      referencia: referencia.value, habitaciones: habitaciones.value, banos: banos.value,
      metros: metros.value, direccion_privada: direccion.value, descripcion: descripcion.value,
      portada_url: portada.value, video_url: video.value,
      operacion: operacion.value, estado: estado.value,
      publico: publico.checked,
      caracteristicas: [...casillas.querySelectorAll("input:checked")].map((i) => i.value),
      etiquetas: v.etiquetas || [],
    };
    try {
      const r = await api("inmuebles.guardar", { id: inm?.id, inmueble: datos });
      d.close();
      toast(`Guardado: ${r.inmueble.titulo}`);
      recargarVista();
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }

  d.showModal();
}

/* ---------- ficha de cliente ---------- */
function abrirCliente(cli) {
  const d = $("ficha");
  const f = $("form-ficha");
  const v = cli || {};

  const nombre = el("input", { value: v.nombre || "", required: true, maxlength: 80 });
  const apellidos = el("input", { value: v.apellidos || "", maxlength: 80 });
  const telefono = el("input", { value: v.telefono || "", type: "tel", maxlength: 30 });
  const email = el("input", { value: v.email || "", type: "email", maxlength: 120 });
  const presupuesto = el("input", { value: v.presupuesto_max || "", inputmode: "decimal", placeholder: "180.000" });
  const zonas = el("input", { value: (v.zonas || []).join(", "), placeholder: "Oviedo, El Llano…" });
  const habitaciones = el("input", { value: v.habitaciones_min || "", type: "number", min: "0", max: "60" });
  const notas = el("textarea", {}, [v.notas || ""]);
  const tipo = el("select", {}, CATALOGO.tipos.map((t) =>
    el("option", { value: t.id, texto: t.nombre, selected: (v.tipo || "comprador") === t.id })));
  const operacion = el("select", {}, CATALOGO.operaciones.map((o) =>
    el("option", { value: o.id, texto: o.nombre, selected: (v.operacion || "venta") === o.id })));
  const necesita = el("div", { clase: "casillas" }, CATALOGO.caracteristicas.map((c) =>
    el("label", {}, [
      el("input", { type: "checkbox", value: c.id, checked: (v.necesita || []).includes(c.id) }),
      c.nombre,
    ])));
  const aviso = el("p", { clase: "aviso", hidden: true });

  pintar(f, 
    el("h2", { texto: cli ? "Editar cliente" : "Nuevo cliente", style: "margin-bottom:18px" }),
    el("div", { clase: "dos" }, [campo("Nombre", nombre), campo("Apellidos", apellidos)]),
    el("div", { clase: "dos" }, [campo("Teléfono", telefono), campo("Correo", email)]),
    el("div", { clase: "tres" }, [campo("Tipo", tipo), campo("Busca", operacion), campo("Presupuesto máximo (€)", presupuesto)]),
    el("div", { clase: "dos" }, [campo("Zonas que le interesan", zonas), campo("Habitaciones mínimas", habitaciones)]),
    el("p", { clase: "apunte", texto: "Necesita sí o sí", style: "margin-bottom:8px" }),
    necesita,
    campo("Notas", notas),
    cli ? el("div", { style: "margin-top:6px" }, [
      el("p", { clase: "apunte", texto: "Lo que le has mandado y qué ha dicho", style: "margin-bottom:8px" }),
      zonaSeguimiento(cli),
    ]) : null,
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Cancelar", onclick: () => d.close() }),
      cli && numeroWa(cli.telefono) ? el("a", {
        clase: "btn claro wa-claro", target: "_blank", rel: "noopener", texto: "WhatsApp",
        href: enlaceWa(cli.telefono, `Hola ${cli.nombre}, soy ${sesion.usuario.nombre}. `),
      }) : null,
      cli ? el("button", { clase: "btn oro", type: "button", texto: "Enviarle pisos", onclick: () => enviarACliente(cli) }) : null,
      el("button", { clase: "btn", type: "button", texto: "Guardar", onclick: guardar }),
    ])
  );

  async function guardar() {
    const datos = {
      nombre: nombre.value, apellidos: apellidos.value, telefono: telefono.value, email: email.value,
      tipo: tipo.value, operacion: operacion.value, presupuesto_max: presupuesto.value,
      zonas: zonas.value.split(",").map((z) => z.trim()).filter(Boolean),
      habitaciones_min: habitaciones.value, notas: notas.value,
      necesita: [...necesita.querySelectorAll("input:checked")].map((i) => i.value),
    };
    try {
      const r = await api("clientes.guardar", { id: cli?.id, cliente: datos });
      d.close();
      toast(`Guardado: ${r.cliente.nombre}`);
      recargarVista();
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }

  if (!d.open) d.showModal();
}

/* ---------- enviar una selección de inmuebles a un cliente ---------- */
//  El caso de todos los días: tengo tres pisos que le encajan a Lucía, se los
//  mando por WhatsApp con sus fichas y sus vídeos, y de paso quedan
//  autorizados en su portal privado para que me diga cuáles quiere ver.
async function enviarSeleccion(ids) {
  const d = $("ficha");
  const f = $("form-ficha");

  let clientes = cache.clientes;
  if (!clientes.length) {
    try {
      clientes = (await api("clientes.listar")).clientes;
      cache.clientes = clientes;
    } catch (e) {
      return toast(e.message);
    }
  }
  if (!clientes.length) {
    return toast("Primero da de alta al cliente al que se lo quieres mandar.");
  }

  const selector = el("select", {}, clientes.map((c) =>
    el("option", {
      value: c.id,
      texto: [c.nombre, c.apellidos].filter(Boolean).join(" ") +
        (c.telefono ? ` · ${c.telefono}` : c.email ? ` · ${c.email}` : " · sin contacto"),
    })));
  const aviso = el("p", { clase: "aviso", hidden: true });
  const salida = el("div", {});

  pintar(f, 
    el("h2", { texto: ids.length === 1 ? "Enviar este inmueble" : `Enviar ${ids.length} inmuebles`, style: "margin-bottom:6px" }),
    el("p", { clase: "apunte", texto: "Se autorizan en el portal privado del cliente y se prepara el mensaje.", style: "margin-bottom:18px" }),
    el("label", { clase: "campo" }, [el("span", { texto: "¿A quién?" }), selector]),
    salida,
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Cerrar", onclick: () => d.close() }),
      el("button", { clase: "btn oro", type: "button", texto: "Preparar mensaje", onclick: preparar }),
    ])
  );

  async function preparar() {
    mostrarAviso(aviso, "");
    try {
      const r = await api("seleccion.enviar", {
        cliente_id: selector.value,
        inmuebles: ids,
        base_url: location.origin,
      });
      pintar(salida, cajaMensaje(r));
      if (r.sin_publicar?.length) {
        // Se ha enviado igual, pero el cliente no podrá abrir esas fichas.
        mostrarAviso(aviso,
          `Enviado. Ojo: ${r.sin_publicar.join(", ")} ${r.sin_publicar.length === 1 ? "no está publicado" : "no están publicados"}, ` +
          "así que no aparecerá en su portal ni tiene ficha que abrir. Publícalo desde su ficha si quieres que lo vea.");
      } else {
        mostrarAviso(aviso, "Listo: ya están autorizados en su portal privado.", true);
      }
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }

  d.showModal();
}

/* ---------- compartir la ficha pública ---------- */
//  El enlace de la ficha es lo que Pau manda por WhatsApp a un cliente o pega
//  en un anuncio. Lleva la vista previa con foto y precio porque la página la
//  monta el servidor (api/oportunidades-ficha.js).
function compartirFicha(inm) {
  const enlace = `${location.origin}/p/${inm.slug}`;
  const mensaje = [
    `${inm.titulo}`,
    [inm.habitaciones ? `${inm.habitaciones} hab` : null, inm.metros ? `${inm.metros} m²` : null,
     [inm.zona, inm.ciudad].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
    euros(inm.precio) + (inm.operacion === "alquiler" ? "/mes" : ""),
    "",
    enlace,
  ].filter((l) => l !== null).join("\n");

  const d = $("ficha");
  const f = $("form-ficha");
  pintar(f, 
    el("h2", { texto: "Compartir esta ficha", style: "margin-bottom:6px" }),
    el("p", { clase: "apunte", texto: "Al pegarlo en WhatsApp sale la tarjeta con la foto y el precio.", style: "margin-bottom:16px" }),
    el("label", { clase: "campo" }, [
      el("span", { texto: "Enlace" }),
      el("input", { value: enlace, readonly: true, onclick: (ev) => ev.target.select() }),
    ]),
    el("label", { clase: "campo" }, [
      el("span", { texto: "Mensaje listo para mandar" }),
      el("textarea", { readonly: true, style: "min-height:130px" }, [mensaje]),
    ]),
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Cerrar", onclick: () => d.close() }),
      el("button", { clase: "btn claro", type: "button", texto: "Copiar enlace", onclick: () => copiar(enlace) }),
      el("a", {
        clase: "btn", target: "_blank", rel: "noopener", texto: "Abrir la ficha",
        href: enlace,
      }),
      el("a", {
        clase: "btn oro", target: "_blank", rel: "noopener", texto: "Mandar por WhatsApp",
        href: `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
      }),
    ])
  );
  d.showModal();
}

/* ---------- coincidencias y envío ---------- */
async function verCoincidencias(inm) {
  const d = $("ficha");
  const f = $("form-ficha");
  let datos;
  try {
    datos = await api("coincidencias", { id: inm.id });
  } catch (e) {
    toast(e.message);
    return;
  }

  const elegidos = new Set();
  const filas = datos.coincidencias.length
    ? el("div", { clase: "lista" }, datos.coincidencias.map((c) => {
        const casilla = el("input", { type: "checkbox", onchange: (ev) => {
          ev.target.checked ? elegidos.add(c.cliente.id) : elegidos.delete(c.cliente.id);
        } });
        const nivel = c.puntos >= 75 ? "alto" : c.puntos >= 45 ? "" : "bajo";
        return el("label", { clase: "fila", style: "cursor:pointer" }, [
          el("div", { style: "display:flex;gap:12px;align-items:center" }, [
            casilla,
            el("div", {}, [
              el("b", { texto: [c.cliente.nombre, c.cliente.apellidos].filter(Boolean).join(" ") }),
              el("div", { clase: "apunte", texto: c.resumen }),
            ]),
          ]),
          el("span", { clase: `puntos ${nivel}`, texto: String(c.puntos) }),
        ]);
      }))
    : el("div", { clase: "vacio", texto: "Ningún cliente encaja todavía con este inmueble." });

  const aviso = el("p", { clase: "aviso", hidden: true });
  const salida = el("div", {});

  pintar(f, 
    el("h2", { texto: "A quién le encaja", style: "margin-bottom:6px" }),
    el("p", { clase: "apunte", texto: `${inm.titulo} · ${euros(inm.precio)}`, style: "margin-bottom:18px" }),
    filas,
    salida,
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Cerrar", onclick: () => d.close() }),
      el("button", { clase: "btn oro", type: "button", texto: "Preparar envío", onclick: preparar }),
    ])
  );

  async function preparar() {
    if (elegidos.size === 0) return mostrarAviso(aviso, "Marca al menos un cliente.");
    try {
      salida.replaceChildren();
      for (const clienteId of elegidos) {
        const r = await api("seleccion.enviar", {
          cliente_id: clienteId,
          inmuebles: [inm.id],
          base_url: location.origin,
        });
        salida.append(
          el("p", { clase: "apunte", texto: `Mensaje para ${r.cliente.nombre}:`, style: "margin-top:14px" }),
          cajaMensaje(r)
        );
      }
      mostrarAviso(aviso, "Listo: los inmuebles ya están autorizados en su portal privado.", true);
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast("Copiado al portapapeles.");
  } catch {
    toast("No se pudo copiar: selecciona el texto a mano.");
  }
}

/* ---------- WhatsApp ---------- */
//  wa.me necesita el número con prefijo de país: un móvil español de 9 cifras
//  va con el 34 delante («663…» → «34663…»). Misma regla que numeroWhatsapp()
//  en lib/oportunidades.js.
function numeroWa(telefono) {
  let d = String(telefono || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && /^[6789]/.test(d)) return "34" + d;
  if (d.length < 10 || d.length > 15) return "";
  return d;
}

function enlaceWa(telefono, texto = "") {
  const n = numeroWa(telefono);
  return n ? `https://wa.me/${n}` + (texto ? `?text=${encodeURIComponent(texto)}` : "") : "";
}

const NOMBRE_ESTILO = { completo: "Completo", corto: "Corto", formal: "De usted" };
const TEXTO_RESPUESTA = {
  visita: "quiere visitarlo", interesa: "le interesa",
  similares: "quiere ver otros parecidos", no_encaja: "dice que no le encaja",
};
const ICONO_RESPUESTA = { visita: "📅", interesa: "👍", similares: "🔁", no_encaja: "✋" };

//  El mensaje ya preparado, pero editable: se elige el tono, se retoca a mano
//  y el botón de WhatsApp lleva siempre lo que hay escrito en la caja.
function cajaMensaje(r) {
  const mensajes = r.mensajes || { completo: r.mensaje };
  const estilos = Object.keys(mensajes);
  const texto = el("textarea", { clase: "mensaje-wa", style: "min-height:200px" }, [mensajes.completo || r.mensaje || ""]);
  const telefono = r.cliente?.telefono;
  const abrir = el("a", { clase: "btn wa", target: "_blank", rel: "noopener",
    texto: `Abrir WhatsApp de ${r.cliente?.nombre || "cliente"}` });
  const actualizar = () => { abrir.href = enlaceWa(telefono, texto.value); };
  texto.addEventListener("input", actualizar);
  actualizar();

  const chips = estilos.length > 1
    ? el("div", { clase: "estilos" }, estilos.map((e, n) => el("button", {
        type: "button", clase: "chip" + (n === 0 ? " activo" : ""), texto: NOMBRE_ESTILO[e] || e,
        onclick: (ev) => {
          ev.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("activo"));
          ev.currentTarget.classList.add("activo");
          texto.value = mensajes[e];
          actualizar();
        },
      })))
    : null;

  return el("div", { clase: "caja-mensaje" }, [
    el("label", { clase: "campo" }, [el("span", { texto: "Mensaje (puedes retocarlo antes de enviar)" }), chips, texto]),
    el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" }, [
      numeroWa(telefono)
        ? abrir
        : el("span", { clase: "apunte", texto: "Este cliente no tiene un teléfono válido: copia el mensaje y mándaselo por donde lo tengas." }),
      el("button", { clase: "btn claro fino", type: "button", texto: "Copiar mensaje", onclick: () => copiar(texto.value) }),
      r.enlace ? el("a", { clase: "btn claro fino", target: "_blank", rel: "noopener", texto: "Ver su portal", href: r.enlace }) : null,
    ]),
  ]);
}

/* ---------- enviar pisos desde la ficha del cliente ---------- */
//  El otro sentido del día a día: entra Lucía, abro su ficha y le mando lo
//  que mejor le encaja, sin repetirle lo que ya tiene.
async function enviarACliente(cli) {
  const d = $("ficha");
  const f = $("form-ficha");
  let datos;
  try {
    datos = await api("cliente.detalle", { id: cli.id });
  } catch (e) {
    return toast(e.message);
  }

  const elegidos = new Set();
  // Se preparan marcados los tres que mejor encajan y que aún no tiene.
  datos.sugeridos.filter((s) => !s.ya_enviado && s.puntos >= 45).slice(0, 3)
    .forEach((s) => elegidos.add(s.inmueble.id));

  const contador = el("b", {});
  const boton = el("button", { clase: "btn oro", type: "button", onclick: preparar });
  const refrescar = () => {
    const n = elegidos.size;
    contador.textContent = n ? `${n} marcado${n === 1 ? "" : "s"}` : "Marca los que le quieres mandar";
    boton.textContent = n ? `Preparar WhatsApp (${n})` : "Preparar WhatsApp";
    boton.disabled = n === 0;
  };

  const filas = datos.sugeridos.length
    ? el("div", { clase: "lista" }, datos.sugeridos.map((s) => {
        const i = s.inmueble;
        const casilla = el("input", { type: "checkbox", checked: elegidos.has(i.id), onchange: (ev) => {
          ev.target.checked ? elegidos.add(i.id) : elegidos.delete(i.id);
          refrescar();
        } });
        const nivel = s.puntos >= 75 ? "alto" : s.puntos >= 45 ? "" : "bajo";
        const mini = el("div", { clase: "mini-foto" }, [i.portada_url ? "" : "⌂"]);
        if (i.portada_url) mini.style.backgroundImage = `url(${CSS.escape(i.portada_url)})`;
        return el("label", { clase: "fila" + (s.ya_enviado ? " atenuada" : ""), style: "cursor:pointer" }, [
          el("div", { style: "display:flex;gap:12px;align-items:center;min-width:0" }, [
            casilla, mini,
            el("div", { style: "min-width:0" }, [
              el("b", { texto: `${i.titulo} · ${euros(i.precio)}${i.operacion === "alquiler" ? "/mes" : ""}` }),
              el("div", { clase: "apunte", texto: s.resumen }),
              s.ya_enviado ? el("span", { clase: "etiqueta", texto: "ya enviado" }) : null,
              !i.publico || !i.slug ? el("span", { clase: "etiqueta aviso-etq", texto: "sin publicar" }) : null,
            ]),
          ]),
          el("span", { clase: `puntos ${nivel}`, texto: String(s.puntos) }),
        ]);
      }))
    : el("div", { clase: "vacio", texto: "No hay inmuebles disponibles para enseñar ahora mismo." });

  const aviso = el("p", { clase: "aviso", hidden: true });
  const salida = el("div", {});

  pintar(f,
    el("h2", { texto: `Enviar pisos a ${cli.nombre}`, style: "margin-bottom:6px" }),
    el("p", { clase: "apunte", style: "margin-bottom:16px", texto:
      "Ordenados por lo que mejor le encaja. Te dejo marcados los mejores que aún no tiene." }),
    filas,
    el("div", { clase: "resumen-marcados" }, [contador]),
    salida,
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Volver a su ficha", onclick: () => abrirCliente(datos.cliente) }),
      boton,
    ])
  );
  refrescar();

  async function preparar() {
    if (!elegidos.size) return;
    mostrarAviso(aviso, "");
    try {
      const r = await api("seleccion.enviar", { cliente_id: cli.id, inmuebles: [...elegidos], base_url: location.origin });
      pintar(salida, cajaMensaje(r));
      salida.scrollIntoView({ behavior: "smooth", block: "start" });
      if (r.sin_publicar?.length) {
        mostrarAviso(aviso, `Ojo: ${r.sin_publicar.join(", ")} ${r.sin_publicar.length === 1 ? "no está publicado" : "no están publicados"}; no lo verá en su portal.`);
      } else {
        mostrarAviso(aviso, "Listo: ya están en su portal privado. Pulsa «Abrir WhatsApp».", true);
      }
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }

  if (!d.open) d.showModal();
}

//  Lo que tiene y lo que ha dicho, dentro de la ficha del cliente.
function zonaSeguimiento(cli) {
  const caja = el("div", { clase: "seguimiento" }, [el("p", { clase: "apunte", texto: "Cargando lo que le has mandado…" })]);
  api("cliente.detalle", { id: cli.id }).then((datos) => {
    if (!datos.enviados.length) {
      pintar(caja, el("div", { clase: "vacio", style: "padding:18px", texto: "Todavía no le has mandado ningún inmueble." }));
      return;
    }
    pintar(caja, el("div", { clase: "lista" }, datos.enviados.map((i) => {
      const r = datos.respuestas.find((x) => x.inmueble.id === i.id);
      return el("div", { clase: "fila" }, [
        el("div", { style: "min-width:0" }, [
          el("b", { texto: i.titulo }),
          el("div", { clase: "apunte", texto: [euros(i.precio),
            i.respuesta ? `${ICONO_RESPUESTA[i.respuesta] || ""} ${TEXTO_RESPUESTA[i.respuesta] || i.respuesta}` : "sin respuesta todavía",
          ].join(" · ") }),
        ]),
        r && numeroWa(cli.telefono)
          ? el("a", { clase: "btn fino wa", target: "_blank", rel: "noopener", texto: "Contestar", href: enlaceWa(cli.telefono, r.mensaje) })
          : null,
      ]);
    })));
  }).catch((e) => pintar(caja, el("p", { clase: "apunte", texto: e.message })));
  return caja;
}

/* ---------- rutas ---------- */
const RUTAS = {
  panel: vistaPanel,
  pisos: vistaPisos,
  clientes: vistaClientes,
  actividad: vistaActividad,
};

function rutaActual() {
  const r = (location.hash || "#/panel").replace(/^#\//, "").split("/")[0];
  return RUTAS[r] ? r : "panel";
}

async function recargarVista() {
  const ruta = rutaActual();
  for (const a of document.querySelectorAll("#menu a")) {
    a.classList.toggle("activo", a.dataset.ruta === ruta);
  }
  try {
    const contenido = await RUTAS[ruta]();
    pintar($("vista"), contenido);
  } catch (e) {
    pintar($("vista"), 
      el("div", { clase: "vacio" }, [
        el("b", { texto: "No se pudo cargar" }),
        el("p", { clase: "apunte", texto: e.message, style: "margin-top:6px" }),
        el("button", { clase: "btn claro", type: "button", texto: "Reintentar", style: "margin-top:14px", onclick: recargarVista }),
      ])
    );
  }
}

/* ---------- arranque ---------- */
$("form-acceso").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  mostrarAviso($("aviso-acceso"), "");
  $("btn-entrar").disabled = true;
  try {
    const r = await api("login", { email: $("email").value, password: $("password").value });
    guardarSesion({ token: r.token, usuario: r.usuario });
    $("password").value = "";
    entrar();
  } catch (e) {
    mostrarAviso($("aviso-acceso"), e.message);
  } finally {
    $("btn-entrar").disabled = false;
  }
});

$("btn-comprobar").addEventListener("click", async () => {
  const caja = $("diagnostico");
  caja.hidden = false;
  pintar(caja, el("p", { clase: "apunte", texto: "Comprobando…" }));
  try {
    const r = await api("estado");
    pintar(caja, 
      el("h3", { texto: r.listo ? "Todo listo" : "Falta algo por configurar" }),
      ...r.pasos.map((p) =>
        el("div", { clase: `paso ${p.ok ? "bien" : "mal"}` }, [
          el("span", { clase: "marca-paso", texto: p.ok ? "✓" : "✕" }),
          el("div", {}, [
            el("b", { texto: p.nombre }),
            el("small", { texto: p.detalle }),
            !p.ok && p.arreglo ? el("small", { clase: "arreglo", texto: p.arreglo }) : null,
          ]),
        ])
      ),
      r.listo
        ? el("p", { clase: "apunte", style: "margin-top:12px", texto: "Si aun así no entras, revisa el correo y la contraseña." })
        : null
    );
  } catch (e) {
    pintar(caja, el("p", { clase: "aviso", texto: e.message }));
  }
});

$("btn-salir").addEventListener("click", () => cerrarSesion());
window.addEventListener("hashchange", recargarVista);

// Al cerrar la ventana de edición se vacía: no dejamos datos de un cliente
// colgando en la página por detrás de lo que se está mirando.
$("ficha").addEventListener("close", () => $("form-ficha").replaceChildren());

function entrar() {
  $("acceso").hidden = true;
  $("app").hidden = false;
  $("usuario-nombre").textContent = sesion.usuario.nombre;
  $("usuario-rol").textContent = sesion.usuario.rol;
  recargarVista();
}

(async function arrancar() {
  const guardada = leerSesion();
  if (!guardada?.token) return cerrarSesion();
  sesion = guardada;
  try {
    // Comprueba que la sesión sigue viva antes de enseñar nada.
    const r = await api("perfil");
    sesion.usuario = r.usuario;
    guardarSesion(sesion);
    entrar();
  } catch {
    cerrarSesion();
  }
})();
