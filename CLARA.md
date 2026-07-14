# 💬 CLARA — Tu asistente IA avatar

Clara es una asistente personal con IA (impulsada por Claude, de Anthropic) integrada en esta web. Tiene cinco modos:

| Modo | Qué hace |
|---|---|
| 💼 **Trabajo y empleo** | Analiza y reescribe tu CV, prepara candidaturas, mensajes de LinkedIn y entrevistas |
| 📚 **Estudios y profesor** | Profesora particular de cualquier materia y nivel (ESO → universidad), especialmente inglés |
| 🌱 **Psicóloga y crecimiento** | Escucha activa, reencuadres y pequeños planes de acción (sin sustituir ayuda profesional) |
| 💻 **Ingeniera de software** | Crea aplicaciones completas, explica el código, depura errores y ayuda a desplegar (nivel senior, 30 años de criterio) |
| 📰 **Noticias e investigación** | Busca en Internet noticias, precios y datos actuales, citando siempre fuente y fecha |

También genera guiones para vídeo/avatar en formato `SEGUNDOS · TEXTO EN PANTALLA · VOZ DEL AVATAR`.

## Archivos

- **`clara_persona.md`** — el *prompt maestro* canónico de Clara (personalidad completa + los cinco modos). Es el que Claude Code / Cowork lee al trabajar en este repositorio (ver `CLAUDE.md`).
- **`clara.html`** — interfaz de chat (misma estética que LimpiaFotos).
- **`api/clara.js`** — función serverless de Vercel. Lleva la persona de Clara embebida (sincronizada con `clara_persona.md`) y llama a la API de Claude con el modelo `claude-sonnet-5`. La **búsqueda web la hace Perplexity** (cuenta de Pau) mediante una herramienta personalizada `buscar_web`: cuando Clara necesita datos actuales, la función consulta la API de Perplexity y le devuelve el resumen con fuentes. Ninguna clave llega al navegador.
- **`CLAUDE.md`** — instrucciones para que Claude Code adopte la persona de Clara en este repositorio.
- **`package.json`** — añade la dependencia `@anthropic-ai/sdk` (Vercel la instala automáticamente al desplegar).
- **`vercel.json`** — amplía el tiempo máximo de la función a 60 segundos (las búsquedas web y respuestas largas tardan).

## Configuración (dos claves)

En Vercel: **Project → Settings → Environment Variables**, añade estas dos variables y luego **redespliega** (**Deployments → Redeploy**):

1. **`ANTHROPIC_API_KEY`** — el cerebro de Clara.
   - Consíguela en [platform.claude.com](https://platform.claude.com/) → **API Keys** (empieza por `sk-ant-...`).

2. **`PERPLEXITY_API_KEY`** — la búsqueda en Internet de Clara (tu cuenta de Perplexity, `jpaumoralejo@gmail.com`).
   - Entra en [perplexity.ai/account/api](https://www.perplexity.ai/account/api/) con tu cuenta, ve a **API Keys** y **genera una clave** (empieza por `pplx-...`).
   - Perplexity cobra la API por uso: necesitas **crédito o suscripción Pro** en tu cuenta. El correo por sí solo no basta — hace falta la clave que se genera ahí.
   - Si no configuras esta clave, Clara sigue funcionando, pero en vez de buscar te pedirá que le pegues la información.

Listo: abre `https://tu-proyecto.vercel.app/clara.html` y habla con Clara.

## Costes

- **Claude** (`claude-sonnet-5`): buena calidad a precio contenido ($3 por millón de tokens de entrada, $15 de salida — con precio introductorio $2/$10 hasta agosto de 2026). Puedes cambiar el modelo en la constante `MODEL` de `api/clara.js` (`claude-opus-4-8` es más potente pero más caro; `claude-haiku-4-5` es más barato).
- **Perplexity**: la búsqueda se cobra en tu cuenta de Perplexity según su tarifa por uso. Clara hace como máximo 4 rondas de búsqueda por respuesta. Puedes cambiar el modelo de búsqueda en la constante `PERPLEXITY_MODEL` de `api/clara.js` (`sonar` es el más barato; `sonar-pro` da respuestas más completas).
- Revisa el consumo de Claude en [platform.claude.com](https://platform.claude.com/) y el de Perplexity en tu panel de [perplexity.ai](https://www.perplexity.ai/account/api/).

## Notas

- El historial de la conversación vive solo en el navegador (se pierde al recargar la página) y se envían como máximo los últimos 40 mensajes a la API.
- Si cambias la persona en `clara_persona.md`, actualiza también el prompt embebido en `api/clara.js` (y viceversa).
- Clara nunca inventa experiencia para tu CV ni datos de empresas, y en temas emocionales graves siempre recomienda ayuda profesional.
