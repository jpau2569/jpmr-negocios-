# Instrucciones para Claude en este repositorio

## Persona: CLARA

Antes de ayudar a Pau en este repositorio, **lee el archivo `clara_persona.md`** y adopta la persona de CLARA definida allí: asistente personal en español de España, cálida, honesta y de máxima excelencia, con seis modos (trabajo y empleo, estudios y profesor, psicóloga y coach, ingeniera de software, noticias e investigación, negocio inmobiliario).

Reglas rápidas:
- Saluda a Pau por su nombre al empezar una sesión nueva y pregunta qué modo quiere, salvo que ya diga directamente lo que necesita.
- Nunca inventes experiencia, datos de empresas, salarios ni APIs. Si no lo sabes, dilo.
- Explica las cosas de forma clara y simple primero; la versión técnica después.
- Cierra las respuestas importantes con un siguiente paso concreto.

## Sobre el proyecto

- Web estática + funciones serverless de Vercel.
- `index.html` + `api/process/[tool].js` → LimpiaFotos (Clipdrop; clave en `CLIPDROP_API_KEY`).
- `marcadeagua.html` → herramienta de quitar marcas de agua propias: el usuario pinta una máscara sobre la marca y se envía imagen + máscara al endpoint `cleanup` de `api/process/[tool].js` (Clipdrop Cleanup, modo quality); admite varias pasadas.
- `clara.html` + `api/clara.js` → chat de CLARA (API de Claude; clave en `ANTHROPIC_API_KEY`). Clara tiene herramientas: `buscar_web` (Gemini con Google, clave en `GEMINI_API_KEY`), `calcular`, `mi_cartera` (lee la cartera real vía `lib/cartera.js`), `recordar` (memoria) y `usar_skill`/`crear_skill` (sistema de skills en `lib/skills.js`: skills base embebidas + tabla `clara_skills` de Supabase).
- La persona de Clara vive en `clara_persona.md` (canónica) y embebida en `api/clara.js` — **si cambias una, actualiza la otra**.
- `api/memoria.js` + `lib/memoria.js` → memoria en la nube de Clara (Supabase con RLS sin políticas: todo pasa por funciones RPC "security definer" que validan la clave de sincronización de Pau; el servidor usa `SUPABASE_URL` + `SUPABASE_ANON_KEY`, la clave de sincronización nunca se guarda en el código).
- `api/briefing.js` → briefing diario proactivo de Clara (cron de Vercel 6:00 UTC, ver `vercel.json`): lee la cartera con `lib/cartera.js`, lo redacta con Claude y lo envía al Telegram de Pau (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`); protegido con `CRON_SECRET` si existe.
- `lib/cartera.js` → lector compartido de la cartera publicada en www.asesoriacastresana.com (sin claves); lo usan `api/escaparate.js`, `api/clara.js` y `api/briefing.js`.
- Embudo de leads: `ebook.html` (landing "Los 7 errores que hunden el precio de tu piso en Oviedo") + `ebook-guia.html` (la guía en sí) → `api/lead.js` guarda el lead en Supabase (RPC `lead_guarda`, tabla `clara_leads`); `leads.html` + `api/leads.js` es el panel privado de lectura (RPC `leads_lista`, protegido con la clave de sincronización).
- `castebot.html` + `api/castebot.js` → CasteBot: red de 6 agentes IA de Asesoría Castresana (JUANJO, JAVI, ALEJANDRO, PAU, NURIA, NICER) con selector "¿Con quién quieres hablar?". Los prompts maestros canónicos viven en `agentes/` (`_comunes.md` + uno por agente) y el backend los compone en el system prompt; hot-lead → aviso a Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) + registro en Supabase (tabla `castebot_leads`). `castebot-widget.js` es el widget embebible (una línea de script) para asesoriacastresana.com, `api/castebot-informe.js` es el informe diario de NICER (cron 7:00 UTC, protegido con `CRON_SECRET`), y `castebot-leads.html` + `api/castebot-leads.js` el panel privado de hot-leads (protegido con la clave de sincronización). Plan general en `AGENTECASTRESANA6.md`.
- `escaparate.html` + `api/escaparate.js` → escaparate para la TV Samsung vertical del local: la API escrapea los inmuebles de www.asesoriacastresana.com y la página se muestra en vertical sin girar por defecto; con el mando (OK/Enter) o `?rot=90|270|0|180` se puede rotar y la elección queda guardada en la TV (también `?secs=N`, `?fuente=demo`).
- `api/health.js` → comprobación rápida de si `CLIPDROP_API_KEY` está configurada.
- `limpiafotos/` → versión independiente de LimpiaFotos (Express local con su propio `package.json`); no forma parte del deploy de Vercel.
- Documentación de configuración: `CLARA.md`. Guía de despliegue: `DESPLIEGUE_VERCEL.md`. Plan de CasteBot: `AGENTECASTRESANA6.md`.

## Comandos

- `npm test` → tests de las APIs de Clara y CasteBot (`test/clara.test.mjs` + `test/castebot.test.mjs`, Node puro sin framework).
- `npm run test:ui` → test de interfaz de `clara.html` con Playwright/Chromium (`test/ui.test.mjs`); no llama a APIs reales, intercepta `/api/clara`.
- No hay build: es web estática + funciones serverless; Vercel despliega tal cual. Los crons (briefing 6:00 UTC e informe de NICER 7:00 UTC) están en `vercel.json`.

## Convenciones

- Todo el código, comentarios, textos de interfaz y mensajes de error están en español de España — mantenlo así.
- Las funciones de `api/` son ES modules (`"type": "module"`) sin framework: `export default async function handler(req, res)`.
- Las claves de API viven solo en variables de entorno de Vercel, nunca en el navegador ni en el código; los endpoints hacen de proxy seguro.
