# MarkItDown — documentos a texto limpio antes de que Claude los lea

MarkItDown es la herramienta gratis de Microsoft (código abierto, licencia MIT,
github.com/microsoft/markitdown) que convierte PDF, Word, Excel, PowerPoint y
más en Markdown. Claude lee ese texto en vez del archivo entero, así que gasta
menos y entiende mejor las tablas.

## 1. Conectarlo (una vez por ordenador)

**En el Mac, lo fácil:** descarga el repositorio (o solo `markitdown/instalar-en-mac.command`)
y haz doble clic en ese archivo. Hace los pasos de abajo uno a uno, te pregunta antes
de instalar nada, copia la skill a `~/.claude/skills/markitdown` para que se active
sola en **todos** tus proyectos y, si le dices que sí, la conecta también a la app de
escritorio (con copia del archivo antes). Si macOS dice que no puede abrirlo: clic
derecho → Abrir.

A mano:

```bash
uvx --version                      # si no sale nada, hace falta uv (docs.astral.sh/uv)
claude mcp add --scope user --transport stdio markitdown -- uvx markitdown-mcp
claude mcp list                    # markitdown tiene que salir ✔ Connected
```

- Mac sin uv: `brew install uv` (o el instalador de docs.astral.sh/uv).
- Windows sin uv: `winget install --id=astral-sh.uv -e`.
- Si `claude` no existe porque usas Claude Code en VS Code, usa el binario de la
  extensión: `~/.vscode/extensions/anthropic.claude-code-…/resources/native-binary/claude`.
- **App de escritorio:** en `claude_desktop_config.json` (Mac:
  `~/Library/Application Support/Claude/`; Windows: `%APPDATA%\Claude\`), dentro de
  `"mcpServers"`: `"markitdown": { "command": "<ruta completa de uvx>", "args": ["markitdown-mcp"] }`.
  Haz una copia antes y no toques los demás conectores. Luego cierra la app del
  todo (Cmd+Q en Mac) y vuelve a abrirla.
- Para comprobarlo: en Claude Code, `/mcp`; en la app, que markitdown salga en los conectores.

## 2. Dale la ruta, no lo arrastres

Si arrastras el archivo al chat, Claude lo lee como siempre y gasta lo de
siempre. Para que pase por MarkItDown, escríbele dónde está.

- **Mac:** clic derecho en el archivo, mantén pulsada la tecla Opción y elige
  «Copiar … como nombre de ruta».
- **Windows:** clic derecho y «Copiar como ruta de acceso».

## 3. Frases para copiar

**Un archivo**

> Con markitdown, convierte a Markdown el archivo [ruta del archivo] y después
> [resúmemelo en 5 puntos / sácame las cifras importantes / contéstame esto: …].

**Una carpeta entera (en Claude Code)**

> Con markitdown, convierte a Markdown todos los archivos de la carpeta
> [ruta de la carpeta]. Guarda cada uno como .md al lado del original y dime
> cuáles han salido vacíos o raros.

**Un vídeo de YouTube**

> Con markitdown, pásame a texto este vídeo: [enlace de YouTube]. Después hazme
> un resumen en 5 puntos y dime en qué minuto se habla de [lo que te interesa].

## 4. Sin chat: el convertidor de esta carpeta

`convertir.mjs` hace lo mismo desde la terminal, hablando con el mismo conector
(solo necesita Node y uv; nada de `npm install`):

```bash
node markitdown/convertir.mjs "/ruta/al/contrato.pdf"          # → contrato.pdf.md al lado
node markitdown/convertir.mjs "/ruta/a/la/carpeta"             # → un .md por archivo
node markitdown/convertir.mjs "/ruta/a/la/carpeta" --recursivo # también subcarpetas
node markitdown/convertir.mjs "https://…" --salida texto.md    # una página o un vídeo
```

- Un `.md` que ya existe **no se sobrescribe** (salvo con `--sobrescribir`).
- Al final dice qué ha salido **vacío** (casi sin texto) o **raro** (caracteres
  ilegibles o casi sin letras).

## 5. Cosas que conviene saber

- **PDF escaneados** (fotos de papel): MarkItDown no hace OCR por sí solo, así que
  saldrán vacíos. Hay que pasarlos antes por un OCR o mandarle a Claude la imagen.
- **CSV con punto y coma** (los que exporta Excel en español): la tabla sale en una
  sola columna. Para leerlos es mejor abrir el `.xlsx` o el CSV tal cual.
- **YouTube** necesita que el vídeo tenga subtítulos y que la red deje entrar en
  YouTube. Desde la sesión en la nube de Claude Code ha fallado («Could not fetch
  the resource»); en tu ordenador debería ir.
- **Privacidad:** los documentos de clientes no se suben al repositorio (es
  público). Si los dejas en `markitdown/documentos/`, git los ignora.
