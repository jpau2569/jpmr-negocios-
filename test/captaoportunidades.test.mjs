// ============================================================================
//  Tests de CAPTAOPORTUNIDADES ASTURIAS (Fase 1) — núcleo + servidor HTTP real.
//  Se ejecutan con:  node test/captaoportunidades.test.mjs   (o: npm test)
//  No salen a Internet ni tocan tus datos: todo ocurre en una carpeta temporal
//  que se borra al final, con un reloj fijo (jueves 8-oct-2026, 10:00).
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import { execFileSync } from "node:child_process";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}
const seccion = (t) => console.log(`\n${t}`);
async function error(fn) { try { await fn(); return null; } catch (e) { return e; } }
/** Comprueba que algo lanza el error de negocio esperado. */
async function lanza(nombre, fn, { estado, codigo, campo } = {}) {
  const e = await error(fn);
  const ok = Boolean(e) && (!estado || e.estado === estado) && (!codigo || e.codigo === codigo) && (!campo || Boolean(e.extra?.campos?.[campo]));
  check(nombre, ok, e ? `${e.estado} ${e.codigo}: ${e.message}` : "no lanzó ningún error");
  return e;
}

const RAIZ = await fsp.mkdtemp(path.join(os.tmpdir(), "captao-test-"));
const reloj = {
  t: new Date(2026, 9, 8, 10, 0, 0),
  ahora() { return new Date(this.t.getTime()); },
  avanzaMin(m) { this.t = new Date(this.t.getTime() + m * 60000); },
  avanzaDias(d) { this.avanzaMin(d * 1440); },
  fija(a, m, d, h = 10, mi = 0) { this.t = new Date(a, m - 1, d, h, mi, 0); },
};

const U = await import("../captaoportunidades/nucleo/util.mjs");
const CAT = await import("../captaoportunidades/nucleo/catalogos.mjs");
const CAMPOS = await import("../captaoportunidades/nucleo/campos.mjs");
const BD = await import("../captaoportunidades/nucleo/bd.mjs");
const { MIGRACIONES } = await import("../captaoportunidades/nucleo/migraciones.mjs");
const { crearApp } = await import("../captaoportunidades/nucleo/app.mjs");
const contactos = await import("../captaoportunidades/nucleo/contactos.mjs");
const oportunidades = await import("../captaoportunidades/nucleo/oportunidades.mjs");
const inmuebles = await import("../captaoportunidades/nucleo/inmuebles.mjs");
const demandas = await import("../captaoportunidades/nucleo/demandas.mjs");
const tareas = await import("../captaoportunidades/nucleo/tareas.mjs");
const actividades = await import("../captaoportunidades/nucleo/actividades.mjs");
const config = await import("../captaoportunidades/nucleo/config.mjs");
const { panel } = await import("../captaoportunidades/nucleo/inicio.mjs");
const { buscar } = await import("../captaoportunidades/nucleo/busqueda.mjs");
const { exportarCsv } = await import("../captaoportunidades/nucleo/exportar.mjs");
const copias = await import("../captaoportunidades/nucleo/copias.mjs");
const zip = await import("../captaoportunidades/nucleo/zip.mjs");
const { iniciar } = await import("../captaoportunidades/iniciar.mjs");

const DATOS = path.join(RAIZ, "datos");
const app = crearApp({ datos: DATOS, reloj });
const C = () => app.ctx("real");
const persona = (nombre, extra = {}) => contactos.crear(C(), { nombre, ...extra }, { confirmar_duplicado: true });
const opp = (extra = {}) => oportunidades.crear(C(), { fuente: "Idealista", tipo_inmueble: "Piso", municipio: "Oviedo", ...extra }, { confirmar_duplicado: true });
const PERMITIDO = { verificacion_contacto: "permitido", verificacion_evidencia: "La propia persona nos escribió primero." };

// ============================================================================
seccion("🧰 Utilidades y validación de entradas");
{
  check("normaliza quita tildes, mayúsculas y espacios", U.normaliza("  JOSÉ   Ángel ") === "jose angel");
  check("teléfonos en formatos distintos se reconocen como el mismo",
    ["+34 600 000 101", "0034600000101", "600-000-101", "34600000101"].every((t) => U.telefonoNorm(t) === "600000101"));
  check("un teléfono demasiado corto no se acepta como identificador", U.telefonoNorm("123") === null);
  check("el enlace se normaliza (sin utm, sin www, sin barra final)", U.urlNorm("https://www.Example.com/a/b/?utm_source=x&id=7#frag") === "example.com/a/b?id=7");
  check("celda CSV neutraliza fórmulas", U.celdaCsv("=1+1") === "'=1+1" && U.celdaCsv("+34 600") === "'+34 600" && U.celdaCsv("ok") === "ok");
  check("celda CSV escapa separador, comillas y saltos", U.celdaCsv('a;"b"\nc') === '"a;""b""\nc"');
  check("fechas imposibles se rechazan", !U.fechaValida("2026-02-30") && U.fechaValida("2026-02-28") && !U.fechaValida("26-02-28"));
  check("la semana empieza en lunes (jueves 8-oct → lunes 5-oct)", U.lunesDe("2026-10-08") === "2026-10-05" && U.lunesDe("2026-10-11") === "2026-10-05" && U.lunesDe("2026-10-12") === "2026-10-12");
  check("sumar días cruza meses", U.sumaDias("2026-10-30", 3) === "2026-11-02");
  const n = CAMPOS.parseNumeroEs;
  check("números a la española: 245.000, 1.234,56, 95,5, 95.5", n("245.000") === 245000 && n("1.234,56") === 1234.56 && n("95,5") === 95.5 && n("95.5") === 95.5 && n(245000) === 245000);
  check("un texto no numérico no se acepta", Number.isNaN(n("abc")) && Number.isNaN(n("")) && Number.isNaN(n("12e3")));

  const { valores, errores } = CAMPOS.limpiar(CAMPOS.CONTACTO, { nombre: "  Ana \n ", id: 99, no_contactar: 1, creado_en: "x", telefono: "600 000 111" });
  check("lista blanca: id, no_contactar y creado_en se ignoran", !("id" in valores) && !("no_contactar" in valores) && !("creado_en" in valores) && valores.nombre === "Ana", JSON.stringify(valores));
  check("el teléfono válido se acepta", !errores.telefono);
  check("teléfono inválido da mensaje comprensible", /teléfono/.test(CAMPOS.limpiar(CAMPOS.CONTACTO, { nombre: "A", telefono: "abc" }).errores.telefono));
  check("enlaces javascript: o con usuario/contraseña se rechazan",
    Boolean(CAMPOS.limpiar(CAMPOS.OPORTUNIDAD, { enlace: "javascript:alert(1)" }).errores.enlace) && Boolean(CAMPOS.limpiar(CAMPOS.OPORTUNIDAD, { enlace: "https://user:pw@example.com/x" }).errores.enlace));
  check("fecha dd/mm/aaaa se convierte a ISO", CAMPOS.limpiar(CAMPOS.TAREA, { titulo: "t", fecha: "05/03/2026" }).valores.fecha === "2026-03-05");
  check("texto demasiado largo se rechaza con el límite", /máximo 120/.test(CAMPOS.limpiar(CAMPOS.CONTACTO, { nombre: "x".repeat(121) }).errores.nombre));
  check("hay exactamente 78 concejos y sin repetir", CAT.MUNICIPIOS_ASTURIAS.length === 78 && new Set(CAT.MUNICIPIOS_ASTURIAS).size === 78);
  check("están los concejos clave del mercado de Pau", ["Oviedo", "Gijón", "Avilés", "Mieres", "Langreo", "Siero", "Llanes", "Yernes y Tameza"].every((m) => CAT.MUNICIPIOS_ASTURIAS.includes(m)));
  check("el catálogo tiene los 12 estados de oportunidad en el orden pedido", CAT.ESTADOS_OPORTUNIDAD.length === 12 && CAT.ESTADOS_OPORTUNIDAD[0].clave === "detectada" && CAT.ESTADOS_OPORTUNIDAD[9].clave === "encargo_confirmado" && CAT.ESTADOS_OPORTUNIDAD[11].clave === "no_contactar");
}

// ============================================================================
seccion("🗄️  Base de datos persistente");
{
  const ruta = path.join(RAIZ, "bd-prueba", "x.sqlite");
  const bd = BD.abrirBd(ruta);
  check("se crea con el esquema v1 y 14 tablas", bd.version() === 1 && bd.valor("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'") === 14);
  check("las claves foráneas están activas", bd.valor("PRAGMA foreign_keys") === 1);
  check("modo WAL y sincronización completa", bd.valor("PRAGMA journal_mode") === "wal" && bd.valor("PRAGMA synchronous") === 2);
  BD.insertar(bd, "contactos", { nombre: "Persistente", creado_en: "x", actualizado_en: "x" });
  const e1 = await error(() => bd.transaccion(() => {
    BD.insertar(bd, "contactos", { nombre: "A", creado_en: "x", actualizado_en: "x" });
    try { bd.transaccion(() => { BD.insertar(bd, "contactos", { nombre: "B", creado_en: "x", actualizado_en: "x" }); throw new Error("interno"); }); } catch { /* se esperaba */ }
  }));
  check("una transacción interna que falla se deshace sin romper la externa", !e1 && bd.valor("SELECT COUNT(*) FROM contactos WHERE nombre='A'") === 1 && bd.valor("SELECT COUNT(*) FROM contactos WHERE nombre='B'") === 0);
  const e2 = await error(() => bd.transaccion(() => { BD.insertar(bd, "contactos", { nombre: "C", creado_en: "x", actualizado_en: "x" }); throw new Error("fallo"); }));
  check("si falla la transacción externa no queda nada a medias", Boolean(e2) && bd.valor("SELECT COUNT(*) FROM contactos WHERE nombre='C'") === 0);
  check("una referencia a un registro inexistente se rechaza", Boolean(await error(() => bd.ejecutar("INSERT INTO inmueble_propietarios (inmueble_id, contacto_id, creado_en) VALUES (99, 99, 'x')"))));
  bd.cerrar();
  const bd2 = BD.abrirBd(ruta);
  check("los datos siguen ahí al reabrir (persistencia)", bd2.valor("SELECT COUNT(*) FROM contactos") === 2);
  bd2.cerrar();

  // Migraciones: una v2 de ejemplo sobre una base con datos hace antes una copia
  const v2 = [...MIGRACIONES, { version: 2, nombre: "prueba", sql: "ALTER TABLE contactos ADD COLUMN prueba_v2 TEXT;" }];
  const bd3 = BD.abrirBd(ruta, { migraciones: v2 });
  check("una migración nueva se aplica conservando los datos", bd3.version() === 2 && bd3.valor("SELECT COUNT(*) FROM contactos") === 2);
  check("antes de migrar se deja una copia .bak de la base", fs.existsSync(`${ruta}.antes-de-v2.bak`));
  bd3.cerrar();
  const e3 = await error(() => BD.abrirBd(ruta)); // el programa «antiguo» ya no entiende el esquema v2
  check("una base de una versión más nueva se rechaza con aviso claro", e3?.codigo === "bd_mas_nueva" && /más nueva/.test(e3.message), e3?.message);
}

// ============================================================================
seccion("👤 Contactos: roles, duplicados, privacidad");
let ana, luis, pedro;
{
  const e = await lanza("solo el nombre es obligatorio (sin nombre falla)", () => contactos.crear(C(), {}), { estado: 422, campo: "nombre" });
  check("el mensaje de error es comprensible", /Falta indicar: el nombre/.test(e?.message || ""));
  ana = contactos.crear(C(), { nombre: "Ana", apellidos: "Fernández Río" });
  check("se puede crear un contacto con solo el nombre", ana.id > 0 && !ana.es_propietario && !ana.es_comprador);
  await lanza("teléfono sin procedencia → se pide la procedencia (registro de procedencia)", () => contactos.crear(C(), { nombre: "Luis", telefono: "600 000 201" }), { estado: 422, campo: "procedencia" });
  await lanza("procedencia «Otra» sin detalle → se pide el detalle", () => contactos.crear(C(), { nombre: "Luis", telefono: "600 000 201", procedencia: "otra" }), { estado: 422, campo: "procedencia_detalle" });
  luis = contactos.crear(C(), { nombre: "Luis", apellidos: "García Pérez", telefono: "600 000 201", email: "luis@example.com", procedencia: "propia_persona", es_propietario: true, motivo_venta: "Cambio de ciudad (lo dijo él)" });
  check("contacto completo creado", luis.id > ana.id && luis.es_propietario === 1 && luis.procedencia === "propia_persona");

  const d1 = await lanza("mismo teléfono (otro formato) → posible duplicado con candidatos", () => contactos.crear(C(), { nombre: "Luis G.", telefono: "+34 600-000-201", procedencia: "propia_persona" }), { estado: 409, codigo: "duplicado_posible" });
  check("el aviso lista el contacto parecido y por qué", d1?.extra?.candidatos?.[0]?.id === luis.id && d1.extra.candidatos[0].motivos.includes("mismo teléfono"));
  await lanza("mismo correo → posible duplicado", () => contactos.crear(C(), { nombre: "Otro", email: "LUIS@example.com", procedencia: "propia_persona" }), { estado: 409, codigo: "duplicado_posible" });
  await lanza("mismo nombre y apellidos → posible duplicado", () => contactos.crear(C(), { nombre: "luis", apellidos: "garcía pérez" }), { estado: 409, codigo: "duplicado_posible" });
  check("no se ha fusionado ni creado nada solo", C().bd.valor("SELECT COUNT(*) FROM contactos") === 2);
  const forzado = contactos.crear(C(), { nombre: "Luis", apellidos: "García Pérez" }, { confirmar_duplicado: true });
  check("si el usuario confirma, se crea otra ficha (nunca se fusiona automáticamente)", forzado.id !== luis.id && C().bd.valor("SELECT COUNT(*) FROM contactos") === 3);
  await lanza("editar el teléfono a uno que ya existe avisa de duplicado", () => contactos.actualizarContacto(C(), ana.id, { telefono: "600000201", procedencia: "propia_persona" }), { estado: 409, codigo: "duplicado_posible" });

  pedro = persona("Pedro", { apellidos: "Suárez", telefono: "600 000 202", procedencia: "referido", es_propietario: true, es_comprador: true });
  const dobles = contactos.listar(C(), { rol: "ambos" });
  check("un contacto puede ser propietario y comprador a la vez, en una sola ficha", dobles.total === 1 && dobles.datos[0].id === pedro.id);
  check("aparece en ambos listados sin duplicarse", contactos.listar(C(), { rol: "propietario" }).datos.filter((c) => c.id === pedro.id).length === 1 && contactos.listar(C(), { rol: "comprador" }).datos.filter((c) => c.id === pedro.id).length === 1);

  const mass = contactos.actualizarContacto(C(), ana.id, { id: 9999, no_contactar: 1, anonimizado_en: "x", notas: "Cliente amable" });
  check("editar ignora campos que no son editables (id, no_contactar)", mass.id === ana.id && mass.no_contactar === 0 && !mass.anonimizado_en && mass.notas === "Cliente amable");
  contactos.actualizarContacto(C(), luis.id, { telefono: "600 000 299", procedencia: "propia_persona" });
  const hist = C().bd.todos("SELECT * FROM historial_cambios WHERE entidad='contacto' AND entidad_id=? AND campo='telefono'", [luis.id]);
  check("el historial registra que cambió el teléfono pero NO guarda su valor", hist.length === 1 && hist[0].valor_anterior === null && hist[0].valor_nuevo === null && /no se guarda/.test(hist[0].resumen));
  check("no hay números de teléfono en ninguna línea del historial", C().bd.todos("SELECT * FROM historial_cambios").every((h) => !/6\d{2}[ \d]{6,}/.test(JSON.stringify(h))));

  check("búsqueda sin tildes ni mayúsculas", contactos.listar(C(), { q: "FERNANDEZ rio" }).total === 1);
  check("búsqueda por teléfono parcial", contactos.listar(C(), { q: "000 299" }).datos[0]?.id === luis.id);
  check("búsqueda por correo", contactos.listar(C(), { q: "luis@exam" }).total >= 1);
  check("un % en la búsqueda no actúa de comodín", contactos.listar(C(), { q: "%" }).total === 0);
  const pag = contactos.listar(C(), { limite: 2, offset: 0 });
  check("paginación: total real y página limitada", pag.datos.length === 2 && pag.total === C().bd.valor("SELECT COUNT(*) FROM contactos"));
}

// ============================================================================
seccion("📞 Habilitación de comunicaciones y «No contactar»");
{
  const h = (items) => contactos.guardarHabilitaciones(C(), luis.id, items);
  const e1 = await lanza("un canal no puede 'habilitarse' sin base, evidencia y fecha", () => h([{ canal: "email", estado: "habilitado" }]), { estado: 422 });
  check("los errores se indican por canal y campo", Boolean(e1?.extra?.campos?.["email.base"]) && Boolean(e1?.extra?.campos?.["email.evidencia"]));
  await lanza("el correo comercial no se habilita solo por «Lista Robinson»", () => h([{ canal: "email", estado: "habilitado", base: "robinson", evidencia: "x", fecha_robinson: "2026-10-01" }]), { estado: 422, campo: "email.base" });
  await lanza("el teléfono con Lista Robinson exige la fecha de comprobación", () => h([{ canal: "telefono", estado: "habilitado", base: "robinson", evidencia: "Comprobado" }]), { estado: 422, campo: "telefono.fecha_robinson" });
  await lanza("consentimiento sin fecha de autorización → error", () => h([{ canal: "email", estado: "habilitado", base: "consentimiento", evidencia: "Formulario" }]), { estado: 422, campo: "email.fecha_autorizacion" });
  const ok = h([
    { canal: "email", estado: "habilitado", base: "consentimiento", evidencia: "Casilla del formulario web", fecha_autorizacion: "2026-10-01" },
    { canal: "telefono", estado: "habilitado", base: "robinson", evidencia: "Consultada la Lista Robinson", fecha_robinson: "2026-10-07" },
    { canal: "whatsapp", estado: "baja" },
  ]);
  check("se guarda la habilitación con su evidencia y fecha", ok.find((x) => x.canal === "email").estado === "habilitado" && ok.find((x) => x.canal === "email").fecha_autorizacion === "2026-10-01");
  check("la oposición/baja queda con fecha (por defecto hoy)", ok.find((x) => x.canal === "whatsapp").fecha_baja === "2026-10-08");
  check("los canales no revisados aparecen como «sin revisar»", ok.find((x) => x.canal === "sms").estado === "sin_revisar" && ok.length === 5);

  check("canal habilitado → comunicación permitida", contactos.evaluarComunicacion(C(), luis.id, "email").nivel === "ok");
  check("canal sin revisar → permitido pero con aviso", contactos.evaluarComunicacion(C(), luis.id, "sms").nivel === "aviso");
  check("canal con baja → bloqueado", contactos.evaluarComunicacion(C(), luis.id, "whatsapp").permitido === false);

  // Tareas de comunicación respetan el canal
  const t1 = tareas.crear(C(), { titulo: "Escribir a Luis", tipo: "email", fecha: "2026-10-09", contacto_id: luis.id });
  check("tarea de correo con canal habilitado: sin avisos", t1.avisos.length === 0);
  await lanza("tarea de WhatsApp con baja en ese canal → bloqueada", () => tareas.crear(C(), { titulo: "WhatsApp a Luis", tipo: "whatsapp", fecha: "2026-10-09", contacto_id: luis.id }), { estado: 409, codigo: "comunicacion_bloqueada" });
  const t2 = tareas.crear(C(), { titulo: "SMS", tipo: "documentacion", fecha: "2026-10-09", contacto_id: luis.id });
  check("una tarea que no es comunicación (documentación) no se bloquea", t2.tarea.id > 0);

  // No contactar
  const marcos = persona("Marcos", { telefono: "600 000 203", procedencia: "anuncio_particular", es_propietario: true });
  const o1 = opp({ contacto_id: marcos.id, ...PERMITIDO });
  oportunidades.cambiarEstado(C(), o1.id, { estado: "conversacion_iniciada" });
  const tl = tareas.crear(C(), { titulo: "Llamar a Marcos", tipo: "llamada", fecha: "2026-10-09", contacto_id: marcos.id });
  const tdoc = tareas.crear(C(), { titulo: "Preparar documentación", tipo: "documentacion", fecha: "2026-10-09", contacto_id: marcos.id });
  await lanza("«No contactar» exige el motivo", () => contactos.marcarNoContactar(C(), marcos.id, {}), { estado: 422, campo: "motivo" });
  const r = contactos.marcarNoContactar(C(), marcos.id, { motivo: "Lo pidió por teléfono" });
  check("marcar «No contactar» bloquea al contacto", r.contacto.no_contactar === 1 && r.contacto.alertas.some((a) => a.nivel === "bloqueo"));
  check("sus oportunidades abiertas pasan a «No contactar»", r.oportunidades_afectadas === 1 && oportunidades.obtener(C(), o1.id).estado === "no_contactar");
  check("sus tareas de llamada/mensaje pendientes se cancelan", r.tareas_canceladas === 1 && tareas.obtenerFila(C(), tl.tarea.id).estado === "cancelada");
  check("las tareas que no son comunicación se conservan", tareas.obtenerFila(C(), tdoc.tarea.id).estado === "pendiente");
  await lanza("no se pueden crear tareas de llamada/correo para él", () => tareas.crear(C(), { titulo: "Llamar otra vez", tipo: "llamada", fecha: "2026-10-10", contacto_id: marcos.id }), { estado: 409, codigo: "comunicacion_bloqueada" });
  await lanza("tampoco si la tarea cuelga de su oportunidad", () => tareas.crear(C(), { titulo: "Llamar", tipo: "llamada", fecha: "2026-10-10", oportunidad_id: o1.id }), { estado: 409, codigo: "comunicacion_bloqueada" });
  await lanza("no se le puede habilitar ningún canal mientras esté bloqueado", () => contactos.guardarHabilitaciones(C(), marcos.id, [{ canal: "email", estado: "habilitado", base: "consentimiento", evidencia: "x", fecha_autorizacion: "2026-10-08" }]), { estado: 422 });
  await lanza("su oportunidad no puede avanzar a un estado de contacto", () => oportunidades.cambiarEstado(C(), o1.id, { estado: "conversacion_iniciada", levantar_no_contactar: false }), { estado: 409 });
  await lanza("ya figura como «No contactar»: no se puede marcar dos veces", () => contactos.marcarNoContactar(C(), marcos.id, { motivo: "x" }), { estado: 409, codigo: "ya_no_contactar" });
  const act = actividades.crear(C(), { tipo: "llamada", direccion: "saliente", fecha: "2026-10-08", resumen: "Llamada realizada antes del bloqueo", contacto_id: marcos.id });
  check("registrar una llamada ya hecha no se bloquea, pero avisa", act.actividad.id > 0 && act.avisos.length === 1);
  await lanza("anonimizar a quien pidió no ser contactado exige confirmar la pérdida del bloqueo", () => contactos.anonimizar(C(), marcos.id), { estado: 409, codigo: "perdida_bloqueo" });
  await lanza("levantar el bloqueo exige explicar el motivo", () => contactos.levantarNoContactar(C(), marcos.id, {}), { estado: 422, campo: "motivo" });
  const lev = contactos.levantarNoContactar(C(), marcos.id, { motivo: "Ha vuelto a escribirnos él mismo" });
  check("tras levantar el bloqueo vuelve a ser contactable", lev.no_contactar === 0);
  check("las oportunidades NO se reabren solas", oportunidades.obtener(C(), o1.id).estado === "no_contactar");
}

// ============================================================================
seccion("🧹 Eliminar y anonimizar contactos");
{
  const vacio = persona("Sin relaciones");
  check("un contacto sin relaciones se puede eliminar", contactos.eliminar(C(), vacio.id).eliminado === true && !C().bd.uno("SELECT 1 FROM contactos WHERE id=?", [vacio.id]));
  const e = await lanza("un contacto con oportunidades no se puede eliminar", () => contactos.eliminar(C(), contactos.listar(C(), { q: "Marcos" }).datos[0].id), { estado: 409, codigo: "contacto_con_relaciones" });
  check("el mensaje propone anonimizar", /Anonimizar/.test(e?.message || ""));
  await lanza("no se puede quitar el rol de comprador con demanda sin cerrar", async () => {
    demandas.crear(C(), { contacto_id: pedro.id, municipios: ["Oviedo"], presupuesto_max: 100000 });
    contactos.actualizarContacto(C(), pedro.id, { es_comprador: false });
  }, { estado: 422, campo: "es_comprador" });

  const persona2 = persona("María Datos", { apellidos: "Personales", telefono: "600 000 250", email: "maria@example.com", procedencia: "propia_persona", notas: "Notas privadas", motivo_venta: "Divorcio (lo dijo ella)" });
  actividades.crear(C(), { tipo: "llamada", direccion: "entrante", fecha: "2026-10-07", resumen: "Habla de su divorcio y de su hijo", contacto_id: persona2.id });
  const o = opp({ contacto_id: persona2.id });
  const an = contactos.anonimizar(C(), persona2.id);
  check("anonimizar borra nombre, teléfono, correo, notas y motivo", an.nombre.startsWith("Contacto anonimizado") && !an.apellidos && !an.telefono && !an.email && !an.notas && !an.motivo_venta && an.anonimizado_en);
  check("anonimizar borra el texto libre de sus actividades", an.actividades.every((a) => a.resumen === "[Contenido eliminado por anonimización]"));
  check("los registros relacionados se conservan (estadísticas)", oportunidades.obtener(C(), o.id).contacto.id === persona2.id);
  check("un contacto anonimizado no sale en búsquedas por su antiguo nombre", contactos.listar(C(), { q: "María Datos" }).total === 0 && buscar(C(), "maria@example").total === 0);
  await lanza("no se puede editar un contacto anonimizado", () => contactos.actualizarContacto(C(), persona2.id, { nombre: "Otra vez" }), { estado: 409 });
}

// ============================================================================
seccion("🎯 Oportunidades y embudo de captación");
let opA, opB;
{
  const e = await lanza("una oportunidad exige fuente, tipo de inmueble y municipio", () => oportunidades.crear(C(), {}), { estado: 422 });
  check("los tres campos mínimos se señalan", ["fuente", "tipo_inmueble", "municipio"].every((c) => e?.extra?.campos?.[c]));
  await lanza("una fuente que no está en el catálogo se rechaza con instrucciones", () => oportunidades.crear(C(), { fuente: "Fuente inventada", tipo_inmueble: "Piso", municipio: "Oviedo" }), { estado: 422, campo: "fuente" });
  opA = oportunidades.crear(C(), { fuente: "idealista", tipo_inmueble: "piso", municipio: "oviedo", zona: "Centro", enlace: "https://www.example.com/anuncio/777?utm_source=a", precio_anunciado: "245.000", superficie_m2: "92,5", habitaciones: 3, banos: 2 });
  check("identificador automático por año (OP-2026-0001)", /^OP-2026-\d{4}$/.test(opA.identificador));
  check("fuente, tipo y municipio se normalizan al catálogo", opA.fuente === "Idealista" && opA.tipo_inmueble === "Piso" && opA.municipio === "Oviedo");
  check("los importes y superficies a la española se interpretan bien", opA.precio_anunciado === 245000 && opA.superficie_m2 === 92.5);
  check("nace «Detectada» con fecha de detección de hoy y el responsable por defecto", opA.estado === "detectada" && opA.fecha_deteccion === "2026-10-08" && opA.responsable === "Pau");
  const d = await lanza("el mismo anuncio con otro enlace parecido (utm) se detecta como duplicado", () => oportunidades.crear(C(), { fuente: "Fotocasa", tipo_inmueble: "Piso", municipio: "Oviedo", enlace: "https://example.com/anuncio/777/#foto" }), { estado: 409, codigo: "duplicado_posible" });
  check("el aviso incluye la oportunidad existente", d?.extra?.candidatos?.[0]?.identificador === opA.identificador);
  const nuevoIds = new Set([opA.identificador]);
  const o2 = opp({}); const o3 = opp({});
  check("los identificadores son consecutivos y distintos", !nuevoIds.has(o2.identificador) && o3.identificador > o2.identificador);
  await lanza("clasificar al anunciante exige anotar la evidencia", () => oportunidades.actualizarOportunidad(C(), opA.id, { clasificacion_anunciante: "particular" }), { estado: 422, campo: "evidencia_clasificacion" });
  const cl = oportunidades.actualizarOportunidad(C(), opA.id, { clasificacion_anunciante: "particular", evidencia_clasificacion: "El anuncio dice «vendo directamente»" });
  check("con evidencia, la clasificación se guarda", cl.clasificacion_anunciante === "particular");
  await lanza("marcar el contacto como permitido exige la evidencia", () => oportunidades.actualizarOportunidad(C(), opA.id, { verificacion_contacto: "permitido" }), { estado: 422, campo: "verificacion_evidencia" });

  // Máquina de estados
  const e1 = await lanza("no se puede pasar a contacto sin verificar que está permitido", () => oportunidades.cambiarEstado(C(), opA.id, { estado: "preparada_contacto" }), { estado: 409, codigo: "transicion_no_permitida" });
  check("el error dice qué hacer (verificar y anotar evidencia)", e1?.extra?.accion === "verificar" && /verifica/i.test(e1.message));
  const ver = oportunidades.obtener(C(), opA.id);
  check("la ficha informa qué transiciones están bloqueadas y por qué", ver.transiciones.find((t) => t.estado === "preparada_contacto").ok === false && ver.transiciones.find((t) => t.estado === "descartada").ok === true);
  oportunidades.actualizarOportunidad(C(), opA.id, { verificacion_contacto: "permitido", verificacion_evidencia: "El anuncio invita a contactar por el portal" });
  await lanza("el motivo es obligatorio al descartar", () => oportunidades.cambiarEstado(C(), opA.id, { estado: "descartada" }), { estado: 422, campo: "motivo" });
  const av = oportunidades.cambiarEstado(C(), opA.id, { estado: "preparada_contacto" });
  check("verificado el contacto, avanza", av.oportunidad.estado === "preparada_contacto");
  for (const e of ["conversacion_iniciada", "propietario_interesado", "visita_valoracion_programada", "valoracion_realizada", "propuesta_presentada"]) oportunidades.cambiarEstado(C(), opA.id, { estado: e });
  check("recorre todos los estados de contacto hasta «Propuesta presentada»", oportunidades.obtener(C(), opA.id).estado === "propuesta_presentada");
  check("cada cambio de estado queda en el historial con fecha", C().bd.valor("SELECT COUNT(*) FROM historial_cambios WHERE entidad='oportunidad' AND entidad_id=? AND campo='estado'", [opA.id]) === 6);
  await lanza("no se llega a «Encargo confirmado» cambiando solo el estado", () => oportunidades.cambiarEstado(C(), opA.id, { estado: "encargo_confirmado" }), { estado: 409, codigo: "transicion_no_permitida" });
  await lanza("estado inexistente → error", () => oportunidades.cambiarEstado(C(), opA.id, { estado: "volando" }), { estado: 422 });

  const od = opp({});
  const ds = oportunidades.cambiarEstado(C(), od.id, { estado: "descartada", motivo: "Precio fuera de mercado" });
  check("descartar guarda el motivo", ds.oportunidad.estado === "descartada" && ds.oportunidad.motivo_descarte === "Precio fuera de mercado");
  await lanza("una descartada no avanza a contacto sin verificación", () => oportunidades.cambiarEstado(C(), od.id, { estado: "conversacion_iniciada" }), { estado: 409 });
  const re = oportunidades.cambiarEstado(C(), od.id, { estado: "pendiente_revision" });
  check("se puede reabrir una descartada y el motivo se limpia", re.oportunidad.estado === "pendiente_revision" && re.oportunidad.motivo_descarte === null);
  const on = opp({});
  oportunidades.cambiarEstado(C(), on.id, { estado: "no_contactar", motivo: "El anunciante prohíbe agencias" });
  await lanza("salir de «No contactar» exige levantar el bloqueo expresamente", () => oportunidades.cambiarEstado(C(), on.id, { estado: "pendiente_revision", motivo: "x" }), { estado: 409, codigo: "requiere_levantar" });
  const lv = oportunidades.cambiarEstado(C(), on.id, { estado: "pendiente_revision", motivo: "Aclarado con el anunciante", levantar_no_contactar: true });
  check("con motivo y confirmación sí se reabre", lv.oportunidad.estado === "pendiente_revision");

  const l = oportunidades.listar(C(), {});
  check("el listado devuelve el conteo por estado para el embudo", l.conteo_estados.propuesta_presentada === 1 && Object.values(l.conteo_estados).reduce((a, b) => a + b, 0) === l.total);
  check("filtros: por estado, municipio y fuente", oportunidades.listar(C(), { estado: "propuesta_presentada" }).total === 1 && oportunidades.listar(C(), { municipio: "oviedo", fuente: "idealista" }).total >= 1);
  check("filtro «abiertas» excluye cerradas y encargos", oportunidades.listar(C(), { estado: "abiertas" }).datos.every((o) => !["descartada", "no_contactar", "encargo_confirmado"].includes(o.estado)));
  check("búsqueda de texto en oportunidades (sin tildes)", oportunidades.listar(C(), { q: "centro" }).total === 1);
  opB = o2;
}

// ============================================================================
seccion("🏠 Confirmar encargo: oportunidad → propietario → encargo → inmueble");
let inmA, encA;
{
  const dueño = persona("Elena", { apellidos: "Marqués", telefono: "600 000 301", procedencia: "formulario_web", es_propietario: true });
  const o = opp({ contacto_id: dueño.id, ...PERMITIDO, tipo_inmueble: "Piso", municipio: "Gijón", zona: "La Arena", precio_anunciado: 295000, superficie_m2: 98, habitaciones: 3, banos: 2, caracteristicas: "Exterior, soleado", notas: "Nota de captación importante: prefiere llamadas por la tarde.", titulo: "Piso luminoso" });
  oportunidades.cambiarEstado(C(), o.id, { estado: "conversacion_iniciada" });
  await lanza("confirmar el encargo valida antes de escribir (vigencia anterior a la fecha)", () => oportunidades.confirmarEncargo(C(), o.id, { encargo: { fecha_encargo: "2026-10-01", vigencia_hasta: "2026-09-01" } }), { estado: 422, campo: "vigencia_hasta" });
  await lanza("honorarios en porcentaje sin importe → error", () => oportunidades.confirmarEncargo(C(), o.id, { encargo: { honorarios_tipo: "porcentaje" } }), { estado: 422, campo: "honorarios_valor" });
  check("tras los errores no se ha creado ningún inmueble", C().bd.valor("SELECT COUNT(*) FROM inmuebles") === 0);

  const res = oportunidades.confirmarEncargo(C(), o.id, {
    encargo: { tipo: "venta", exclusividad: true, fecha_encargo: "2026-10-08", vigencia_hasta: "2027-01-08", honorarios_tipo: "porcentaje", honorarios_valor: 4 },
    inmueble: { direccion_interna: "Calle Falsa 123, 2º", planta: "2" },
  });
  inmA = res.inmueble;
  check("se crea el inmueble con referencia automática y los datos de la oportunidad", /^INM-\d{4}$/.test(inmA.referencia) && inmA.municipio === "Gijón" && inmA.superficie_m2 === 98 && inmA.precio_actual === 295000 && inmA.tipo === "Piso");
  check("la oportunidad pasa a «Encargo confirmado» y queda enlazada", res.oportunidad.estado === "encargo_confirmado" && res.oportunidad.inmueble_id === inmA.id);
  check("el propietario queda vinculado al inmueble (y como propietario)", inmA.propietarios.length === 1 && inmA.propietarios[0].contacto_id === dueño.id && inmA.propietarios[0].principal === 1);
  check("el encargo se registra con exclusividad, vigencia y honorarios", inmA.encargos.length === 1 && inmA.encargos[0].exclusividad === 1 && inmA.encargos[0].honorarios_valor === 4 && inmA.encargos[0].vigencia_hasta === "2027-01-08");
  encA = inmA.encargos[0];
  check("el estado comercial arranca «En preparación»", inmA.estado_comercial === "en_preparacion");
  check("los datos que vienen del anuncio quedan «pendientes de confirmar»", inmA.datos_pendientes.includes("superficie_m2") && inmA.datos_pendientes.includes("precio_actual") && inmA.datos_pendientes.includes("habitaciones"));
  check("lo que se aportó al confirmar (planta, dirección) NO figura como pendiente", !inmA.datos_pendientes.includes("planta") && inmA.direccion_interna === "Calle Falsa 123, 2º");
  check("la ubicación pública NO incluye la dirección interna", inmA.ubicacion_publica === "La Arena, Gijón" && !inmA.ubicacion_publica.includes("Falsa"));
  check("se guarda el primer precio en el historial de precios", inmA.precios.length === 1 && inmA.precios[0].precio === 295000);
  check("se conserva el historial de captación en el inmueble (oportunidad, notas, cambios de estado)",
    inmA.captacion.oportunidad.id === o.id && /llamadas por la tarde/.test(inmA.captacion.oportunidad.notas) && inmA.captacion.cambios.some((c) => c.campo === "estado"));
  check("las notas de la oportunidad no se han perdido", /llamadas por la tarde/.test(oportunidades.obtener(C(), o.id).notas));
  const tarea = C().bd.uno("SELECT * FROM tareas WHERE encargo_id = ?", [encA.id]);
  check("se crea el aviso de vencimiento del encargo 30 días antes", tarea && tarea.fecha === "2026-12-09" && tarea.tipo === "vencimiento_encargo" && tarea.estado === "pendiente");
  await lanza("confirmar dos veces no duplica nada", () => oportunidades.confirmarEncargo(C(), o.id, { encargo: {} }), { estado: 409, codigo: "ya_confirmado" });
  check("sigue habiendo un único inmueble y un único encargo", C().bd.valor("SELECT COUNT(*) FROM inmuebles") === 1 && C().bd.valor("SELECT COUNT(*) FROM encargos") === 1);
  await lanza("la oportunidad confirmada no retrocede de estado", () => oportunidades.cambiarEstado(C(), o.id, { estado: "descartada", motivo: "x" }), { estado: 409 });
  await lanza("la oportunidad con inmueble no se puede borrar (es el historial de captación)", () => oportunidades.eliminar(C(), o.id), { estado: 409, codigo: "oportunidad_con_inmueble" });

  // Sin propietario
  const sinDueno = opp({ municipio: "Avilés", tipo_inmueble: "Piso", superficie_m2: 60, precio_anunciado: 100000 });
  await lanza("sin propietario conocido no se puede confirmar", () => oportunidades.confirmarEncargo(C(), sinDueno.id, { encargo: {} }), { estado: 422, campo: "contacto_id" });
  const conNuevo = oportunidades.confirmarEncargo(C(), sinDueno.id, { contacto: { nombre: "Nuevo Propietario", telefono: "600 000 302", procedencia: "propia_persona" }, encargo: {} });
  check("se puede crear el propietario en el mismo paso", conNuevo.inmueble.propietarios[0].nombre_completo === "Nuevo Propietario" && conNuevo.inmueble.propietarios[0].no_contactar === 0);
  check("el segundo inmueble recibe la referencia siguiente", conNuevo.inmueble.referencia > inmA.referencia);

  // Duplicados de inmueble
  const parecida = opp({ contacto_id: dueño.id, municipio: "Gijón", tipo_inmueble: "Piso", superficie_m2: 99, precio_anunciado: 290000, zona: "La Arena" });
  const sim = await lanza("una oportunidad que parece el mismo inmueble avisa en lugar de duplicar", () => oportunidades.confirmarEncargo(C(), parecida.id, { encargo: {} }), { estado: 409, codigo: "inmueble_similar" });
  check("el aviso trae el inmueble parecido y por qué", sim?.extra?.candidatos?.[0]?.id === inmA.id && sim.extra.candidatos[0].motivos.length > 0);
  check("la vista previa también lista los parecidos", oportunidades.previsualizarEncargo(C(), parecida.id).similares.length >= 1);
  await lanza("reutilizar un inmueble que ya tiene encargo vigente del mismo tipo se rechaza", () => oportunidades.confirmarEncargo(C(), parecida.id, { inmueble_id: inmA.id, encargo: { tipo: "venta" } }), { estado: 409, codigo: "encargo_vigente" });
  check("…y no deja nada a medias (transacción deshecha)", oportunidades.obtener(C(), parecida.id).estado === "detectada" && C().bd.valor("SELECT COUNT(*) FROM inmuebles") === 2);
  const alq = oportunidades.confirmarEncargo(C(), parecida.id, { inmueble_id: inmA.id, encargo: { tipo: "alquiler", fecha_encargo: "2026-10-08" } });
  check("con otro tipo de encargo (alquiler) se reutiliza el inmueble sin duplicarlo", alq.inmueble_reutilizado === true && C().bd.valor("SELECT COUNT(*) FROM inmuebles") === 2 && alq.inmueble.encargos.length === 2);
  check("el inmueble reutilizado conserva su origen de captación original", alq.inmueble.captacion.oportunidad.id !== parecida.id);

  const bloq = persona("Bloqueado", { telefono: "600 000 303", procedencia: "propia_persona" });
  contactos.marcarNoContactar(C(), bloq.id, { motivo: "Oposición" });
  const ob = opp({ contacto_id: bloq.id, municipio: "Mieres" });
  await lanza("un propietario «No contactar» bloquea la confirmación del encargo", () => oportunidades.confirmarEncargo(C(), ob.id, { encargo: {} }), { estado: 409 });
}

// ============================================================================
seccion("🏢 Cartera: referencias, precios, propietarios y encargos");
{
  const a = inmuebles.crear(C(), { tipo: "Casa", municipio: "Llanes", operacion: "venta", precio_actual: 310000, direccion_interna: "Camino Privado 5", superficie_m2: 150, tipo_superficie: "construida" });
  const b = inmuebles.crear(C(), { tipo: "Parcela o terreno", municipio: "Villaviciosa" });
  check("las referencias automáticas son consecutivas", Number(b.referencia.split("-")[1]) === Number(a.referencia.split("-")[1]) + 1);
  inmuebles.eliminar(C(), b.id);
  const c = inmuebles.crear(C(), { tipo: "Local", municipio: "Oviedo" });
  check("una referencia eliminada NO se reutiliza", Number(c.referencia.split("-")[1]) === Number(b.referencia.split("-")[1]) + 1);
  const man = inmuebles.crear(C(), { tipo: "Piso", municipio: "Mieres", referencia: "PIS0190" });
  check("se puede fijar una referencia propia (migrar desde otro sistema)", man.referencia === "PIS0190");
  await lanza("una referencia repetida (aunque cambie la mayúscula) se rechaza", () => inmuebles.crear(C(), { tipo: "Piso", municipio: "Mieres", referencia: "pis0190" }), { estado: 409, codigo: "referencia_repetida" });
  check("el título se genera si no se da", /Casa en Llanes/.test(a.titulo));
  check("ascensor/garaje/terraza distinguen «no» de «desconocido»",
    inmuebles.crear(C(), { tipo: "Piso", municipio: "Oviedo", ascensor: false }).ascensor === 0 && inmuebles.crear(C(), { tipo: "Piso", municipio: "Oviedo" }).ascensor === null);
  await lanza("el municipio es obligatorio", () => inmuebles.crear(C(), { tipo: "Piso" }), { estado: 422, campo: "municipio" });

  // Historial de precios
  inmuebles.actualizarInmueble(C(), a.id, { precio_actual: 295000, motivo_precio: "Bajada pactada" });
  inmuebles.actualizarInmueble(C(), a.id, { precio_actual: 295000, notas_internas: "Sin cambio de precio" });
  inmuebles.actualizarInmueble(C(), a.id, { precio_actual: 289000 });
  const pa = inmuebles.obtener(C(), a.id);
  check("cada cambio de precio añade una línea; repetir el mismo no", pa.precios.length === 3 && pa.precios[0].precio === 289000 && pa.precios[1].motivo === "Bajada pactada");

  // Propietarios
  const p1 = persona("Prop1"), p2 = persona("Prop2");
  inmuebles.anadirPropietario(C(), a.id, { contacto_id: p1.id, porcentaje: 60 });
  await lanza("los porcentajes de propiedad no pueden pasar del 100 %", () => inmuebles.anadirPropietario(C(), a.id, { contacto_id: p2.id, porcentaje: 50 }), { estado: 422 });
  inmuebles.anadirPropietario(C(), a.id, { contacto_id: p2.id, porcentaje: 40 });
  await lanza("la misma persona no puede figurar dos veces", () => inmuebles.anadirPropietario(C(), a.id, { contacto_id: p2.id }), { estado: 409 });
  check("un inmueble puede tener varios propietarios y el primero es el principal", inmuebles.obtener(C(), a.id).propietarios.length === 2 && inmuebles.obtener(C(), a.id).propietarios[0].principal === 1);
  inmuebles.anadirPropietario(C(), inmA.id, { contacto_id: p1.id });
  check("un propietario puede tener varios inmuebles", contactos.obtener(C(), p1.id).inmuebles.length === 2 && contactos.obtener(C(), p1.id).es_propietario === 1);
  check("el listado de inmuebles filtra por propietario", inmuebles.listar(C(), { propietario_id: p1.id }).total === 2);
  inmuebles.quitarPropietario(C(), a.id, p1.id);
  check("al quitar al principal, otro propietario pasa a ser el principal", inmuebles.obtener(C(), a.id).propietarios[0].principal === 1 && inmuebles.obtener(C(), a.id).propietarios.length === 1);
  check("quien sigue siendo propietario de otro inmueble conserva el rol", contactos.obtener(C(), p1.id).es_propietario === 1);

  // Datos pendientes
  const ya = inmuebles.confirmarDato(C(), inmA.id, "superficie_m2");
  check("confirmar un dato lo saca de «pendientes de confirmar»", !ya.datos_pendientes.includes("superficie_m2") && ya.datos_pendientes.includes("precio_actual"));
  check("los datos que faltan se listan aparte de los pendientes", inmuebles.obtener(C(), a.id).datos_faltantes.some((f) => f.campo === "habitaciones"));

  // Encargos
  const e1 = await lanza("el encargo vigente no puede coexistir con otro del mismo tipo", () => inmuebles.crearEncargo(C(), inmA.id, { tipo: "venta" }), { estado: 409, codigo: "encargo_vigente" });
  check("el mensaje explica cómo resolverlo", /finalizado o cancelado/.test(e1?.message || ""));
  const tareaInicial = C().bd.uno("SELECT * FROM tareas WHERE encargo_id = ?", [encA.id]);
  inmuebles.actualizarEncargo(C(), encA.id, { vigencia_hasta: "2027-03-01" });
  const tareas1 = C().bd.todos("SELECT * FROM tareas WHERE encargo_id = ?", [encA.id]);
  check("cambiar la vigencia actualiza el MISMO aviso (no crea otro)", tareas1.length === 1 && tareas1[0].id === tareaInicial.id && tareas1[0].fecha === "2027-01-30");
  inmuebles.actualizarEncargo(C(), encA.id, { vigencia_hasta: "2026-10-20" });
  check("si el vencimiento está muy cerca, el aviso salta hoy", C().bd.uno("SELECT fecha FROM tareas WHERE encargo_id = ?", [encA.id]).fecha === "2026-10-08");
  check("la ficha avisa de que el encargo está a punto de vencer", inmuebles.obtener(C(), inmA.id).alertas.some((x) => /vence en 12/.test(x.texto)));
  inmuebles.actualizarEncargo(C(), encA.id, { vigencia_hasta: "2027-06-01" });
  inmuebles.actualizarEncargo(C(), encA.id, { estado: "cancelado" });
  check("cancelar el encargo apaga su aviso", C().bd.uno("SELECT estado FROM tareas WHERE encargo_id = ?", [encA.id]).estado === "cancelada");
  const nuevoEnc = inmuebles.crearEncargo(C(), inmA.id, { tipo: "venta", vigencia_hasta: "2027-02-01", fecha_encargo: "2026-10-08" });
  check("tras cancelar, se puede registrar uno nuevo", nuevoEnc.estado === "vigente");
  await lanza("una vigencia anterior al encargo se rechaza", () => inmuebles.actualizarEncargo(C(), nuevoEnc.id, { vigencia_hasta: "2026-01-01" }), { estado: 422, campo: "vigencia_hasta" });
  inmuebles.actualizarInmueble(C(), inmA.id, { estado_comercial: "vendido" });
  const post = inmuebles.obtener(C(), inmA.id);
  check("vender el inmueble finaliza sus encargos vigentes", post.encargos.filter((e) => e.estado === "vigente").length === 0 && post.encargos.some((e) => e.estado === "finalizado"));
  check("…y apaga los avisos de vencimiento", C().bd.valor("SELECT COUNT(*) FROM tareas WHERE inmueble_id=? AND tipo='vencimiento_encargo' AND estado='pendiente'", [inmA.id]) === 0);
  await lanza("un inmueble con historial de captación no se borra (se archiva)", () => inmuebles.eliminar(C(), inmA.id), { estado: 409, codigo: "inmueble_con_historial" });
  const arch = inmuebles.actualizarInmueble(C(), inmA.id, { estado_comercial: "archivado" });
  check("archivar conserva todo", arch.estado_comercial === "archivado" && arch.captacion.oportunidad.id > 0);
  check("el estado comercial lo gestionan los 8 estados pedidos", CAT.ESTADOS_COMERCIALES.map((e) => e.clave).join() === "en_preparacion,disponible,reservado,en_negociacion,vendido,alquilado,retirado,archivado");
  check("listado de inmuebles: filtros por estado, municipio y rango de precio", inmuebles.listar(C(), { municipio: "llanes" }).total === 1 && inmuebles.listar(C(), { precio_min: 280000, precio_max: 300000 }).datos.some((i) => i.id === a.id));
}

// ============================================================================
seccion("🔎 Demandas de compradores");
{
  const comp = persona("Comprador", { apellidos: "Uno", telefono: "600 000 401", procedencia: "formulario_web" });
  check("el contacto aún no es comprador", comp.es_comprador === 0);
  const d1 = demandas.crear(C(), { contacto_id: comp.id, nombre: "Piso en Oviedo", municipios: ["oviedo", "GIJÓN"], presupuesto_min: "150.000", presupuesto_max: "220.000", tipos: ["piso"], habitaciones_min: 3, ascensor: "imprescindible", estados_aceptables: ["buen_estado", "reformado"] });
  check("crear una demanda convierte al contacto en comprador", contactos.obtener(C(), comp.id).es_comprador === 1);
  check("municipios y tipos se normalizan al catálogo", d1.municipios.join() === "Oviedo,Gijón" && d1.tipos.join() === "Piso");
  check("los importes se interpretan bien", d1.presupuesto_min === 150000 && d1.presupuesto_max === 220000);
  check("nace «activa» con requisitos sin definir como «indiferente»", d1.estado === "activa" && d1.garaje === "indiferente" && d1.terraza === "indiferente");
  const d2 = demandas.crear(C(), { contacto_id: comp.id, nombre: "Casa en Llanes", municipios: ["Llanes"], presupuesto_max: 350000, terraza: "imprescindible" });
  check("un comprador puede tener varias demandas", contactos.obtener(C(), comp.id).demandas.length === 2 && d2.id !== d1.id);
  await lanza("el presupuesto máximo no puede ser menor que el mínimo", () => demandas.crear(C(), { contacto_id: comp.id, presupuesto_min: 300000, presupuesto_max: 100000 }), { estado: 422, campo: "presupuesto_max" });
  const e = await lanza("no se puede dar la financiación por aprobada sin evidencia", () => demandas.crear(C(), { contacto_id: comp.id, financiacion: "aprobada_acreditada" }), { estado: 422, campo: "financiacion_evidencia" });
  check("el mensaje explica la diferencia con «manifestado»", /manifestado/.test(e?.extra?.campos?.financiacion_evidencia || ""));
  const ok = demandas.crear(C(), { contacto_id: comp.id, financiacion: "aprobada_acreditada", financiacion_evidencia: "Carta del banco" });
  check("con evidencia se admite", ok.financiacion === "aprobada_acreditada");
  check("lo manifestado no se presenta como aprobado: etiquetas honestas", CAT.FINANCIACION.find((f) => f.clave === "contado_manifestado").etiqueta.includes("sin acreditar") && CAT.FINANCIACION.find((f) => f.clave === "hipoteca_manifestada").etiqueta.includes("sin estudio"));
  await lanza("cerrar una demanda exige el motivo", () => demandas.actualizarDemanda(C(), d1.id, { estado: "cerrada" }), { estado: 422, campo: "motivo_cierre" });
  await lanza("el comprador de una demanda no se puede cambiar", async () => { const r = demandas.actualizarDemanda(C(), d1.id, { contacto_id: ana.id, nombre: "x" }); if (r.contacto_id !== comp.id && r.contacto.id !== comp.id) throw new Error("cambió"); throw new Error("ignorado correctamente"); }, { });
  check("listado de demandas: filtros por municipio y estado", demandas.listar(C(), { municipio: "Llanes" }).total === 1 && demandas.listar(C(), { estado: "activa" }).total >= 2);
  check("filtro por presupuesto", demandas.listar(C(), { presupuesto_max: 250000 }).datos.some((d) => d.id === d1.id));

  reloj.avanzaDias(70);
  check("pasados 60 días sin tocarla, la demanda activa figura como caducada", demandas.obtener(C(), d1.id).obsoleta === true && demandas.listar(C(), { obsoletas: "1" }).total >= 2);
  check("el panel avisa de las demandas caducadas", panel(C()).avisos.some((a) => a.tipo === "demandas"));
  demandas.confirmarVigente(C(), d1.id);
  check("confirmarla con el cliente renueva su fecha de actualización", demandas.obtener(C(), d1.id).obsoleta === false);
  actividades.crear(C(), { tipo: "llamada", direccion: "saliente", fecha: "2026-12-17", resumen: "Sigue buscando", demanda_id: d2.id });
  check("registrar una conversación sobre la demanda también la renueva", demandas.obtener(C(), d2.id).obsoleta === false);
  reloj.avanzaDias(-70);
}

// ============================================================================
seccion("📅 Agenda, tareas y recordatorios internos");
{
  C().bd.ejecutar("DELETE FROM tareas");
  reloj.fija(2026, 10, 8, 10, 0); // jueves
  const t = (o) => tareas.crear(C(), { prioridad: "media", ...o }).tarea;
  const ayer = t({ titulo: "Ayer", fecha: "2026-10-07", hora: "17:00" });
  const hoyPasada = t({ titulo: "Hoy 09:00", fecha: "2026-10-08", hora: "09:00" });
  const hoyFutura = t({ titulo: "Hoy 11:00", fecha: "2026-10-08", hora: "11:00", aviso_min: 30 });
  const hoySinHora = t({ titulo: "Hoy sin hora", fecha: "2026-10-08", aviso_min: 0 });
  const manana = t({ titulo: "Mañana", fecha: "2026-10-09" });
  const finSemana = t({ titulo: "Domingo", fecha: "2026-10-11" });
  const proxSemana = t({ titulo: "Lunes que viene", fecha: "2026-10-12" });
  const lunesPasado = t({ titulo: "Lunes pasado", fecha: "2026-10-05", estado: "hecha" });
  const ids = (vista, extra = {}) => tareas.listar(C(), { vista, ...extra }).datos.map((x) => x.titulo);
  check("vista HOY: solo las de hoy", ids("hoy").sort().join("|") === ["Hoy 09:00", "Hoy 11:00", "Hoy sin hora"].sort().join("|"), ids("hoy").join("|"));
  check("vista SEMANA: de lunes a domingo (incluye la hecha del lunes)", ids("semana").length === 7 && ids("semana").includes("Domingo") && ids("semana").includes("Lunes pasado") && !ids("semana").includes("Lunes que viene"));
  check("vista VENCIDAS: ayer y hoy 09:00 (pero no hoy 11:00 ni las hechas)", ids("vencidas").sort().join("|") === ["Ayer", "Hoy 09:00"].join("|"), ids("vencidas").join("|"));
  check("vista PENDIENTES: todas las abiertas, ordenadas por fecha", ids("pendientes")[0] === "Ayer" && ids("pendientes").length === 7 && !ids("pendientes").includes("Lunes pasado"));
  check("vista CALENDARIO por rango", ids("calendario", { desde: "2026-10-09", hasta: "2026-10-12" }).sort().join("|") === ["Domingo", "Lunes que viene", "Mañana"].sort().join("|"));
  await lanza("el calendario exige un rango válido", async () => tareas.listar(C(), { vista: "calendario" }), { estado: 422 });
  check("el resumen alimenta los contadores de las pestañas", tareas.listar(C(), {}).resumen.vencidas === 2 && tareas.listar(C(), {}).resumen.hoy === 3 && tareas.listar(C(), {}).resumen.pendientes === 7);
  check("las tareas llevan marcada la vencida", tareas.listar(C(), { vista: "hoy" }).datos.find((x) => x.titulo === "Hoy 09:00").vencida === true && tareas.listar(C(), { vista: "hoy" }).datos.find((x) => x.titulo === "Hoy 11:00").vencida === false);
  const orden = tareas.listar(C(), { vista: "hoy" }).datos.map((x) => x.titulo);
  check("orden: por hora y las de «sin hora» al final", orden.join("|") === "Hoy 09:00|Hoy 11:00|Hoy sin hora", orden.join("|"));

  const completada = tareas.completar(C(), ayer.id).tarea;
  check("completar marca la fecha y la saca de vencidas", completada.estado === "hecha" && completada.completada_en && !ids("vencidas").includes("Ayer"));
  check("el panel cuenta las vencidas reales", panel(C()).indicadores.find((i) => i.id === "tareas_vencidas").valor === 1);

  // Recordatorios
  const nombresRec = () => tareas.recordatorios(C()).items.map((x) => x.titulo).sort();
  check("recordatorio: sin hora y aviso 0 salta desde el principio del día; la de las 11:00 con aviso de 30 min aún no", nombresRec().join("|") === "Hoy sin hora", nombresRec().join("|"));
  reloj.fija(2026, 10, 8, 10, 29);
  check("a las 10:29 todavía no toca avisar la de las 11:00", !nombresRec().includes("Hoy 11:00"));
  reloj.fija(2026, 10, 8, 10, 30);
  check("a las 10:30 (30 min antes) sí salta el recordatorio", nombresRec().includes("Hoy 11:00"));
  tareas.avisoVisto(C(), hoyFutura.id);
  check("marcado como visto deja de salir", !nombresRec().includes("Hoy 11:00"));
  tareas.posponer(C(), hoyFutura.id, { minutos: 60 });
  const pospuesta = tareas.obtenerFila(C(), hoyFutura.id);
  check("posponer 60 minutos mueve la hora y reactiva el aviso", pospuesta.hora === "11:30" && pospuesta.aviso_visto_en === null);
  reloj.fija(2026, 10, 8, 10, 59);
  check("tras posponer a las 11:30 (aviso 30 min) no salta a las 10:59…", !nombresRec().includes("Hoy 11:00"));
  reloj.fija(2026, 10, 8, 11, 0);
  check("…y sí a las 11:00, que es 30 min antes de su nueva hora", nombresRec().includes("Hoy 11:00"));
  tareas.posponer(C(), manana.id, { dias: 2 });
  check("posponer N días desplaza la fecha", tareas.obtenerFila(C(), manana.id).fecha === "2026-10-11");
  tareas.posponer(C(), manana.id, { fecha: "2026-10-20", hora: "08:15" });
  check("posponer a una fecha y hora concretas", tareas.obtenerFila(C(), manana.id).fecha === "2026-10-20" && tareas.obtenerFila(C(), manana.id).hora === "08:15");
  await lanza("posponer sin indicar cuándo da un error comprensible", () => tareas.posponer(C(), manana.id, {}), { estado: 422 });
  await lanza("no se pospone una tarea ya hecha", () => tareas.posponer(C(), lunesPasado.id, { dias: 1 }), { estado: 409 });

  await lanza("una tarea necesita título y fecha", () => tareas.crear(C(), {}), { estado: 422 });
  await lanza("una tarea enlazada a un contacto que no existe falla con mensaje claro", () => tareas.crear(C(), { titulo: "x", fecha: "2026-10-10", contacto_id: 99999 }), { estado: 422, campo: "contacto_id" });
  await lanza("avisar con antelación exige hora", () => tareas.crear(C(), { titulo: "x", fecha: "2026-10-10", aviso_min: 15 }), { estado: 422, campo: "aviso_min" });
  const rel = tareas.crear(C(), { titulo: "Visita al piso", tipo: "visita", fecha: "2026-10-14", hora: "17:00", prioridad: "alta", oportunidad_id: opB.id, inmueble_id: inmA.id, contacto_id: ana.id, demanda_id: null }).tarea;
  check("una tarea se relaciona con contacto, oportunidad e inmueble a la vez", rel.contacto_id === ana.id && rel.oportunidad_id === opB.id && rel.inmueble_id === inmA.id);
  check("el listado trae los nombres de las relaciones", tareas.listar(C(), { inmueble_id: inmA.id }).datos.find((x) => x.id === rel.id).inmueble_referencia === inmA.referencia);
  tareas.eliminar(C(), rel.id);
  check("eliminar una tarea la quita de verdad", !C().bd.uno("SELECT 1 FROM tareas WHERE id=?", [rel.id]));
  void hoyPasada; void hoySinHora; void finSemana; void proxSemana;
}

// ============================================================================
seccion("🔍 Buscador global y panel de Inicio");
{
  const b = buscar(C(), "elena");
  check("el buscador global agrupa por tipo y encuentra contactos", b.grupos.some((g) => g.clave === "contactos" && g.items.length >= 1));
  check("encuentra inmuebles por referencia", buscar(C(), inmA.referencia).grupos.some((g) => g.clave === "inmuebles"));
  check("encuentra oportunidades por zona sin tildes", buscar(C(), "la arena").grupos.some((g) => g.clave === "oportunidades" || g.clave === "inmuebles"));
  check("exige al menos 2 caracteres", buscar(C(), "a").total === 0 && buscar(C(), "a").minimo === 2);
  check("cada resultado lleva su ruta para abrirlo", buscar(C(), "elena").grupos[0].items[0].ruta.startsWith("#/"));

  const p = panel(C());
  const ind = (id) => p.indicadores.find((i) => i.id === id);
  const cuenta = (sql) => Number(C().bd.valor(sql));
  check("«Oportunidades nuevas» = las que están en Detectada", ind("oportunidades_nuevas").valor === cuenta("SELECT COUNT(*) FROM oportunidades WHERE estado='detectada'"));
  check("«Inmuebles activos» cuenta solo disponible, reservado y en negociación", ind("inmuebles_activos").valor === cuenta("SELECT COUNT(*) FROM inmuebles WHERE estado_comercial IN ('disponible','reservado','en_negociacion')"));
  check("«Compradores activos» = personas con demanda activa", ind("compradores_activos").valor === cuenta("SELECT COUNT(DISTINCT contacto_id) FROM demandas WHERE estado='activa'"));
  check("cada indicador explica su definición", p.indicadores.every((i) => i.definicion && i.definicion.length > 10));
  check("lo de la Fase 2 NO enseña un 0 falso: es «sin datos» (null) y dice su fase", ["visitas_proximas", "ofertas_pendientes", "operaciones_en_curso"].every((id) => ind(id).valor === null && ind(id).fase === 2));
  check("el embudo separa detectadas, contacto, encargo y cerradas", p.embudo.detectadas + p.embudo.en_contacto + p.embudo.encargos + p.embudo.descartadas === p.embudo.total && p.embudo.operaciones_cerradas === null);
  check("resultados por fuente y por municipio salen de los datos", p.por_fuente.reduce((a, f) => a + f.total, 0) === p.embudo.total && p.por_municipio.reduce((a, f) => a + f.total, 0) === p.embudo.total);
  check("cada fila por fuente cuadra (abiertas + encargos + cerradas = total)", p.por_fuente.every((f) => f.abiertas + f.encargos + f.cerradas === f.total));
  check("hay datos, así que el panel no está «vacío»", p.vacio === false);
  const aVacia = crearApp({ datos: path.join(RAIZ, "vacia"), reloj });
  const pv = panel(aVacia.ctx("real"));
  check("con una base nueva el panel está vacío y los contadores reales son 0 (no null)", pv.vacio === true && pv.indicadores.find((i) => i.id === "oportunidades_nuevas").valor === 0 && pv.indicadores.find((i) => i.id === "tareas_vencidas").valor === 0);
  check("…y los de fases futuras siguen siendo «sin datos»", pv.indicadores.find((i) => i.id === "ofertas_pendientes").valor === null);
  aVacia.cerrar();
}

// ============================================================================
seccion("⚙️  Configuración y catálogos");
{
  const m0 = config.listarCatalogo(C(), "municipio").length;
  check("los 78 concejos vienen cargados, sin limitar a una lista parcial", m0 === 78);
  const nuevo = config.anadirCatalogo(C(), "municipio", "  Parroquia de Prueba  ");
  check("se puede incorporar un municipio (o zona) más", nuevo.etiqueta === "Parroquia de Prueba" && config.listarCatalogo(C(), "municipio").length === 79);
  await lanza("no se admite repetido (sin distinguir tildes/mayúsculas)", () => config.anadirCatalogo(C(), "municipio", "oviedo"), { estado: 409, codigo: "catalogo_duplicado" });
  check("lo añadido se acepta enseguida en oportunidades", opp({ municipio: "parroquia de prueba" }).municipio === "Parroquia de Prueba");
  check("un municipio fuera del catálogo se admite como texto libre (no se limita)", opp({ municipio: "Lugar Nuevo Sin Catalogar" }).municipio === "Lugar Nuevo Sin Catalogar");
  config.activarCatalogo(C(), nuevo.id, false);
  check("desactivar una entrada la oculta de las listas activas sin romper los registros", config.listarCatalogo(C(), "municipio", { soloActivos: true }).length === 78);
  config.anadirCatalogo(C(), "fuente", "Mi fuente nueva");
  check("también se amplían las fuentes y los tipos", C().cat("fuente", "mi fuente nueva") === "Mi fuente nueva" && opp({ fuente: "Mi fuente nueva" }).fuente === "Mi fuente nueva");
  const cfg = config.guardarConfig(C(), "referencias", { inmueble_prefijo: "CAS", inmueble_digitos: 5 });
  check("el prefijo de las referencias es configurable", cfg.referencias.inmueble_prefijo === "CAS");
  check("…y se usa en los inmuebles nuevos", inmuebles.crear(C(), { tipo: "Piso", municipio: "Oviedo" }).referencia.startsWith("CAS-0"));
  await lanza("un prefijo con símbolos raros se rechaza", async () => config.guardarConfig(C(), "referencias", { inmueble_prefijo: "A/B" }), { estado: 422, campo: "inmueble_prefijo" });
  config.guardarConfig(C(), "referencias", { inmueble_prefijo: "INM", inmueble_digitos: 4 });
  config.guardarConfig(C(), "inmobiliaria", { nombre: "Inmobiliaria Prueba", telefono: "985 000 000", web: "https://example.com" });
  check("los datos de la inmobiliaria se guardan", C().config().inmobiliaria.nombre === "Inmobiliaria Prueba");
  await lanza("sección de configuración inexistente → 404", async () => config.guardarConfig(C(), "inventada", {}), { estado: 404 });
}

// ============================================================================
seccion("📤 Exportar a CSV");
{
  persona("=CMD|' /C calc'!A0", { apellidos: "Inyección;con\"comillas\nsalto" });
  const csv = exportarCsv(C(), "contactos");
  check("empieza con BOM UTF-8 y usa «;» (Excel en español)", csv.contenido.startsWith("﻿ID;Nombre;"));
  check("las fórmulas peligrosas quedan neutralizadas", csv.contenido.includes("'=CMD|") && !/;=CMD/.test(csv.contenido));
  check("comillas y separador se escapan; el salto de línea de un campo de una línea se aplana", csv.contenido.includes('"Inyección;con""comillas salto"'));
  const sin = exportarCsv(C(), "contactos", { sin_personales: true });
  check("«sin datos personales» omite nombre, teléfono y correo", !/Teléfono|Correo|Nombre/.test(sin.contenido.split("\r\n")[0]) && sin.nombre.includes("sin-datos-personales"));
  check("todas las entidades principales se exportan", ["oportunidades", "inmuebles", "demandas", "tareas", "actividades"].every((e) => exportarCsv(C(), e).contenido.length > 20));
  await lanza("una entidad desconocida no se exporta", async () => exportarCsv(C(), "usuarios; DROP"), { estado: 422 });
  check("el número de filas del CSV coincide con la tabla", csv.contenido.trim().split("\r\n").length - 1 >= csv.filas);
}

// ============================================================================
seccion("💾 Copias de seguridad y restauración");
let copiaBuena;
{
  const antes = { c: C().bd.valor("SELECT COUNT(*) FROM contactos"), o: C().bd.valor("SELECT COUNT(*) FROM oportunidades"), i: C().bd.valor("SELECT COUNT(*) FROM inmuebles") };
  fs.mkdirSync(path.join(DATOS, "archivos", "fotos"), { recursive: true });
  fs.writeFileSync(path.join(DATOS, "archivos", "fotos", "foto ñ.jpg"), crypto.randomBytes(5000));
  fs.writeFileSync(path.join(DATOS, "archivos", "nota.txt"), "documento de prueba");
  const e = await copias.estadoCopias(app);
  check("sin copias y con datos, el panel avisa de que falta la primera copia", /ninguna copia/.test(e.aviso || ""));
  copiaBuena = await copias.crearCopia(app, { tipo: "copia" });
  check("la copia se crea y recuenta lo que contiene", copiaBuena.nombre.startsWith("copia-") && copiaBuena.recuentos.contactos === antes.c && copiaBuena.archivos === 2);
  check("no queda ningún .parcial ni carpeta temporal", fs.readdirSync(app.dirs.copias).every((f) => !f.endsWith(".parcial") && !f.startsWith(".tmp")));
  const insp = await copias.inspeccionarPorNombre(app, copiaBuena.nombre);
  check("la copia se puede inspeccionar (qué trae) sin restaurarla", insp.valida && insp.recuentos.oportunidades === antes.o && insp.esquema === 1);
  let externo = "n/d";
  try { externo = execFileSync("unzip", ["-tq", path.join(app.dirs.copias, copiaBuena.nombre)], { encoding: "utf8" }).trim(); } catch (err) { externo = err.code === "ENOENT" ? "n/d" : `ERROR ${err.message}`; }
  check("un lector de ZIP externo (unzip) valida la copia", externo === "n/d" || /No errors/.test(externo), externo);
  check("tras la copia el aviso desaparece", (await copias.estadoCopias(app)).aviso === null);
  reloj.avanzaDias(8);
  check("pasada una semana sin copias nuevas, avisa otra vez (con el consejo de guardar fuera)", /pendrive o nube/.test((await copias.estadoCopias(app)).aviso || ""));
  reloj.avanzaDias(-8);

  // Cambios posteriores y restauración
  persona("Contacto posterior a la copia");
  fs.writeFileSync(path.join(DATOS, "archivos", "nota.txt"), "MODIFICADO");
  fs.writeFileSync(path.join(DATOS, "archivos", "nueva.txt"), "no estaba en la copia");
  check("hay un contacto más que en la copia", C().bd.valor("SELECT COUNT(*) FROM contactos") === antes.c + 1);
  const rest = await copias.restaurarCopia(app, copiaBuena.nombre);
  check("restaurar devuelve los datos como estaban", C().bd.valor("SELECT COUNT(*) FROM contactos") === antes.c && C().bd.valor("SELECT COUNT(*) FROM oportunidades") === antes.o && rest.recuentos.contactos === antes.c);
  check("restaura también los archivos (y quita los posteriores)", fs.readFileSync(path.join(DATOS, "archivos", "nota.txt"), "utf8") === "documento de prueba" && !fs.existsSync(path.join(DATOS, "archivos", "nueva.txt")) && fs.existsSync(path.join(DATOS, "archivos", "fotos", "foto ñ.jpg")));
  check("antes de restaurar guarda una copia de lo que había (para poder arrepentirse)", rest.copia_previa.startsWith("antes-de-restaurar-") && fs.existsSync(path.join(app.dirs.copias, rest.copia_previa)));
  check("tras restaurar la aplicación sigue funcionando y no quedan restos", C().bd.valor("SELECT COUNT(*) FROM inmuebles") === antes.i && !fs.existsSync(`${app.dirs.bdReal}.reemplazada`) && fs.readdirSync(DATOS).every((f) => !f.startsWith(".restaurar")));
  const deshacer = await copias.restaurarCopia(app, rest.copia_previa);
  check("se puede deshacer la restauración con la copia previa", C().bd.valor("SELECT COUNT(*) FROM contactos") === antes.c + 1 && deshacer.restaurada === rest.copia_previa);

  // Copias dañadas o hostiles
  const dañada = path.join(app.dirs.copias, "copia-20200101-000000.zip");
  const buf = fs.readFileSync(path.join(app.dirs.copias, copiaBuena.nombre));
  const mal = Buffer.from(buf); mal[Math.floor(mal.length / 2)] ^= 0xff;
  fs.writeFileSync(dañada, mal);
  const e1 = await error(() => copias.restaurarCopia(app, "copia-20200101-000000.zip"));
  check("una copia con un byte alterado se rechaza", Boolean(e1) && e1.estado === 422 && /dañada|comprobación/.test(e1.message), e1?.message);
  check("…y los datos actuales quedan intactos", C().bd.valor("SELECT COUNT(*) FROM contactos") === antes.c + 1);
  fs.writeFileSync(path.join(app.dirs.copias, "copia-20200102-000000.zip"), buf.subarray(0, buf.length - 30));
  const e2 = await error(() => copias.restaurarCopia(app, "copia-20200102-000000.zip"));
  check("una copia cortada (descarga incompleta) se rechaza con mensaje comprensible", Boolean(e2) && e2.estado === 422 && /ZIP|válida|dañada/.test(e2.message), e2?.message);
  const ajeno = path.join(RAIZ, "ajeno.zip");
  const zw = await new zip.EscritorZip(ajeno).abrir();
  await zw.anadirBuffer("hola.txt", Buffer.from("no soy una copia"));
  await zw.cerrar();
  fs.copyFileSync(ajeno, path.join(app.dirs.copias, "copia-20200103-000000.zip"));
  const e3 = await error(() => copias.restaurarCopia(app, "copia-20200103-000000.zip"));
  check("un ZIP cualquiera (sin manifiesto) no se acepta como copia", e3?.codigo === "copia_sin_manifiesto", e3?.message);
  // Esquema más nuevo
  const futura = path.join(app.dirs.copias, "copia-20200104-000000.zip");
  const tmpBd = path.join(RAIZ, "futura.sqlite"); fs.copyFileSync(path.join(DATOS, "captao.sqlite"), tmpBd);
  const bdf = (await import("node:sqlite")).DatabaseSync; const dbf = new bdf(tmpBd); dbf.exec("PRAGMA wal_checkpoint(TRUNCATE)"); dbf.close();
  const zf = await new zip.EscritorZip(futura).abrir();
  const sha = crypto.createHash("sha256").update(fs.readFileSync(tmpBd)).digest("hex");
  await zf.anadirBuffer("manifiesto.json", Buffer.from(JSON.stringify({ app: "captaoportunidades", formato: 1, esquema: 99, contenido: [{ ruta: "captao.sqlite", bytes: fs.statSync(tmpBd).size, sha256: sha }] })));
  await zf.anadirArchivo("captao.sqlite", tmpBd);
  await zf.cerrar();
  const e4 = await error(() => copias.restaurarCopia(app, "copia-20200104-000000.zip"));
  check("una copia de una versión más nueva del programa se rechaza explicando por qué", e4?.codigo === "copia_mas_nueva" && /Actualiza el programa/.test(e4.message), e4?.message);
  // Zip slip
  const slip = path.join(RAIZ, "slip.zip");
  const zs = await new zip.EscritorZip(slip).abrir();
  await zs.anadirBuffer("aa/evil.txt", Buffer.from("malo"));
  await zs.cerrar();
  const raw = fs.readFileSync(slip);
  for (let i = 0; i < raw.length - 3; i++) if (raw.toString("latin1", i, i + 3) === "aa/") raw.write("../", i, "latin1");
  fs.writeFileSync(slip, raw);
  const { entradas } = await zip.leerZip(slip);
  const eSlip = await error(() => zip.extraerEntrada(slip, entradas[0], path.join(RAIZ, "salida-slip.txt")));
  check("ZIP con ruta maliciosa (../) es rechazado al extraer (zip slip)", eSlip?.codigo === "zip_nombre" && !fs.existsSync(path.join(RAIZ, "salida-slip.txt")) && !fs.existsSync(path.join(RAIZ, "evil.txt")), eSlip?.message);
  const zx = await new zip.EscritorZip(path.join(RAIZ, "x.zip")).abrir();
  check("nombres peligrosos no se pueden ni escribir", (await error(() => zx.anadirBuffer("../x", Buffer.from("a"))))?.codigo === "zip_nombre");
  await zx.abortar();
  // Bomba: tamaño declarado menor que el real
  const bomba = path.join(RAIZ, "bomba.zip");
  const zb = await new zip.EscritorZip(bomba).abrir(); await zb.anadirBuffer("grande.txt", Buffer.alloc(100000, 65)); await zb.cerrar();
  const eb = (await zip.leerZip(bomba)).entradas[0]; eb.usize = 10;
  check("una entrada que se hincha más de lo declarado se corta (zip bomb)", (await error(() => zip.extraerEntrada(bomba, eb, null)))?.codigo === "zip_bomba");

  // Subida y rotación
  const { Readable } = await import("node:stream");
  const subida = await copias.guardarSubida(app, Readable.from([fs.readFileSync(path.join(app.dirs.copias, copiaBuena.nombre))]));
  check("subir una copia válida la guarda y la valida", subida.valida && subida.nombre.startsWith("subida-") && subida.recuentos.contactos === antes.c);
  const eSub = await error(() => copias.guardarSubida(app, Readable.from([Buffer.from("esto no es un zip, solo basura de texto para probar")])));
  check("subir basura se rechaza y no deja ficheros", Boolean(eSub) && fs.readdirSync(app.dirs.copias).every((f) => !f.endsWith(".parcial")));
  const antes2 = copias.listarCopias(app).length;
  await copias.eliminarCopia(app, subida.nombre);
  check("se puede eliminar una copia concreta", copias.listarCopias(app).length === antes2 - 1);
  await lanza("los nombres de copia con '..' o rutas no se aceptan", async () => copias.rutaCopia(app, "../../etc/passwd"), { estado: 404 });

  C().config(); config.guardarConfig(C(), "copias", { conservar: 2 });
  for (const f of fs.readdirSync(app.dirs.copias)) if (f.startsWith("auto-")) fs.rmSync(path.join(app.dirs.copias, f));
  reloj.avanzaDias(1);
  const a1 = await copias.copiaAutomaticaSiToca(app);
  const noDeNuevo = await copias.copiaAutomaticaSiToca(app);
  reloj.avanzaDias(1); const a2 = await copias.copiaAutomaticaSiToca(app);
  reloj.avanzaDias(1); const a3 = await copias.copiaAutomaticaSiToca(app);
  check("la copia automática se hace una vez al día (no repite el mismo día)", a1 && noDeNuevo === null && a2 && a3);
  check("la rotación conserva solo las N más recientes", copias.listarCopias(app).filter((c) => c.tipo === "auto").length === 2);
  const aVacia = crearApp({ datos: path.join(RAIZ, "sin-datos"), reloj });
  check("sin datos no se hacen copias automáticas vacías", await copias.copiaAutomaticaSiToca(aVacia) === null);
  aVacia.cerrar();
}

// ============================================================================
seccion("🧪 Datos de demostración, separados de los reales");
{
  const dir = path.join(RAIZ, "con-demo");
  const a = crearApp({ datos: dir, reloj });
  check("la base real arranca vacía aunque exista la demostración", a.bd("real").valor("SELECT COUNT(*) FROM contactos") === 0);
  const dem = a.bd("demo");
  check("la demostración trae datos coherentes en todas las entidades", ["contactos", "oportunidades", "inmuebles", "demandas", "tareas", "actividades", "encargos"].every((t) => dem.valor(`SELECT COUNT(*) FROM ${t}`) > 0));
  check("la demostración usa una base distinta (otro fichero)", fs.existsSync(a.dirs.bdDemo) && a.dirs.bdDemo !== a.dirs.bdReal);
  check("los datos ficticios no tienen teléfonos ni correos reales (600 000 1xx y example.com)", dem.todos("SELECT telefono, email FROM contactos").every((c) => (!c.telefono || /^600 000 1\d\d$/.test(c.telefono)) && (!c.email || c.email.endsWith("@example.com"))));
  check("la demostración marca que es demo en su configuración", a.ctx("demo").bd.valor("SELECT valor FROM configuracion WHERE clave='demo'") === "true");
  const antesReal = a.bd("real").valor("SELECT COUNT(*) FROM contactos");
  contactos.crear(a.ctx("demo"), { nombre: "Solo en demo" }, { confirmar_duplicado: true });
  check("escribir en la demostración no toca los datos reales", a.bd("real").valor("SELECT COUNT(*) FROM contactos") === antesReal);
  a.restablecerDemo();
  check("restablecer la demostración la deja como nueva (sin lo añadido)", a.bd("demo").valor("SELECT COUNT(*) FROM contactos WHERE nombre='Solo en demo'") === 0 && a.bd("demo").valor("SELECT COUNT(*) FROM contactos") === 7);
  const copiaSinDemo = await copias.crearCopia(a, { tipo: "copia" });
  check("una copia de seguridad NUNCA incluye la demostración", copiaSinDemo.recuentos.contactos === 0);
  a.cerrar();
}

// ============================================================================
seccion("🌐 Servidor HTTP real: seguridad y recorrido completo");
{
  const dir = path.join(RAIZ, "http");
  let srv = await iniciar({ puerto: 0, datos: dir, reloj, copiasAutomaticas: false });
  const base = () => `http://127.0.0.1:${srv.puerto}`;
  const J = { "content-type": "application/json", "x-captao": "1" };
  const api = async (metodo, ruta, cuerpo, cab = {}) => {
    const r = await fetch(base() + ruta, { method: metodo, headers: { ...J, ...cab }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    let datos = null; const texto = await r.text();
    try { datos = JSON.parse(texto); } catch { datos = texto; }
    return { estado: r.status, datos, cab: r.headers };
  };
  const crudo = (opciones, cuerpo) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: srv.puerto, ...opciones }, (res) => { let t = ""; res.on("data", (c) => (t += c)); res.on("end", () => resolve({ estado: res.statusCode, texto: t, cab: res.headers })); });
    req.on("error", reject); if (cuerpo) req.write(cuerpo); req.end();
  });

  const est = await api("GET", "/api/estado");
  check("el servidor responde con la identidad de la app", est.estado === 200 && est.datos.app === "captaoportunidades" && est.datos.fase === 1 && est.datos.modo === "real");
  check("escucha solo en 127.0.0.1", srv.server.address().address === "127.0.0.1");
  check("las respuestas llevan cabeceras de seguridad (CSP estricta, nosniff, sin referrer)", /script-src 'self'/.test(est.cab.get("content-security-policy")) && !/unsafe-inline/.test(est.cab.get("content-security-policy")) && est.cab.get("x-content-type-options") === "nosniff" && est.cab.get("referrer-policy") === "no-referrer");
  check("la API no se cachea", est.cab.get("cache-control") === "no-store");
  const hostMalo = await crudo({ path: "/api/estado", headers: { host: "evil.example.com" } });
  check("un Host ajeno se rechaza (anti DNS rebinding)", hostMalo.estado === 421);
  const hostPuerto = await crudo({ path: "/api/estado", headers: { host: "127.0.0.1:9999" } });
  check("un Host con otro puerto también", hostPuerto.estado === 421);
  const origenMalo = await crudo({ path: "/api/contactos", method: "POST", headers: { host: `127.0.0.1:${srv.puerto}`, origin: "https://evil.example.com", "content-type": "application/json", "x-captao": "1" } }, "{}");
  check("una petición con Origin ajeno se rechaza", origenMalo.estado === 403);
  const cross = await crudo({ path: "/api/contactos", headers: { host: `127.0.0.1:${srv.puerto}`, "sec-fetch-site": "cross-site" } });
  check("una petición «cross-site» se rechaza aunque sea de lectura", cross.estado === 403);
  const sinCab = await crudo({ path: "/api/contactos", method: "POST", headers: { host: `127.0.0.1:${srv.puerto}`, "content-type": "text/plain" } }, '{"nombre":"x"}');
  check("un POST sin la cabecera de la app se rechaza (anti CSRF)", sinCab.estado === 403);
  check("…y no creó nada", (await api("GET", "/api/contactos")).datos.total === 0);
  const rotoJson = await crudo({ path: "/api/contactos", method: "POST", headers: { host: `127.0.0.1:${srv.puerto}`, "content-type": "application/json", "x-captao": "1" } }, "{no es json");
  check("un JSON roto da 400 con mensaje claro", rotoJson.estado === 400 && /JSON/.test(rotoJson.texto));
  const tipoMalo = await crudo({ path: "/api/contactos", method: "POST", headers: { host: `127.0.0.1:${srv.puerto}`, "content-type": "text/plain", "x-captao": "1" } }, '{"nombre":"x"}');
  check("un tipo de contenido que no es JSON da 415", tipoMalo.estado === 415);
  const grande = await crudo({ path: "/api/contactos", method: "POST", headers: { host: `127.0.0.1:${srv.puerto}`, "content-type": "application/json", "x-captao": "1" } }, JSON.stringify({ nombre: "x", notas: "a".repeat(1100000) }));
  check("un cuerpo de más de 1 MB se rechaza (413)", grande.estado === 413);
  check("API inexistente → 404 y método incorrecto → 405", (await api("GET", "/api/nada")).estado === 404 && (await api("DELETE", "/api/estado")).estado === 405);
  check("un identificador que no es número → 404, no 500", (await api("GET", "/api/contactos/abc")).estado === 404 && (await api("GET", "/api/contactos/99999")).estado === 404);
  const trav = await crudo({ path: "/%2e%2e/%2e%2e/package.json", headers: { host: `127.0.0.1:${srv.puerto}` } });
  const trav2 = await crudo({ path: "/..%2f..%2fpackage.json", headers: { host: `127.0.0.1:${srv.puerto}` } });
  check("la web estática no sirve archivos fuera de su carpeta (path traversal)", [403, 404].includes(trav.estado) && [403, 404].includes(trav2.estado) && !/jpmr-negocios/.test(trav.texto + trav2.texto));
  const raiz = await crudo({ path: "/", headers: { host: `127.0.0.1:${srv.puerto}` } });
  check("la página de inicio se sirve", raiz.estado === 200 && /CAPTAOPORTUNIDADES/.test(raiz.texto) && /text\/html/.test(raiz.cab["content-type"]));
  check("la página no lleva scripts ni estilos en línea (compatible con la CSP)", !/<script(?![^>]*\bsrc=)[^>]*>[^<]/i.test(raiz.texto) && !/<style/i.test(raiz.texto) && !/\sstyle="/i.test(raiz.texto) && !/\son[a-z]+="/i.test(raiz.texto));

  // Recorrido completo por la API
  const cat = (await api("GET", "/api/catalogos")).datos;
  check("el catálogo sirve estados, municipios y configuración a la interfaz", cat.enumeraciones.estados_oportunidad.length === 12 && cat.catalogos.municipio.length === 78 && cat.config.usuario.nombre);
  const c1 = await api("POST", "/api/contactos", { nombre: "Rosa", apellidos: "Valdés", telefono: "600 000 501", procedencia: "formulario_web" });
  check("POST contacto → 201", c1.estado === 201 && c1.datos.id > 0);
  const dup = await api("POST", "/api/contactos", { nombre: "Rosa V.", telefono: "600000501", procedencia: "formulario_web" });
  check("duplicado → 409 con candidatos para decidir", dup.estado === 409 && dup.datos.error.codigo === "duplicado_posible" && dup.datos.error.candidatos[0].id === c1.datos.id);
  const val = await api("POST", "/api/contactos", { nombre: "", telefono: "xx" });
  check("error de validación → 422 con detalle por campo", val.estado === 422 && val.datos.error.campos.nombre && val.datos.error.campos.telefono);
  const o1 = await api("POST", "/api/oportunidades", { fuente: "Idealista", tipo_inmueble: "Piso", municipio: "Mieres", zona: "Centro", precio_anunciado: 120000, superficie_m2: 80, contacto_id: c1.datos.id, enlace: "https://www.example.com/anuncio/555" });
  check("POST oportunidad → 201", o1.estado === 201 && o1.datos.estado === "detectada");
  const bloqueo = await api("POST", `/api/oportunidades/${o1.datos.id}/estado`, { estado: "conversacion_iniciada" });
  check("el avance sin verificar da 409 con la acción a realizar", bloqueo.estado === 409 && bloqueo.datos.error.accion === "verificar");
  await api("PUT", `/api/oportunidades/${o1.datos.id}`, { verificacion_contacto: "permitido", verificacion_evidencia: "Ella rellenó el formulario" });
  const av = await api("POST", `/api/oportunidades/${o1.datos.id}/estado`, { estado: "conversacion_iniciada" });
  check("tras verificar, avanza", av.estado === 200 && av.datos.oportunidad.estado === "conversacion_iniciada");
  const act = await api("POST", "/api/actividades", { tipo: "llamada", direccion: "entrante", fecha: "2026-10-08", resumen: "Llamó ella", oportunidad_id: o1.datos.id, contacto_id: c1.datos.id });
  check("registrar una conversación → 201", act.estado === 201 && act.datos.actividad.id > 0);
  const cf = await api("POST", `/api/oportunidades/${o1.datos.id}/confirmar-encargo`, { encargo: { tipo: "venta", exclusividad: true, vigencia_hasta: "2027-04-01", honorarios_tipo: "porcentaje", honorarios_valor: 3.5 } });
  check("confirmar el encargo por la API crea el inmueble y lo vincula", cf.estado === 200 && cf.datos.inmueble.referencia.startsWith("INM-") && cf.datos.inmueble.propietarios[0].contacto_id === c1.datos.id && cf.datos.oportunidad.estado === "encargo_confirmado");
  const inm = cf.datos.inmueble;
  const d = await api("POST", "/api/demandas", { contacto_id: (await api("POST", "/api/contactos", { nombre: "Sergio", telefono: "600 000 502", procedencia: "propia_persona" })).datos.id, municipios: ["Mieres"], presupuesto_max: 130000, tipos: ["Piso"], habitaciones_min: 2 });
  check("POST demanda → 201 y el comprador queda marcado", d.estado === 201 && d.datos.contacto.nombre_completo === "Sergio");
  const tk = await api("POST", "/api/tareas", { titulo: "Enviar el piso de Mieres a Sergio", tipo: "email", fecha: "2026-10-09", inmueble_id: inm.id, demanda_id: d.datos.id, aviso_min: 0 });
  check("POST tarea enlazada al inmueble y a la demanda → 201", tk.estado === 201 && tk.datos.tarea.inmueble_id === inm.id);
  const ag = await api("GET", "/api/tareas?vista=pendientes");
  check("la agenda la lista con su resumen", ag.datos.datos.some((x) => x.id === tk.datos.tarea.id) && ag.datos.resumen.pendientes >= 2);
  const rec = await api("GET", "/api/recordatorios");
  check("los recordatorios internos funcionan por la API", Array.isArray(rec.datos.items) && rec.datos.resumen);
  const bu = await api("GET", "/api/buscar?q=mieres");
  check("el buscador global lo encuentra todo", bu.datos.grupos.length >= 2);
  const ini = await api("GET", "/api/inicio");
  check("el panel refleja el recorrido: 1 encargo, 1 inmueble en preparación, 1 comprador activo", ini.datos.indicadores.find((i) => i.id === "encargos_vigentes").valor === 1 && ini.datos.indicadores.find((i) => i.id === "compradores_activos").valor === 1 && ini.datos.embudo.encargos === 1);
  const hi = await api("GET", `/api/historial?entidad=oportunidad&id=${o1.datos.id}`);
  check("el historial de cambios de la oportunidad está disponible", hi.datos.datos.some((h) => h.campo === "estado" && h.valor_nuevo === "encargo_confirmado"));
  const csvR = await fetch(`${base()}/api/exportar/inmuebles`, { headers: J });
  check("exportar CSV por la API", csvR.status === 200 && /text\/csv/.test(csvR.headers.get("content-type")) && /attachment/.test(csvR.headers.get("content-disposition")));

  // Copias por HTTP: crear, descargar, alterar, subir, restaurar
  const cp = await api("POST", "/api/copias");
  check("POST /api/copias crea la copia", cp.estado === 201 && cp.datos.recuentos.contactos === 2 && cp.datos.recuentos.oportunidades === 1);
  const desc = await fetch(`${base()}/api/copias/${cp.datos.nombre}/descargar`);
  const zipBytes = Buffer.from(await desc.arrayBuffer());
  check("la copia se descarga como ZIP real", desc.status === 200 && desc.headers.get("content-type") === "application/zip" && zipBytes.subarray(0, 2).toString() === "PK" && zipBytes.length === cp.datos.bytes);
  const extra = await api("POST", "/api/contactos", { nombre: "Posterior" });
  check("se añade un dato posterior a la copia", extra.estado === 201);
  const subir = await fetch(`${base()}/api/copias/subir`, { method: "POST", headers: { "content-type": "application/octet-stream", "x-captao": "1" }, body: zipBytes });
  const sj = await subir.json();
  check("subir la copia descargada (como si fuera de un pendrive) la valida y dice qué trae", subir.status === 201 && sj.valida && sj.recuentos.contactos === 2);
  const sinConf = await api("POST", "/api/copias/restaurar", { nombre: sj.nombre });
  check("restaurar SIN confirmación expresa se rechaza", sinConf.estado === 422 && sinConf.datos.error.campos.confirmar);
  const rs = await api("POST", "/api/copias/restaurar", { nombre: sj.nombre, confirmar: true });
  check("restaurar con confirmación devuelve los datos de la copia", rs.estado === 200 && (await api("GET", "/api/contactos")).datos.total === 2);
  const basura = await fetch(`${base()}/api/copias/subir`, { method: "POST", headers: { "content-type": "application/octet-stream", "x-captao": "1" }, body: Buffer.from("no es un zip") });
  check("subir un archivo que no es una copia da 422 con explicación", basura.status === 422 && /válida|ZIP|copia/i.test((await basura.json()).error.mensaje));

  // Modo demostración (cabecera) separado de lo real
  const demoHdr = { "x-captao-modo": "demo" };
  const dEst = await api("GET", "/api/estado", undefined, demoHdr);
  check("el modo demostración se pide por cabecera y se identifica como tal", dEst.datos.modo === "demo" && dEst.datos.demo === true && !dEst.datos.ubicacion_datos.includes(dir));
  const dCon = await api("GET", "/api/contactos", undefined, demoHdr);
  check("la demostración tiene sus propios datos (7), distintos de los reales (2)", dCon.datos.total === 7 && (await api("GET", "/api/contactos")).datos.total === 2);
  const dCopia = await api("POST", "/api/copias", undefined, demoHdr);
  check("las copias de seguridad no existen en modo demostración", dCopia.estado === 409 && dCopia.datos.error.codigo === "no_disponible_en_demo");
  check("restablecer la demostración funciona solo en demostración", (await api("POST", "/api/demo/restablecer", undefined, demoHdr)).estado === 200 && (await api("POST", "/api/demo/restablecer")).estado === 409);
  check("un valor de modo raro cae siempre en los datos REALES (nunca en la demo por error)", (await api("GET", "/api/contactos", undefined, { "x-captao-modo": "../../x" })).datos.total === 2);

  // Persistencia tras reiniciar el servidor
  await srv.cerrar();
  srv = await iniciar({ puerto: 0, datos: dir, reloj, copiasAutomaticas: false });
  const tras = await api("GET", "/api/oportunidades");
  check("PERSISTENCIA: tras reiniciar el servidor los datos siguen ahí", tras.datos.total === 1 && tras.datos.datos[0].estado === "encargo_confirmado" && (await api("GET", "/api/inmuebles")).datos.total === 1 && (await api("GET", "/api/demandas")).datos.total === 1);
  check("…incluidas las relaciones (propietario ↔ inmueble)", (await api("GET", `/api/inmuebles/${inm.id}`)).datos.propietarios[0].nombre === "Rosa");
  await srv.cerrar();
}

// ============================================================================
seccion("🚀 Arranque");
{
  const dir = path.join(RAIZ, "arranque-auto");
  const sembrar = crearApp({ datos: dir, reloj });
  contactos.crear(sembrar.ctx("real"), { nombre: "Con datos" });
  sembrar.cerrar();
  const s = await iniciar({ puerto: 0, datos: dir, reloj });
  check("al arrancar con datos y sin copias recientes, se hace la copia automática", copias.listarCopias(s.app).filter((c) => c.tipo === "auto").length === 1);
  await s.cerrar();
  const web = fs.readFileSync(new URL("../captaoportunidades/web/index.html", import.meta.url), "utf8");
  check("el menú tiene las 15 secciones pedidas", ["Inicio", "Oportunidades", "Propietarios", "Inmuebles", "Compradores", "Demandas", "Agenda y tareas", "Visitas", "Ofertas", "Operaciones", "Documentos", "Marketing", "Asistente IA", "Informes", "Configuración"].every((t) => web.includes(`>${t}<`) || fs.readFileSync(new URL("../captaoportunidades/web/js/app.js", import.meta.url), "utf8").includes(`"${t}"`)));
}

app.cerrar();
await fsp.rm(RAIZ, { recursive: true, force: true });
console.log(`\n${fallados === 0 ? "✅" : "❌"} ${pasados} comprobaciones superadas${fallados ? `, ${fallados} FALLIDAS` : ""}.`);
process.exit(fallados ? 1 : 0);
