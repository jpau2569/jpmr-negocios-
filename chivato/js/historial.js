/* Historial local: se guarda en el propio dispositivo (localStorage), sin
   cuentas ni servidores. Se limita a 30 entradas para no llenar la cuota.  */

const CLAVE = 'chivato.historial.v1';
const MAXIMO = 30;

export function leerHistorial() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); }
  catch { return []; }
}

export function guardarEnHistorial(entrada) {
  const lista = leerHistorial();
  lista.unshift({ ...entrada, fecha: Date.now(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  const recortada = lista.slice(0, MAXIMO);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(recortada));
  } catch {
    // Cuota llena: reintenta sin las miniaturas, que es lo que más pesa.
    try {
      localStorage.setItem(CLAVE, JSON.stringify(recortada.map(({ miniatura, ...r }) => r)));
    } catch { /* nos rendimos en silencio: el historial es un extra */ }
  }
  return recortada;
}

export function borrarEntrada(id) {
  const lista = leerHistorial().filter((e) => e.id !== id);
  try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* nada */ }
  return lista;
}

export function vaciarHistorial() {
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
  return [];
}

/* ── Datos del vehículo (opcional, mejoran la precisión) ───────────────── */
const CLAVE_COCHE = 'chivato.vehiculo.v1';

export function leerVehiculo() {
  try { return JSON.parse(localStorage.getItem(CLAVE_COCHE) || '{}'); }
  catch { return {}; }
}

export function guardarVehiculo(v) {
  try { localStorage.setItem(CLAVE_COCHE, JSON.stringify(v)); } catch { /* nada */ }
  return v;
}
