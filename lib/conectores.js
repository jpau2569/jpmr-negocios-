// ============================================================================
//  Conectores de Clara (servidores MCP remotos)
// ----------------------------------------------------------------------------
//  Un conector es un servidor MCP remoto (https) que da a Clara herramientas
//  de otro servicio: correo, calendario, Notion, hojas de cálculo, CRM…
//  Los usa la propia API de Claude (MCP connector, beta "mcp-client-2025-11-20"):
//  Anthropic llama al servidor y devuelve el resultado dentro de la respuesta.
//
//  Se configuran SOLO en Vercel, con la variable de entorno CLARA_CONECTORES:
//  un JSON con una lista. Ejemplo:
//
//    [{"nombre":"notion","url":"https://<servidor-mcp>/mcp","token_env":"NOTION_MCP_TOKEN",
//      "descripcion":"Mis notas y bases de datos de Notion"}]
//
//  - nombre: minúsculas, números, - o _ (máx. 40).
//  - url: dirección https del servidor MCP (la da el propio servicio).
//  - token_env (recomendado): nombre de OTRA variable de entorno con el token,
//    para no mezclar secretos en el JSON. También se admite "token" directo.
//  - descripcion (opcional): para qué sirve; Clara la lee para decidir.
//  - herramientas (opcional): lista blanca de herramientas permitidas.
//  - cabeceras (opcional): para servidores que piden la clave en una cabecera
//    propia (p. ej. Composio: {"x-api-key": "COMPOSIO_API_KEY"}, con el NOMBRE
//    de la variable de entorno, nunca el valor). Como el conector de Claude
//    solo envía un token estándar, esos conectores pasan por el puente
//    /api/mcp-puente de Clara, que añade la cabecera y reenvía SOLO a la url
//    configurada. El puente usa CLARA_PUENTE_SECRETO (o uno derivado de
//    ANTHROPIC_API_KEY) y la dirección pública de Vercel.
//
//  Los tokens nunca salen del servidor ni se envían al navegador.
// ============================================================================

import { createHmac } from "node:crypto";

export const BETA_MCP = "mcp-client-2025-11-20";

// Secreto con el que Claude se identifica ante el puente (nunca sale del servidor).
export function secretoPuente(env = process.env) {
  if (env.CLARA_PUENTE_SECRETO) return String(env.CLARA_PUENTE_SECRETO);
  if (!env.ANTHROPIC_API_KEY) return "";
  return createHmac("sha256", String(env.ANTHROPIC_API_KEY)).update("clara-mcp-puente").digest("hex");
}

// Dirección pública de esta web (para que Anthropic llegue al puente).
export function urlPublica(env = process.env) {
  const host = env.CLARA_URL_PUBLICA || env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL || "";
  if (!host) return "";
  return (/^https?:\/\//.test(host) ? host : `https://${host}`).replace(/\/+$/, "");
}
const MAX_CONECTORES = 10;

export function leerConectores(env = process.env) {
  const bruto = String(env.CLARA_CONECTORES || "").trim();
  if (!bruto) return { conectores: [], avisos: [] };

  let lista;
  try {
    lista = JSON.parse(bruto);
  } catch {
    return { conectores: [], avisos: ["CLARA_CONECTORES no es un JSON válido"] };
  }
  if (!Array.isArray(lista)) lista = [lista];

  const conectores = [];
  const avisos = [];
  const vistos = new Set();
  for (const c of lista.slice(0, MAX_CONECTORES)) {
    const nombre = String(c?.nombre || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(nombre)) {
      avisos.push(`conector con nombre no válido: "${nombre}"`);
      continue;
    }
    if (vistos.has(nombre)) {
      avisos.push(`conector repetido: ${nombre}`);
      continue;
    }
    let url;
    try {
      url = new URL(String(c?.url || ""));
    } catch {
      avisos.push(`${nombre}: la url no es válida`);
      continue;
    }
    if (url.protocol !== "https:") {
      avisos.push(`${nombre}: la url debe empezar por https://`);
      continue;
    }
    const token = c?.token_env ? env[String(c.token_env)] : c?.token;
    if (c?.token_env && !token) avisos.push(`${nombre}: falta la variable ${c.token_env} (se conecta sin token)`);
    // Cabeceras propias: {"x-api-key": "NOMBRE_VARIABLE"} → valor leído del entorno.
    const cabeceras = {};
    if (c?.cabeceras && typeof c.cabeceras === "object") {
      for (const [h, variable] of Object.entries(c.cabeceras)) {
        const cab = String(h).trim().toLowerCase();
        if (!/^[a-z0-9-]{1,60}$/.test(cab) || ["host", "content-length", "connection"].includes(cab)) {
          avisos.push(`${nombre}: cabecera no permitida "${h}"`);
          continue;
        }
        const valor = env[String(variable)];
        if (!valor) avisos.push(`${nombre}: falta la variable ${variable} para la cabecera ${cab}`);
        else cabeceras[cab] = String(valor);
      }
    }
    const herramientas = Array.isArray(c?.herramientas)
      ? c.herramientas.map((h) => String(h).trim()).filter(Boolean)
      : [];
    const conPuente = Object.keys(cabeceras).length > 0;
    let urlParaClaude = url.href;
    let tokenParaClaude = token ? String(token) : "";
    if (conPuente) {
      const base = urlPublica(env);
      const secreto = secretoPuente(env);
      if (!base || !secreto) {
        avisos.push(`${nombre}: necesita el puente, pero falta la dirección pública (CLARA_URL_PUBLICA) o el secreto`);
        continue;
      }
      urlParaClaude = `${base}/api/mcp-puente?c=${encodeURIComponent(nombre)}`;
      tokenParaClaude = secreto;
    }
    vistos.add(nombre);
    conectores.push({
      nombre,
      url: urlParaClaude,
      token: tokenParaClaude,
      descripcion: String(c?.descripcion || "").trim().slice(0, 300),
      herramientas,
      // Solo para el puente: destino real y sus credenciales (nunca van a Claude).
      destino: url.href,
      tokenDestino: token ? String(token) : "",
      cabeceras,
      conPuente,
    });
  }
  if (lista.length > MAX_CONECTORES) avisos.push(`solo se usan los ${MAX_CONECTORES} primeros conectores`);
  return { conectores, avisos };
}

// Piezas para la petición a Claude: mcp_servers + un mcp_toolset por conector.
export function piezasMcp(conectores) {
  const mcp_servers = conectores.map((c) => ({
    type: "url",
    name: c.nombre,
    url: c.url,
    ...(c.token ? { authorization_token: c.token } : {}),
  }));
  const tools = conectores.map((c) =>
    c.herramientas.length
      ? {
          type: "mcp_toolset",
          mcp_server_name: c.nombre,
          default_config: { enabled: false },
          configs: Object.fromEntries(c.herramientas.map((h) => [h, { enabled: true }])),
        }
      : { type: "mcp_toolset", mcp_server_name: c.nombre }
  );
  return { mcp_servers, tools };
}

// Bloque de sistema que le cuenta a Clara qué conectores tiene hoy.
export function textoConectores(conectores) {
  if (!conectores.length) return "";
  return (
    "## 🔌 Conectores activos\nAdemás de tus herramientas propias, hoy tienes conectados estos servicios (sus herramientas aparecen con el nombre del conector):\n" +
    conectores.map((c) => `- ${c.nombre}${c.descripcion ? `: ${c.descripcion}` : ""}`).join("\n") +
    "\nÚsalos cuando la tarea lo pida. Antes de cualquier acción que cambie algo fuera del chat (enviar un correo, crear o borrar un evento, modificar un registro), enséñale a Pau exactamente lo que vas a hacer y espera su confirmación explícita. Leer y consultar no necesita confirmación. Si un conector falla, dilo con claridad y sigue con lo que puedas hacer sin él."
  );
}
