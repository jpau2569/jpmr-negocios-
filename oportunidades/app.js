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
const MAX_FOTOS = 18;          // = MAX_FOTOS de lib/oportunidades.js
const MAX_VIDEO_MB = 50;       // = MAX_VIDEO_BYTES de lib/oportunidades-extras.js
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

  const seguimientos = (datos.seguimientos || []).length
    ? el("div", { clase: "lista" }, datos.seguimientos.map((sg) => {
        const fila = el("div", { clase: "fila" });
        const hecho = async () => {
          try {
            await api("cliente.contactado", { id: sg.cliente.id });
            fila.remove();
            toast(`Apuntado: vuelvo a avisarte de ${sg.cliente.nombre} si no contesta.`);
          } catch (e) { toast(e.message); }
        };
        pintar(fila,
          el("div", { style: "min-width:0" }, [
            el("b", { texto: `⏰ ${[sg.cliente.nombre, sg.cliente.apellidos].filter(Boolean).join(" ")}` }),
            el("div", { clase: "apunte", texto:
              `${sg.enviados} ${sg.enviados === 1 ? "piso enviado" : "pisos enviados"} hace ${sg.dias} días · sin respuesta` }),
          ]),
          el("div", { clase: "acciones-fila" }, [
            numeroWa(sg.cliente.telefono)
              ? el("a", { clase: "btn fino wa", target: "_blank", rel: "noopener", texto: "Recordar",
                  href: enlaceWa(sg.cliente.telefono, sg.mensaje), onclick: () => setTimeout(hecho, 400) })
              : null,
            el("button", { clase: "btn fino claro", type: "button", texto: "Hecho", title: "Ya le he escrito", onclick: hecho }),
          ]));
        return fila;
      }))
    : el("div", { clase: "vacio", texto: "Nadie pendiente. Cuando un cliente lleve 3 días sin contestar a lo que le mandaste, aparecerá aquí." });

  return el("div", {}, [
    pintarCabecera(`Hola, ${sesion.usuario.nombre}`, [
      el("button", { clase: "btn", type: "button", texto: "Añadir inmueble", onclick: () => abrirInmueble(null) }),
      el("button", { clase: "btn claro", type: "button", texto: "Añadir cliente", onclick: () => abrirCliente(null) }),
    ]),
    metricas,
    el("div", { clase: "columnas" }, [
      el("section", {}, [el("h3", { texto: "Últimos movimientos", style: "margin-bottom:12px" }), recientes]),
      el("div", {}, [
        el("section", { style: "margin-bottom:20px" }, [el("h3", { texto: "Seguimientos de hoy", style: "margin-bottom:12px" }), seguimientos]),
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

  // Se llamaba «pintar» y tapaba al pintar() general: se llamaba a sí misma
  // sin fin y la ficha de un inmueble ya guardado no llegaba a abrirse.
  let actualGaleria = inm;
  function pintarGaleria(actual) {
    actualGaleria = actual;
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
        galeria.length >= MAX_FOTOS ? null : el("button", {
          clase: "mini-anadir", type: "button", onclick: () => entrada.click(),
        }, [el("span", { texto: "+" }), el("small", { texto: galeria.length ? "Añadir" : "Añadir fotos" })]),
      ]),
      el("p", { clase: "apunte", texto: `${galeria.length} de ${MAX_FOTOS} · se reducen solas antes de subirse` }),
      aviso,
      entrada
    );
  }

  async function cambiar(accion, datos) {
    try {
      const r = await api(accion, datos);
      pintarGaleria(r.inmueble);
      alCambiar?.(r.inmueble);
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }

  entrada.addEventListener("change", async () => {
    const hueco = MAX_FOTOS - (Array.isArray(actualGaleria.fotos) ? actualGaleria.fotos.length : 0);
    const todas = [...entrada.files];
    const archivos = todas.slice(0, Math.max(0, hueco));
    entrada.value = "";
    mostrarAviso(aviso, todas.length > archivos.length
      ? `Máximo ${MAX_FOTOS} fotos por piso: subo ${archivos.length} de las ${todas.length} que has elegido.` : "");
    let ultimo = null;
    for (const [i, archivo] of archivos.entries()) {
      try {
        cargando(true);
        const foto = await comprimirFoto(archivo);
        cargando(false);
        const r = await api("fotos.subir", { id: inm.id, ...foto });
        ultimo = r.inmueble;
        pintarGaleria(r.inmueble);
        toast(`Foto ${i + 1} de ${archivos.length} subida.`);
      } catch (e) {
        cargando(false);
        mostrarAviso(aviso, e.message);
        break;
      }
    }
    if (ultimo) alCambiar?.(ultimo);
  });

  pintarGaleria(inm);
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
  // La referencia es la calle y el número: es lo que va en los WhatsApp para
  // que el cliente sepa de qué piso se le habla. Los códigos antiguos
  // («OU-2026-0001») se dejan vacíos para que se ponga la calle.
  const refAntigua = /^OU-\d{4}-\d{4}$/.test(v.referencia || "");
  const referencia = entrada("referencia", refAntigua ? "" : v.referencia,
    { placeholder: "Ej.: Uría 12, 3ºB", maxlength: 40 });
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

  const campos = { titulo, ciudad, zona, precio, habitaciones, banos, metros, descripcion, operacion, casillas };
  // Si escribes la dirección y la referencia está vacía, se propone «calle y
  // número» (lo de antes de la primera coma que lleve un número).
  direccion.addEventListener("change", () => {
    if (referencia.value.trim()) return;
    const trozo = direccion.value.split(",").map((t) => t.trim()).find((t) => /\d/.test(t));
    if (trozo) { referencia.value = trozo.slice(0, 40); referencia.classList.add("rellenado"); }
  });
  pintar(f, 
    el("h2", { texto: inm ? "Editar inmueble" : "Nuevo inmueble", style: "margin-bottom:18px" }),
    altaRapida(campos, !inm),
    campo("Título comercial", titulo),
    el("div", { clase: "tres" }, [campo("Operación", operacion), campo("Precio (€)", precio), campo("Estado", estado)]),
    el("div", { clase: "dos" }, [campo("Ciudad", ciudad), campo("Zona o barrio", zona)]),
    el("div", { clase: "tres" }, [campo("Habitaciones", habitaciones), campo("Baños", banos), campo("Metros", metros)]),
    campo("Dirección exacta (privada, nunca se publica)", direccion),
    campo("Referencia: calle y número (va en los WhatsApp)", referencia),
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
    inm ? zonaVideo(inm, video, (actualizado) => { inm = actualizado; video.value = actualizado.video_url || ""; }) : null,
    campo(inm ? "…o pega un enlace de YouTube o Vimeo" : "Vídeo del inmueble (YouTube, Vimeo o enlace directo)", video),
    el("label", { clase: "casillas" }, [el("label", {}, [publico, "Publicar la ficha (hace falta precio y estado disponible)"])]),
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Cancelar", onclick: () => d.close() }),
      inm ? el("button", {
        clase: "btn claro", type: "button", texto: "Tarjeta para WhatsApp",
        onclick: () => tarjetaVisual(inm),
      }) : null,
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
      referencia: referencia.value || (refAntigua ? v.referencia : ""), habitaciones: habitaciones.value, banos: banos.value,
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

  if (!d.open) d.showModal();
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
  const refCalle = inm.referencia && !/^OU-\d{4}-\d{4}$/.test(inm.referencia) ? inm.referencia : null;
  const mensaje = [
    `${inm.titulo}`,
    refCalle ? `📍 ${refCalle}` : null,
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

/* ---------- vídeo propio del inmueble ---------- */
//  Se sube del móvil DIRECTO al almacén (el backend solo firma el permiso):
//  así no choca con el límite de 4,5 MB por petición de Vercel.
function zonaVideo(inm, campoUrl, alCambiar) {
  const caja = el("div", { clase: "zona-video" });
  const entrada = el("input", { type: "file", accept: "video/mp4,video/quicktime,video/webm,video/*", hidden: true });
  const aviso = el("p", { clase: "aviso", hidden: true });
  const barra = el("div", { clase: "progreso", hidden: true }, [el("span")]);
  let actual = inm;

  function dibujar() {
    const url = actual.video_url;
    const propio = url && /\/storage\/v1\/object\/public\/videos\//.test(url);
    pintar(caja,
      el("p", { clase: "apunte", texto: "Vídeo (uno por piso, máx. 50 MB ≈ 1 minuto en 1080p)", style: "margin-bottom:8px" }),
      url && propio ? el("video", { src: url, controls: true, playsinline: true, preload: "metadata", clase: "video-previa" }) : null,
      url && !propio ? el("p", { clase: "apunte", texto: `Enlace puesto: ${url}` }) : null,
      el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" }, [
        el("button", { clase: "btn claro fino", type: "button", texto: url ? "🎬 Cambiar vídeo" : "🎬 Subir vídeo del móvil",
          onclick: () => entrada.click() }),
        url ? el("button", { clase: "btn fino peligro", type: "button", texto: "Quitar vídeo", onclick: quitar }) : null,
      ]),
      barra, aviso, entrada);
  }

  async function quitar() {
    try {
      const r = await api("video.quitar", { id: actual.id });
      actual = r.inmueble; alCambiar?.(actual); dibujar(); toast("Vídeo quitado.");
    } catch (e) { mostrarAviso(aviso, e.message); }
  }

  entrada.addEventListener("change", async () => {
    const archivo = entrada.files[0];
    entrada.value = "";
    if (!archivo) return;
    mostrarAviso(aviso, "");
    if (archivo.size > MAX_VIDEO_MB * 1048576) {
      return mostrarAviso(aviso, `El vídeo pesa ${Math.round(archivo.size / 1048576)} MB y el máximo es ${MAX_VIDEO_MB} MB. Grábalo en 1080p o recórtalo a menos de un minuto.`);
    }
    const tipo = archivo.type || (/\.mov$/i.test(archivo.name) ? "video/quicktime" : "video/mp4");
    try {
      const p = await api("video.preparar", { id: actual.id, tipo, tamano: archivo.size });
      barra.hidden = false;
      await subirConProgreso(p.subida, archivo, p.tipo, (x) => { barra.firstChild.style.width = `${Math.round(x * 100)}%`; });
      const r = await api("video.guardar", { id: actual.id, ruta: p.ruta });
      actual = r.inmueble; alCambiar?.(actual);
      barra.hidden = true; dibujar();
      toast("Vídeo subido. Ya sale en la ficha y en los WhatsApp.");
    } catch (e) {
      barra.hidden = true;
      mostrarAviso(aviso, e.message);
    }
  });

  dibujar();
  return caja;
}

function subirConProgreso(url, archivo, tipo, alAvanzar) {
  return new Promise((ok, mal) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", tipo);
    x.upload.onprogress = (ev) => ev.lengthComputable && alAvanzar(ev.loaded / ev.total);
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : mal(new Error(`El almacén rechazó el vídeo (${x.status}).`)));
    x.onerror = () => mal(new Error("Se cortó la conexión subiendo el vídeo. Prueba con wifi."));
    x.send(archivo);
  });
}

/* ---------- 1. Alta rápida: notas o voz → ficha rellena ---------- */
//  Pau escribe o dicta lo que sabe del piso y la ficha se rellena sola. En un
//  inmueble nuevo se rellena todo; en uno existente solo lo que está vacío, y
//  el anuncio nuevo se ofrece, no se impone.
function altaRapida(c, nuevo) {
  const notas = el("textarea", { clase: "notas-alta", placeholder:
    "Ej.: piso 3 hab en El Llano, Gijón, 90 m², 2 baños, ascensor y terraza, 185.000 €" });
  const aviso = el("p", { clase: "aviso", hidden: true });
  const salida = el("div", {});
  const Reconocer = window.SpeechRecognition || window.webkitSpeechRecognition;
  let escuchando = null;

  const micro = Reconocer ? el("button", {
    clase: "btn claro fino micro", type: "button", texto: "🎤 Dictar",
    onclick: () => {
      if (escuchando) { escuchando.stop(); return; }
      const r = new Reconocer();
      r.lang = "es-ES"; r.interimResults = true; r.continuous = true;
      const base = notas.value ? notas.value.trim() + " " : "";
      r.onresult = (ev) => {
        notas.value = base + [...ev.results].map((x) => x[0].transcript).join(" ");
      };
      r.onend = () => { escuchando = null; micro.textContent = "🎤 Dictar"; micro.classList.remove("grabando"); };
      r.onerror = (ev) => mostrarAviso(aviso, ev.error === "not-allowed"
        ? "El navegador no deja usar el micrófono: dale permiso y vuelve a probar." : "No te he entendido; prueba otra vez.");
      r.start();
      escuchando = r;
      micro.textContent = "■ Parar";
      micro.classList.add("grabando");
    },
  }) : null;

  const poner = (nodo, valor) => {
    if (valor === undefined || valor === null || valor === "") return false;
    if (!nuevo && String(nodo.value || "").trim()) return false;
    nodo.value = valor;
    nodo.classList.add("rellenado");
    setTimeout(() => nodo.classList.remove("rellenado"), 2400);
    return true;
  };

  async function rellenar() {
    mostrarAviso(aviso, "");
    try {
      if (escuchando) escuchando.stop();
      const { ficha: x, motor, aviso: nota } = await api("inmuebles.redactar", { notas: notas.value });
      poner(c.titulo, x.titulo);
      poner(c.ciudad, x.ciudad);
      poner(c.zona, x.zona);
      poner(c.precio, x.precio ? new Intl.NumberFormat("es-ES").format(x.precio) : "");
      poner(c.habitaciones, x.habitaciones);
      poner(c.banos, x.banos);
      poner(c.metros, x.metros);
      if (nuevo && x.operacion) c.operacion.value = x.operacion;
      for (const id of x.caracteristicas || []) {
        const casilla = c.casillas.querySelector(`input[value="${CSS.escape(id)}"]`);
        if (casilla) casilla.checked = true;
      }
      const descripcionPuesta = poner(c.descripcion, x.descripcion);
      pintar(salida,
        el("div", { clase: "resultado-alta" }, [
          el("b", { texto: motor === "ia" ? "✨ Ficha rellenada con IA" : "✓ Ficha rellenada" }),
          el("span", { clase: "apunte", texto: " · revisa los campos marcados antes de guardar." }),
          x.faltan?.length
            ? el("p", { clase: "apunte", style: "margin-top:6px", texto: `Para que venda más, añade: ${x.faltan.join(", ")}.` })
            : null,
          !descripcionPuesta && x.descripcion
            ? el("div", { style: "margin-top:10px" }, [
                el("p", { clase: "apunte", texto: "Anuncio propuesto (la ficha ya tenía descripción):" }),
                el("p", { clase: "anuncio-propuesto", texto: x.descripcion }),
                el("button", { clase: "btn claro fino", type: "button", texto: "Usar este anuncio",
                  onclick: () => { c.descripcion.value = x.descripcion; toast("Anuncio puesto en la descripción."); } }),
              ])
            : null,
        ]));
      if (nota) mostrarAviso(aviso, nota, true);
    } catch (e) {
      mostrarAviso(aviso, e.message);
    }
  }

  return el("details", { clase: "alta-rapida", open: nuevo }, [
    el("summary", { texto: nuevo ? "⚡ Alta rápida: escribe o dicta y se rellena sola" : "⚡ Completar con notas o voz" }),
    el("div", { clase: "alta-cuerpo" }, [
      notas,
      el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-top:8px" }, [
        micro,
        el("button", { clase: "btn oro fino", type: "button", texto: "Rellenar ficha", onclick: rellenar }),
      ]),
      salida,
      aviso,
    ]),
  ]);
}

/* ---------- 3. Tarjeta visual para WhatsApp, estados e Instagram ---------- */
//  La dibuja el navegador en un <canvas>: foto de portada, precio, datos y la
//  marca. Se comparte directamente (en el móvil abre WhatsApp con la imagen)
//  o se descarga en PNG. Los datos son los de la ficha, nada más.
const CONTACTO_WA = "663 26 38 42"; // = CONTACTO.whatsapp de lib/oportunidades.js

const FORMATOS_TARJETA = {
  publicacion: { nombre: "Publicación 4:5", ancho: 1080, alto: 1350, foto: 0.52 },
  estado: { nombre: "Estado / historia 9:16", ancho: 1080, alto: 1920, foto: 0.58 },
};

function cargarImagen(src, anonimo = true) {
  return new Promise((ok) => {
    if (!src) return ok(null);
    const img = new Image();
    if (anonimo) img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

function datosTarjeta(inm) {
  const nombre = (id) => CATALOGO.caracteristicas.find((c) => c.id === id)?.nombre || id;
  return {
    precio: inm.precio ? euros(inm.precio) + (inm.operacion === "alquiler" ? "/mes" : "") : "Consultar precio",
    titulo: String(inm.titulo || ""),
    donde: [inm.zona, inm.ciudad].filter(Boolean).join(", "),
    datos: [
      inm.habitaciones ? `${inm.habitaciones} hab` : null,
      inm.banos ? `${inm.banos} ${Number(inm.banos) === 1 ? "baño" : "baños"}` : null,
      inm.metros ? `${inm.metros} m²` : null,
      ...(inm.caracteristicas || []).slice(0, 3).map(nombre),
    ].filter(Boolean),
    operacion: inm.operacion === "alquiler" ? "EN ALQUILER" : "EN VENTA",
  };
}

async function dibujarTarjeta(canvas, inm, formato) {
  const F = FORMATOS_TARJETA[formato];
  const W = F.ancho, H = F.alto, fotoH = Math.round(H * F.foto);
  canvas.width = W; canvas.height = H;
  const x = canvas.getContext("2d");
  const d = datosTarjeta(inm);
  const SERIF = "'Iowan Old Style', Georgia, 'Times New Roman', serif";
  const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const ORO = "#D9B75F";

  // Fondo: arriba el azul de la marca, abajo un azul noche liso para el texto
  const FONDO = "#072C4A";
  const fondo = x.createLinearGradient(0, 0, 0, fotoH);
  fondo.addColorStop(0, "#0E4A79"); fondo.addColorStop(1, FONDO);
  x.fillStyle = fondo; x.fillRect(0, 0, W, fotoH);
  x.fillStyle = FONDO; x.fillRect(0, fotoH, W, H - fotoH);

  // Foto (recorte tipo «cover»)
  const [foto, logo] = await Promise.all([cargarImagen(inm.portada_url), cargarImagen("iconos/icono-192.png", false)]);
  if (foto) {
    const esc = Math.max(W / foto.width, fotoH / foto.height);
    const w = foto.width * esc, h = foto.height * esc;
    x.save(); x.beginPath(); x.rect(0, 0, W, fotoH); x.clip();
    x.drawImage(foto, (W - w) / 2, (fotoH - h) / 2, w, h);
    x.restore();
  } else if (logo) {
    x.globalAlpha = 0.18;
    x.drawImage(logo, W / 2 - 220, fotoH / 2 - 220, 440, 440);
    x.globalAlpha = 1;
  }
  const velo = x.createLinearGradient(0, fotoH * 0.6, 0, fotoH + 1);
  velo.addColorStop(0, "rgba(7,44,74,0)"); velo.addColorStop(1, "rgba(7,44,74,1)");
  x.fillStyle = velo; x.fillRect(0, 0, W, fotoH + 1);

  // Etiqueta de operación y logo
  x.font = `700 34px ${SANS}`;
  const et = d.operacion, etW = x.measureText(et).width + 56;
  redondeado(x, 48, 48, etW, 68, 34); x.fillStyle = ORO; x.fill();
  x.fillStyle = "#2A2410"; x.textBaseline = "middle"; x.fillText(et, 76, 83);
  if (logo) {
    x.save(); redondeado(x, W - 48 - 120, 40, 120, 120, 28); x.clip();
    x.drawImage(logo, W - 48 - 120, 40, 120, 120); x.restore();
  }

  // Texto
  let y = fotoH + 30;
  x.textBaseline = "top";
  x.fillStyle = ORO; x.font = `600 ${formato === "estado" ? 118 : 108}px ${SERIF}`;
  x.fillText(d.precio, 64, y); y += formato === "estado" ? 150 : 136;
  x.fillStyle = "#FFFFFF"; x.font = `600 52px ${SANS}`;
  for (const linea of partirLineas(x, d.titulo, W - 128).slice(0, 2)) { x.fillText(linea, 64, y); y += 64; }
  if (d.donde) {
    x.fillStyle = "rgba(255,255,255,.72)"; x.font = `400 38px ${SANS}`;
    x.fillText("⌖ " + d.donde, 64, y + 6); y += 70;
  }
  // Pastillas de datos (las que quepan antes del pie)
  y += 14;
  let px = 64;
  const pieY = H - 150;
  x.font = `600 34px ${SANS}`;
  for (const t of d.datos) {
    const w = x.measureText(t).width + 48;
    if (px + w > W - 64) { px = 64; y += 78; }
    if (y + 62 > pieY - 24) break;
    redondeado(x, px, y, w, 62, 31);
    x.fillStyle = "rgba(255,255,255,.08)"; x.fill();
    x.strokeStyle = "rgba(217,183,95,.55)"; x.lineWidth = 2; x.stroke();
    x.fillStyle = "#FFFFFF"; x.textBaseline = "middle"; x.fillText(t, px + 24, y + 32); x.textBaseline = "top";
    px += w + 14;
  }

  // Pie con la marca y el contacto
  x.fillStyle = "rgba(217,183,95,.9)"; x.fillRect(64, pieY, W - 128, 3);
  x.fillStyle = "#FFFFFF"; x.font = `600 40px ${SERIF}`; x.textBaseline = "middle";
  x.fillText("Oportunidades", 64, pieY + 58);
  x.fillStyle = ORO; x.fillText("Únicas", 64 + x.measureText("Oportunidades ").width, pieY + 58);
  x.font = `600 34px ${SANS}`; x.fillStyle = "#FFFFFF"; x.textAlign = "right";
  x.fillText(`WhatsApp ${CONTACTO_WA}`, W - 64, pieY + 58);
  x.textAlign = "left";
  return !!foto || !inm.portada_url; // false = la foto no se pudo usar
}

function redondeado(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
}

function partirLineas(x, texto, ancho) {
  const palabras = String(texto).split(/\s+/), lineas = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? actual + " " + p : p;
    if (x.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  if (lineas.length > 2) lineas[1] = lineas[1].replace(/\s*\S*$/, "") + "…";
  return lineas;
}

async function tarjetaVisual(inm) {
  const d = $("ficha");
  const f = $("form-ficha");
  const canvas = el("canvas", { clase: "lienzo-tarjeta" });
  const aviso = el("p", { clase: "aviso", hidden: true });
  let formato = "publicacion";
  const enlace = inm.slug ? `${location.origin}/p/${inm.slug}` : "";
  const refCalle = inm.referencia && !/^OU-\d{4}-\d{4}$/.test(inm.referencia) ? inm.referencia : null;
  const texto = [`${inm.titulo} · ${datosTarjeta(inm).precio}`, refCalle ? `📍 ${refCalle}` : null, enlace].filter(Boolean).join("\n");

  const pintarFormato = async () => {
    const fotoOk = await dibujarTarjeta(canvas, inm, formato);
    mostrarAviso(aviso, fotoOk ? "" : "No he podido usar la foto de portada (¿enlace externo?). Sube la foto desde la ficha y saldrá en la tarjeta.");
  };
  const archivo = () => new Promise((ok) => canvas.toBlob((b) => ok(b ? new File([b],
    `${(inm.referencia || inm.slug || "inmueble").toString().toLowerCase()}-${formato}.png`, { type: "image/png" }) : null), "image/png"));

  const chips = el("div", { clase: "estilos" }, Object.entries(FORMATOS_TARJETA).map(([id, F], n) => el("button", {
    type: "button", clase: "chip" + (n === 0 ? " activo" : ""), texto: F.nombre,
    onclick: (ev) => {
      chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("activo"));
      ev.currentTarget.classList.add("activo");
      formato = id; pintarFormato();
    },
  })));

  async function compartir() {
    let fichero;
    try { fichero = await archivo(); } catch { fichero = null; }
    if (!fichero) return mostrarAviso(aviso, "No se pudo preparar la imagen. Prueba a descargarla.");
    if (navigator.canShare?.({ files: [fichero] })) {
      try { await navigator.share({ files: [fichero], text: texto }); } catch { /* cancelado */ }
    } else {
      descargar(fichero);
      toast("Este navegador no comparte imágenes: la he descargado. Adjúntala en WhatsApp.");
    }
  }
  function descargar(fichero) {
    const a = el("a", { href: URL.createObjectURL(fichero), download: fichero.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  pintar(f,
    el("h2", { texto: "Tarjeta para WhatsApp", style: "margin-bottom:6px" }),
    el("p", { clase: "apunte", style: "margin-bottom:12px", texto:
      "Para mandar a un cliente, subir a tus estados o a Instagram. Solo lleva los datos de la ficha." }),
    chips,
    el("div", { clase: "marco-tarjeta" }, [canvas]),
    aviso,
    el("div", { clase: "pie-ficha" }, [
      el("button", { clase: "btn claro", type: "button", texto: "Volver a la ficha", onclick: () => abrirInmueble(inm) }),
      el("button", { clase: "btn claro", type: "button", texto: "Descargar PNG",
        onclick: async () => { const a = await archivo().catch(() => null); a ? descargar(a) : mostrarAviso(aviso, "No se pudo preparar la imagen."); } }),
      el("button", { clase: "btn wa", type: "button", texto: "Compartir por WhatsApp", onclick: compartir }),
    ])
  );
  if (!d.open) d.showModal();
  await pintarFormato();
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
