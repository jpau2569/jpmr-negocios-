# Cerebro Útil Pau — detalle técnico

PWA de trabajo y personal de Pau Moralejo (Asesoría Castresana). Está hecha con módulos ES sin empaquetador, como `nicer-estudia/` y `sol-niebla-agua/`. **Necesita servirse por HTTP**, porque usa módulos y service worker. Guía para Pau: `EMPEZAR-AQUI.md`.

La hizo el equipo de Clara:
- **NURIA:** datos de dominio con fuentes (`FUENTES-OPERACIONES.md`).
- **IYAN:** generador de PDF (`pdf.js`).
- **NICER:** revisión de calidad.

## Módulos
| Archivo | Qué hace |
|---|---|
| `utiles.js` | Fechas ISO locales (`esISO` rechaza fechas imposibles), días hábiles, formatos en español, `escapaHtml`, `rellena` de plantillas y `telefonoWhatsapp`. |
| `datos.js` | Estado en `localStorage` (`cerebro_util_pau_v1`), `normaliza` (una copia rota nunca rompe la app), copia de seguridad `.json` (sin la clave de sincronización) y aviso de almacenamiento lleno. |
| `calendario.js` | `.ics` con alarmas: con hora o de día completo, líneas de 75 octetos como máximo. |
| `firma.js` | Lienzo con eventos de puntero; exporta un JPEG de 600 px con fondo blanco. |
| `pdf.js` | Generador de PDF propio (IYAN): Helvetica con WinAnsi/CP1252, métricas AFM, JPEG con DCTDecode y xref exacta. Sin dependencias, funciona sin conexión. |
| `documentos.js` | PDF de la hoja de visita y del informe de valoración, con la marca Castresana. |
| `visitas.js` | Validación de la visita (firma, RGPD, nombre), limpieza, declaración rellenada y buscador. |
| `operaciones.js` + `operaciones-datos.js` | Fases, papeles (quién los aporta y su carácter: obligatorio, habitual o según el caso, con fuente), plazos (naturales o hábiles), fechas, eventos y mensajes. Los datos los preparó NURIA el 26/09/2026. |
| `valoracion.js` | €/m² con ajuste manual, mediana y rango P25-P75 (mínimo-máximo si hay menos de 4). **Sin 3 comparables válidos y superficie no hay precio.** Aviso de dispersión alta. |
| `papeles.js` | Tipos, estado (vencido, pronto u ok), orden, eventos y renovación anual. |
| `campos-piso.js` | Definición única de los más de 50 datos de un piso (grupos, tipos texto, número, opciones, sí/no y fecha). Genera el formulario, los PDF, el esquema de Claude (`esquemaFicha`) y `limpiaFicha`. Los campos `interno` (precio mínimo) nunca salen en un PDF. Incluye la referencia de zona (€/m² de oferta de idealista, agosto 2026, tomada de EstateScore AI; solo contexto). |
| `dictado.js` | Dictado por voz con la Web Speech API (es-ES, en varias tandas); si no está disponible, se oculta. |
| `importar.js` (IYAN) | Enlace `#importar=<base64url>` con el que Clara abre una valoración ya montada. `decodificaImportacion` sanea los datos y la app los pasa además por `normaliza`. |
| `logo-castresana.jpg` | Logo oficial (inmoweb), en JPEG sobre blanco para los PDF. |
| `app.js` | Pantallas y eventos. Navegación por `#ancla`; todo el texto pasa por `escapaHtml`. |
| `service-worker.js` | Red primero y caché si no hay conexión. `/api` nunca se cachea. Al tocar un archivo, sube `VERSION`. |

## Backend
`api/_cerebro.js` (en `/api/cerebro` a través de `api/[ruta].js`). Acciones: `ficha` (dictado, anuncio o enlace → ficha, solo con lo que consta; los números que no aparecen en el texto se descartan) y `comparables` (Gemini con Google → Claude; solo anuncios con precio, m² y url presente en las fuentes, 10 como máximo; sin `GEMINI_API_KEY` responde 503). Y `leer-documento`:
- Recibe una foto JPEG, PNG o WebP de 3 MB como máximo. Claude la lee con la herramienta forzada `datos_documento` y `limpiaLectura` descarta las fechas imposibles.
- Nunca queda abierto. Con Supabase exige la clave de sincronización (se valida con `clara_memoria_lee`); sin Supabase exige la variable `CEREBRO_CLAVE` de Vercel y, si no existe, responde 503. Así nadie gasta el saldo de Anthropic.
- No guarda nada.

## Datos legales
- `operaciones-datos.js` y `FUENTES-OPERACIONES.md` recogen normativa a septiembre de 2026 (ITP de Asturias, Ley 5/2019, LAU tras la Ley 12/2023, art. 9 de la LPH, cédula de habitabilidad en Asturias…).
- Lo no verificado lleva la marca **SIN VERIFICAR** en `FUENTES-OPERACIONES.md`. Destaca el depósito de fianzas en Asturias por el proyecto de Ley de Vivienda.
- Si cambia una norma, se actualiza el dato y su fuente, y se ejecuta `node test/cerebro.test.mjs`.
- Los textos de la hoja de visita son un **BORRADOR**: el PDF lo indica hasta que Pau los marca como revisados, y la app no deja marcarlos mientras queden `[corchetes]`.

## Tests
- `node test/cerebro-pdf.test.mjs`: 53 comprobaciones del generador de PDF.
- `node test/cerebro.test.mjs`: lógica, PDF y `/api/cerebro` simulada.
- `node test/cerebro.ui.test.mjs`: Chromium real con firma, PDF, operación, valoración, papel con foto, copia, uso sin conexión y anchos de 360 a 1366 px sin desbordes.
