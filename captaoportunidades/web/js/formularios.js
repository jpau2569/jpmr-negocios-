// ============================================================================
//  Formularios de alta y edición de cada entidad + el diálogo genérico que
//  gestiona errores del servidor y avisos de duplicado.
// ============================================================================
import { h, abrirDialogo, boton, aviso, toast, hoyIso, nombreDe, eur, chip } from "./ui.js";
import { crearFormulario } from "./form.js";
import { api, ApiError, opciones, catalogoActivo, sesion, etiqueta } from "./api.js";

let nDlg = 0;

async function preguntarDuplicado(candidatos, mensaje) {
  return new Promise((resolve) => {
    let d;
    const lista = h("ul", { style: { paddingLeft: "18px" } }, candidatos.map((c) => h("li", null,
      h("b", null, c.nombre || c.identificador || c.referencia), " ",
      c.motivos ? `(${c.motivos.join(", ")})` : c.estado ? `· ${etiqueta("estados_oportunidad", c.estado)}` : "", " ",
      h("a", { href: c.identificador ? `#/oportunidades/${c.id}` : `#/contactos/${c.id}`, target: "_blank", rel: "noopener" }, "Abrir ficha"))));
    const seguir = boton("Es distinto: crear igualmente", { clase: "primario", onclick: () => d.cerrar(true) });
    const cancelar = boton("Cancelar, revisaré la ficha", { onclick: () => d.cerrar(false) });
    d = abrirDialogo({ titulo: "¿Ya lo tienes registrado?", clase: "estrecho", cuerpo: [h("p", { style: { marginTop: 0 } }, mensaje), lista], pie: [cancelar, seguir] });
    d.cerrado.then((v) => resolve(v === true));
  });
}

/**
 * Diálogo de formulario. `enviar(valores)` debe devolver el resultado (o lanzar ApiError).
 * Devuelve una promesa con ese resultado, o null si se cancela.
 */
export function dialogoFormulario({ titulo, campos, valores = {}, textoOk = "Guardar", enviar, clase = "", intro, pieExtra = [], alAbrir }) {
  return new Promise((resolve) => {
    const f = crearFormulario(campos, valores);
    f.el.id = `form-dlg-${++nDlg}`;
    const resumen = h("div");
    const ok = h("button", { type: "submit", class: "btn primario", form: f.el.id }, textoOk);
    const cancelar = boton("Cancelar", { onclick: () => d.cerrar(null) });
    const d = abrirDialogo({ titulo, clase, cuerpo: [intro || null, resumen, f.el], pie: [...pieExtra, cancelar, ok] });
    let resultado = null;
    d.cerrado.then(() => resolve(resultado));
    f.el.addEventListener("submit", () => intentar());
    alAbrir?.(f, d);
    f.foco();

    async function intentar(extra = {}) {
      f.limpiarErrores();
      resumen.replaceChildren();
      ok.disabled = true;
      try {
        const r = await enviar({ ...f.leer(), ...extra }, f);
        resultado = r ?? true;
        d.cerrar(resultado);
      } catch (e) {
        ok.disabled = false;
        if (!(e instanceof ApiError)) { resumen.append(aviso("bloqueo", String(e.message || e))); return; }
        if (e.codigo === "duplicado_posible") {
          if (await preguntarDuplicado(e.extra.candidatos, e.message)) return intentar({ confirmar_duplicado: true });
          return;
        }
        const sueltos = f.mostrarErrores(e.campos);
        const extraTxt = Object.entries(sueltos).map(([k, m]) => m);
        resumen.append(aviso("bloqueo", e.message, ...(extraTxt.length > 1 ? [h("ul", null, extraTxt.map((m) => h("li", null, m)))] : [])));
        d.cuerpo.scrollTo?.({ top: 0 });
      }
    }
  });
}

// ----------------------------------------------------------------- campos ----
const sino = (n, etq, extra = {}) => ({ n, t: "tri", etq, ancho: "tercio", ...extra });

export function camposContacto() {
  return [
    { n: "nombre", t: "texto", etq: "Nombre", req: true, ancho: "mitad", max: 120 },
    { n: "apellidos", t: "texto", etq: "Apellidos", ancho: "mitad", max: 160 },
    { n: "empresa", t: "texto", etq: "Empresa", ancho: "mitad", max: 160, ayuda: "Solo si actúa en nombre de una empresa." },
    { n: "canal_preferido", t: "select", etq: "Canal preferido", ancho: "mitad", op: opciones("canal_preferido") },
    { n: "telefono", t: "tel", etq: "Teléfono", ancho: "mitad" },
    { n: "email", t: "email", etq: "Correo electrónico", ancho: "mitad" },
    { t: "seccion", etq: "De dónde salen estos datos" },
    { n: "procedencia", t: "select", etq: "Procedencia de los datos", ancho: "mitad", op: opciones("procedencias"), ayuda: "Obligatoria si indicas teléfono o correo." },
    { n: "procedencia_detalle", t: "texto", etq: "Detalle de la procedencia", ancho: "mitad", max: 300, ayuda: "Obligatorio si eliges «Otra»." },
    { t: "seccion", etq: "Rol" },
    { n: "es_propietario", t: "check", etq: "Es propietario", ancho: "mitad" },
    { n: "es_comprador", t: "check", etq: "Es comprador", ancho: "mitad" },
    { t: "seccion", etq: "Solo lo que la persona haya manifestado" },
    { n: "motivo_venta", t: "largo", etq: "Motivo de venta", max: 1000, ayuda: "Anota solo lo que haya dicho la propia persona. No supongas ni infieras su situación personal." },
    { n: "plazo_venta", t: "select", etq: "Plazo previsto de venta", ancho: "mitad", op: opciones("plazos_venta") },
    { n: "notas", t: "largo", etq: "Notas", max: 4000 },
  ];
}

export function camposOportunidad({ crearContacto } = {}) {
  return [
    { n: "fuente", t: "select", etq: "Fuente", req: true, ancho: "mitad", op: catalogoActivo("fuente").map((x) => ({ valor: x, texto: x })), vacio: "— Elige la fuente —" },
    { n: "fecha_deteccion", t: "fecha", etq: "Fecha de detección", ancho: "mitad" },
    { n: "enlace", t: "url", etq: "Enlace del anuncio", ancho: "completo", ayuda: "Opcional. Solo enlaces que hayas obtenido de forma legítima." },
    { n: "tipo_inmueble", t: "select", etq: "Tipo de inmueble", req: true, ancho: "mitad", op: catalogoActivo("tipo_inmueble").map((x) => ({ valor: x, texto: x })), vacio: "— Elige el tipo —" },
    { n: "municipio", t: "texto", etq: "Municipio", req: true, ancho: "mitad", lista: catalogoActivo("municipio"), ayuda: "Los 78 concejos de Asturias; si no aparece, escríbelo." },
    { n: "zona", t: "texto", etq: "Zona o barrio", ancho: "mitad" },
    { n: "titulo", t: "texto", etq: "Título (opcional)", ancho: "mitad", max: 200 },
    { n: "precio_anunciado", t: "num", etq: "Precio anunciado (€)", ancho: "tercio", ph: "245000" },
    { n: "superficie_m2", t: "num", etq: "Superficie (m²)", ancho: "tercio" },
    { n: "habitaciones", t: "int", etq: "Habitaciones", ancho: "cuarto" },
    { n: "banos", t: "int", etq: "Baños", ancho: "cuarto" },
    { n: "caracteristicas", t: "largo", etq: "Características conocidas", max: 2000, ayuda: "Solo lo que figura en el anuncio o te han dicho." },
    { t: "seccion", etq: "Anunciante" },
    { n: "clasificacion_anunciante", t: "select", etq: "Clasificación del anunciante", ancho: "mitad", op: opciones("clasificacion_anunciante"), sinVacio: true },
    { n: "evidencia_clasificacion", t: "largo", etq: "Evidencia de esa clasificación", ancho: "mitad", filas: 2, max: 500, ayuda: "Obligatoria si no es «Sin verificar»." },
    { t: "seccion", etq: "Propietario y seguimiento" },
    { n: "contacto_id", t: "contacto", etq: "Propietario relacionado", ancho: "completo", rol: undefined, crear: crearContacto },
    { n: "responsable", t: "texto", etq: "Responsable", ancho: "mitad", max: 80 },
    { n: "proxima_accion_fecha", t: "fecha", etq: "Fecha de la próxima acción", ancho: "mitad" },
    { n: "proxima_accion", t: "texto", etq: "Próxima acción", ancho: "completo", max: 200 },
    { n: "notas", t: "largo", etq: "Notas", max: 4000 },
  ];
}

export function camposInmueble({ edicion = false } = {}) {
  return [
    { n: "referencia", t: "texto", etq: "Referencia", ancho: "mitad", max: 40, ayuda: edicion ? "Debe ser única." : "Déjala vacía y se asigna sola (INM-0001…)." },
    { n: "titulo", t: "texto", etq: "Título", ancho: "mitad", max: 200, ayuda: "Si lo dejas vacío se genera con el tipo y el municipio." },
    { n: "tipo", t: "select", etq: "Tipo de inmueble", req: true, ancho: "tercio", op: catalogoActivo("tipo_inmueble").map((x) => ({ valor: x, texto: x })), vacio: "— Elige el tipo —" },
    { n: "operacion", t: "select", etq: "Operación", ancho: "tercio", op: opciones("operaciones"), sinVacio: true },
    { n: "estado_comercial", t: "select", etq: "Estado comercial", ancho: "tercio", op: opciones("estados_comerciales"), sinVacio: true },
    { t: "seccion", etq: "Ubicación" },
    { n: "municipio", t: "texto", etq: "Municipio", req: true, ancho: "mitad", lista: catalogoActivo("municipio") },
    { n: "zona", t: "texto", etq: "Zona o barrio", ancho: "mitad" },
    { n: "direccion_interna", t: "texto", etq: "Dirección interna (no se publica)", ancho: "mitad", max: 300, ayuda: "Calle, número, piso. Solo para uso interno." },
    { n: "ubicacion_publica", t: "texto", etq: "Ubicación pública", ancho: "mitad", max: 200, ayuda: "Lo que puede verse en anuncios. No pongas la dirección exacta." },
    { t: "seccion", etq: "Características" },
    { n: "superficie_m2", t: "num", etq: "Superficie (m²)", ancho: "tercio" },
    { n: "tipo_superficie", t: "select", etq: "Tipo de superficie", ancho: "tercio", op: opciones("tipos_superficie"), sinVacio: true },
    { n: "planta", t: "texto", etq: "Planta", ancho: "tercio", max: 20 },
    { n: "habitaciones", t: "int", etq: "Habitaciones", ancho: "tercio" },
    { n: "banos", t: "int", etq: "Baños", ancho: "tercio" },
    { n: "estado_conservacion", t: "select", etq: "Estado", ancho: "tercio", op: opciones("estados_conservacion") },
    sino("ascensor", "Ascensor"), sino("garaje", "Garaje"), sino("terraza", "Terraza"),
    { n: "caracteristicas", t: "largo", etq: "Otras características", max: 2000 },
    { t: "seccion", etq: "Precio y textos" },
    { n: "precio_actual", t: "num", etq: "Precio actual (€)", ancho: "mitad" },
    ...(edicion ? [{ n: "motivo_precio", t: "texto", etq: "Motivo del cambio de precio", ancho: "mitad", max: 200, ayuda: "Opcional. Se guarda en el historial de precios." }] : []),
    { n: "descripcion_comercial", t: "largo", etq: "Descripción comercial", filas: 4, max: 5000, ayuda: "Solo datos confirmados. No ocultes defectos relevantes." },
    { n: "notas_internas", t: "largo", etq: "Notas internas", max: 5000 },
  ];
}

export function camposDemanda({ conComprador = true, crearContacto } = {}) {
  return [
    ...(conComprador ? [{ n: "contacto_id", t: "contacto", etq: "Comprador", req: true, ancho: "completo", crear: crearContacto }] : []),
    { n: "nombre", t: "texto", etq: "Nombre de la demanda", ancho: "mitad", max: 120, ayuda: "Por ejemplo: «Piso en Oviedo con ascensor»." },
    { n: "operacion", t: "select", etq: "Operación", ancho: "mitad", op: opciones("operaciones_demanda"), sinVacio: true },
    { n: "municipios", t: "multi", etq: "Municipios", lista: catalogoActivo("municipio"), ayuda: "Escribe y pulsa Intro. Puedes añadir varios." },
    { n: "zonas", t: "texto", etq: "Zonas o barrios", max: 300, ancho: "completo" },
    { n: "presupuesto_min", t: "num", etq: "Presupuesto mínimo (€)", ancho: "mitad" },
    { n: "presupuesto_max", t: "num", etq: "Presupuesto máximo (€)", ancho: "mitad" },
    { n: "tipos", t: "multi", etq: "Tipos de inmueble", lista: catalogoActivo("tipo_inmueble") },
    { n: "superficie_min", t: "num", etq: "Superficie mínima (m²)", ancho: "tercio" },
    { n: "habitaciones_min", t: "int", etq: "Habitaciones mínimas", ancho: "tercio" },
    { n: "banos_min", t: "int", etq: "Baños mínimos", ancho: "tercio" },
    { n: "ascensor", t: "select", etq: "Ascensor", ancho: "tercio", op: opciones("nivel_requisito"), sinVacio: true },
    { n: "garaje", t: "select", etq: "Garaje", ancho: "tercio", op: opciones("nivel_requisito"), sinVacio: true },
    { n: "terraza", t: "select", etq: "Terraza", ancho: "tercio", op: opciones("nivel_requisito"), sinVacio: true },
    { n: "estados_aceptables", t: "checks", etq: "Estado aceptable del inmueble", op: opciones("estados_conservacion").filter((o) => o.valor !== "desconocido") },
    { n: "requisitos_imprescindibles", t: "largo", etq: "Requisitos imprescindibles", filas: 2, max: 1000 },
    { n: "preferencias", t: "largo", etq: "Preferencias", filas: 2, max: 1000 },
    { t: "seccion", etq: "Plazo y financiación" },
    { n: "plazo_compra", t: "select", etq: "Plazo de compra", ancho: "mitad", op: opciones("plazos_compra"), sinVacio: true },
    { n: "financiacion", t: "select", etq: "Situación de financiación", ancho: "mitad", op: opciones("financiacion"), sinVacio: true, ayuda: "Lo manifestado por el cliente no está acreditado." },
    { n: "financiacion_evidencia", t: "largo", etq: "Evidencia de la financiación", filas: 2, max: 500, ayuda: "Obligatoria solo si eliges «aprobada y acreditada»." },
    { n: "estado", t: "select", etq: "Estado de la demanda", ancho: "mitad", op: opciones("estados_demanda"), sinVacio: true },
    { n: "motivo_cierre", t: "texto", etq: "Motivo de cierre", ancho: "mitad", max: 300, ayuda: "Obligatorio si la cierras." },
  ];
}

const AVISOS = [["", "Sin aviso"], ["0", "A la hora"], ["15", "15 minutos antes"], ["30", "30 minutos antes"], ["60", "1 hora antes"], ["1440", "1 día antes"]];
export function camposTarea({ edicion = false, etiquetaRelacion } = {}) {
  return [
    { n: "titulo", t: "texto", etq: "Qué hay que hacer", req: true, max: 200 },
    ...(etiquetaRelacion ? [{ t: "seccion", etq: `Relacionada con: ${etiquetaRelacion}` }] : []),
    { n: "tipo", t: "select", etq: "Tipo", ancho: "tercio", op: opciones("tipos_tarea").filter((o) => o.valor !== "vencimiento_encargo" || edicion), sinVacio: true },
    { n: "fecha", t: "fecha", etq: "Fecha", req: true, ancho: "tercio" },
    { n: "hora", t: "hora", etq: "Hora", ancho: "tercio" },
    { n: "aviso_min", t: "select", etq: "Recordatorio", ancho: "tercio", op: AVISOS.slice(1).map(([valor, texto]) => ({ valor, texto })), vacio: "Sin aviso", ayuda: "Avisa mientras tengas la aplicación abierta." },
    { n: "prioridad", t: "select", etq: "Prioridad", ancho: "tercio", op: opciones("prioridades"), sinVacio: true },
    ...(edicion ? [{ n: "estado", t: "select", etq: "Estado", ancho: "tercio", op: opciones("estados_tarea"), sinVacio: true }] : []),
    { n: "responsable", t: "texto", etq: "Responsable", ancho: "tercio", max: 80 },
    { n: "notas", t: "largo", etq: "Notas", max: 2000 },
  ];
}

export function camposActividad() {
  return [
    { n: "tipo", t: "select", etq: "Tipo", req: true, ancho: "tercio", op: opciones("tipos_actividad"), sinVacio: true },
    { n: "direccion", t: "select", etq: "Quién contactó", ancho: "tercio", op: opciones("direcciones"), sinVacio: true },
    { n: "fecha", t: "fecha", etq: "Fecha", req: true, ancho: "tercio" },
    { n: "hora", t: "hora", etq: "Hora", ancho: "tercio" },
    { n: "resultado", t: "texto", etq: "Resultado", ancho: "mitad", max: 300, ayuda: "Por ejemplo: «le interesa una valoración»." },
    { n: "resumen", t: "largo", etq: "Qué se habló o qué ha pasado", req: true, max: 2000, filas: 4, ayuda: "Resume solo hechos. Evita datos sensibles que no hagan falta." },
  ];
}

// --------------------------------------------------------------- aperturas ----
const sinVacios = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v]));

export async function nuevoContacto(defecto = {}) {
  return dialogoFormulario({
    titulo: "Nuevo contacto", campos: camposContacto(), valores: { es_propietario: false, ...defecto },
    textoOk: "Crear contacto",
    enviar: (v) => api.post("/api/contactos", v),
  });
}
export async function editarContacto(c) {
  return dialogoFormulario({
    titulo: "Editar contacto", campos: camposContacto(), valores: c, enviar: (v) => api.put(`/api/contactos/${c.id}`, { ...v, version: c.actualizado_en }),
  });
}

export async function nuevaOportunidad(defecto = {}) {
  const campos = camposOportunidad({ crearContacto: (q) => nuevoContacto({ nombre: q, es_propietario: true }) });
  return dialogoFormulario({
    titulo: "Nueva oportunidad", campos, clase: "ancho", textoOk: "Registrar oportunidad",
    valores: { fecha_deteccion: hoyIso(), clasificacion_anunciante: "sin_verificar", responsable: sesion.cat.config.usuario.nombre, ...defecto },
    intro: aviso("info", "Registra solo datos obtenidos de forma legítima. El programa no rastrea portales ni extrae teléfonos: tú anotas lo que has visto."),
    enviar: (v) => api.post("/api/oportunidades", v),
  });
}
export async function editarOportunidad(o) {
  const campos = camposOportunidad({ crearContacto: (q) => nuevoContacto({ nombre: q, es_propietario: true }) });
  return dialogoFormulario({
    titulo: `Editar ${o.identificador}`, campos, clase: "ancho",
    valores: { ...o, contacto_id: o.contacto?.id ?? null, contacto_id__etq: o.contacto?.nombre_completo }, enviar: (v) => api.put(`/api/oportunidades/${o.id}`, { ...v, version: o.actualizado_en }),
  });
}

export async function nuevoInmueble(defecto = {}) {
  return dialogoFormulario({ titulo: "Nuevo inmueble", campos: camposInmueble(), clase: "ancho", valores: { operacion: "venta", estado_comercial: "en_preparacion", tipo_superficie: "desconocida", ...defecto }, textoOk: "Crear inmueble", enviar: (v) => api.post("/api/inmuebles", v) });
}
export async function editarInmueble(i) {
  return dialogoFormulario({ titulo: `Editar ${i.referencia}`, campos: camposInmueble({ edicion: true }), clase: "ancho", valores: i, enviar: (v) => api.put(`/api/inmuebles/${i.id}`, { ...v, version: i.actualizado_en }) });
}

export async function nuevaDemanda(defecto = {}) {
  const campos = camposDemanda({ crearContacto: (q) => nuevoContacto({ nombre: q, es_comprador: true }) });
  return dialogoFormulario({
    titulo: "Nueva demanda de comprador", campos, clase: "ancho", textoOk: "Crear demanda",
    valores: { operacion: "compra", ascensor: "indiferente", garaje: "indiferente", terraza: "indiferente", plazo_compra: "desconocido", financiacion: "no_indicada", estado: "activa", ...defecto },
    enviar: (v) => api.post("/api/demandas", v),
  });
}
export async function editarDemanda(d) {
  return dialogoFormulario({
    titulo: "Editar demanda", campos: camposDemanda({ conComprador: false }), clase: "ancho", valores: d,
    enviar: (v) => api.put(`/api/demandas/${d.id}`, { ...v, version: d.actualizado_en }),
  });
}

export async function nuevaTarea(defecto = {}, rel = {}, etiquetaRelacion) {
  return dialogoFormulario({
    titulo: "Nueva tarea", campos: camposTarea({ etiquetaRelacion }), textoOk: "Crear tarea",
    valores: { tipo: "seguimiento", fecha: hoyIso(), prioridad: "media", responsable: sesion.cat.config.usuario.nombre, aviso_min: "", ...defecto },
    enviar: async (v) => {
      const r = await api.post("/api/tareas", { ...v, aviso_min: v.aviso_min === "" ? null : v.aviso_min, ...rel });
      for (const a of r.avisos || []) toast(a, { tipo: "aviso", ms: 8000 });
      return r;
    },
  });
}
export async function editarTarea(t, etiquetaRelacion) {
  return dialogoFormulario({
    titulo: "Editar tarea", campos: camposTarea({ edicion: true, etiquetaRelacion }), valores: { ...t, aviso_min: t.aviso_min === null || t.aviso_min === undefined ? "" : String(t.aviso_min) },
    enviar: async (v) => {
      const r = await api.put(`/api/tareas/${t.id}`, { ...v, aviso_min: v.aviso_min === "" ? null : v.aviso_min, version: t.actualizado_en });
      for (const a of r.avisos || []) toast(a, { tipo: "aviso", ms: 8000 });
      return r;
    },
  });
}

export async function nuevaActividad(rel, etiquetaRelacion) {
  return dialogoFormulario({
    titulo: "Registrar actividad", campos: camposActividad(), textoOk: "Guardar actividad",
    intro: etiquetaRelacion ? h("p", { style: { marginTop: 0 } }, "Relacionada con: ", h("b", null, etiquetaRelacion)) : null,
    valores: { tipo: "llamada", direccion: "saliente", fecha: hoyIso() },
    enviar: async (v) => {
      const r = await api.post("/api/actividades", { ...v, ...rel });
      for (const a of r.avisos || []) toast(a, { tipo: "aviso", ms: 9000 });
      return r;
    },
  });
}

export { sinVacios, eur, chip, nombreDe };
