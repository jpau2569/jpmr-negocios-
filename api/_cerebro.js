// ============================================================================
//  Cerebro Útil Pau — lectura de documentos con foto (/api/cerebro)
// ----------------------------------------------------------------------------
//  Pau hace una foto a un papel (ITV, póliza, recibo del IBI, DNI…) y Claude
//  devuelve el tipo, un título y las fechas que se leen EN la imagen. La
//  respuesta se pide como herramienta forzada para que llegue siempre en el
//  mismo formato, y se valida aquí: una fecha que no sea real se descarta.
//  Nada se guarda en el servidor: la foto va y vuelve.
//
//  Protección: nunca queda abierto. Con memoria en la nube (Supabase) exige
//  la clave de sincronización de Pau (la misma de la 🧠 de Clara); sin nube,
//  exige la variable CEREBRO_CLAVE de Vercel. Así nadie más gasta su saldo.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { timingSafeEqual } from "node:crypto";
import { nubeConfigurada, leerMemoria } from "../lib/memoria.js";

function igualSeguro(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const MODEL = "claude-sonnet-5";
const TIPOS = ["itv", "seguro-coche", "revision-coche", "seguro-hogar", "seguro-vida", "ibi", "dni", "carne", "pasaporte", "garantia", "recibo", "otro"];
const IMAGENES = ["image/jpeg", "image/png", "image/webp"];
const MAX_B64 = 4_000_000;

export const HERRAMIENTA_DOCUMENTO = {
  name: "datos_documento",
  description: "Devuelve los datos leídos en la foto del documento.",
  input_schema: {
    type: "object",
    properties: {
      legible: { type: "boolean", description: "false si la foto no permite leer el documento." },
      tipo: { type: "string", enum: TIPOS },
      titulo: { type: "string", description: "Nombre corto y útil, p. ej. 'ITV del Seat León 1234ABC' o 'Seguro de hogar Mapfre'." },
      vence: { type: "string", description: "Fecha de caducidad o vencimiento en formato AAAA-MM-DD, SOLO si aparece escrita en el documento. Vacío si no aparece." },
      otras_fechas: {
        type: "array",
        items: { type: "object", properties: { que: { type: "string" }, fecha: { type: "string" } }, required: ["que", "fecha"] },
        description: "Otras fechas escritas en el documento (emisión, próxima revisión…), formato AAAA-MM-DD.",
      },
      notas: { type: "string", description: "Datos útiles leídos (compañía, nº de póliza, matrícula…). Nunca inventes." },
    },
    required: ["legible", "tipo", "titulo", "vence"],
  },
};

const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

export function limpiaLectura(x) {
  const t = (v, n) => String(v ?? "").trim().slice(0, n);
  return {
    legible: x?.legible !== false,
    tipo: TIPOS.includes(x?.tipo) ? x.tipo : "otro",
    titulo: t(x?.titulo, 80),
    vence: esFecha(x?.vence) ? x.vence : "",
    otras_fechas: (Array.isArray(x?.otras_fechas) ? x.otras_fechas : [])
      .filter((f) => esFecha(f?.fecha))
      .slice(0, 6)
      .map((f) => ({ que: t(f.que, 60), fecha: f.fecha })),
    notas: t(x?.notas, 300),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST." });
  const { accion, imagen, clave } = req.body ?? {};
  if (accion !== "leer-documento") return res.status(400).json({ error: "Acción desconocida." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Falta ANTHROPIC_API_KEY en Vercel: sin ella no puedo leer la foto. Apunta los datos a mano." });
  }
  if (!imagen || !IMAGENES.includes(imagen.media_type) || typeof imagen.data !== "string" || !imagen.data || imagen.data.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(imagen.data)) {
    return res.status(400).json({ error: "Manda una foto JPG, PNG o WebP de menos de 3 MB." });
  }
  const c = typeof clave === "string" ? clave.trim() : "";
  if (!nubeConfigurada()) {
    const propia = process.env.CEREBRO_CLAVE;
    if (!propia) {
      return res.status(503).json({ error: "La lectura con foto no está protegida todavía: configura Supabase o la variable CEREBRO_CLAVE en Vercel." });
    }
    if (!c || !igualSeguro(c, propia)) return res.status(401).json({ error: "Clave de sincronización incorrecta." });
  } else {
    if (!c) return res.status(401).json({ error: "Escribe tu clave de sincronización en Ajustes para leer fotos." });
    try {
      await leerMemoria(c);
    } catch (e) {
      const incorrecta = String(e?.message || e).includes("incorrecta");
      return res.status(incorrecta ? 401 : 502).json({ error: incorrecta ? "Clave de sincronización incorrecta." : "No se pudo comprobar la clave. Inténtalo en un momento." });
    }
  }

  const hoy = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
  try {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system:
        `Lees fotos de documentos personales en España (ITV, pólizas de seguro, recibos, DNI, carné, garantías) para apuntar cuándo vencen. Hoy es ${hoy}. ` +
        "Solo devuelves fechas que estén ESCRITAS en el documento; si la fecha de vencimiento no aparece, deja 'vence' vacío (no la calcules ni la supongas). " +
        "Convierte las fechas españolas (dd/mm/aaaa) a AAAA-MM-DD. No copies números de documento completos en las notas: como mucho los 4 últimos caracteres.",
      tools: [HERRAMIENTA_DOCUMENTO],
      tool_choice: { type: "tool", name: HERRAMIENTA_DOCUMENTO.name },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imagen.media_type, data: imagen.data } },
            { type: "text", text: "Lee este documento y devuelve sus datos." },
          ],
        },
      ],
    });
    const uso = r.content.find((b) => b.type === "tool_use" && b.name === HERRAMIENTA_DOCUMENTO.name);
    if (!uso) return res.status(502).json({ error: "No he podido leer el documento. Apunta los datos a mano." });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, lectura: limpiaLectura(uso.input) });
  } catch (e) {
    console.error("Cerebro leer-documento:", e?.status, e?.message);
    return res.status(502).json({ error: "El servicio de lectura ha fallado. Inténtalo de nuevo o apunta los datos a mano." });
  }
}
