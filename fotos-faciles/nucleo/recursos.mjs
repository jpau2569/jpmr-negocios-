// ============================================================================
//  Fotos Fáciles — recursos de la web (sueltos en disco o dentro del ejecutable)
// ----------------------------------------------------------------------------
//  En desarrollo las pantallas se leen de `web/`, para poder tocarlas y
//  recargar. Cuando se empaqueta en un ejecutable único (ver
//  `herramientas/empaquetar.mjs`), esos mismos archivos viajan incrustados y se
//  registran aquí al arrancar. El servidor no nota la diferencia.
// ============================================================================
const embebidos = new Map();

/** Registra los recursos incrustados. `mapa` es { "pc.html": "<base64>" }. */
export function registraRecursos(mapa = {}) {
  for (const [nombre, base64] of Object.entries(mapa)) {
    embebidos.set(nombre, Buffer.from(base64, "base64"));
  }
  return embebidos.size;
}

export const empaquetado = () => embebidos.size > 0;

/** Devuelve el recurso incrustado o null si toca leerlo del disco. */
export function recursoEmbebido(nombre) {
  return embebidos.get(String(nombre).replace(/^\/+/, "")) || null;
}
