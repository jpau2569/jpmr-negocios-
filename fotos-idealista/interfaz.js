// ============================================================================
//  Fotos para Idealista — pintar la pantalla (funciones puras: datos → HTML)
// ----------------------------------------------------------------------------
//  Todos los textos que ve Pau salen de aquí o del catálogo; nunca de la IA.
// ============================================================================

import { ESTANCIAS, estancia, objeto, aviso } from "./catalogo.js";

export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Lista con comas y «y» final: «móvil, mandos y ropa». */
export function enumerar(cosas) {
  const l = cosas.filter(Boolean);
  if (l.length <= 1) return l.join("");
  return `${l.slice(0, -1).join(", ")} y ${l.at(-1)}`;
}

/** Avisos de una foto, ya en texto para Pau. */
export function avisosFoto(f, { posicionDe } = {}) {
  const lista = [];
  if (!f.estancia) lista.push({ tipo: "info", texto: "Elige qué estancia es para que tenga buen nombre." });
  const objetos = (f.ia?.objetos_a_retirar || []).map((id) => objeto(id)?.nombre).filter(Boolean);
  if (objetos.length) {
    const t = enumerar(objetos);
    lista.push({ tipo: "retirar", texto: `Retira: ${t}.`, borrar: true });
  }
  for (const id of f.ia?.avisos || []) {
    const a = aviso(id);
    if (a) lista.push({ tipo: id === "posible_otro_inmueble" ? "grave" : "aviso", texto: `${a.texto}. ${a.consejo}` });
  }
  if (f.parecidaA && posicionDe) {
    const n = posicionDe(f.parecidaA);
    if (n) lista.push({ tipo: "aviso", texto: `Parecida a la foto ${n}.` });
  }
  return lista;
}

function htmlAvisos(lista) {
  if (!lista.length) return "";
  return `<ul class="avisos">${lista.map((a) => `<li class="av-${a.tipo}">${esc(a.texto)}${a.borrar
    ? ` <a href="/marcadeagua.html" target="_blank" rel="noopener">Borrar un objeto sin repetir la foto</a>` : ""}</li>`).join("")}</ul>`;
}

function htmlCalidad(c) {
  if (!c) return "";
  return `<p class="calidad">Luz ${c.luz}/5 · Encuadre ${c.encuadre}/5 · Nitidez ${c.nitidez}/5</p>`;
}

function selectorEstancia(f) {
  const opciones = [`<option value=""${f.estancia ? "" : " selected"}>— Elige estancia —</option>`]
    .concat(ESTANCIAS.map((e) => `<option value="${e.id}"${e.id === f.estancia ? " selected" : ""}>${esc(e.nombre)}</option>`));
  return `<label class="campo-estancia"><span class="vh">Estancia de la foto</span>
    <select data-accion="estancia" data-id="${esc(f.id)}">${opciones.join("")}</select></label>`;
}

/**
 * Tarjeta de una foto que va en el anuncio.
 * @param {object} f        foto del estado
 * @param {number} pos      posición (1, 2…)
 * @param {number} total    fotos activas
 * @param {string} nombre   nombre final del archivo
 */
export function htmlFoto(f, pos, total, nombre, opciones = {}) {
  const e = estancia(f.estancia);
  const alt = `Foto ${pos}${e ? `: ${e.nombre}` : ""}`;
  return `<li class="foto${pos === 1 ? " portada" : ""}" data-id="${esc(f.id)}"${opciones.arrastrable ? ' draggable="true"' : ""}>
  <div class="foto-img">
    <img src="${esc(f.vistaUrl)}" alt="${esc(alt)}" loading="lazy" width="240" height="180">
    <span class="numero" aria-hidden="true">${pos}</span>
    ${pos === 1 ? '<span class="sello">Portada</span>' : ""}
  </div>
  <div class="foto-datos">
    <p class="nombre-archivo" title="Nombre del archivo">${esc(nombre)}</p>
    ${selectorEstancia(f)}
    ${htmlCalidad(f.ia?.calidad)}
    ${htmlAvisos(avisosFoto(f, opciones))}
    <div class="botones-foto">
      <button type="button" class="btn-icono" data-accion="subir" data-id="${esc(f.id)}" ${pos === 1 ? "disabled" : ""} aria-label="Subir la foto ${pos}">↑</button>
      <button type="button" class="btn-icono" data-accion="bajar" data-id="${esc(f.id)}" ${pos === total ? "disabled" : ""} aria-label="Bajar la foto ${pos}">↓</button>
      <button type="button" class="btn-icono" data-accion="descargar-una" data-id="${esc(f.id)}" aria-label="Descargar la foto ${pos}">⤓</button>
      <button type="button" class="btn-quitar" data-accion="quitar" data-id="${esc(f.id)}">Quitar</button>
    </div>
  </div>
</li>`;
}

/** Tarjeta de una foto apartada (repetida o quitada por Pau). */
export function htmlApartada(f, opciones = {}) {
  const motivo = f.motivo === "duplicado"
    ? (() => {
      const n = opciones.posicionDe?.(f.parecidaA);
      return n ? `Parecida a la foto ${n}, que está más nítida.` : "Parecida a otra foto más nítida.";
    })()
    : "La has quitado tú.";
  return `<li class="apartada" data-id="${esc(f.id)}">
  <img src="${esc(f.vistaUrl)}" alt="Foto apartada" loading="lazy" width="120" height="90">
  <div>
    <p>${esc(motivo)}</p>
    <button type="button" class="btn-secundario" data-accion="recuperar" data-id="${esc(f.id)}">Volver a ponerla</button>
  </div>
</li>`;
}

/** Aviso del estado de la IA. */
export function htmlEstadoIA(ia) {
  const t = {
    apagada: ["info", "La IA está apagada: elige tú la estancia de cada foto con el desplegable."],
    trabajando: ["info", ia.mensaje || "La IA está mirando las fotos…"],
    ok: ["ok", ia.mensaje || "La IA ha revisado las fotos. Repasa lo que propone: tú decides."],
    error: ["error", `No he podido usar la IA: ${ia.mensaje || "error desconocido"} La app sigue funcionando: elige tú la estancia de cada foto.`],
  }[ia.estado];
  if (!t) return "";
  return `<p class="estado-ia estado-${t[0]}">${esc(t[1])}</p>`;
}

/** Resumen encima de la lista. */
export function htmlResumen(activas, apartadas) {
  if (!activas && !apartadas) return "";
  const partes = [`<strong>${activas}</strong> ${activas === 1 ? "foto lista" : "fotos listas"}`];
  if (apartadas) partes.push(`${apartadas} ${apartadas === 1 ? "apartada" : "apartadas"}`);
  partes.push("sin ubicación GPS");
  return partes.join(" · ");
}
