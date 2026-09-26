// ============================================================================
//  Puente MCP de Clara — /api/mcp-puente?c=<conector>
// ----------------------------------------------------------------------------
//  Algunos servidores MCP (p. ej. Composio) piden su clave en una cabecera
//  propia (x-api-key), pero el conector MCP de la API de Claude solo envía un
//  token estándar ("Authorization: Bearer"). Este puente:
//   1. Acepta solo peticiones con el secreto del puente (lib/conectores.js →
//      secretoPuente), que únicamente conoce el servidor de Clara.
//   2. Reenvía SOLO a la url del conector configurado en CLARA_CONECTORES
//      (no es un proxy abierto), añadiendo sus cabeceras desde el entorno.
//   3. Devuelve la respuesta tal cual (JSON o streaming SSE), con la sesión MCP.
// ============================================================================

import { timingSafeEqual } from "node:crypto";
import { leerConectores, secretoPuente } from "../lib/conectores.js";

export const config = { supportsResponseStreaming: true };

const TIMEOUT_MS = 55000;
const CABECERAS_IDA = ["content-type", "accept", "mcp-session-id", "mcp-protocol-version", "last-event-id"];
const CABECERAS_VUELTA = ["content-type", "mcp-session-id", "mcp-protocol-version", "cache-control"];

function igualSeguro(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function cuerpoCrudo(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const trozos = [];
  for await (const t of req) trozos.push(typeof t === "string" ? Buffer.from(t) : t);
  return Buffer.concat(trozos);
}

export default async function handler(req, res) {
  const secreto = secretoPuente();
  if (!secreto || !igualSeguro(req.headers?.authorization || "", `Bearer ${secreto}`)) {
    return res.status(401).json({ error: "No autorizado." });
  }
  const nombre = String(req.query?.c || "").toLowerCase();
  const con = leerConectores().conectores.find((c) => c.nombre === nombre && c.conPuente);
  if (!con) return res.status(404).json({ error: `No hay ningún conector con puente llamado "${nombre}".` });
  if (!["POST", "GET", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Método no permitido." });
  }

  const headers = {};
  for (const h of CABECERAS_IDA) if (req.headers?.[h]) headers[h] = String(req.headers[h]);
  Object.assign(headers, con.cabeceras);
  if (con.tokenDestino) headers.authorization = `Bearer ${con.tokenDestino}`;

  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(con.destino, {
      method: req.method,
      headers,
      body: req.method === "POST" ? await cuerpoCrudo(req) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(alarma);
    const tardó = e?.name === "AbortError";
    return res.status(tardó ? 504 : 502).json({ error: tardó ? "El servidor del conector tardó demasiado." : "No se pudo conectar con el servidor del conector." });
  }

  const vuelta = {};
  for (const h of CABECERAS_VUELTA) {
    const v = resp.headers.get(h);
    if (v) vuelta[h] = v;
  }
  res.writeHead(resp.status, vuelta);
  try {
    if (resp.body) {
      for await (const trozo of resp.body) res.write(trozo);
    }
  } catch {
    // corte a mitad del streaming: se cierra la respuesta tal cual
  } finally {
    clearTimeout(alarma);
    res.end();
  }
}
