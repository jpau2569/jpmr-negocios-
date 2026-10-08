// ============================================================================
//  Panel de Inicio. TODOS los números salen de lo guardado; ninguno es
//  decorativo. Lo que pertenece a fases futuras (visitas, ofertas,
//  operaciones) se devuelve como `valor: null` con su fase, para que la
//  pantalla diga «llega en la Fase 2» en vez de enseñar un 0 falso.
//  Cada indicador lleva su definición.
// ============================================================================
import * as tareas from "./tareas.mjs";
import { ESTADOS_OPORTUNIDAD, ESTADOS_COMERCIALES_ACTIVOS } from "./catalogos.mjs";
import { hoy, horaAhora } from "./util.mjs";

export function panel(ctx, extras = {}) {
  const bd = ctx.bd;
  const n = (sql, p = []) => Number(bd.valor(sql, p));
  const h = hoy(ctx.reloj);
  const por_estado = ESTADOS_OPORTUNIDAD.map((e) => ({
    clave: e.clave, etiqueta: e.etiqueta, grupo: e.grupo, color: e.color,
    n: n("SELECT COUNT(*) FROM oportunidades WHERE estado = ?", [e.clave]),
  }));
  const suma = (grupo) => por_estado.filter((e) => e.grupo === grupo).reduce((a, e) => a + e.n, 0);
  const total_op = por_estado.reduce((a, e) => a + e.n, 0);
  const t = tareas.resumen(ctx);
  const activos = ESTADOS_COMERCIALES_ACTIVOS;

  const indicadores = [
    { id: "oportunidades_nuevas", etiqueta: "Oportunidades nuevas", valor: n("SELECT COUNT(*) FROM oportunidades WHERE estado = 'detectada'"), definicion: "Oportunidades en estado «Detectada», aún sin revisar.", ruta: "#/oportunidades?estado=detectada" },
    { id: "propietarios_interesados", etiqueta: "Propietarios interesados", valor: n("SELECT COUNT(*) FROM oportunidades WHERE estado = 'propietario_interesado'"), definicion: "Oportunidades en estado «Propietario interesado».", ruta: "#/oportunidades?estado=propietario_interesado" },
    { id: "valoraciones_pendientes", etiqueta: "Visitas de valoración pendientes", valor: n("SELECT COUNT(*) FROM oportunidades WHERE estado = 'visita_valoracion_programada'"), definicion: "Oportunidades en estado «Visita de valoración programada». Desde la Fase 2 saldrá del módulo de Visitas.", ruta: "#/oportunidades?estado=visita_valoracion_programada" },
    { id: "encargos_vigentes", etiqueta: "Encargos vigentes", valor: n("SELECT COUNT(*) FROM encargos WHERE estado = 'vigente' AND (vigencia_hasta IS NULL OR vigencia_hasta >= ?)", [h]), definicion: "Encargos en estado «Vigente» cuya fecha de vigencia no ha pasado.", ruta: "#/inmuebles" },
    { id: "inmuebles_activos", etiqueta: "Inmuebles activos", valor: n(`SELECT COUNT(*) FROM inmuebles WHERE estado_comercial IN (${activos.map(() => "?").join(",")})`, activos), definicion: "Inmuebles Disponibles, Reservados o En negociación.", ruta: "#/inmuebles?estado=activos" },
    { id: "compradores_activos", etiqueta: "Compradores activos", valor: n("SELECT COUNT(DISTINCT contacto_id) FROM demandas WHERE estado = 'activa'"), definicion: "Personas con al menos una demanda en estado «Activa».", ruta: "#/demandas?estado=activa" },
    { id: "visitas_proximas", etiqueta: "Visitas comerciales próximas", valor: null, fase: 2, definicion: "Llega con el módulo de Visitas (Fase 2)." },
    { id: "ofertas_pendientes", etiqueta: "Ofertas pendientes", valor: null, fase: 2, definicion: "Llega con el módulo de Ofertas (Fase 2)." },
    { id: "operaciones_en_curso", etiqueta: "Operaciones en curso", valor: null, fase: 2, definicion: "Llega con el módulo de Operaciones (Fase 2)." },
    { id: "tareas_vencidas", etiqueta: "Tareas vencidas", valor: t.vencidas, definicion: "Tareas pendientes o en curso cuya fecha y hora ya han pasado.", ruta: "#/agenda?vista=vencidas", alerta: t.vencidas > 0 },
    { id: "tareas_hoy", etiqueta: "Tareas de hoy", valor: t.hoy_abiertas, definicion: "Tareas pendientes o en curso con fecha de hoy.", ruta: "#/agenda?vista=hoy" },
  ];

  const agrupa = (columna) => bd.todos(
    `SELECT ${columna} AS clave, COUNT(*) AS total,
       SUM(CASE WHEN estado NOT IN ('encargo_confirmado','descartada','no_contactar') THEN 1 ELSE 0 END) AS abiertas,
       SUM(CASE WHEN estado = 'encargo_confirmado' THEN 1 ELSE 0 END) AS encargos,
       SUM(CASE WHEN estado IN ('descartada','no_contactar') THEN 1 ELSE 0 END) AS cerradas
     FROM oportunidades GROUP BY ${columna} ORDER BY total DESC, clave`).map((f) => ({ ...f, abiertas: Number(f.abiertas), encargos: Number(f.encargos), cerradas: Number(f.cerradas) }));

  const hm = horaAhora(ctx.reloj);
  const proximas = bd.todos(
    `SELECT t.*, c.nombre AS contacto_nombre, c.apellidos AS contacto_apellidos FROM tareas t LEFT JOIN contactos c ON c.id = t.contacto_id
     WHERE t.estado IN ('pendiente','en_curso') AND t.fecha <= ? ORDER BY t.fecha, COALESCE(t.hora, '99:99') LIMIT 8`, [h])
    .map((x) => ({ ...x, vencida: x.fecha < h || (x.fecha === h && x.hora && x.hora < hm) }));

  const avisos = [];
  const dias = ctx.config().avisos;
  const porVencer = bd.todos(
    `SELECT e.id, e.vigencia_hasta, i.id AS inmueble_id, i.referencia FROM encargos e JOIN inmuebles i ON i.id = e.inmueble_id
     WHERE e.estado = 'vigente' AND e.vigencia_hasta IS NOT NULL AND e.vigencia_hasta <= date(?, '+' || ? || ' days') ORDER BY e.vigencia_hasta`, [h, dias.encargo_dias]);
  for (const e of porVencer) {
    avisos.push({ tipo: "encargo", nivel: e.vigencia_hasta < h ? "bloqueo" : "aviso", texto: `El encargo de ${e.referencia} ${e.vigencia_hasta < h ? "venció" : "vence"} el ${e.vigencia_hasta.split("-").reverse().join("/")}.`, ruta: `#/inmuebles/${e.inmueble_id}` });
  }
  const obsoletas = n("SELECT COUNT(*) FROM demandas WHERE estado = 'activa' AND date(actualizado_en) < date(?, '-' || ? || ' days')", [h, dias.demanda_obsoleta_dias]);
  if (obsoletas) avisos.push({ tipo: "demandas", nivel: "aviso", texto: `${obsoletas} demanda(s) activa(s) sin actualizar desde hace más de ${dias.demanda_obsoleta_dias} días.`, ruta: "#/demandas?obsoletas=1" });
  if (extras.copia && extras.copia.aviso) avisos.push({ tipo: "copia", nivel: "aviso", texto: extras.copia.aviso, ruta: "#/configuracion/copias" });

  const registros = n("SELECT (SELECT COUNT(*) FROM contactos) + (SELECT COUNT(*) FROM oportunidades) + (SELECT COUNT(*) FROM inmuebles) + (SELECT COUNT(*) FROM demandas) + (SELECT COUNT(*) FROM tareas)");
  return {
    fecha: h,
    vacio: registros === 0,
    embudo: {
      detectadas: suma("detectada"), en_contacto: suma("contacto"), encargos: suma("encargo"), descartadas: suma("cerrada"),
      operaciones_cerradas: null, operaciones_fase: 2, total: total_op, por_estado,
    },
    indicadores,
    por_fuente: agrupa("fuente"),
    por_municipio: agrupa("municipio"),
    proximas_tareas: proximas,
    avisos,
  };
}
