// ============================================================================
//  Alta de leads de las landings (ebook, etc.) → Supabase
// ----------------------------------------------------------------------------
//  La landing (ebook.html) llama aquí al enviar el formulario. El alta pasa por
//  la función RPC lead_guarda, que valida el email en la base de datos. La
//  lectura de leads queda protegida por la clave de sincronización de Pau
//  (función leads_lista), fuera de este endpoint público.
// ============================================================================

import { nubeConfigurada, rpc } from "../lib/memoria.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!nubeConfigurada()) {
    return res.status(503).json({
      error: "El registro de leads no está configurado (faltan SUPABASE_URL y SUPABASE_ANON_KEY en Vercel).",
    });
  }

  const { origen, nombre, email, telefono, tipo } = req.body ?? {};
  const correo = String(email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(correo)) {
    return res.status(400).json({ error: "El email no es válido." });
  }

  try {
    await rpc("lead_guarda", {
      origen_nuevo: String(origen || "web").slice(0, 60),
      nombre_nuevo: String(nombre || "").slice(0, 120),
      email_nuevo: correo.slice(0, 200),
      telefono_nuevo: String(telefono || "").slice(0, 40),
      tipo_nuevo: String(tipo || "").slice(0, 60),
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Error en /api/lead:", String(e?.message || e));
    return res.status(502).json({ error: "No se pudo registrar el lead. " + String(e?.message || e) });
  }
}
