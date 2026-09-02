# Desplegar en Vercel — guía de 5 minutos (para Pau)

> ⚠️ Las **claves NO están en este archivo** (nunca se guardan en GitHub).
> Las tienes en el chat con Clara/Claude Code y en tus cuentas de cada servicio.

## 1. Entrar en Vercel

1. Abre https://vercel.com/login
2. Pulsa **"Continue with GitHub"** (no uses el email) e inicia sesión como **jpau2569**.
3. Si GitHub falla: **"Continue with Email"** con `jpaumoralejo@gmail.com` → enlace mágico al Gmail.

## 2. Importar el proyecto (enlace directo)

Abre: **https://vercel.com/new/import?s=https://github.com/jpau2569/jpmr-negocios-**

En la pantalla de importación, ANTES de pulsar Deploy, abre el apartado
**Environment Variables** y añade estas variables (el valor de cada una,
del chat o de su web):

| Nombre | De dónde sale el valor |
|---|---|
| `ANTHROPIC_API_KEY` | platform.claude.com → API Keys (`sk-ant-...`) |
| `GEMINI_API_KEY` | aistudio.google.com/apikey (búsqueda de Clara con Google) |
| `SUPABASE_URL` | `https://hgwlowomttzbnbspdnkx.supabase.co` (este sí es público) |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → clave **anon** |
| `CRON_SECRET` | la cadena aleatoria que te generó Clara en el chat (o inventa una larga) |
| `TELEGRAM_BOT_TOKEN` | @BotFather en Telegram → /mybots → tu bot → API Token |
| `TELEGRAM_CHAT_ID` | @userinfobot en Telegram → Start → tu ID |
| `CLIPDROP_API_KEY` | clipdrop.co/apis (solo para LimpiaFotos y marca de agua) |
| `AEMET_API_KEY` | opendata.aemet.es/centrodedescargas/altaUsuario (opcional, solo para Sol Niebla y Agua) |

Pulsa **Deploy**. Si ya habías desplegado sin variables: Settings →
Environment Variables → añádelas → Deployments → ⋯ → **Redeploy**.

## 3. Probar que todo funciona

Con la URL que te da Vercel (algo como `jpmr-negocios.vercel.app`):

- `/clara.html` → habla con Clara y pídele algo actual ("¿euríbor hoy?") → debe citar fuentes de Google.
- `/castebot.html` → haz de cliente con Juanjo (zona + presupuesto + "quiero visitar ya") → debe llegarte el 🔥 a Telegram.
- `/castebot-leads.html` → entra con tu clave de sincronización → debe aparecer el hot-lead de la prueba.
- `/api/castebot-informe?key=TU_CRON_SECRET` → te llega el informe de NICER a Telegram (y cada mañana solo, a las ~9:00).

## 4. Último paso: el widget en la web del despacho

Pega esta línea antes de `</body>` en asesoriacastresana.com (cambia el dominio por el tuyo de Vercel):

```html
<script src="https://TU-PROYECTO.vercel.app/castebot-widget.js" defer></script>
```

## Recordatorios

- El proyecto de Supabase (`clara-memoria`) es del plan gratuito: si pasa ~1 semana
  sin uso se pausa solo; se despierta en supabase.com/dashboard → Restore project.
- Cuando todo funcione, regenera las claves que se pegaron en el chat
  (AI Studio y platform.claude.com) y actualiza su valor en Vercel.
