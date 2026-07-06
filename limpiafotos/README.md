# LimpiaFotos JPMR — Clipdrop + Descarga

App para **limpiar y recortar fotos con IA** (Clipdrop) y **descargarlas** en el
ordenador o el móvil. Se compone de dos partes:

- **Backend** (`server.js`): hace de proxy seguro con Clipdrop. Tu clave de API
  vive solo en el servidor, nunca en el navegador.
- **Frontend** (`public/index.html`): la interfaz para subir la foto, procesarla
  y **descargarla** con un botón.

Funciones incluidas: **quitar fondo**, **quitar texto** y **mejorar resolución**.

---

## Pasos para ponerlo en marcha (aparte, sin tocar lo demás)

### 1. Consigue tu clave de Clipdrop
1. Entra en <https://clipdrop.co/apis> e inicia sesión.
2. Ve a **API Keys** y crea una clave.
3. Cópiala (algo como `abc123...`).

### 2. Instala Node.js
Descarga **Node.js 18 o superior** desde <https://nodejs.org> (versión LTS).

### 3. Instala las dependencias
Abre una terminal dentro de la carpeta `limpiafotos/` y ejecuta:

```bash
npm install
```

### 4. Arranca el servidor con tu clave

**Windows (PowerShell):**
```powershell
$env:CLIPDROP_API_KEY="tu_clave_aqui"; npm start
```

**Windows (CMD):**
```cmd
set CLIPDROP_API_KEY=tu_clave_aqui && npm start
```

**Mac / Linux:**
```bash
CLIPDROP_API_KEY="tu_clave_aqui" npm start
```

> También puedes copiar `.env.example` a `.env`, poner ahí tu clave y arrancar con
> `node --env-file=.env server.js` (Node 20.6+).

### 5. Ábrelo en el navegador
Ve a **<http://localhost:3000>**. Sube una foto, pulsa **«Procesar con Clipdrop»**
y luego **«Descargar foto»**.

---

## Cómo funciona la descarga

- En **ordenador**: se guarda directamente en tu carpeta de *Descargas*.
- En **Android**: se guarda en *Descargas* o la galería.
- En **iPhone** (Safari): a veces abre la imagen a pantalla completa; mantén
  pulsado y elige **«Guardar en Fotos»**.

La descarga usa la imagen ya procesada (un *Blob* en el navegador), así que se
guarda con transparencia (PNG) cuando quitas el fondo.

---

## Publicarlo en internet (opcional)

Puedes desplegarlo gratis en **Render**, **Railway** o **Vercel**:

1. Sube esta carpeta a un repositorio.
2. En el panel del hosting, crea un servicio de tipo *Node*.
3. Comando de arranque: `npm start`.
4. Añade la variable de entorno **`CLIPDROP_API_KEY`** con tu clave.

Así la app queda accesible desde cualquier móvil sin instalar nada.

---

## Herramientas de Clipdrop disponibles

| Opción en la app        | Endpoint de Clipdrop            |
|-------------------------|---------------------------------|
| Quitar fondo            | `/remove-background/v1`         |
| Quitar texto            | `/remove-text/v1`               |
| Mejorar resolución (x2) | `/image-upscaling/v1/upscale`   |

Puedes añadir más (p. ej. `cleanup`) editando el objeto `CLIPDROP_ENDPOINTS`
en `server.js` y una `<option>` en `public/index.html`.
