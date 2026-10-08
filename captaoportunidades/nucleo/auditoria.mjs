// ============================================================================
//  Historial de cambios. Cada alta, edición, cambio de estado, vínculo o
//  borrado relevante deja una línea. Los datos personales y los textos libres
//  (campos con `sens`) NO guardan su valor: solo consta que cambiaron. Así el
//  historial sirve para saber "qué y cuándo" sin ser una segunda copia de los
//  datos personales (minimización).
// ============================================================================
import { insertar, comoGuardado } from "./bd.mjs";
import { sello, recorta } from "./util.mjs";

export function registrar(ctx, entidad, id, accion, { campo = null, antes = null, despues = null, resumen = null } = {}) {
  insertar(ctx.bd, "historial_cambios", {
    entidad, entidad_id: id, accion, campo,
    valor_anterior: antes === null ? null : recorta(antes, 200),
    valor_nuevo: despues === null ? null : recorta(despues, 200),
    resumen: resumen ? recorta(resumen, 300) : null,
    usuario: ctx.usuario(),
    fecha: sello(ctx.reloj),
  });
}

const igual = (a, b) => JSON.stringify(comoGuardado(a)) === JSON.stringify(comoGuardado(b));

/** Compara y registra un cambio por campo. Devuelve los campos que cambiaron. */
export function registrarDiff(ctx, entidad, id, def, antes, nuevos, etiquetas = {}) {
  const cambiados = [];
  for (const [campo, valor] of Object.entries(nuevos)) {
    if (!(campo in def)) continue;
    if (igual(antes[campo], valor)) continue;
    cambiados.push(campo);
    const nombre = etiquetas[campo] || def[campo].etq || campo;
    if (def[campo].sens) {
      registrar(ctx, entidad, id, "editar", { campo, resumen: `Se modificó ${nombre} (el valor no se guarda en el historial).` });
    } else {
      registrar(ctx, entidad, id, "editar", {
        campo,
        antes: antes[campo] === null || antes[campo] === undefined ? null : String(Array.isArray(antes[campo]) ? antes[campo].join(", ") : antes[campo]),
        despues: valor === null || valor === undefined ? null : String(Array.isArray(valor) ? valor.join(", ") : valor),
      });
    }
  }
  return cambiados;
}

export function historial(ctx, entidad, id, limite = 100) {
  return ctx.bd.todos(
    "SELECT * FROM historial_cambios WHERE entidad = ? AND entidad_id = ? ORDER BY fecha DESC, id DESC LIMIT ?",
    [entidad, id, limite],
  );
}
