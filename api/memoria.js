// ============================================================================
//  API de la memoria en la nube de Clara
// ----------------------------------------------------------------------------
//  El panel 🧠 Memoria del chat llama aquí para leer/guardar la memoria
//  sincronizada entre dispositivos. La clave anónima de Supabase se queda en
//  el servidor; el navegador solo envía la clave de sincronización de Pau.
// ============================================================================

import { nubeConfigurada, leerMemoria, guardarMemoria } from "../lib/memoria.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!nubeConfigurada()) {
    return res.status(503).json({
      error:
        "La memoria en la nube no está configurada (faltan SUPABASE_URL y SUPABASE_ANON_KEY en Vercel). Tu memoria sigue funcionando solo en este navegador.",
    });
  }

  const { clave, accion, contenido } = req.body ?? {};
  if (typeof clave !== "string" || !clave.trim()) {
    return res.status(400).json({ error: "Falta la clave de sincronización." });
  }

  try {
    if (accion === "guarda") {
      const guardado = await guardarMemoria(clave.trim(), String(contenido ?? "").slice(0, 8000));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, contenido: guardado });
    }
    const leido = await leerMemoria(clave.trim());
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, contenido: leido });
  } catch (e) {
    const mensaje = String(e?.message || e);
    if (mensaje.includes("incorrecta")) {
      return res.status(401).json({ error: "La clave de sincronización no es correcta." });
    }
    console.error("Error en /api/memoria:", mensaje);
    return res.status(502).json({ error: "No se pudo hablar con la memoria en la nube. " + mensaje });
  }
}
