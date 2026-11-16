---
name: markitdown
description: Usar SIEMPRE que Pau pase, adjunte, nombre o dé la ruta de un PDF, Word (.docx/.doc), Excel (.xlsx/.xls), PowerPoint (.pptx), CSV, EPUB o HTML, o una carpeta con ellos, o un enlace de YouTube que quiera en texto, para leerlo, resumirlo, sacar cifras o contestar preguntas sobre él. Convierte el archivo a Markdown con MarkItDown (Microsoft, MIT) antes de leerlo, para gastar menos y leer bien las tablas.
---

# MarkItDown: convertir antes de leer

Regla de Pau: **todo PDF, Word, Excel o PowerPoint pasa por MarkItDown antes de leerlo.**
No se lee el binario directamente con Read salvo que MarkItDown falle.

## Cómo

1. **Si las herramientas del conector están cargadas** (`mcp__markitdown__convert_to_markdown`),
   úsalas con la ruta como URI: `file:///ruta/absoluta/al/archivo.pdf` (o la URL `https://…`).
2. **Si no lo están** (sesión abierta antes de conectarlo, o en la nube), usa el convertidor
   del repo, que habla con el mismo conector por stdio:
   ```bash
   node markitdown/convertir.mjs "/ruta/al/archivo.pdf"     # → archivo.pdf.md al lado
   node markitdown/convertir.mjs "/ruta/a/la/carpeta"       # → un .md por archivo
   node markitdown/convertir.mjs "https://…" --salida /tmp/…/texto.md
   ```
   Después lee el `.md` resultante.
3. **Si no está conectado** (`claude mcp list` no muestra markitdown): díselo a Pau y
   ofrécele conectarlo con `claude mcp add --scope user --transport stdio markitdown -- uvx markitdown-mcp`.
   No instales nada sin preguntar. Nunca uses sudo.

## Después de convertir

- Haz lo que Pau pidió (resumen en 5 puntos, cifras, respuesta concreta) sobre el Markdown.
- Si sale **vacío o raro** (PDF escaneado, fuentes rotas), dilo y ofrece leer el original
  como imagen. No inventes el contenido que falte.
- **CSV con «;»** salen en una sola columna: léelos tal cual.
- **Privacidad:** documentos de clientes nunca al repositorio (es público). Los `.md`
  generados de documentos de clientes no se commitean; si hace falta guardarlos, en
  `markitdown/documentos/` (ignorada por git) o en el scratchpad.
- Si algo falla, enseña el error tal cual y pregunta antes de probar otra cosa.

Guía completa para Pau: `markitdown/EMPEZAR-AQUI.md`.
