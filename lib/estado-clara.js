// Chequeo de estado de Clara: qué piezas están activas y cuáles no, para saber
// de un vistazo si todo funciona. Solo devuelve sí/no y qué variable falta:
// NUNCA el valor de ninguna clave.
import { leerConectores } from "./conectores.js";

const PIEZAS = [
  { id: "claude", nombre: "Cerebro (Claude)", vars: ["ANTHROPIC_API_KEY"], critico: true },
  { id: "buscador", nombre: "Búsqueda web y oídos (Gemini)", vars: ["GEMINI_API_KEY"] },
  { id: "perplexity", nombre: "Perplexity", vars: ["PERPLEXITY_API_KEY", "OPENROUTER_API_KEY"], cualquiera: true },
  { id: "segunda_opinion", nombre: "Segunda opinión (OpenRouter)", vars: ["OPENROUTER_API_KEY"] },
  { id: "nube", nombre: "Memoria y leads en la nube", vars: ["SUPABASE_URL", "SUPABASE_ANON_KEY"] },
];

export function estadoClara(env = process.env) {
  const piezas = PIEZAS.map((p) => {
    const tiene = (v) => Boolean(env[v]);
    const activa = p.cualquiera ? p.vars.some(tiene) : p.vars.every(tiene);
    return { id: p.id, nombre: p.nombre, activa, falta: activa ? [] : p.vars.filter((v) => !tiene(v)) };
  });
  let conectores = 0;
  try { conectores = leerConectores(env).conectores.length; } catch { /* configuración rota: cuenta 0 */ }
  piezas.push({ id: "conectores", nombre: "Conectores MCP", activa: conectores > 0, detalle: conectores, falta: [] });
  const critica = piezas.find((p) => p.id === "claude");
  return {
    ok: critica.activa,
    resumen: critica.activa ? "Clara puede responder." : "Clara NO puede responder: falta ANTHROPIC_API_KEY.",
    piezas,
  };
}
