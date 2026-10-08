// ============================================================================
//  Exportación a CSV (se abre bien en Excel en español: UTF-8 con BOM,
//  separador «;»). Las celdas que empiezan por = + - @ se neutralizan para que
//  una hoja de cálculo no las ejecute como fórmula. Con `sin_personales` se
//  omiten teléfonos, correos, direcciones y textos libres (minimización).
//  La importación con vista previa llega en la Fase 2.
// ============================================================================
import { celdaCsv, invalido } from "./util.mjs";

const unir = (v) => { try { const a = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(a) ? a.join(" | ") : v; } catch { return v; } };
const sino = (v) => (v === 1 ? "Sí" : v === 0 ? "No" : "");

// [cabecera, columna o función, esPersonal]
const DEFINICIONES = {
  contactos: {
    tabla: "contactos", orden: "id",
    cols: [
      ["ID", "id"], ["Nombre", "nombre", true], ["Apellidos", "apellidos", true], ["Empresa", "empresa", true], ["Teléfono", "telefono", true],
      ["Correo", "email", true], ["Canal preferido", "canal_preferido"], ["Propietario", (r) => sino(r.es_propietario)], ["Comprador", (r) => sino(r.es_comprador)],
      ["Procedencia", "procedencia"], ["Detalle procedencia", "procedencia_detalle", true], ["Plazo de venta", "plazo_venta"],
      ["No contactar", (r) => sino(r.no_contactar)], ["Fecha no contactar", "no_contactar_fecha"], ["Anonimizado", (r) => (r.anonimizado_en ? "Sí" : "No")], ["Creado", "creado_en"],
    ],
  },
  oportunidades: {
    tabla: "oportunidades", orden: "id",
    cols: [
      ["Identificador", "identificador"], ["Fuente", "fuente"], ["Fecha detección", "fecha_deteccion"], ["Estado", "estado"], ["Tipo", "tipo_inmueble"],
      ["Municipio", "municipio"], ["Zona", "zona"], ["Título", "titulo"], ["Enlace", "enlace", true], ["Precio anunciado", "precio_anunciado"],
      ["Superficie m2", "superficie_m2"], ["Habitaciones", "habitaciones"], ["Baños", "banos"], ["Anunciante", "clasificacion_anunciante"],
      ["Verificación contacto", "verificacion_contacto"], ["Responsable", "responsable"], ["Próxima acción", "proxima_accion", true],
      ["Motivo descarte", "motivo_descarte", true], ["Notas", "notas", true],
    ],
  },
  inmuebles: {
    tabla: "inmuebles", orden: "id",
    cols: [
      ["Referencia", "referencia"], ["Título", "titulo"], ["Tipo", "tipo"], ["Operación", "operacion"], ["Municipio", "municipio"], ["Zona", "zona"],
      ["Dirección interna", "direccion_interna", true], ["Ubicación pública", "ubicacion_publica"], ["Superficie m2", "superficie_m2"], ["Tipo superficie", "tipo_superficie"],
      ["Habitaciones", "habitaciones"], ["Baños", "banos"], ["Planta", "planta"], ["Ascensor", (r) => sino(r.ascensor)], ["Garaje", (r) => sino(r.garaje)],
      ["Terraza", (r) => sino(r.terraza)], ["Conservación", "estado_conservacion"], ["Precio", "precio_actual"], ["Estado comercial", "estado_comercial"],
      ["Datos pendientes", (r) => unir(r.datos_pendientes)], ["Notas internas", "notas_internas", true],
    ],
  },
  demandas: {
    tabla: "demandas", orden: "id",
    cols: [
      ["ID", "id"], ["ID contacto", "contacto_id"], ["Nombre", "nombre"], ["Operación", "operacion"], ["Municipios", (r) => unir(r.municipios)], ["Zonas", "zonas"],
      ["Presupuesto mín.", "presupuesto_min"], ["Presupuesto máx.", "presupuesto_max"], ["Tipos", (r) => unir(r.tipos)], ["Superficie mín.", "superficie_min"],
      ["Habitaciones mín.", "habitaciones_min"], ["Ascensor", "ascensor"], ["Garaje", "garaje"], ["Terraza", "terraza"], ["Plazo", "plazo_compra"],
      ["Financiación", "financiacion"], ["Estado", "estado"], ["Actualizada", "actualizado_en"], ["Requisitos", "requisitos_imprescindibles", true], ["Preferencias", "preferencias", true],
    ],
  },
  tareas: {
    tabla: "tareas", orden: "fecha, id",
    cols: [
      ["ID", "id"], ["Título", "titulo", true], ["Tipo", "tipo"], ["Fecha", "fecha"], ["Hora", "hora"], ["Prioridad", "prioridad"], ["Estado", "estado"],
      ["Responsable", "responsable"], ["ID contacto", "contacto_id"], ["ID oportunidad", "oportunidad_id"], ["ID inmueble", "inmueble_id"], ["Notas", "notas", true],
    ],
  },
  actividades: {
    tabla: "actividades", orden: "fecha, id",
    cols: [
      ["ID", "id"], ["Tipo", "tipo"], ["Dirección", "direccion"], ["Fecha", "fecha"], ["Hora", "hora"], ["Resumen", "resumen", true], ["Resultado", "resultado", true],
      ["ID contacto", "contacto_id"], ["ID oportunidad", "oportunidad_id"], ["ID inmueble", "inmueble_id"], ["ID demanda", "demanda_id"],
    ],
  },
};

export const ENTIDADES_EXPORTABLES = Object.keys(DEFINICIONES);

export function exportarCsv(ctx, entidad, { sin_personales = false } = {}) {
  const def = Object.hasOwn(DEFINICIONES, entidad) ? DEFINICIONES[entidad] : null;
  if (!def) throw invalido(`Solo se puede exportar: ${ENTIDADES_EXPORTABLES.join(", ")}.`);
  const cols = def.cols.filter((c) => !(sin_personales && c[2]));
  const filas = ctx.bd.todos(`SELECT * FROM ${def.tabla} ORDER BY ${def.orden}`);
  const lineas = [cols.map((c) => celdaCsv(c[0])).join(";")];
  for (const f of filas) lineas.push(cols.map((c) => celdaCsv(typeof c[1] === "function" ? c[1](f) : f[c[1]])).join(";"));
  return { nombre: `${entidad}${sin_personales ? "-sin-datos-personales" : ""}.csv`, contenido: "﻿" + lineas.join("\r\n") + "\r\n", filas: filas.length };
}
