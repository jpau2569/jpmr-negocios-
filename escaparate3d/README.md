# Escaparate 3D · Asesoría Castresana

Web de una sola página con la cartera de inmuebles en un **carrusel 3D (WebGL)**
y, debajo, la misma cartera en lista para móvil, buscadores y navegadores sin 3D.
El objetivo no es el efecto: es que un comprador marque **solo los pisos que le
interesan** y nos llegue ese mensaje por **WhatsApp o correo**, ya escrito.

```
escaparate3d/
├── index.html              la web entera (3D + lista + contacto). No necesita build.
├── pisos.json              los datos reales. Vacío al principio.
├── pisos.ejemplo.json      el esquema de cada inmueble, con un ejemplo comentado.
├── fotos/                  las fotos en hosting propio (ver fotos/LEEME.md).
└── herramientas/
    └── sincronizar.mjs     rellena pisos.json y baja las fotos desde la web oficial.
```

## Cómo lo ve el cliente

1. Entra y ve las tarjetas de los inmuebles girando en 3D (flechas, rueda del
   ratón, arrastre o teclado). En el móvil ve directamente la lista con foto.
2. Filtra por **venta / alquiler** y por **zona**.
3. En cada inmueble tiene tres acciones:
   - **Ver ficha completa** → la ficha oficial en asesoriacastresana.com.
   - **Me interesa** → lo marca (se guarda en su navegador).
   - **Solicitar visita** → formulario corto (nombre, teléfono, cuándo le viene
     bien) y dos botones de envío.
4. Abajo aparece la barra **"N inmuebles marcados"**: al enviar, el mensaje de
   WhatsApp o el correo llevan **solo los que ha marcado**, con título, precio,
   referencia y enlace de cada uno. Nada de "hola, quiero información".

El correo va a `asesoriacastresana@gmail.com` y el WhatsApp al móvil que se
configure. Si además hay Supabase configurado, el contacto se registra en el CRM
por `/api/lead` (origen `escaparate3d`) sin molestar al cliente.

## Lo único que hay que configurar

En `index.html`, bloque `CONFIG` (arriba del `<script type="module">`):

```js
whatsapp: "",   // ← móvil en formato internacional SIN "+": "34600112233"
```

Mientras esté vacío, los botones de WhatsApp abren la app pidiendo elegir
contacto (funcionan, pero el cliente tiene que buscarnos) y el botón de WhatsApp
de la cabecera se oculta. **Poner el número es el paso 1.**

El resto del bloque (marca, teléfono, correo, dirección, horario, colores) ya
está relleno con los datos reales de la oficina.

## De dónde salen los datos

Cascada, del más fiable al último recurso:

1. **`pisos.json`** — datos y fotos propios. No caducan nunca. Es el modo bueno.
2. **`/api/escaparate`** — lectura en vivo de la web oficial (la función que ya
   usa la tele del local). Sirve mientras `pisos.json` esté vacío.
3. **Respaldo embebido en `index.html`** — la última cartera conocida, para que
   la web nunca aparezca vacía si se cae todo lo demás.

Forzar un origen concreto para probar: `?fuente=json`, `?fuente=api`,
`?fuente=respaldo`. Otros parámetros: `?op=venta`, `?ref=PIS0160`, `?2d=1`.

## Actualizar la cartera

Desde la raíz del repositorio, con conexión a Internet:

```bash
node escaparate3d/herramientas/sincronizar.mjs          # datos + fotos
node escaparate3d/herramientas/sincronizar.mjs --dry    # enseña qué haría, sin escribir
node escaparate3d/herramientas/sincronizar.mjs --sin-fotos
```

- Lee la web oficial con `lib/cartera.js` (el mismo lector que la TV y Clara).
- Descarga la foto principal de cada anuncio a `fotos/` y apunta la ruta local.
- Pone la fecha de comprobación en `verificado` (se muestra bajo la ficha).
- **No borra nada**: un anuncio que ya no está pasa a `"activo": false`.
- Si no consigue leer ni un inmueble, no toca `pisos.json` (evita vaciarlo).

Lo escrito a mano (descripción, planta, fotos añadidas) se conserva entre
sincronizaciones. Para añadir más fotos a un inmueble, cópialas a `fotos/` y
súmalas al array `imagenes` de ese inmueble en `pisos.json`.

Cuando exista un feed o una API autorizada de Inmoweb, solo hay que cambiar la
fuente dentro de `sincronizar.mjs`: el resto del sistema no se entera.

## Publicar

- **En este repositorio (Vercel):** ya está. Se despliega solo en
  `/escaparate3d/` y ahí `/api/escaparate` y `/api/lead` funcionan.
- **En otro hosting (Hostinger):** sube la carpeta entera por FTP. Sin
  `/api/*` la web usa el respaldo embebido, así que conviene tener `pisos.json`
  sincronizado antes de subirla.

## Detalles técnicos

- Three.js por `importmap` desde CDN, sin empaquetador ni dependencias.
- `setPixelRatio(min(devicePixelRatio, 2))`, sRGB, tone mapping ACES,
  `RoomEnvironment` + `PMREMGenerator`, `MeshPhysicalMaterial` con clearcoat y
  tres luces. Solo se dibujan las tarjetas de la ventana visible (±7).
- El bucle se pausa con la pestaña oculta y respeta `prefers-reduced-motion`.
- Todo el texto real vive en el HTML (el `<canvas>` es `aria-hidden`), con
  JSON-LD `RealEstateAgent`, navegación por teclado y foco visible.
- Las fotos se pintan dentro del canvas: por eso deben servirse desde el mismo
  dominio (ver `fotos/LEEME.md`).
