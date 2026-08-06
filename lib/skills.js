// ============================================================================
//  Sistema de skills de Clara
// ----------------------------------------------------------------------------
//  Dos fuentes:
//   1. SKILLS_BASE — skills expertas embebidas en el código (siempre disponibles).
//   2. Supabase (tabla clara_skills) — skills que Clara crea o mejora ella misma
//      con la herramienta crear_skill; persisten entre despliegues y requieren
//      la clave de sincronización de Pau.
//  Clara consulta el catálogo y carga una skill con la herramienta usar_skill.
// ============================================================================

import { nubeConfigurada, rpc } from "./memoria.js";

export const SKILLS_BASE = {
  "ebook-lead-magnet": {
    descripcion:
      "Crear ebooks, lead magnets y dossieres en PDF con el método Claude + Higgsfield: HTML con diseño premium listo para imprimir a PDF, portada generada con IA y contenido desde vídeos, guiones o inmuebles de Pau.",
    contenido: `# Skill: Ebook / Lead Magnet premium (método Claude + Higgsfield)

## Cuándo usarla
Pau pide un ebook, guía en PDF, lead magnet, dossier de inmueble, descargable para captar propietarios/compradores/inversores, o convertir sus vídeos/guiones en un ebook.

## El método (pipeline HTML → PDF)
1. **Entrevista mínima** (máx. 3 preguntas si faltan datos): tema, público (propietarios / compradores / inversores / seguidores de sus vídeos), objetivo (captar leads, regalo de valor, dossier comercial) y material de partida (guion de vídeo, notas, inmueble concreto).
2. **Estructura estándar** (adáptala al tema):
   - Portada (título potente + subtítulo + marca).
   - "Para quién es esta guía" (1 página).
   - 5-7 capítulos cortos con un consejo accionable cada uno.
   - Checklist o plantilla final (el lector se la queda).
   - Página de cierre con llamada a la acción: contacto de Asesoría Castresana (☎ 985 210 468 · www.asesoriacastresana.com · C/ Cabo Noval 8, Oviedo).
3. **Entrega SIEMPRE un único archivo HTML completo** (\`<!doctype html>\`…) con CSS embebido, listo para: abrir → Ctrl+P → "Guardar como PDF". El chat de Clara ofrece botón de descarga para los HTML completos.
4. **Portada con Higgsfield**: genera 2-3 prompts en inglés para que Pau cree la imagen de portada en Higgsfield/Midjourney (estilo: "editorial real estate photography, warm light, Oviedo cityscape…"). Déjale un hueco \`<img>\` comentado donde pegarla.

## Reglas de diseño del HTML
- Página A4: \`@page { size: A4; margin: 0 }\` + secciones con \`page-break-after: always\` (usa \`min-height: 297mm\` por página).
- Tipografía del sistema o Google Fonts (una serif elegante para títulos + una sans para cuerpo).
- Paleta Castresana: azul marino #10203a, dorado #c9a227, blanco roto #f7f5f0, gris texto #444.
- Portada a sangre completa con color de marca; interiores limpios con mucho blanco.
- Numera páginas a mano en el pie de cada sección. Nada de librerías externas de JS.

## Desde los vídeos de Pau
Si el material es un guion o la descripción de un vídeo (YouTube/Reels/TikTok): cada vídeo → un capítulo (gancho del vídeo = título del capítulo; desarrollo = 3-4 párrafos; cierre = consejo accionable). Serie de vídeos → ebook "Las N claves de…".

## Norma
Contenido 100% real: nada de datos de mercado inventados (si hacen falta, usa buscar_web y cita, o marca como estimación). El ebook debe aportar valor de verdad aunque sea gratis.`,
  },

  "app-movil-profesional": {
    descripcion:
      "Diseñar y construir apps móviles profesionales de principio a fin: PWA primero, Capacitor para tiendas, stack recomendado, plantilla de arranque y checklist de calidad.",
    contenido: `# Skill: App móvil profesional

## Cuándo usarla
Pau pide una app móvil, "app para el negocio", llevar una web al móvil, o publicar en Google Play / App Store.

## Criterio (en este orden)
1. **PWA primero** (como ya es Clara): un solo código, instalable, sin tiendas ni cuotas. Vale para el 80% de los casos de Pau (herramientas internas, catálogos, agendas, paneles).
2. **Capacitor** cuando haga falta tienda o APIs nativas (notificaciones push nativas, cámara avanzada): la misma web empaquetada. Requiere cuenta Google Play (25 USD una vez) / Apple (99 USD/año) — dilo siempre.
3. **Nativo puro**: casi nunca para Pau; solo si un requisito lo exige de verdad.

## Stack recomendado
- Sencillo: HTML+CSS+JS vanilla + manifest + service worker (offline).
- Con datos y usuarios: Vite + React + Supabase (auth + Postgres + storage) + Vercel.
- Empaquetado: \`npm i @capacitor/core @capacitor/cli\` → \`npx cap add android\` → Android Studio.

## Entrega estándar (siempre completa)
1. Estructura de archivos y cada archivo completo listo para copiar.
2. manifest.webmanifest + service worker con caché básica (app shell + stale-while-revalidate).
3. Diseño móvil-primero: botones ≥44px, safe-areas iOS (\`env(safe-area-inset-*)\`), tema oscuro/claro.
4. Instrucciones de despliegue en Vercel + cómo instalarla en el móvil, paso a paso.
5. Checklist de calidad: Lighthouse PWA ≥ 90, funciona offline, iconos 192/512, splash, sin errores en consola.

## Norma
Nunca prometas "publicada en la App Store" sin mencionar cuentas, costes y revisión de Apple/Google. Señala siempre lo no probado.`,
  },

  "web-3d-profesional": {
    descripcion:
      "Crear webs profesionales con 3D real: Three.js o React Three Fiber, escenas 3D de inmuebles, tours, hero sections con profundidad, y rendimiento cuidado.",
    contenido: `# Skill: Web profesional en 3D

## Cuándo usarla
Pau pide una web "en 3D", con efectos de profundidad, tour virtual, visualización de un piso/edificio, o una landing espectacular.

## Criterio: elige la herramienta según el objetivo
1. **Efecto 3D ligero** (hero con profundidad, tarjetas con tilt, parallax): CSS 3D transforms + JS vanilla. Cero dependencias, carga instantánea. Primera opción para landings.
2. **Escena 3D real** (objetos, cámara orbitando, modelo de un piso): **Three.js** desde CDN propio no — mejor bundle con Vite. Escena mínima: renderer + PerspectiveCamera + OrbitControls + luces (ambient + directional) + entorno.
3. **App React con 3D**: **React Three Fiber** + drei (\`<OrbitControls>\`, \`<Environment>\`, \`<Html>\` para etiquetas sobre el modelo).
4. **Modelos**: formato .glb (glTF binario). Para inmuebles: plano → modelo simple con extrusión, o encargar/generar el .glb y cargarlo con GLTFLoader/useGLTF.
5. **Tours 360º**: esfera invertida con textura equirectangular (foto 360 del piso) — Three.js puro, muy vistoso y barato de hacer.

## Rendimiento (no negociable)
- Carga diferida del 3D (dynamic import al hacer scroll o clic).
- \`renderer.setPixelRatio(Math.min(devicePixelRatio, 2))\`, sombras solo si aportan.
- Modelos < 3 MB comprimidos (Draco/meshopt); texturas ≤ 2048px.
- Fallback estático (imagen) si WebGL no está disponible o en móviles flojos.

## Entrega estándar
Proyecto completo (Vite si hay bundle), archivos íntegros, instrucciones de despliegue en Vercel y de sustitución de modelos/texturas. Para piezas simples, un único HTML autocontenido con el 3D embebido.

## Norma
El 3D es un medio, no el fin: si no mejora la conversión o la comprensión del inmueble, propón la alternativa 2D y explica por qué.`,
  },

  "crear-skills": {
    descripcion:
      "Meta-skill: cómo Clara diseña y guarda nuevas skills con la herramienta crear_skill cuando detecta una necesidad recurrente sin skill disponible.",
    contenido: `# Skill: Crear nuevas skills (meta-skill)

## Cuándo usarla
Pau pide algo recurrente para lo que no existe skill (ni base ni personalizada), o te pide directamente "crea una skill para X". Consulta SIEMPRE antes el catálogo con usar_skill (sin nombre) para no duplicar.

## Formato de una buena skill
1. **nombre**: minúsculas-con-guiones, específico (p. ej. "email-captacion-propietarios").
2. **descripcion**: una frase que empiece por un verbo y diga cuándo activarla.
3. **contenido** (markdown, 500-4000 caracteres):
   - "## Cuándo usarla" — situaciones concretas.
   - "## Método" — pasos numerados, decisiones y criterios (no teoría).
   - "## Entrega estándar" — qué recibe Pau exactamente y en qué formato.
   - "## Norma" — la regla de honestidad/calidad específica de esa skill.

## Reglas
- Una skill = una tarea. Si abarca dos temas, son dos skills.
- Escríbela para poder ejecutarla sin preguntar nada obvio: valores por defecto sensatos.
- Incluye el contexto de Pau que aplique (Asturias, Castresana, su marca, sus herramientas).
- Tras crearla con crear_skill, confírmaselo a Pau en una línea y ÚSALA ya en esa misma respuesta.
- Para mejorar una skill existente: léela con usar_skill, reescríbela completa y guárdala con el mismo nombre.`,
  },
};

// Catálogo combinado: skills base + skills personalizadas de Supabase.
export async function catalogoSkills(claveSync) {
  const base = Object.entries(SKILLS_BASE).map(([nombre, s]) => ({
    nombre,
    descripcion: s.descripcion,
    origen: "base",
  }));
  let personalizadas = [];
  if (claveSync && nubeConfigurada()) {
    try {
      const lista = await rpc("clara_skills_lista", { clave: claveSync });
      personalizadas = (Array.isArray(lista) ? lista : []).map((s) => ({ ...s, origen: "personalizada" }));
    } catch {
      // sin nube seguimos con las base
    }
  }
  return [...base, ...personalizadas];
}

export async function leerSkill(claveSync, nombre) {
  const limpio = String(nombre || "").trim().toLowerCase();
  if (SKILLS_BASE[limpio]) return SKILLS_BASE[limpio].contenido;
  if (claveSync && nubeConfigurada()) {
    const contenido = await rpc("clara_skills_lee", { clave: claveSync, skill: limpio });
    // Si la skill no existe en la nube, el RPC devuelve null/vacío: lo tratamos
    // como error (no como resultado válido) para no romper el turno de Clara.
    if (contenido == null || String(contenido).trim() === "") {
      throw new Error(`no existe la skill "${limpio}"`);
    }
    return contenido;
  }
  throw new Error(`no existe la skill "${limpio}"`);
}

export async function guardarSkill(claveSync, nombre, descripcion, contenido) {
  const limpio = String(nombre || "").trim().toLowerCase();
  if (SKILLS_BASE[limpio]) {
    throw new Error(`"${limpio}" es una skill base del código y no se puede sobrescribir; elige otro nombre`);
  }
  await rpc("clara_skills_guarda", {
    clave: claveSync,
    skill: limpio,
    descripcion_nueva: String(descripcion || "").slice(0, 300),
    contenido_nuevo: String(contenido || "").slice(0, 20000),
  });
  return limpio;
}
