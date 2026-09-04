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
3. En cada inmueble tiene cuatro acciones:
   - **Ver fotos** → la galería, sin salir de la web (ver abajo).
   - **Ver ficha completa** → la ficha oficial en asesoriacastresana.com.
   - **Me interesa** → lo marca (se guarda en su navegador).
   - **Solicitar visita** → formulario corto (nombre, teléfono, cuándo le viene
     bien) y dos botones de envío.
4. Abajo aparece la barra **"N inmuebles marcados"**, con **Comparar** y **Pedir
   visita**: al enviar, el mensaje de WhatsApp o el correo llevan **solo los que
   ha marcado**, con título, precio, referencia y enlace de cada uno. Nada de
   "hola, quiero información".

El correo va a `asesoriacastresana@gmail.com` y el WhatsApp al móvil que se
configure. Si además hay Supabase configurado, el contacto se registra en el CRM
por `/api/lead` (origen `escaparate3d`) sin molestar al cliente.

## Galería, comparador y modo escaparate

**Galería.** Clic en la foto de la tarjeta (o en la tarjeta de delante del
carrusel, o en "Ver fotos") y se abren todas las fotos del piso sin salir:
flechas, teclado, miniaturas, deslizar con el dedo en el móvil y, en el pie, los
mismos botones de marcar y pedir visita. Las fotos salen, por este orden, de
`pisos.json` (propias) o de `/api/fotos`, que lee la ficha oficial y devuelve
todas las de ese anuncio. Sin backend, queda la foto de portada.

**Comparador.** Con dos o más marcados aparece **Comparar**: los cuatro primeros
enfrentados en una tabla —precio, **precio por m²**, superficie, habitaciones,
baños, planta y **cuota estimada**— con el mejor valor de cada fila en dorado.
Desde ahí se puede quitar uno o pedir visita de todos. La cuota usa 80 %
financiado a 25 años al 3 %, y así se dice en la propia tabla.

**Modo escaparate.** Si nadie toca nada durante 30 segundos, el carrusel empieza
a girar solo y aparece el aviso "modo escaparate". Al primer toque, tecla o
rueda, se para y manda el visitante. Para la tele del local: `?auto=1` arranca
girando desde el principio y `?secs=6` marca el ritmo. Con
`prefers-reduced-motion` activado no se activa nunca.

## Contacto configurado

Todo vive en el bloque `CONFIG` de `index.html` (arriba del `<script type="module">`):
WhatsApp **672 77 57 21**, correo **asesoriacastresana@gmail.com**, teléfono
985 21 04 68, dirección y horario de la oficina. Para cambiar el móvil, esa línea:

```js
whatsapp: "34672775721",   // internacional, sin "+" ni espacios
```

Si se deja vacío, los botones de WhatsApp siguen funcionando pero abren la app
pidiendo elegir contacto, y el botón de la cabecera se oculta.

## La tarjeta "Comprar o vender con todo en regla"

Cierra el carrusel 3D y encabeza la lista del móvil. Al abrirla:

- **Checklist de la notaría**, en dos pestañas (voy a comprar / voy a vender):
  11 puntos cada una, con qué es, dónde se pide y cuáles hay que empezar pronto
  (cancelación registral de hipoteca, certificado de la comunidad, papeles del
  banco). Lo marcado se guarda en el dispositivo y sale en la barra de progreso.
- **Calculadora.** Comprando: entrada, ITP, notaría/registro/gestoría, cuánto
  hace falta el día de la firma y cuota estimada de hipoteca. Vendiendo:
  ganancia, IRPF orientativo por la escala del ahorro, hipoteca a cancelar y qué
  queda limpio. Todos los números son editables.
- **"Mandármelo por WhatsApp / por correo"**: manda lo que ya tiene, lo que le
  falta y sus números. Es decir, un lead cualificado que llega con los deberes
  hechos, no un "hola, información".

Todo se calcula en el navegador y lleva aviso de que es orientativo: los tipos,
las bonificaciones y lo que pide cada notaría cambian. Los textos están en la
constante `PAPELES` del final de `index.html`; cambiarlos es editar texto.

## De dónde salen los datos

Cascada, del más fiable al último recurso:

1. **`pisos.json`** — datos y fotos propios. No caducan nunca. Es el modo bueno.
2. **`/api/escaparate`** — lectura en vivo de la web oficial (la función que ya
   usa la tele del local). Sirve mientras `pisos.json` esté vacío.
3. **Respaldo embebido en `index.html`** — la última cartera conocida, para que
   la web nunca aparezca vacía si se cae todo lo demás.

Forzar un origen concreto para probar: `?fuente=json`, `?fuente=api`,
`?fuente=respaldo`. Otros parámetros: `?op=venta`, `?ref=PIS0160`, `?2d=1`,
`?auto=1`, `?secs=6`.

Las fotos de cada ficha las sirve `api/fotos.js` con el lector `lib/fotos-ficha.js`,
que tiene sus propios tests: `npm test`.

## Actualizar la cartera

Desde la raíz del repositorio, con conexión a Internet:

```bash
node escaparate3d/herramientas/sincronizar.mjs               # datos + fotos
node escaparate3d/herramientas/sincronizar.mjs --dry         # enseña qué haría, sin escribir
node escaparate3d/herramientas/sincronizar.mjs --maxfotos 10 # más fotos por inmueble
node escaparate3d/herramientas/sincronizar.mjs --sin-fotos
```

- Lee la web oficial con `lib/cartera.js` (el mismo lector que la TV y Clara).
- Entra en la ficha de cada inmueble y descarga **todas sus fotos** (6 por
  defecto, `--maxfotos 10` para más) a `fotos/`, apuntando las rutas locales.
- Pone la fecha de comprobación en `verificado` (se muestra bajo la ficha).
- **No borra nada**: un anuncio que ya no está pasa a `"activo": false`.
- Si no consigue leer ni un inmueble, no toca `pisos.json` (evita vaciarlo).

Lo escrito a mano (descripción, planta, fotos añadidas) se conserva entre
sincronizaciones. Para añadir más fotos a un inmueble, cópialas a `fotos/` y
súmalas al array `imagenes` de ese inmueble en `pisos.json`.

Cuando exista un feed o una API autorizada de Inmoweb, solo hay que cambiar la
fuente dentro de `sincronizar.mjs`: el resto del sistema no se entera.

### Las fotos reales antes de sincronizar: `/api/foto`

El escaparate pinta las fotos dentro del canvas y WebGL rechaza las imágenes de
otro dominio. Las de la web oficial (CDN de Inmoweb) no autorizan CORS, así que
pasan por `api/foto.js`, que las sirve desde nuestro propio dominio con caché en
Vercel. Gracias a eso los inmuebles auténticos salen con su foto desde el primer
día, aunque `pisos.json` esté vacío. **No es un proxy abierto**: solo deja pasar
`asesoriacastresana.com` y `apinmo.com`. En un hosting sin `/api`, la lista cae
sola a la URL original de la foto.

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
