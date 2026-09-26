// ============================================================================
//  Enrutador único de /api/<nombre>
// ----------------------------------------------------------------------------
//  El plan Hobby de Vercel admite como máximo 12 funciones por despliegue y
//  aquí hay 17 endpoints. Vercel no convierte en función los archivos que
//  empiezan por "_", así que cada endpoint vive en api/_<nombre>.js y esta
//  única función los despacha. Las URLs no cambian: /api/clara sigue siendo
//  /api/clara.
//
//  Cada import es estático dentro de su flecha para que Vercel empaquete el
//  archivo y solo cargue el endpoint que se pide.
// ============================================================================

const RUTAS = {
  briefing: () => import("./_briefing.js"),
  "castebot-informe": () => import("./_castebot-informe.js"),
  "castebot-leads": () => import("./_castebot-leads.js"),
  castebot: () => import("./_castebot.js"),
  chivato: () => import("./_chivato.js"),
  clara: () => import("./_clara.js"),
  escaparate: () => import("./_escaparate.js"),
  foto: () => import("./_foto.js"),
  fotos: () => import("./_fotos.js"),
  health: () => import("./_health.js"),
  lead: () => import("./_lead.js"),
  leads: () => import("./_leads.js"),
  "luxury-motion": () => import("./_luxury-motion.js"),
  memoria: () => import("./_memoria.js"),
  "mcp-puente": () => import("./_mcp-puente.js"),
  "oportunidades-ficha": () => import("./_oportunidades-ficha.js"),
  oportunidades: () => import("./_oportunidades.js"),
  profe: () => import("./_profe.js"),
  tiempo: () => import("./_tiempo.js"),
};

// Clara y CasteBot responden en streaming; activarlo aquí no afecta al resto.
export const config = { supportsResponseStreaming: true };

export const rutasDisponibles = Object.keys(RUTAS);

export default async function handler(req, res) {
  const ruta = String(req.query?.ruta || "");
  const cargar = Object.prototype.hasOwnProperty.call(RUTAS, ruta) ? RUTAS[ruta] : null;
  if (!cargar) {
    res.status(404).json({ error: `No existe /api/${ruta}` });
    return;
  }
  // El parámetro de la ruta dinámica no es asunto del endpoint.
  delete req.query.ruta;
  const modulo = await cargar();
  return modulo.default(req, res);
}
