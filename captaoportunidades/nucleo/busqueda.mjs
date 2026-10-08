// ============================================================================
//  Buscador global: contactos, oportunidades, inmuebles, demandas y tareas.
//  Sin tildes ni mayúsculas. El teléfono se busca por sus dígitos.
// ============================================================================
import { patronLike } from "./config.mjs";
import { normaliza } from "./util.mjs";

const POR_GRUPO = 6;

export function buscar(ctx, texto) {
  const q = String(texto ?? "").trim();
  if (q.length < 2) return { q, minimo: 2, grupos: [], total: 0 };
  const t = patronLike(normaliza(q));
  const digitos = q.replace(/\D/g, "");
  const grupos = [];
  const bd = ctx.bd;

  const contactos = bd.todos(
    `SELECT id, nombre, apellidos, telefono, email, es_propietario, es_comprador, no_contactar FROM contactos
     WHERE norm(nombre || ' ' || COALESCE(apellidos, '') || ' ' || COALESCE(empresa, '')) LIKE ? ESCAPE '\\'
        OR (? != '' AND telefono_norm LIKE ? ESCAPE '\\') OR email_norm LIKE ? ESCAPE '\\'
     ORDER BY actualizado_en DESC LIMIT ?`,
    [t, digitos.length >= 3 ? digitos : "", patronLike(digitos), patronLike(q.toLowerCase()), POR_GRUPO]);
  if (contactos.length) {
    grupos.push({ clave: "contactos", titulo: "Contactos", items: contactos.map((c) => ({
      id: c.id, titulo: [c.nombre, c.apellidos].filter(Boolean).join(" "),
      detalle: [c.es_propietario ? "Propietario" : null, c.es_comprador ? "Comprador" : null, c.telefono, c.email].filter(Boolean).join(" · "),
      alerta: c.no_contactar ? "No contactar" : null, ruta: `#/contactos/${c.id}`,
    })) });
  }
  const oportunidades = bd.todos(
    `SELECT id, identificador, titulo, tipo_inmueble, municipio, estado FROM oportunidades
     WHERE norm(identificador || ' ' || COALESCE(titulo, '') || ' ' || municipio || ' ' || COALESCE(zona, '') || ' ' || COALESCE(enlace, '')) LIKE ? ESCAPE '\\'
     ORDER BY actualizado_en DESC LIMIT ?`, [t, POR_GRUPO]);
  if (oportunidades.length) {
    grupos.push({ clave: "oportunidades", titulo: "Oportunidades", items: oportunidades.map((o) => ({
      id: o.id, titulo: o.titulo || `${o.tipo_inmueble} en ${o.municipio}`, detalle: `${o.identificador} · ${o.municipio}`, estado: o.estado, ruta: `#/oportunidades/${o.id}`,
    })) });
  }
  const inmuebles = bd.todos(
    `SELECT id, referencia, titulo, municipio, estado_comercial FROM inmuebles
     WHERE norm(referencia || ' ' || titulo || ' ' || municipio || ' ' || COALESCE(zona, '') || ' ' || COALESCE(direccion_interna, '')) LIKE ? ESCAPE '\\'
     ORDER BY actualizado_en DESC LIMIT ?`, [t, POR_GRUPO]);
  if (inmuebles.length) {
    grupos.push({ clave: "inmuebles", titulo: "Inmuebles", items: inmuebles.map((i) => ({
      id: i.id, titulo: i.titulo, detalle: `${i.referencia} · ${i.municipio}`, estado: i.estado_comercial, ruta: `#/inmuebles/${i.id}`,
    })) });
  }
  const demandas = bd.todos(
    `SELECT d.id, d.nombre, d.estado, d.presupuesto_max, c.nombre AS cn, c.apellidos AS ca FROM demandas d JOIN contactos c ON c.id = d.contacto_id
     WHERE norm(COALESCE(d.nombre, '') || ' ' || c.nombre || ' ' || COALESCE(c.apellidos, '') || ' ' || COALESCE(d.zonas, '') || ' ' || COALESCE(d.municipios, '')) LIKE ? ESCAPE '\\'
     ORDER BY d.actualizado_en DESC LIMIT ?`, [t, POR_GRUPO]);
  if (demandas.length) {
    grupos.push({ clave: "demandas", titulo: "Demandas", items: demandas.map((d) => ({
      id: d.id, titulo: d.nombre || `Demanda de ${[d.cn, d.ca].filter(Boolean).join(" ")}`, detalle: [d.cn, d.ca].filter(Boolean).join(" "), estado: d.estado, ruta: `#/demandas/${d.id}`,
    })) });
  }
  const tareas = bd.todos(
    `SELECT id, titulo, fecha, hora, estado FROM tareas WHERE norm(titulo) LIKE ? ESCAPE '\\' ORDER BY fecha DESC LIMIT ?`, [t, POR_GRUPO]);
  if (tareas.length) {
    grupos.push({ clave: "tareas", titulo: "Tareas", items: tareas.map((x) => ({
      id: x.id, titulo: x.titulo, detalle: `${x.fecha.split("-").reverse().join("/")}${x.hora ? ` ${x.hora}` : ""}`, estado: x.estado, ruta: `#/agenda?tarea=${x.id}`,
    })) });
  }
  return { q, grupos, total: grupos.reduce((n, g) => n + g.items.length, 0) };
}
