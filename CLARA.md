# 💬 CLARA — Tu asistente IA avatar

Clara es una asistente personal con IA (impulsada por Claude, de Anthropic) integrada en esta web. Tiene seis modos:

| Modo | Qué hace |
|---|---|
| 💼 **Trabajo y empleo** | Analiza y reescribe tu CV, prepara candidaturas, mensajes de LinkedIn y entrevistas |
| 📚 **Estudios y profesor** | Profesora particular de cualquier materia y nivel (ESO → universidad), especialmente inglés |
| 🌱 **Psicóloga y crecimiento** | Escucha activa, reencuadres y pequeños planes de acción (sin sustituir ayuda profesional) |
| 💻 **Ingeniera de software** | Crea aplicaciones completas, explica el código, depura errores y ayuda a desplegar (nivel senior, 30 años de criterio) |
| 📰 **Noticias e investigación** | Busca en Internet noticias, precios y datos actuales, citando siempre fuente y fecha |
| 🏠 **Negocio inmobiliario** | Mano derecha de Inmo Castresana: captación de propietarios, venta de cartera, análisis de inversión, marketing y atención al cliente |

También genera guiones para vídeo/avatar en formato `SEGUNDOS · TEXTO EN PANTALLA · VOZ DEL AVATAR`.

## Quién es Pau y el mandato de Clara

- **Pau Moralejo** trabaja en [asesoriacastresana.com](https://www.asesoriacastresana.com) vendiendo pisos en la zona centro de Asturias, y además crea **páginas web, apps móviles y todo lo relacionado con IA y tecnología**.
- El mandato que le ha dado a Clara: ser **sus ojos y su mano ejecutora** en su vida profesional y personal, con el **máximo nivel de exigencia** en cada cosa que le pida.
- La frase de activación es **"Clara, ¿me ayudas a…?"** — al oírla, Clara entiende lo que Pau necesita, elige el modo adecuado, ejecuta de principio a fin y entrega al nivel de la mejor profesional del mundo, cerrando siempre con el siguiente paso concreto. Exigencia máxima, pero sin inventar jamás: lo que no se sabe o no se puede verificar, se dice.

Este mandato vive también en `clara_persona.md` (sección "Lo que sabes de Pau") y en el prompt embebido de `api/clara.js`, que se mantienen sincronizados.

## Archivos

- **`clara_persona.md`** — el *prompt maestro* canónico de Clara (personalidad completa + los seis modos). Es el que Claude Code / Cowork lee al trabajar en este repositorio (ver `CLAUDE.md`).
- **`clara.html`** — interfaz de chat (misma estética que LimpiaFotos). La conversación se guarda en el navegador (`localStorage`) y sobrevive a recargas; el botón **🗑 Nueva** la borra. Las respuestas de Clara se muestran con formato (negritas, código, enlaces) y cada una tiene botón de copiar. Además:
  - **🧠 Memoria** — notas persistentes que Clara recuerda entre conversaciones (perfil, objetivos, preferencias). Se guardan solo en tu navegador y se le envían con cada mensaje.
  - **🔊 Voz** — Clara lee sus respuestas en voz alta (síntesis del navegador, con la mejor voz femenina en español disponible); el botón 🎙 junto al cuadro de texto permite dictarle por micrófono. Ambos se ocultan si el navegador no los soporta.
  - **🙂 Rostro de Clara (avatar visual)** — si existe el archivo `clara-rostro.jpg` en la raíz del proyecto, se muestra como retrato circular en la cabecera y **se ilumina con un aro rosa que late mientras Clara habla** (sincronizado con la voz). Si el archivo no está, el retrato simplemente no aparece y todo lo demás funciona igual. Para ponerle cara: añade una foto de retrato (vertical, cara centrada) con ese nombre exacto en la raíz del repositorio.
  - **⬇ Exportar** — descarga la conversación como archivo Markdown.
  - **Instalable como app** — `clara.webmanifest` + `clara-icon.svg` permiten añadir Clara a la pantalla de inicio del móvil (Chrome/Android: menú → "Añadir a pantalla de inicio") y abrirla a pantalla completa como una app.
  - Si un envío falla (red caída, error de la API), el mensaje **vuelve al cuadro de texto** para reenviarlo sin perder nada.
- **`api/clara.js`** — función serverless de Vercel. Lleva la persona de Clara embebida (sincronizada con `clara_persona.md`) y llama a la API de Claude con el modelo `claude-sonnet-5`. Responde en **streaming** (el texto aparece según lo escribe, con avisos de "🔍 Buscando…", "🧮 Calculando…", "🏠 Leyendo tu cartera…"), acepta **fotos y PDFs adjuntos** (los analiza de verdad: Claude es multimodal) y tiene tres herramientas: `buscar_web` (**Perplexity**, con fuentes), `calcular` (**calculadora exacta**) y `mi_cartera` (**lee en el momento los inmuebles reales publicados en asesoriacastresana.com**, con precios y referencias). Ninguna clave llega al navegador.
- **`lib/cartera.js`** — lector compartido de la cartera de Asesoría Castresana (lo usan el escaparate, la herramienta `mi_cartera` de Clara y el briefing).
- **`api/briefing.js`** — briefing proactivo: un cron de Vercel lo ejecuta cada mañana (08:00 en horario de verano; el horario del cron es UTC, `0 6 * * *`). Lee la cartera real, Clara redacta el resumen del día y, si configuras `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en Vercel, te llega al móvil por Telegram. Sin Telegram, puedes abrir `/api/briefing` en el navegador y leerlo ahí. Opcional: `CRON_SECRET` para que solo el cron pueda llamarlo.
- **`lib/memoria.js` + `api/memoria.js`** — memoria en la nube (Supabase, proyecto `clara-memoria`, 0 €/mes). La tabla tiene RLS activado sin políticas: solo se accede por funciones RPC que exigen la **clave de sincronización** de Pau. Pau escribe esa clave una vez en el panel 🧠 de cada dispositivo y su memoria pasa a ser la misma en todos; además Clara gana la herramienta `recordar` para apuntar notas ella sola. Sin clave (o sin las variables de Supabase), todo sigue funcionando en modo local como antes.
- **`ebook.html` + `ebook-guia.html` + `api/lead.js`** — el **embudo del ebook**: landing de captura ("Los 7 errores que hunden el precio de tu piso en Oviedo") con formulario que guarda cada lead en Supabase (tabla `clara_leads`, alta validada por RPC pública y lectura solo con la clave de sincronización — función `leads_lista`) y entrega la guía al instante. El ebook son 16 páginas A4 con la marca Castresana, listas para PDF (Ctrl+P). URLs una vez desplegado: `/ebook.html` (landing) y `/ebook-guia.html` (la guía).
- **`lib/skills.js`** — el **sistema de skills** de Clara: manuales expertos que carga bajo demanda con la herramienta `usar_skill`. Vienen cuatro de serie: `ebook-lead-magnet` (ebooks/lead magnets/dossieres en PDF con el método Claude + Higgsfield, también a partir de los vídeos de Pau — Clara entrega un HTML premium con botón **⬇ Descargar HTML** en el chat, que se convierte en PDF con Ctrl+P), `app-movil-profesional` (apps móviles: PWA primero, Capacitor para tiendas), `web-3d-profesional` (webs con 3D real: Three.js, React Three Fiber, tours 360º) y `crear-skills` (meta-skill). Con la nube activa, Clara además puede **crear sus propias skills** con la herramienta `crear_skill`: quedan guardadas en Supabase (tabla `clara_skills`, mismo blindaje que la memoria) y disponibles para siempre.

## Memoria en la nube (fase 3) — configuración

En Vercel → Settings → Environment Variables, añade (además de las claves de siempre):

- `SUPABASE_URL` = `https://hgwlowomttzbnbspdnkx.supabase.co`
- `SUPABASE_ANON_KEY` = la clave **anon** del proyecto `clara-memoria` (Supabase → Project Settings → API Keys). Esta clave es *publicable por diseño*: la seguridad real la da la clave de sincronización, que no está en ningún archivo.

Después, en el chat de Clara: pulsa **🧠 Memoria**, escribe tu **clave de sincronización** en el campo de abajo y guarda. Repite ese paso una vez en cada dispositivo (móvil, portátil…) y la memoria será la misma en todos. Puedes cambiar la clave cuando quieras pidiéndoselo a Clara en modo ingeniera (función `clara_cambia_clave` en Supabase).
- **`test/clara.test.mjs`** — batería de pruebas de la API (calculadora, búsqueda, validación, flujo completo con herramientas simulando Claude). Se ejecuta con `npm test`, sin gastar API real.
- **`test/ui.test.mjs`** — prueba de la interfaz con navegador real (Playwright + Chromium): saludo, modos, envío/respuesta, formato, persistencia, memoria y reinicio. Se ejecuta con `npm run test:ui`.
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
- **Perplexity**: la búsqueda se cobra en tu cuenta de Perplexity según su tarifa por uso. Clara hace como máximo 6 rondas de búsqueda por respuesta. Puedes cambiar el modelo de búsqueda en la constante `PERPLEXITY_MODEL` de `api/clara.js` (`sonar` es el más barato; `sonar-pro` da respuestas más completas).
- Revisa el consumo de Claude en [platform.claude.com](https://platform.claude.com/) y el de Perplexity en tu panel de [perplexity.ai](https://www.perplexity.ai/account/api/).

## Notas

- El historial de la conversación vive solo en tu navegador (`localStorage`): sobrevive a recargas y cierres, y se borra con el botón **🗑 Nueva** (la 🧠 Memoria no se toca al reiniciar la conversación). A la API se envían como máximo los últimos 60 mensajes, más tus notas de 🧠 Memoria (hasta 4.000 caracteres).
- Clara conoce la fecha de hoy (hora de Madrid): el servidor se la inyecta en cada petición, así que puede calcular plazos y saber si un dato está desactualizado.
- Si cambias la persona en `clara_persona.md`, actualiza también el prompt embebido en `api/clara.js` (y viceversa).
- Clara nunca inventa experiencia para tu CV ni datos de empresas, y en temas emocionales graves siempre recomienda ayuda profesional.
