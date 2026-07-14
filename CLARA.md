# 💬 CLARA — Tu asistente IA avatar

Clara es una asistente personal con IA (impulsada por Claude, de Anthropic) integrada en esta web. Tiene tres modos:

| Modo | Qué hace |
|---|---|
| 💼 **Trabajo y empleo** | Analiza y reescribe tu CV, prepara candidaturas, mensajes de LinkedIn y entrevistas |
| 📚 **Estudios y profesor** | Profesora particular de cualquier materia y nivel (ESO → universidad), especialmente inglés |
| 🌱 **Psicóloga y crecimiento** | Escucha activa, reencuadres y pequeños planes de acción (sin sustituir ayuda profesional) |

También genera guiones para vídeo/avatar en formato `SEGUNDOS · TEXTO EN PANTALLA · VOZ DEL AVATAR`.

## Archivos

- **`clara.html`** — interfaz de chat (misma estética que LimpiaFotos).
- **`api/clara.js`** — función serverless de Vercel. Contiene el *prompt maestro* de Clara (personalidad + los tres modos) y llama a la API de Claude con el modelo `claude-opus-4-8`. La clave nunca llega al navegador.
- **`package.json`** — añade la dependencia `@anthropic-ai/sdk` (Vercel la instala automáticamente al desplegar).
- **`vercel.json`** — amplía el tiempo máximo de la función a 60 segundos (las respuestas largas de Claude pueden tardar).

## Configuración (un solo paso)

1. Consigue una clave de API en [platform.claude.com](https://platform.claude.com/) → **API Keys**.
2. En Vercel: **Project → Settings → Environment Variables** y añade:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** tu clave (empieza por `sk-ant-...`)
3. Vuelve a desplegar el proyecto (**Deployments → Redeploy**).

Listo: abre `https://tu-proyecto.vercel.app/clara.html` y habla con Clara.

## Notas

- El historial de la conversación vive solo en el navegador (se pierde al recargar la página) y se envían como máximo los últimos 40 mensajes a la API.
- El modelo usado es `claude-opus-4-8` con *adaptive thinking*; puedes cambiarlo en la constante `MODEL` de `api/clara.js`.
- Cada conversación consume tokens de tu cuenta de Anthropic — revisa el consumo en la consola de la plataforma.
- Clara nunca inventa experiencia para tu CV ni datos de empresas, y en temas emocionales graves siempre recomienda ayuda profesional.
