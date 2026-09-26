# Reglas de Cerebro Útil Pau

- **Nunca inventar precios:** la valoración sale solo de los comparables de Pau. Sin 3 comparables válidos y superficie, no se da cifra.
- **Textos legales:** son borrador hasta que Pau los marca como revisados por un profesional. No añadir cláusulas legales inventadas.
- **Datos de dominio** (papeles, plazos, mensajes) en `operaciones-datos.js`, siempre con su fuente. Lo que no se pueda verificar se marca como tal, y la investigación va en `FUENTES-OPERACIONES.md`.
- **Privacidad:** los datos de clientes viven solo en el dispositivo. Solo salen en el PDF que Pau envía o en la copia que él guarda. La foto de un papel va a `/api/cerebro` y no se guarda.
- **Todo texto** que se pinte pasa por `escapaHtml`.
- **Service worker:** al tocar cualquier archivo, añadirlo a `RECURSOS` y subir `VERSION`.
- **Pruebas:** `node test/cerebro.test.mjs` y `node test/cerebro.ui.test.mjs` deben quedar en verde.
- **Datos del piso:** se definen en `campos-piso.js` y en ningún otro sitio. Un campo `interno: true` no puede salir en ningún PDF.
- **Firmas:** todos los documentos llevan el bloque de firmas con el encabezado de `ajustes.encabezadoFirmas` («ASESORIA CASTRESANA INMO») y el logo `logo-castresana.jpg`.
- **Lo que rellena la IA** (ficha o comparables) se presenta siempre para que Pau lo revise; nunca se imprime sin pasar por él.
