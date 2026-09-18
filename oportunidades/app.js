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

function tarjetaInmueble(inm, alPulsar) {
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

  return el("button", { clase: "inmueble", type: "button", onclick: () => alPulsar(inm) }, [
    foto,
    el("div", { clase: "cuerpo" }, [
      el("div", { clase: "precio", texto: euros(inm.precio) + (inm.operacion === "alquiler" ? "/mes" : "") }),
      el("h3", { texto: inm.titulo }),
      el("div", { clase: "datos" }, [
        el("span", { texto: [inm.zona, inm.ciudad].filter(Boolean).join(", ") }),
      ]),
      el("div", { clase: "datos", style: "margin-top:4px" }, datos.map((d) => el("span", { texto: d }))),
      el("div", {}, (inm.etiquetas || []).slice(0, 3).map((t) => el("span", { clase: "etiqueta", texto: t }))),
    ]),
  ]);
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

  return el("div", {}, [
    pintarCabecera(`Hola, ${sesion.usuario.nombre}`, [
      el("button", { clase: "btn", type: "button", texto: "Añadir inmueble", onclick: () => abrirInmueble(null) }),
      el("button", { clase: "btn claro", type: "button", texto: "Añadir cliente", onclick: () => abrirCliente(null) }),
    ]),
    metricas,
    el("div", { clase: "columnas" }, [
      el("section", {}, [el("h3", { texto: "Últimos movimientos", style: "margin-bottom:12px" }), recientes]),
      el("div", {}, [
        el("section", { style: "margin-bottom:20px" }, [el("h3", { texto: "Tareas pendientes", style: "margin-bottom:12px" }), tareas]),
        el("section", {}, [el("h3", { texto: "Actividad", style: "margin-bottom:12px" }), actividad]),
      ]),
    ]),
  ]);
}

async function vistaPisos() {
  const contenedor = el("div", {});
  const rejilla = el("div", {});

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
    rejilla.replaceChildren(
      inmuebles.length
        ? el("div", { clase: "rejilla" }, inmuebles.map((i) => tarjetaInmueble(i, abrirInmueble)))
        : el("div", { clase: "vacio", texto: "Ningún inmueble con esos filtros." })
    );
  }

  let reloj;
  busca.addEventListener("input", () => { clearTimeout(reloj); reloj = setTimeout(recargar, 350); });
  filtroEstado.addEventListener("change", recargar);
  filtroOperacion.addEventListener("change", recargar);

  contenedor.append(
    pintarCabecera("Inmuebles", [
      el("button", { clase: "btn", type: "button", texto: "Añadir inmueble", onclick: () => abrirInmueble(null) }),
    ]),
    el("div", { clase: "filtros" }, [busca, filtroEstado, filtroOperacion]),
    rejilla
  );
  await recargar();
  return contenedor;
}

async function vistaClientes() {
  const { clientes } = await api("clientes.listar");
  cache.clientes = clientes;

  const lista = clientes.length
    ? el("div", { clase: "lista" }, clientes.map((c) =>
        el("button", { clase: "fila", type: "button", onclick: () => abrirCliente(c) }, [
          el("div", {}, [
            el("b", { texto: [c.nombre, c.apellidos].filter(Boolean).join(" ") }),
            el("div", { clase: "apunte", texto: [
              CATALOGO.tipos.find((t) => t.id === c.tipo)?.nombre,
              c.presupuesto_max ? `hasta ${euros(c.presupuesto_max)}` : "sin presupuesto anotado",
              (c.zonas || []).join(", "),
            ].filter(Boolean).join(" · ") }),
          ]),
          el("div", { clase: "apunte", texto: c.telefono || c.email || "" }),
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
    caja.replaceChildren(
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

  f.replaceChildren(
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
      portada_url: portada.value, operacion: operacion.value, estado: estado.value,
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

  f.replaceChildren(
    el("h2", { texto: cli ? "Editar cliente" : "Nuevo cliente", style: "margin-bottom:18px" }),
    el("div", { clase: "dos" }, [campo("Nombre", nombre), campo("Apellidos", apellidos)]),
    el("div", { clase: "dos" }, [campo("Teléfono", telefono), campo("Correo", email)]),
    el("div", { clase: "tres" }, [campo("Tipo", tipo), campo("Busca", operacion), campo("Presupuesto máximo (€)", presupuesto)]),
    el("div", { clase: "dos" }, [campo("Zonas que le interesan", zonas), campo("Habitaciones mínimas", habitaciones)]),
    el("p", { clase: "apunte", texto: "Necesita sí o sí", style: "margin-bottom:8px" }),
    necesita,
    campo("Notas", notas),
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Cancelar", onclick: () => d.close() }),
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
  f.replaceChildren(
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

  f.replaceChildren(
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
        const texto = el("textarea", { readonly: true, style: "min-height:140px;margin-top:14px" }, [r.mensaje]);
        salida.append(
          el("p", { clase: "apunte", texto: `Mensaje para ${r.cliente.nombre}:`, style: "margin-top:14px" }),
          texto,
          el("div", { style: "display:flex;gap:8px;margin-top:8px;flex-wrap:wrap" }, [
            el("button", { clase: "btn fino claro", type: "button", texto: "Copiar", onclick: () => copiar(r.mensaje) }),
            r.cliente.telefono
              ? el("a", {
                  clase: "btn fino", target: "_blank", rel: "noopener", texto: "Abrir WhatsApp",
                  href: `https://wa.me/${r.cliente.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(r.mensaje)}`,
                })
              : null,
          ])
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
    $("vista").replaceChildren(contenido);
  } catch (e) {
    $("vista").replaceChildren(
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
