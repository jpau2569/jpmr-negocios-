# AGENTS.md — JPMR Negocios (Base44)

## Qué es el proyecto

Monorepo de herramientas web para negocios (IA, CRM, escaparates 3D, fotos, leads).
Está pensado para **Vercel**: HTML estático en la raíz + funciones serverless en `api/`.
No hay paso de build para el frontend — los `.html` se sirven tal cual.

## Cómo arranca en Base44

- `docker-compose.base44.yml` levanta un único servicio `web` con `node:22-slim`.
- El servidor es `server.mjs` (Node puro, sin Express): sirve los estáticos de la raíz
  y enruta `/api/:ruta` → `api/_:ruta.js` (mismo patrón que el enrutador `api/[ruta].js`).
- Dependencias: `npm ci --omit=dev` (solo `@anthropic-ai/sdk`). Playwright y Three son
  devDependencies y no se instalan en el contenedor.
- El código se sirve desde un bind-mount — los cambios en HTML/JS/CSS se ven al refrescar.

## Variables de entorno

Todas las claves externas son **opcionales** — la app arranca sin ninguna.
Las funciones compruean si la clave existe y devuelven un mensaje de error si falta.

| Variable | Servicio | Notas |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` | Supabase | Memoria de Clara, leads, cerebro |
| `ANTHROPIC_API_KEY` | Anthropic | Clara, CasteBot |
| `CLIPDROP_API_KEY` | Clipdrop | LimpiaFotos |
| `OPENROUTER_API_KEY` | OpenRouter | Segunda opinión IA |
| `GEMINI_API_KEY` | Google Gemini | IA |
| `AEMET_API_KEY` | AEMET | Endpoint de tiempo |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Telegram | Chivato |
| `CRON_SECRET` / `CEREBRO_CLAVE` | Interno | Crones y acceso al cerebro |

## Verificar que funciona

- `curl http://localhost:3000/` → HTML de LimpiaFotos
- `curl http://localhost:3000/api/health` → JSON `{"ok":true,...}`
- `curl http://localhost:3000/clara.html` → HTML de Clara
- `curl http://localhost:3000/cerebro/` → HTML del cerebro

## Subproyectos

- `pulso-local-ai/` — app Next.js independiente (Supabase), no parte del despliegue raíz.
- `escaparate3d-pro/` — HTML+JS estático con Three.js por CDN, sin dependencias npm.
- `sol-niebla-agua/`, `chivato/` — sub-apps con sus propios `api/` re-exportados desde `api/`.

## Tests

`npm test` ejecuta los tests unitarios (Node). `npm run test:ui` usa Playwright.
No son necesarios para el arranque.
