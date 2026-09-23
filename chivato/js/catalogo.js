/* Catálogo de testigos: se carga una vez, se guarda en el dispositivo y
   sirve tanto para el buscador como para el respaldo sin conexión.        */

const CLAVE = 'chivato.catalogo.v1';
let doc = null;

export async function cargarCatalogo() {
  if (doc) return doc;

  // 1) Copia guardada: la app abre al instante aunque no haya red.
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) doc = JSON.parse(guardado);
  } catch { /* almacenamiento no disponible: seguimos con la red */ }

  // 2) Versión de la red, para refrescar si el catálogo ha crecido.
  try {
    const resp = await fetch('datos/testigos.json', { cache: 'no-cache' });
    if (resp.ok) {
      const fresco = await resp.json();
      if (Array.isArray(fresco?.testigos) && fresco.testigos.length) {
        doc = fresco;
        try { localStorage.setItem(CLAVE, JSON.stringify(fresco)); } catch { /* cuota llena */ }
      }
    }
  } catch { /* sin conexión: nos quedamos con la copia guardada */ }

  if (!doc) throw new Error('No se ha podido cargar el catálogo de testigos.');
  return doc;
}

export const testigos = () => doc?.testigos ?? [];
export const categorias = () => doc?.categorias ?? {};
export const porId = (id) => testigos().find((t) => t.id === id) ?? null;

/** Normaliza para buscar sin tildes ni mayúsculas. */
const plano = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export function buscar(consulta, categoria = 'todas') {
  const q = plano(consulta).trim();
  const palabras = q ? q.split(/\s+/) : [];
  return testigos().filter((t) => {
    if (categoria !== 'todas' && t.categoria !== categoria) return false;
    if (!palabras.length) return true;
    const heno = plano([t.nombre, t.otros_nombres.join(' '), t.forma, t.significado, t.categoria, t.color].join(' '));
    return palabras.every((p) => heno.includes(p));
  });
}

export const ETIQUETA_GRAVEDAD = {
  critico: 'Crítico · para el coche',
  atencion: 'Atención · revísalo',
  informativo: 'Informativo',
};

export const ETIQUETA_CONDUCIR = {
  no: 'No sigas conduciendo',
  taller: 'Puedes moverte, pero al taller',
  si: 'Puedes conducir con normalidad',
};
