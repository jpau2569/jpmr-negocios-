// ============================================================================
//  Escaparate 3D Pro — carrito compartido
// ----------------------------------------------------------------------------
//  Lo usan la carta (añadir platos) y el módulo de pedidos (cerrar el pedido).
//  Se guarda en el navegador por negocio: si el cliente cierra la pestaña sin
//  querer, su pedido sigue ahí. Nada sale del dispositivo hasta que confirma.
// ============================================================================

export function crearCarrito(negocioId) {
  const clave = `escaparate3d-pro:carrito:${negocioId || "sin-configurar"}`;
  let lineas = leer();
  const oyentes = new Set();

  function leer() {
    try {
      const guardado = JSON.parse(localStorage.getItem(clave) || "[]");
      return Array.isArray(guardado) ? guardado.filter((l) => l && l.id) : [];
    } catch {
      return [];
    }
  }

  function persistir() {
    try { localStorage.setItem(clave, JSON.stringify(lineas)); } catch { /* sin almacenamiento: solo en memoria */ }
    for (const oyente of oyentes) oyente(api);
  }

  const api = {
    lineas: () => lineas.map((l) => ({ ...l })),
    unidades: () => lineas.reduce((n, l) => n + l.cantidad, 0),
    total: () => lineas.reduce((n, l) => n + l.cantidad * (Number(l.precio) || 0), 0),
    cantidadDe: (id) => lineas.find((l) => l.id === id)?.cantidad || 0,
    vacio: () => lineas.length === 0,

    anadir(plato, cantidad = 1) {
      const existente = lineas.find((l) => l.id === plato.id);
      if (existente) existente.cantidad += cantidad;
      else lineas.push({ id: plato.id, nombre: plato.nombre, precio: Number(plato.precio) || 0, cantidad });
      persistir();
      return api;
    },

    fijar(id, cantidad) {
      const n = Math.max(0, Math.round(Number(cantidad) || 0));
      lineas = n === 0 ? lineas.filter((l) => l.id !== id) : lineas.map((l) => (l.id === id ? { ...l, cantidad: n } : l));
      persistir();
      return api;
    },

    quitar: (id) => api.fijar(id, 0),
    vaciar() { lineas = []; persistir(); return api; },
    alCambiar(oyente) { oyentes.add(oyente); return () => oyentes.delete(oyente); },
  };

  return api;
}
