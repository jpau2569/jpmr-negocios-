// ============================================================================
//  Lectura de leads del embudo (ebook, etc.) — panel protegido
// ----------------------------------------------------------------------------
//  Devuelve la lista de leads capturados. La lectura está protegida por la
//  clave de sincronización de Pau (la misma de la 🧠 memoria): la función RPC
//  leads_lista de Supabase la valida. La clave nunca se guarda en el código.
//
//  Requiere en Supabase la función RPC `leads_lista(clave)` (security definer)
//  que devuelve las filas de la tabla clara_leads solo si la clave es correcta.
// ============================================================================

import { nubeConfigurada, rpc } from "../lib/memoria.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!nubeConfigurada()) {
    return res.status(503).json({
      error: "El panel de leads no está configurado (faltan SUPABASE_URL y SUPABASE_ANON_KEY en Vercel).",
    });
  }

  const claveSync = typeof req.body?.clave === "string" ? req.body.clave.trim() : "";
  if (!claveSync) {
    return res.status(400).json({ error: "Falta la clave de sincronización." });
  }

  try {
    const lista = await rpc("leads_lista", { clave: claveSync });
    const leads = Array.isArray(lista) ? lista : [];
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, total: leads.length, leads });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("incorrecta")) {
      return res.status(401).json({ error: "Clave de sincronización incorrecta." });
    }
    console.error("Error en /api/leads:", msg);
    return res.status(502).json({ error: "No se pudieron leer los leads. Inténtalo de nuevo en un momento." });
  }
}
