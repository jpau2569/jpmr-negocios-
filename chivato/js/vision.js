/* Llamada al backend. La clave de la IA nunca vive aquí: el navegador habla
   con /api/chivato y es la función serverless la que llama a Claude.       */

const RUTA = '../api/chivato';   // el monorepo y la carpeta suelta comparten ruta

async function pedir(cuerpo, segundos = 60) {
  const alarma = AbortSignal.timeout ? AbortSignal.timeout(segundos * 1000) : undefined;
  let resp;
  try {
    resp = await fetch(RUTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: alarma,
    });
  } catch (e) {
    if (e?.name === 'TimeoutError') throw new Error('La IA ha tardado demasiado. Vuelve a intentarlo.');
    throw new Error('No hay conexión con el servidor. Puedes buscar el testigo a mano en la pestaña Símbolos.');
  }

  let datos = null;
  try { datos = await resp.json(); } catch { /* respuesta no JSON */ }
  if (!resp.ok) {
    const err = new Error(datos?.error || `El servidor ha respondido ${resp.status}.`);
    err.sinIA = Boolean(datos?.sin_ia);
    throw err;
  }
  return datos;
}

export const analizarFoto = (base64, mime, vehiculo) =>
  pedir({ imagen: base64, mime, vehiculo });

export const preguntar = (pregunta, ids, vehiculo) =>
  pedir({ accion: 'preguntar', pregunta, testigos: ids, vehiculo }, 45);
