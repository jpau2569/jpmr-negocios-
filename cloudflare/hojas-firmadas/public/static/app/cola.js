/* ═══════════════════════════════════════════════════════════════════
   HOJAS FIRMADAS — cola de hojas pendientes de subir (sin cobertura)
   Al firmar, la hoja se guarda PRIMERO aquí (IndexedDB del móvil) y luego
   se intenta subir. Si no hay red, se queda con el aviso «pendiente de
   subir» y se sube sola al volver la conexión (evento «online»), al abrir
   la app y cada minuto mientras esté abierta.
   No se duplica nunca: cada hoja lleva su id (UUID generado en el móvil)
   y el servidor hace un INSERT idempotente (ON CONFLICT DO NOTHING).
   En cuanto el servidor la confirma, se borra del móvil: los datos de
   clientes no se quedan en el teléfono más de lo necesario.
   ═══════════════════════════════════════════════════════════════════ */

const BD = 'hojas-firmadas';
const ALMACEN = 'pendientes';

/**
 * Qué hacer con la hoja según la respuesta del servidor (puro, se prueba en Node).
 *   'subida'     201 nueva o 200 repetida → se borra del móvil
 *   'borrada'    410 se borró por supresión → se borra del móvil
 *   'sesion'     401 hay que volver a entrar → se para y se espera
 *   'espera'     429, 5xx o sin red → se reintenta más tarde
 *   'error'      409, 403, 413, 422… → se queda con el mensaje para verlo
 */
export function decideTrasSubida(estado) {
  if (estado === 200 || estado === 201) return 'subida';
  if (estado === 410) return 'borrada';
  if (estado === 401) return 'sesion';
  if (estado === 0 || estado === 429 || estado === 503 || estado >= 500) return 'espera';
  return 'error';
}

function abre() {
  return new Promise((ok, mal) => {
    const p = indexedDB.open(BD, 1);
    p.onupgradeneeded = () => {
      if (!p.result.objectStoreNames.contains(ALMACEN)) p.result.createObjectStore(ALMACEN, { keyPath: 'id' });
    };
    p.onsuccess = () => ok(p.result);
    p.onerror = () => mal(p.error);
  });
}

async function operacion(modo, hacer) {
  const base = await abre();
  try {
    return await new Promise((ok, mal) => {
      const tx = base.transaction(ALMACEN, modo);
      const pet = hacer(tx.objectStore(ALMACEN));
      tx.oncomplete = () => ok(pet?.result);
      tx.onerror = () => mal(tx.error);
      tx.onabort = () => mal(tx.error || new Error('Transacción cancelada'));
    });
  } finally {
    base.close();
  }
}

/** { id, hoja, hash, creada, estado: 'pendiente'|'error', mensaje } */
export const guarda = (item) => operacion('readwrite', (a) => a.put(item));
export const lista = async () => ((await operacion('readonly', (a) => a.getAll())) || []).sort((x, y) => String(x.creada).localeCompare(String(y.creada)));
export const lee = (id) => operacion('readonly', (a) => a.get(id));
export const quita = (id) => operacion('readwrite', (a) => a.delete(id));

let subiendo = null;

/**
 * Sube todo lo pendiente, una a una y en orden. Si ya hay una subida en
 * marcha, devuelve esa misma (no se lanzan dos a la vez).
 * Devuelve { subidas: [{ id, recibida }], quedan, motivo: ''|'sesion'|'espera'|'error' }.
 */
export function subePendientes({ hazFetch = (...a) => fetch(...a) } = {}) {
  if (subiendo) return subiendo;
  subiendo = (async () => {
    const res = { subidas: [], quedan: 0, motivo: '' };
    for (const item of await lista()) {
      let estado = 0;
      let cuerpo = {};
      try {
        const r = await hazFetch('/api/hojas', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ hoja: item.hoja, hash: item.hash }),
        });
        estado = r.status;
        cuerpo = await r.json().catch(() => ({}));
      } catch {
        estado = 0; // sin red
      }
      const que = decideTrasSubida(estado);
      if (que === 'subida' || que === 'borrada') {
        await quita(item.id);
        res.subidas.push({ id: item.id, recibida: cuerpo.recibida || '', estado: cuerpo.estado || 'firmada', borrada: que === 'borrada' });
        continue;
      }
      if (que === 'error') {
        await guarda({ ...item, estado: 'error', mensaje: [cuerpo.error, ...(cuerpo.errores || [])].filter(Boolean).join(' ') || `Error ${estado}` });
        res.motivo = 'error';
        continue;
      }
      res.motivo = que; // 'sesion' o 'espera': no tiene sentido seguir probando ahora
      break;
    }
    res.quedan = (await lista()).length;
    return res;
  })().finally(() => { subiendo = null; });
  return subiendo;
}
