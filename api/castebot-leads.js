// ============================================================================
//  Lectura de hot-leads de CasteBot — panel protegido
// ----------------------------------------------------------------------------
//  Devuelve los hot-leads registrados por la red de 6 agentes (tabla
//  castebot_leads). La lectura está protegida por la clave de sincronización
//  de Pau (la misma de la 🧠 memoria): la RPC castebot_leads_lista de
//  Supabase la valida. La clave nunca se guarda en el código.
// ============================================================================

import { nubeConfigurada, rpc } from "../lib/memoria.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!nubeConfigurada()) {
    return res.status(503).json({
      error: "El panel de hot-leads no está configurado (faltan SUPABASE_URL y SUPABASE_ANON_KEY en Vercel).",
    });
  }

  const claveSync = typeof req.body?.clave === "string" ? req.body.clave.trim() : "";
  if (!claveSync) {
    return res.status(400).json({ error: "Falta la clave de sincronización." });
  }

  try {
    const lista = await rpc("castebot_leads_lista", { clave: claveSync });
    const leads = Array.isArray(lista) ? lista : [];
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, total: leads.length, leads });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("incorrecta")) {
      return res.status(401).json({ error: "Clave de sincronización incorrecta." });
    }
    console.error("Error en /api/castebot-leads:", msg);
    return res.status(502).json({ error: "No se pudieron leer los hot-leads. Inténtalo de nuevo en un momento." });
  }
}
