// ============================================================================
//  Configuración: inmobiliaria, referencias, catálogos (municipios, fuentes,
//  tipos, motivos), copias de seguridad y restauración, exportación de datos,
//  demostración y qué hace (y no hace) esta versión.
// ============================================================================
import { h, montar, cabecera, panel, boton, aviso, chip, chipDe, vacio, fecha, sello, conAviso, confirmar, toast, toastError, abrirDialogo, datosLista, debounce } from "../ui.js";
import { api, ApiError, sesion, cargarCatalogos, etiqueta, enums } from "../api.js";
import { dialogoFormulario } from "../formularios.js";
import { crearFormulario } from "../form.js";
import { refrescar } from "../dialogos.js";

const SECCIONES = [["general", "General"], ["referencias", "Referencias"], ["catalogos", "Catálogos"], ["copias", "Copias de seguridad"], ["datos", "Datos y privacidad"], ["demo", "Demostración"], ["acerca", "Qué hace esta versión"]];
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function formSeccion(titulo, seccion, campos, valores, ayuda) {
  const f = crearFormulario(campos, valores);
  const msg = h("div");
  const btn = boton("Guardar", { clase: "primario", onclick: async () => {
    msg.replaceChildren(); f.limpiarErrores(); btn.disabled = true;
    try { await api.put(`/api/configuracion/${seccion}`, f.leer()); await cargarCatalogos(true); toast("Configuración guardada."); refrescar(); }
    catch (e) { btn.disabled = false; if (e instanceof ApiError) { f.mostrarErrores(e.campos); msg.append(aviso("bloqueo", e.message)); } else toastError(e); }
  } });
  return panel(titulo, [ayuda ? h("p", { class: "ayuda", style: { marginTop: 0 } }, ayuda) : null, msg, f.el, h("div", { style: { marginTop: "14px" } }, btn)]);
}

function general(cont) {
  const c = sesion.cat.config;
  cont.append(
    formSeccion("Datos de la inmobiliaria", "inmobiliaria", [
      { n: "nombre", t: "texto", etq: "Nombre", ancho: "mitad", max: 120 }, { n: "telefono", t: "tel", etq: "Teléfono", ancho: "mitad" },
      { n: "email", t: "email", etq: "Correo", ancho: "mitad" }, { n: "web", t: "url", etq: "Web", ancho: "mitad" }, { n: "direccion", t: "texto", etq: "Dirección", max: 200 },
    ], c.inmobiliaria, "Se usarán en los documentos y dosieres de las próximas fases. El logotipo se podrá subir en la Fase 3."),
    formSeccion("Tú", "usuario", [{ n: "nombre", t: "texto", etq: "Tu nombre", req: true, ancho: "mitad", max: 80 }], c.usuario, "Es el responsable por defecto de oportunidades y tareas. Esta versión es de un solo usuario."),
    formSeccion("Avisos", "avisos", [
      { n: "encargo_dias", t: "int", etq: "Avisar del vencimiento de un encargo con (días)", ancho: "mitad", ayuda: "También es cuándo se crea la tarea automática." },
      { n: "demanda_obsoleta_dias", t: "int", etq: "Marcar una demanda como caducada tras (días sin tocarla)", ancho: "mitad" },
      { n: "copia_dias", t: "int", etq: "Avisar si la última copia de seguridad tiene más de (días)", ancho: "mitad" },
    ], c.avisos),
  );
}

function referencias(cont) {
  const c = sesion.cat.config;
  cont.append(formSeccion("Referencias", "referencias", [
    { n: "inmueble_prefijo", t: "texto", etq: "Prefijo de los inmuebles", ancho: "mitad", max: 10, ayuda: "Ejemplo: INM → INM-0001. Solo letras, números y guiones." },
    { n: "inmueble_digitos", t: "int", etq: "Cifras del número", ancho: "mitad" },
    { n: "oportunidad_prefijo", t: "texto", etq: "Prefijo de las oportunidades", ancho: "mitad", max: 10, ayuda: "Ejemplo: OP → OP-2026-0001 (el número se reinicia cada año)." },
  ], c.referencias, "Los números nunca se reutilizan, aunque borres un registro. Puedes poner a mano la referencia de un inmueble al crearlo (por ejemplo, si ya usabas otras)."));
}

async function catalogos(cont, f) {
  const tipos = enums().tipos_catalogo;
  const tipo = f.tipo && tipos[f.tipo] ? f.tipo : "municipio";
  const items = sesion.cat.catalogos[tipo];
  const selector = h("select", { "aria-label": "Catálogo", onchange: (e) => { f.tipo = e.target.value; refrescar(); } }, Object.entries(tipos).map(([k, v]) => h("option", { value: k }, v)));
  selector.value = tipo;
  const buscar = h("input", { type: "search", placeholder: "Filtrar la lista…", "aria-label": "Filtrar la lista" });
  const nuevo = h("input", { type: "text", placeholder: "Añadir…", maxlength: 80, "aria-label": "Nombre nuevo" });
  const lista = h("div", { class: "chips", style: { maxHeight: "50vh", overflow: "auto" } });
  const pintar = () => {
    const q = buscar.value.trim().toLowerCase();
    montar(lista, ...items.filter((x) => !q || x.etiqueta.toLowerCase().includes(q)).map((x) => h("span", { class: `chip ${x.activo ? "verde" : "gris"}` }, x.etiqueta, " ",
      h("button", { type: "button", class: "btn peq suave", style: { minHeight: "22px", padding: "0 6px" }, title: x.activo ? "Ocultar de las listas (los registros que ya lo usan no cambian)" : "Volver a mostrar",
        onclick: async () => { await conAviso(() => api.put(`/api/catalogo/${x.id}/activo`, { activo: !x.activo })); await cargarCatalogos(true); refrescar(); } }, x.activo ? "Ocultar" : "Mostrar"))));
  };
  buscar.addEventListener("input", debounce(pintar, 120));
  const anadir = async () => {
    if (!nuevo.value.trim()) return;
    try { await api.post(`/api/catalogo/${tipo}`, { etiqueta: nuevo.value }); nuevo.value = ""; await cargarCatalogos(true); toast("Añadido."); refrescar(); } catch (e) { toastError(e); }
  };
  nuevo.addEventListener("keydown", (e) => { if (e.key === "Enter") anadir(); });
  pintar();
  cont.append(panel("Catálogos configurables", [
    h("p", { class: "ayuda", style: { marginTop: 0 } }, tipo === "municipio" ? "Vienen cargados los 78 concejos de Asturias. Puedes añadir más (por ejemplo, parroquias o localidades de fuera). Además, en los formularios puedes escribir cualquier municipio aunque no esté en la lista." : "Amplía la lista con lo que necesites. «Ocultar» quita la opción de los desplegables, pero los registros que ya la usan no cambian."),
    h("div", { class: "form" }, h("div", { class: "campo mitad" }, h("label", { class: "etq" }, "Catálogo"), selector), h("div", { class: "campo mitad" }, h("label", { class: "etq" }, "Filtrar"), buscar),
      h("div", { class: "campo mitad" }, h("label", { class: "etq" }, "Añadir una entrada"), h("div", { style: { display: "flex", gap: "8px" } }, nuevo, boton("Añadir", { clase: "primario", onclick: anadir })))),
    h("p", { class: "ayuda" }, `${items.filter((x) => x.activo).length} activas de ${items.length}.`), lista]));
  cont.append(aviso("info", "Los estados (de oportunidad, inmueble, demanda…) son fijos en esta versión porque de ellos dependen las reglas y el panel. Los hitos configurables de las operaciones llegan en la Fase 2."));
}

// ----------------------------------------------------------- copias ----
async function copias(cont) {
  if (sesion.modo === "demo") { cont.append(aviso("aviso", "Las copias de seguridad solo existen para los datos reales. Vuelve a tus datos reales para usarlas.")); return; }
  const r = await api.get("/api/copias");
  const est = r.estado;
  cont.append(aviso(est.aviso ? "aviso" : "ok", est.aviso || `Última copia: ${est.ultima ? `${sello(est.ultima.modificada)} (hace ${est.dias} día(s))` : "ninguna"}. `, " ", h("b", null, "Recuerda guardar también una copia fuera de este ordenador (pendrive o nube)."), " Una copia en el mismo disco no te protege si el disco falla."));
  const crear = boton("Hacer una copia de seguridad ahora", { clase: "primario", icono: "descargar", onclick: async () => {
    crear.disabled = true;
    try { const c = await api.post("/api/copias"); toast(`Copia creada: ${c.nombre} (${kb(c.bytes)}).`, { ms: 7000 }); refrescar(); } catch (e) { crear.disabled = false; toastError(e); }
  } });
  const archivo = h("input", { type: "file", accept: ".zip,application/zip", hidden: true, onchange: async (e) => {
    const a = e.target.files[0]; e.target.value = "";
    if (!a) return;
    try { const s = await api.subir("/api/copias/subir", a); mostrarRestauracion(s); } catch (err) { toastError(err); }
  } });
  cont.append(panel("Copia completa", [
    h("p", { style: { marginTop: 0 } }, "Una copia incluye la base de datos y la carpeta de archivos en un único ZIP que puedes abrir con cualquier programa. Se comprueba al crearla."),
    h("div", { class: "chips" }, crear, boton("Restaurar desde un archivo…", { icono: "subir", onclick: () => archivo.click() }), archivo),
    h("p", { class: "ayuda", style: { marginBottom: 0 } }, `Carpeta de copias: ${r.carpeta}. El programa hace además una copia automática al día (y conserva las ${sesion.cat.config.copias.conservar} últimas) cuando lo abres.`),
  ]));

  const cols = [
    { t: "Copia", c: (c) => h("b", null, c.nombre) }, { t: "Tipo", c: (c) => chip({ copia: "Manual", auto: "Automática", "antes-de-restaurar": "Antes de restaurar", subida: "Subida" }[c.tipo] || c.tipo, c.tipo === "copia" ? "verde" : "gris") },
    { t: "Fecha", c: (c) => sello(c.modificada) }, { t: "Tamaño", num: true, c: (c) => kb(c.bytes) },
    { t: "Acciones", sinEtq: true, c: (c) => h("span", { class: "chips" },
      boton("Descargar", { clase: "peq", href: api.urlDescarga(`/api/copias/${c.nombre}/descargar`) }),
      boton("Restaurar", { clase: "peq", onclick: async () => { try { mostrarRestauracion(await api.get(`/api/copias/${c.nombre}`)); } catch (e) { toastError(e); } } }),
      boton("Eliminar", { clase: "peq borde-peligro", onclick: async () => { if (await confirmar({ titulo: "Eliminar copia", mensaje: `Se borrará ${c.nombre}.`, textoOk: "Eliminar", peligro: true })) { await conAviso(() => api.del(`/api/copias/${c.nombre}`)); refrescar(); } } })) },
  ];
  const tablaEl = r.copias.length ? h("div", { class: "tabla-caja" }, h("table", { class: "tabla" }, h("thead", null, h("tr", null, cols.map((c) => h("th", { class: c.num ? "num" : "" }, c.t)))),
    h("tbody", null, r.copias.map((c) => h("tr", null, cols.map((k) => h("td", { "data-label": k.t, class: `${k.num ? "num" : ""} ${k.sinEtq ? "sin-etq" : ""}`.trim() }, k.c(c)))))))) : vacio("Aún no hay copias", "Pulsa «Hacer una copia de seguridad ahora».");
  cont.append(panel("Copias guardadas", tablaEl, { sinPadding: true }));
  cont.append(h("p", { class: "ayuda" }, "Los ficheros de la copia se pueden abrir con cualquier programa de ZIP: dentro hay «manifiesto.json» (qué contiene), «captao.sqlite» (la base de datos) y la carpeta «archivos»."));

  function mostrarRestauracion(s) {
    const campo = h("input", { type: "text", placeholder: "RESTAURAR", "aria-label": "Escribe RESTAURAR para confirmar", autocomplete: "off" });
    const ok = boton("Sustituir mis datos por esta copia", { clase: "peligro", deshabilitado: true, onclick: async () => {
      ok.disabled = true;
      try {
        const res = await api.post("/api/copias/restaurar", { nombre: s.nombre, confirmar: true });
        d.cerrar(true); await cargarCatalogos(true);
        toast(`Copia restaurada. Se guardó antes una copia de lo anterior: ${res.copia_previa}.`, { ms: 10000 }); location.hash = "#/inicio"; refrescar();
      } catch (e) { ok.disabled = false; toastError(e); }
    } });
    campo.addEventListener("input", () => { ok.disabled = campo.value.trim() !== "RESTAURAR"; });
    const rc = s.recuentos || {};
    const d = abrirDialogo({
      titulo: "Restaurar una copia de seguridad", clase: "estrecho",
      cuerpo: [
        aviso("bloqueo", h("b", null, "Esto sustituye TODOS tus datos actuales"), " por los de la copia. Antes se guarda automáticamente una copia de lo que tienes ahora, por si te arrepientes."),
        s.vacia ? aviso("aviso", h("b", null, "Esta copia no contiene ningún dato."), " Si la restauras, tu CRM quedará vacío.") : null,
        datosLista([["Archivo", s.nombre], ["Creada", sello(s.creada_en)], ["Contactos", rc.contactos ?? "—"], ["Oportunidades", rc.oportunidades ?? "—"], ["Inmuebles", rc.inmuebles ?? "—"], ["Demandas", rc.demandas ?? "—"], ["Tareas", rc.tareas ?? "—"], ["Archivos adjuntos", s.archivos ?? 0]]),
        h("p", { style: { margin: "14px 0 6px" } }, "Para confirmarlo escribe ", h("b", null, "RESTAURAR"), ":"), campo],
      pie: [boton("Cancelar", { onclick: () => d.cerrar(null) }), ok],
    });
  }
}

function datos(cont, estado) {
  const ent = [["contactos", "Contactos"], ["oportunidades", "Oportunidades"], ["inmuebles", "Inmuebles"], ["demandas", "Demandas"], ["tareas", "Tareas"], ["actividades", "Actividades"]];
  cont.append(panel("Exportar datos a CSV", [
    h("p", { style: { marginTop: 0 } }, "Archivos CSV que se abren en Excel (UTF-8, separador «;»). Contienen datos personales: guárdalos con cuidado."),
    h("div", { class: "chips" }, ent.map(([k, t]) => { const a = boton(t, { icono: "descargar", href: api.urlDescarga(`/api/exportar/${k}`) }); a.setAttribute("download", ""); return a; })),
    h("p", { class: "ayuda" }, "Versión sin teléfonos, correos, direcciones ni textos libres:"),
    h("div", { class: "chips" }, ent.map(([k, t]) => { const a = boton(t, { clase: "peq", href: api.urlDescarga(`/api/exportar/${k}`, { sin_personales: "1" }) }); a.setAttribute("download", ""); return a; })),
    h("p", { class: "ayuda" }, "La importación de CSV con vista previa, relación de columnas y detección de duplicados llega en la Fase 2."),
  ]));
  cont.append(panel("Dónde están tus datos", [
    datosLista([["Carpeta de datos", h("code", null, estado.ubicacion_datos), true], ["Versión del programa", `${estado.version} (esquema de datos ${estado.esquema})`], ["Node.js", estado.node]]),
    h("p", { class: "ayuda" }, "La base de datos es un fichero SQLite real. Los datos NO se guardan en el navegador: borrar el historial del navegador no los afecta. Los archivos adjuntos (Fase 2) irán en la subcarpeta «archivos»."),
  ]));
  const notif = h("span");
  const estadoNotif = () => (window.Notification ? ({ granted: "Activados", denied: "Bloqueados en el navegador", default: "Sin activar" })[Notification.permission] : "No disponibles en este navegador");
  notif.textContent = estadoNotif();
  cont.append(panel("Recordatorios", [
    h("p", { style: { marginTop: 0 } }, "Los recordatorios son internos: aparecen en pantalla (y, si los activas, como aviso del navegador) ", h("b", null, "solo mientras esta aplicación está abierta"), ". No se envían correos, SMS ni WhatsApp, ni funcionan con la aplicación cerrada."),
    h("p", null, "Avisos del navegador: ", h("b", null, notif)),
    window.Notification && Notification.permission === "default" ? boton("Activar avisos del navegador", { onclick: async () => { await Notification.requestPermission(); notif.textContent = estadoNotif(); } }) : null,
  ]));
  cont.append(panel("Privacidad y seguridad (resumen)", h("ul", { style: { margin: 0, paddingLeft: "18px", lineHeight: "1.7" } },
    h("li", null, "El programa escucha solo en este ordenador (127.0.0.1): no es accesible desde la red ni desde Internet."),
    h("li", null, "Es de un solo usuario y sin contraseña. ", h("b", null, "No está pensado para exponerse a Internet"), ": antes de acceso remoto o varios usuarios hacen falta autenticación, roles, HTTPS, alojamiento y copias (Fase 4)."),
    h("li", null, "Se guarda la procedencia de los datos de contacto, la base y la evidencia de cada canal, y un historial de cambios que no copia los datos personales."),
    h("li", null, "Hay anonimización y borrado por contacto. «No contactar» bloquea de verdad."),
    h("li", null, h("b", null, "Nada de esto garantiza por sí solo el cumplimiento legal"), " (RGPD, LSSI…): son registros y bloqueos de ayuda. Consúltalo con tu asesor."))));
}

function demo(cont) {
  cont.append(panel("Datos de demostración", [
    h("p", { style: { marginTop: 0 } }, "La demostración usa una base de datos ", h("b", null, "distinta"), " con datos ficticios (personas inventadas, teléfonos 600 000 1xx, correos @example.com). No se mezcla con tus datos reales y las copias de seguridad nunca la incluyen."),
    sesion.modo === "demo" ? aviso("aviso", "Ahora mismo estás en la demostración. Usa el botón naranja de arriba para volver a tus datos reales.") : h("p", null, "Usa «Probar con datos de demostración» en el menú lateral para entrar. Una franja naranja te recordará siempre dónde estás."),
  ]));
}

function acerca(cont, estado) {
  const si = (t) => h("li", null, chip("Hecho", "verde", { punto: false }), " ", t);
  const no = (t, f) => h("li", null, chip(`Fase ${f}`, "gris", { punto: false }), " ", t);
  cont.append(panel(`CAPTAOPORTUNIDADES ASTURIAS · versión ${estado.version}`, [
    h("h3", null, "Funciona ya (Fase 1)"),
    h("ul", { style: { lineHeight: "1.9" } },
      si("Base de datos persistente (SQLite) con contactos, oportunidades, inmuebles, propietarios, encargos, demandas, tareas, actividades e historial de cambios."),
      si("Oportunidades con los 12 estados, reglas de avance y «Confirmar encargo» que crea el inmueble sin duplicar."),
      si("Contactos con roles múltiples, duplicados avisados (nunca fusionados solos), habilitación de comunicaciones por canal y «No contactar» con efecto real."),
      si("Cartera con historial de precios, varios propietarios, ubicación pública distinta de la dirección interna y datos pendientes de confirmar."),
      si("Compradores y demandas, con aviso de caducidad y sin dar por aprobada una financiación sin evidencia."),
      si("Agenda (hoy, semana, pendientes, vencidas, calendario) con recordatorios internos reales."),
      si("Buscador global, filtros, exportación a CSV, copias de seguridad completas y restauración, y modo demostración separado.")),
    h("h3", null, "Todavía no existe"),
    h("ul", { style: { lineHeight: "1.9" } },
      no("Visitas, ofertas, operaciones, documentos y fotografías; cruce demanda↔cartera; importación CSV.", 2),
      no("Informes, marketing, dosieres, plantillas, generador de prompts para Claude, logotipo.", 3),
      no("Varios usuarios, acceso remoto, IA por API, mensajería. Y nunca: scraping de portales, captcha, mensajes o llamadas automáticas.", 4)),
    h("p", { class: "ayuda" }, "Limitaciones de esta versión: un solo usuario, sin contraseña, solo en este ordenador; avisos solo con la aplicación abierta; SQLite integrado en Node (marcado «experimental» en Node 22)."),
  ]));
}

export async function vista(cont, { partes }) {
  const seccion = SECCIONES.some(([k]) => k === partes[1]) ? partes[1] : "general";
  const estado = await api.get("/api/estado");
  cont.append(cabecera({ titulo: "Configuración", subtitulo: "Tu inmobiliaria, los catálogos, las copias de seguridad y los datos." }));
  cont.append(h("nav", { class: "tabs", "aria-label": "Secciones de configuración" }, SECCIONES.map(([k, t]) => h("a", { href: `#/configuracion/${k}`, "aria-current": k === seccion ? "page" : undefined }, t))));
  const f = { tipo: sessionStorage.getItem("captao.cat") || "municipio" };
  const zona = h("div");
  cont.append(zona);
  if (seccion === "general") general(zona);
  else if (seccion === "referencias") referencias(zona);
  else if (seccion === "catalogos") await catalogos(zona, { get tipo() { return f.tipo; }, set tipo(v) { f.tipo = v; try { sessionStorage.setItem("captao.cat", v); } catch { /* sin almacenamiento */ } } });
  else if (seccion === "copias") await copias(zona);
  else if (seccion === "datos") datos(zona, estado);
  else if (seccion === "demo") demo(zona);
  else acerca(zona, estado);
}

export { dialogoFormulario, etiqueta, chipDe, fecha };
