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
- `clara.html` + `api/clara.js` → chat de CLARA (API de Claude; clave en `ANTHROPIC_API_KEY`).
- La persona de Clara vive en `clara_persona.md` (canónica) y embebida en `api/clara.js` — **si cambias una, actualiza la otra**.
- `castebot.html` + `api/castebot.js` → CasteBot: red de 6 agentes IA de Asesoría Castresana (JUANJO, JAVI, ALEJANDRO, PAU, NURIA, NICER) con selector "¿Con quién quieres hablar?". Los prompts maestros canónicos viven en `agentes/` (`_comunes.md` + uno por agente) y el backend los compone en el system prompt; hot-lead → aviso a Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) + registro en Supabase (tabla `castebot_leads`). `castebot-widget.js` es el widget embebible (una línea de script) para asesoriacastresana.com, `api/castebot-informe.js` es el informe diario de NICER (cron 7:00 UTC, protegido con `CRON_SECRET`), y `castebot-leads.html` + `api/castebot-leads.js` el panel privado de hot-leads (protegido con la clave de sincronización). Plan general en `AGENTECASTRESANA6.md`.
- `sol-niebla-agua/` → **Sol Niebla y Agua**: PWA personal del tiempo en Asturias central y costa (Oviedo, Mieres, Gijón), instalable en el móvil. Separada en módulos ES sin empaquetador: `utiles.js` (herramientas), `datos.js` (proveedores y caché), `indice.js` (Índice Sol Niebla y Agua, etiquetas y recomendaciones), `interfaz.js` (render puro) y `app.js` (estado, eventos y PWA), más `app.html`, `styles.css`, `manifest.json` y `service-worker.js`. El índice (0-100) se recalcula según el modo de uso —paseo, fotos, visitas inmobiliarias, carretera— y traduce los datos a decisiones ("sal ahora", "espera una mejor apertura", "ojo con niebla para carretera"). Origen de datos configurable desde Ajustes con cascada `api/tiempo.js` (AEMET + Open-Meteo) → Open-Meteo directo → simulados. **Necesita servirse por HTTP** (usa módulos ES y service worker). Iconos PNG: `node sol-niebla-agua/herramientas/generar-iconos.mjs`. Reglas propias del proyecto en `sol-niebla-agua/CLAUDE.md`; detalle técnico en `sol-niebla-agua/README.md`.
- `escaparate.html` + `api/escaparate.js` → escaparate para la TV Samsung vertical del local: la API escrapea los inmuebles de www.asesoriacastresana.com y la página se muestra en vertical sin girar por defecto; con el mando (OK/Enter) o `?rot=90|270|0|180` se puede rotar y la elección queda guardada en la TV (también `?secs=N`, `?fuente=demo`).
- `sol-niebla-agua/api/tiempo.js` → backend del tiempo de Sol Niebla y Agua (con un reenvío en `api/tiempo.js` para que la ruta siga viva al desplegar el monorepo): compone la malla horaria de Open-Meteo con la observación real de la estación AEMET más cercana a cada ciudad (`AEMET_API_KEY`, opcional; sin ella devuelve solo Open-Meteo). Existe porque la clave de AEMET no puede vivir en el navegador y AEMET no da CORS.
- Documentación de configuración: `CLARA.md`.
