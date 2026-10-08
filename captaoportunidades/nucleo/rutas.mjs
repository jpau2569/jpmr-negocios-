// ============================================================================
//  Tabla de rutas de la API (/api/...). Cada manejador recibe un objeto con:
//    app, modo ('real'|'demo'), ctx() (contexto de datos), params, query, body, req
//  y devuelve un objeto (se envía como JSON), o una `Respuesta` para casos
//  especiales (201, descargas…). Los errores de negocio son ErrorApp.
// ============================================================================
import path from "node:path";
import * as contactos from "./contactos.mjs";
import * as oportunidades from "./oportunidades.mjs";
import * as inmuebles from "./inmuebles.mjs";
import * as demandas from "./demandas.mjs";
import * as tareas from "./tareas.mjs";
import * as actividades from "./actividades.mjs";
import * as config from "./config.mjs";
import * as auditoria from "./auditoria.mjs";
import * as copias from "./copias.mjs";
import { buscar } from "./busqueda.mjs";
import { panel } from "./inicio.mjs";
import { exportarCsv } from "./exportar.mjs";
import { enumeraciones } from "./catalogos.mjs";
import { noEncontrado, invalido, conflicto, hoy } from "./util.mjs";

export class Respuesta {
  constructor(estado, cuerpo = null, { tipo = "application/json; charset=utf-8", cabeceras = {}, archivo = null } = {}) {
    Object.assign(this, { estado, cuerpo, tipo, cabeceras, archivo });
  }
}
const creado = (cuerpo) => new Respuesta(201, cuerpo);

export const RUTAS = [];
function r(metodo, patron, manejador, opciones = {}) {
  const nombres = [];
  const regex = new RegExp("^" + patron.replace(/:([a-z_]+)/g, (_, n) => { nombres.push(n); return "([^/]+)"; }) + "/?$");
  RUTAS.push({ metodo, patron, regex, nombres, manejador, ...opciones });
}

const id = (c, nombre = "id") => {
  const n = Number(c.params[nombre]);
  if (!Number.isInteger(n) || n <= 0) throw noEncontrado("El registro");
  return n;
};
const soloReal = (c) => {
  if (c.modo === "demo") throw conflicto("no_disponible_en_demo", "Las copias de seguridad solo existen para los datos reales. Sal del modo demostración para usarlas.");
};
const bool = (v) => v === true || v === "1" || v === "true";

// ---------------------------------------------------------------- general ----
r("GET", "/api/estado", (c) => {
  const ctx = c.ctx();
  const esDemo = Boolean(ctx.bd.valor("SELECT 1 FROM configuracion WHERE clave = 'demo'"));
  return {
    app: "captaoportunidades", nombre: "CAPTAOPORTUNIDADES ASTURIAS", version: c.app.version, fase: 1,
    modo: c.modo, demo: esDemo, fecha: hoy(c.app.reloj), esquema: ctx.bd.version(), node: process.version,
    ubicacion_datos: c.modo === "real" ? c.app.dirs.datos : "(base de demostración, separada de los datos reales)",
    mantenimiento: c.app.mantenimiento,
  };
});
r("GET", "/api/catalogos", (c) => {
  const ctx = c.ctx();
  return { enumeraciones: enumeraciones(), catalogos: config.todosLosCatalogos(ctx), config: ctx.config() };
});
r("GET", "/api/inicio", (c) => panel(c.ctx(), { copia: c.modo === "real" ? copias.estadoCopias(c.app) : null }));
r("GET", "/api/buscar", (c) => buscar(c.ctx(), c.query.q));
r("GET", "/api/historial", (c) => {
  const entidades = ["contacto", "oportunidad", "inmueble", "demanda", "tarea", "encargo", "configuracion"];
  if (!entidades.includes(c.query.entidad)) throw invalido("Entidad no válida.");
  return { datos: auditoria.historial(c.ctx(), c.query.entidad, Number(c.query.id) || 0, 200) };
});

// -------------------------------------------------------------- contactos ----
r("GET", "/api/contactos", (c) => contactos.listar(c.ctx(), c.query));
r("POST", "/api/contactos", (c) => creado(contactos.crear(c.ctx(), c.body, { confirmar_duplicado: c.body?.confirmar_duplicado === true })));
r("POST", "/api/contactos/duplicados", (c) => ({ candidatos: contactos.buscarDuplicados(c.ctx(), c.body || {}, Number(c.body?.excluir_id) || null) }));
r("GET", "/api/contactos/:id", (c) => contactos.obtener(c.ctx(), id(c)));
r("PUT", "/api/contactos/:id", (c) => contactos.actualizarContacto(c.ctx(), id(c), c.body, { confirmar_duplicado: c.body?.confirmar_duplicado === true }));
r("DELETE", "/api/contactos/:id", (c) => contactos.eliminar(c.ctx(), id(c)));
r("POST", "/api/contactos/:id/anonimizar", (c) => contactos.anonimizar(c.ctx(), id(c), { confirmar_perdida_bloqueo: c.body?.confirmar_perdida_bloqueo === true }));
r("PUT", "/api/contactos/:id/comunicaciones", (c) => ({ comunicaciones: contactos.guardarHabilitaciones(c.ctx(), id(c), c.body?.canales) }));
r("POST", "/api/contactos/:id/no-contactar", (c) => contactos.marcarNoContactar(c.ctx(), id(c), c.body));
r("POST", "/api/contactos/:id/levantar-no-contactar", (c) => contactos.levantarNoContactar(c.ctx(), id(c), c.body));

// ---------------------------------------------------------- oportunidades ----
r("GET", "/api/oportunidades", (c) => oportunidades.listar(c.ctx(), c.query));
r("POST", "/api/oportunidades", (c) => creado(oportunidades.crear(c.ctx(), c.body, { confirmar_duplicado: c.body?.confirmar_duplicado === true })));
r("GET", "/api/oportunidades/:id", (c) => oportunidades.obtener(c.ctx(), id(c)));
r("PUT", "/api/oportunidades/:id", (c) => oportunidades.actualizarOportunidad(c.ctx(), id(c), c.body, { confirmar_duplicado: c.body?.confirmar_duplicado === true }));
r("DELETE", "/api/oportunidades/:id", (c) => oportunidades.eliminar(c.ctx(), id(c)));
r("POST", "/api/oportunidades/:id/estado", (c) => oportunidades.cambiarEstado(c.ctx(), id(c), c.body));
r("GET", "/api/oportunidades/:id/encargo-previa", (c) => oportunidades.previsualizarEncargo(c.ctx(), id(c)));
r("POST", "/api/oportunidades/:id/confirmar-encargo", (c) => oportunidades.confirmarEncargo(c.ctx(), id(c), c.body));

// -------------------------------------------------------------- inmuebles ----
r("GET", "/api/inmuebles", (c) => inmuebles.listar(c.ctx(), c.query));
r("POST", "/api/inmuebles", (c) => creado(inmuebles.crear(c.ctx(), c.body)));
r("GET", "/api/inmuebles/:id", (c) => inmuebles.obtener(c.ctx(), id(c)));
r("PUT", "/api/inmuebles/:id", (c) => inmuebles.actualizarInmueble(c.ctx(), id(c), c.body));
r("DELETE", "/api/inmuebles/:id", (c) => inmuebles.eliminar(c.ctx(), id(c)));
r("POST", "/api/inmuebles/:id/propietarios", (c) => creado({ propietarios: inmuebles.anadirPropietario(c.ctx(), id(c), c.body) }));
r("DELETE", "/api/inmuebles/:id/propietarios/:contacto", (c) => ({ propietarios: inmuebles.quitarPropietario(c.ctx(), id(c), id(c, "contacto")) }));
r("POST", "/api/inmuebles/:id/confirmar-dato", (c) => inmuebles.confirmarDato(c.ctx(), id(c), c.body?.campo));
r("POST", "/api/inmuebles/:id/encargos", (c) => creado(inmuebles.crearEncargo(c.ctx(), id(c), c.body)));
r("PUT", "/api/encargos/:id", (c) => inmuebles.actualizarEncargo(c.ctx(), id(c), c.body));

// --------------------------------------------------------------- demandas ----
r("GET", "/api/demandas", (c) => demandas.listar(c.ctx(), c.query));
r("POST", "/api/demandas", (c) => creado(demandas.crear(c.ctx(), c.body)));
r("GET", "/api/demandas/:id", (c) => demandas.obtener(c.ctx(), id(c)));
r("PUT", "/api/demandas/:id", (c) => demandas.actualizarDemanda(c.ctx(), id(c), c.body));
r("DELETE", "/api/demandas/:id", (c) => demandas.eliminar(c.ctx(), id(c)));
r("POST", "/api/demandas/:id/confirmar-vigente", (c) => demandas.confirmarVigente(c.ctx(), id(c)));

// ------------------------------------------------------ actividades/tareas ----
r("GET", "/api/actividades", (c) => actividades.listar(c.ctx(), c.query));
r("POST", "/api/actividades", (c) => creado(actividades.crear(c.ctx(), c.body)));
r("PUT", "/api/actividades/:id", (c) => actividades.actualizarActividad(c.ctx(), id(c), c.body));
r("DELETE", "/api/actividades/:id", (c) => actividades.eliminar(c.ctx(), id(c)));

r("GET", "/api/tareas", (c) => tareas.listar(c.ctx(), c.query));
r("POST", "/api/tareas", (c) => creado(tareas.crear(c.ctx(), c.body)));
r("GET", "/api/tareas/:id", (c) => tareas.obtenerFila(c.ctx(), id(c)));
r("PUT", "/api/tareas/:id", (c) => tareas.actualizarTarea(c.ctx(), id(c), c.body));
r("DELETE", "/api/tareas/:id", (c) => tareas.eliminar(c.ctx(), id(c)));
r("POST", "/api/tareas/:id/completar", (c) => tareas.completar(c.ctx(), id(c)));
r("POST", "/api/tareas/:id/posponer", (c) => tareas.posponer(c.ctx(), id(c), c.body || {}));
r("POST", "/api/tareas/:id/aviso-visto", (c) => tareas.avisoVisto(c.ctx(), id(c)));
r("GET", "/api/recordatorios", (c) => tareas.recordatorios(c.ctx()));

// ---------------------------------------------------------- configuración ----
r("PUT", "/api/configuracion/:seccion", (c) => ({ config: config.guardarConfig(c.ctx(), c.params.seccion, c.body) }));
r("POST", "/api/catalogo/:tipo", (c) => creado(config.anadirCatalogo(c.ctx(), c.params.tipo, c.body?.etiqueta)));
r("PUT", "/api/catalogo/:id/activo", (c) => config.activarCatalogo(c.ctx(), id(c), c.body?.activo === true));

// -------------------------------------------------------------- exportar ----
r("GET", "/api/exportar/:entidad", (c) => {
  const e = exportarCsv(c.ctx(), c.params.entidad, { sin_personales: bool(c.query.sin_personales) });
  return new Respuesta(200, e.contenido, { tipo: "text/csv; charset=utf-8", cabeceras: { "content-disposition": `attachment; filename="${e.nombre}"` } });
});

// ------------------------------------------------------------------ copias ----
r("GET", "/api/copias", (c) => { soloReal(c); return { copias: copias.listarCopias(c.app), estado: copias.estadoCopias(c.app), carpeta: c.app.dirs.copias }; });
r("POST", "/api/copias", async (c) => { soloReal(c); return creado(await copias.crearCopia(c.app, { tipo: "copia" })); });
r("POST", "/api/copias/subir", async (c) => {
  soloReal(c);
  return creado(await copias.guardarSubida(c.app, c.req, { tamanoDeclarado: Number(c.req.headers["content-length"]) || 0 }));
}, { crudo: true });
r("POST", "/api/copias/restaurar", async (c) => {
  soloReal(c);
  if (c.body?.confirmar !== true) throw invalido("Falta la confirmación expresa para restaurar.", { confirmar: "Confirma que quieres sustituir los datos actuales." });
  return copias.restaurarCopia(c.app, String(c.body.nombre ?? ""));
});
r("GET", "/api/copias/:nombre/descargar", (c) => {
  soloReal(c);
  const ruta = copias.rutaCopia(c.app, c.params.nombre);
  return new Respuesta(200, null, { tipo: "application/zip", archivo: ruta, cabeceras: { "content-disposition": `attachment; filename="${path.basename(ruta)}"` } });
});
r("GET", "/api/copias/:nombre", async (c) => { soloReal(c); return copias.inspeccionarPorNombre(c.app, c.params.nombre); });
r("DELETE", "/api/copias/:nombre", async (c) => { soloReal(c); return copias.eliminarCopia(c.app, c.params.nombre); });

// ------------------------------------------------------------------- demo ----
r("POST", "/api/demo/restablecer", (c) => {
  if (c.modo !== "demo") throw conflicto("solo_demo", "Esta acción solo existe en el modo demostración: los datos reales nunca se restablecen.");
  c.app.restablecerDemo();
  return { restablecida: true };
});

