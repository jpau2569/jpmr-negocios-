# 📷 Fotos Fáciles — Pasar a Ordenador

Pasa las fotos y vídeos del móvil (iPhone o Android), de un pendrive o de otra carpeta
**a tu ordenador**, en segundos, sin iTunes, sin drivers raros y **sin que nada salga a internet**.

Pensado para el día a día de una inmobiliaria: haces 60 fotos de un piso con el iPhone,
llegas a la oficina, escaneas un QR y ya están en el PC, ordenadas por fecha o por inmueble,
listas para editar y publicar.

---

## Lo que hace, en una frase por modo

| Modo | Para qué sirve |
|---|---|
| **📶 Sin cables (QR)** | El PC muestra un código QR. Lo escaneas con la cámara del móvil, se abre el navegador y eliges las fotos. Van directas al PC por la WiFi. **Es el modo estrella.** |
| **🔌 Por cable / USB** | Detecta pendrives, tarjetas SD, cámaras y Android en modo "transferencia de archivos". Enseña solo lo que **todavía no tienes** y lo importa ordenado. |
| **📋 Copiar y pegar** | Un explorador doble dentro de la app: eliges fotos en una carpeta (incluida la de WhatsApp de un Android) y las pegas en otra con Ctrl+C / Ctrl+V. |
| **🔗 Compartir** | Seleccionas fotos ya guardadas y generas un enlace para enseñárselas a un cliente. Nunca toca los originales. |
| **🏠 Escaparate 3D** | Publica las fotos elegidas en tu carrusel de la cartera: las reduce, las copia a `escaparate3d/fotos/` y las pone de portada en `pisos.json`. |
| **🪄 LimpiaFotos** | Prepara una carpeta con las fotos seleccionadas y la abre, para arrastrarlas de una vez a la herramienta de retoque. |

---

## Instalación (una sola vez, 3 minutos)

1. **Instala Node.js** desde [nodejs.org](https://nodejs.org) — elige la versión **LTS** y dale a Siguiente hasta el final.
   (Es gratis y es lo único que hace falta: la app no necesita descargar ninguna librería más.)
2. **Descarga esta carpeta** `fotos-faciles` a tu ordenador
   (o clona el repositorio: `git clone https://github.com/jpau2569/jpmr-negocios-.git`).
3. Listo. No hay que ejecutar `npm install`: **la app no tiene ninguna dependencia**.

## Cómo se usa cada día

### En Windows
Haz **doble clic en `FotosFaciles.bat`**. Se abre una ventana negra y, detrás, el navegador con la pantalla del programa.

### En Mac
Haz **doble clic en `iniciar.command`** (la primera vez: botón derecho → Abrir).

### Desde el terminal (cualquier sistema)
```bash
node fotos-faciles/iniciar.mjs
```

Opciones útiles:

```bash
node fotos-faciles/iniciar.mjs --puerto 5000            # otro puerto
node fotos-faciles/iniciar.mjs --destino "D:\Fotos"     # otra carpeta de destino
node fotos-faciles/iniciar.mjs --sin-navegador          # no abrir el navegador
node fotos-faciles/iniciar.mjs --ayuda
```

---

## Modo estrella: pasar fotos del móvil sin cables

1. Arranca el programa en el PC. Verás un **QR grande** y un **PIN de 4 cifras**.
2. Con el móvil **en la misma WiFi**, abre la cámara y apunta al QR. Toca el aviso que sale arriba.
3. Se abre el navegador del móvil (Safari o Chrome). Pulsa **«Elegir fotos y vídeos»**.
4. Elige lo que quieras — del Carrete, de un álbum, o fotos que hayas guardado de un chat de WhatsApp.
5. Ya está: van llegando al PC y las ves aparecer en la pantalla del ordenador.

**Detalles que hacen que funcione bien de verdad:**

- **No se repite nada.** Antes de subir, el móvil pregunta al PC qué tiene ya. Si mandas el mismo
  álbum dos veces, la segunda tarda un segundo y no duplica ni una foto.
- **Si se corta la WiFi, se reanuda.** Cada archivo se escribe en un `.parcial`; al reintentar
  se sigue exactamente por donde iba. Funciona aunque cierres y vuelvas a abrir el programa.
- **Tres archivos a la vez**, con barra de progreso real y botón de reintentar los fallidos.
- **PIN.** Si alguien escribe la dirección a mano (por ejemplo en la WiFi de la oficina) le pide
  el PIN, y tras varios fallos se bloquea un par de minutos. Quien escanea el QR entra directo.

> **¿Y si el móvil no abre la página?** Casi siempre es que el PC está en otra red (cable vs WiFi,
> o una red de invitados). En Ajustes tienes todas las direcciones detectadas; también puedes
> escribir a mano `http://LA-IP-DEL-PC:4321/m` y meter el PIN.

### Desde el móvil también mandas tú

La pantalla del móvil no es solo "enviar": decide **dónde** caen las fotos y qué se hace con ellas,
sin tener que tocar el ordenador.

**¿Dónde te las guardo?** — tres opciones, arriba del todo:

| Opción | Qué hace |
|---|---|
| **Por día** | Lo de siempre: `Fotos Faciles/2026-09-07/`. |
| **En un inmueble** | Desplegable con **tu cartera real** del escaparate 3D. Crea `PIS0190 - Piso…/2026-09-07/`. |
| **En una carpeta del PC** | Abres el explorador del ordenador **desde el móvil**, navegas, puedes **crear una carpeta nueva** y pulsas «Guardar aquí». |

Cuando eliges carpeta a mano se respeta el **nombre original** del archivo (`IMG_2001.jpg`), porque es
lo que espera quien elige la carpeta; en los otros dos modos sigue funcionando el renombrado
inteligente. La carpeta tiene que estar dentro de tu carpeta personal, de la de la app o de una
unidad conectada: el servidor rechaza cualquier otra.

**¿Las pongo en el escaparate 3D?** — al terminar de enviar aparece un botón para publicarlas
directamente. El móvil reduce las fotos a 1600 px **él mismo** (no hace falta volver a bajarlas del
PC) y quedan de portada del inmueble. Es el flujo completo desde el coche: haces las fotos del piso,
escaneas el QR, las mandas, eliges el inmueble y ya están en el escaparate.

---

## Modo por cable / USB

Pulsa **Buscar dispositivos**. Aparecen las unidades conectadas y, dentro de cada una, las carpetas
donde suelen estar las fotos (`DCIM`, `Pictures`, y las de WhatsApp en Android). Eliges una,
te enseña las fotos marcando **cuáles son nuevas**, seleccionas y pulsas Importar.

### Aviso honesto sobre el iPhone

En Windows, el iPhone **no se conecta como una unidad con letra**: usa un protocolo llamado MTP y
aparece como "dispositivo portátil" dentro del Explorador. Ningún programa puede leerlo como una
carpeta normal sin usar la API WPD de Windows, que aquí no se usa. Por eso:

- **Para el iPhone → usa el Modo sin cables (QR).** Es más rápido que el cable, de hecho.
- Si prefieres el cable: copia las fotos con el Explorador de Windows a una carpeta cualquiera
  y luego usa el **Modo copiar y pegar** para meterlas en su sitio.
- Pendrives, tarjetas SD, cámaras y Android en "Transferencia de archivos" **sí** funcionan por cable.

---

## Modo copiar y pegar (la regla de oro)

> **Nunca se sobrescribe ni se reorganiza nada que ya estuviera guardado.**

Cuando pegas y ya existe un archivo con ese nombre:

- si el contenido es **idéntico** (mismo SHA-256) → se ignora, es un duplicado;
- si el contenido es **distinto** → se guarda al lado como `IMG_001 (2).jpg`.

Funciona igual con Ctrl+C / Ctrl+V dentro de la propia app.

---

## Compartir fotos con un cliente

En «Mis fotos» seleccionas las que quieras y pulsas **Generar enlace**. La app crea una URL con su
propio código, que caduca a los días que le digas (7 por defecto) y que **apunta a los archivos
originales**: no los copia, no los mueve y no los renombra.

- **Enlace local** (siempre disponible): `http://192.168.1.40:4321/a/xxxx`. Funciona mientras el PC
  esté encendido y el cliente esté en la misma red. Perfecto para enseñar algo en la oficina.
- **Enlace de fuera de casa** (opcional): si tienes un túnel apuntando a tu PC
  ([Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/),
  ngrok o Tailscale Funnel), pon su dominio en Ajustes → *Dominio propio para enlaces fuera de casa*
  y los enlaces se generarán también con esa dirección, para mandarlos por WhatsApp.
  **Las fotos las sigue sirviendo tu PC**: no se suben a ninguna nube.

Si no configuras el túnel, la app te lo dice claramente en vez de darte un enlace que no funcionaría.

---

## Enganche con el resto de tus herramientas

En **Mis fotos** hay una caja, *Enviar al resto de tus herramientas*, con un desplegable que lee
**tu cartera real** desde `escaparate3d/pisos.json`. Eliges el inmueble (o escribes su referencia) y:

### 🏠 Publicar en el escaparate 3D

1. Cada foto se **reduce a 1600 px** en el propio navegador (canvas), que es el tamaño que
   recomienda `escaparate3d/fotos/LEEME.md`. Sin instalar nada: pasa de ~4 MB a ~200 KB.
2. Se copia a `escaparate3d/fotos/` como `<referencia>-propia-01.jpg`, `-02`…
3. Se apunta en `pisos.json` **delante** de las fotos del portal, así que **tu foto pasa a ser la portada**.

Dos detalles pensados a propósito:

- El sufijo `-propia-` evita chocar con `sincronizar.mjs`, que nombra las suyas `<referencia>-01.jpg`.
- Ese script **conserva** las `imagenes` que ya había, así que tus fotos **sobreviven a cada
  sincronización** y siguen siendo la portada. Antes de tocar `pisos.json` se guarda `pisos.json.bak`.
- Si el inmueble aún no está en la cartera, se crea su entrada mínima (referencia, título, activo).
- Las fotos HEIC del iPhone no se pueden publicar tal cual: el navegador no las sabe pintar y te lo
  dice. Pásalas por el modo WiFi (el iPhone las convierte a JPG al enviarlas) o cambia el ajuste
  del iPhone a "Más compatible".

### 🪄 Preparar para LimpiaFotos

Copia las seleccionadas a `_Para LimpiaFotos/<referencia>/` dentro de tu carpeta de fotos y **abre esa
carpeta** en el Explorador, para arrastrarlas todas de golpe a la herramienta web. Los originales no
se tocan y no se vuelve a copiar lo que ya estaba preparado.

---

## iPhone por cable en Windows (experimental)

Además del modo WiFi, la pestaña *Por cable / USB* ahora lista los **dispositivos portátiles**
(iPhone y Android en MTP). Se leen con la interfaz COM `Shell.Application` a través de PowerShell,
que es la misma que usa el Explorador de Windows — sin módulos nativos que compilar.

Cómo funciona: se navega por nombres (*Apple iPhone → Internal Storage → DCIM → 100APPLE*),
se marcan las fotos (las que ya tienes salen señaladas) y se copian en tandas a una carpeta temporal
antes de entrar en su sitio. Ahí no hay miniaturas: MTP no las deja ver sin copiar el archivo entero.

**Honestidad primero:** esta parte está probada en su lógica (construcción del guion, lectura de la
respuesta, escapado contra inyección), pero **no sobre un iPhone real** — el entorno donde se
desarrolló es Linux. Por eso sale marcada como *experimental* y, si falla, la app te manda al modo
WiFi, que es más rápido de todas formas.

---

## Convertirlo en un programa que no necesita Node

```bash
npm install --no-save esbuild postject      # solo para construir
node fotos-faciles/herramientas/empaquetar.mjs                        # para este sistema
node fotos-faciles/herramientas/empaquetar.mjs --plataforma win-x64   # .exe de Windows
```

Usa las [Single Executable Applications](https://nodejs.org/api/single-executable-applications.html)
oficiales de Node: el código y las tres pantallas web se incrustan dentro de una copia del binario de
Node y sale un único archivo que **se abre con doble clic en un ordenador sin Node instalado**.
El resultado queda en `fotos-faciles/dist/`.

**Aviso de tamaño, sin adornos:** el ejecutable pesa unos **83 MB en Windows** y **119 MB en Linux**,
porque lleva Node entero dentro (comprimido en ZIP, unos 40 MB). Un envoltorio de Tauri daría una
**ventana nativa** en vez de una pestaña del navegador, pero ocuparía eso *más* los ~5 MB de Tauri:
no ahorra tamaño, solo cambia el aspecto. Como el objetivo era "no depender de Node", el ejecutable
único ya lo cumple; la ventana nativa queda como mejora aparte.

---

## Dónde acaban las fotos

Por defecto en `Fotos Faciles` dentro de tu carpeta personal, organizadas por el **día real de la
foto** (el que trae el EXIF del iPhone, no el día en que la pasaste):

```
Fotos Faciles/
├── 2026-09-07/
│   ├── 2026-09-07_Piso-Oviedo_001.jpg
│   └── 2026-09-07_Piso-Oviedo_002.jpg
└── .fotos-faciles/          ← índice, historial y enlaces (no lo borres)
```

En Ajustes puedes cambiar:

- **la carpeta de destino**;
- **cómo organizar**: por día, **por inmueble y día** (`Piso Oviedo/2026-09-07/`) o todo junto;
- **el renombrado inteligente** (`2026-09-07_Piso-Oviedo_001.jpg`) o dejar el nombre original;
- **el PIN** y el **dominio para enlaces de fuera**.

---

## Privacidad

- Ninguna foto sale de tu ordenador. No hay cuentas, ni nube, ni telemetría, ni analítica.
- El servidor solo escucha en tu red local y solo mientras el programa está abierto.
- El PIN y el token de sesión **se generan nuevos en cada arranque**.
- Al cerrar el programa, los enlaces compartidos dejan de funcionar.

---

## Para desarrolladores

Node.js puro, **cero dependencias**, módulos ES. Se ejecuta igual en Windows, macOS y Linux.

```
fotos-faciles/
├── iniciar.mjs              arranque, QR en el terminal, abre el navegador
├── nucleo/
│   ├── qr.mjs               generador de QR propio (modelo 2, byte, v1-10, L/M/Q/H)
│   ├── servidor.mjs         servidor HTTP y toda la API
│   ├── almacen.mjs          índice por SHA-256, dónde va cada archivo, historial
│   ├── subidas.mjs          subidas reanudables (.parcial + identificador estable)
│   ├── exif.mjs             fecha real y miniatura incrustada (JPEG/HEIC/MP4/MOV)
│   ├── ecosistema.mjs       puentes con el escaparate 3D y con LimpiaFotos
│   ├── wpd.mjs              iPhone/Android por cable en Windows (MTP, experimental)
│   ├── recursos.mjs         pantallas web: del disco o desde dentro del ejecutable
│   ├── dispositivos.mjs     Modo A: unidades, carpetas típicas, escaneo
│   ├── explorador.mjs       Modo C: navegar y pegar sin sobrescribir
│   ├── compartir.mjs        álbumes y enlaces con caducidad
│   ├── seguridad.mjs        PIN, tokens, límite de intentos
│   ├── tareas.mjs           tareas largas con progreso y cancelación
│   ├── red.mjs              IPv4 locales, descartando adaptadores virtuales
│   ├── config.mjs           ~/.fotos-faciles/config.json
│   └── util.mjs             nombres seguros, tipos, tamaños, rutas
├── herramientas/
│   └── empaquetar.mjs       construye el ejecutable único (Windows/macOS/Linux)
└── web/
    ├── pc.html / pc.js      pantalla del ordenador (6 pestañas)
    ├── movil.html / movil.js pantalla del móvil (PIN + subida)
    ├── album.html / album.js página que ve el cliente
    └── estilos.css
```

### Decisiones y por qué

- **Sin `npm install`.** Un instalador que falla porque no compila `sharp` es un instalador que no
  se usa. Todo lo que hacía falta (QR, EXIF, miniaturas, hashes) se resuelve con Node a pelo.
  El QR está **verificado módulo a módulo contra la librería `qrcode`** en 400 casos aleatorios;
  la prueba deja una huella fija en el test para detectar regresiones.
- **Miniaturas gratis.** El iPhone y Android ya dejan una miniatura dentro del EXIF: se sirve esa,
  así la galería va instantánea sin redimensionar nada.
- **Subida archivo a archivo, no multipart.** Permite progreso real, reanudación por bytes y
  simplifica el servidor (nada de parsear límites de multipart a mano).
- **Un `PUT` por archivo con `?desde=N`.** El servidor rechaza un desplazamiento que no cuadre
  (409), así dos intentos simultáneos no pueden mezclar bytes y corromper un vídeo.

### Tests

```bash
npm test                       # desde la raíz del repositorio (incluye Fotos Fáciles)
node test/fotos-faciles.test.mjs
```

110 comprobaciones: QR contra referencia, nombres seguros, EXIF, organización por fecha,
duplicados, la regla de no sobrescribir, seguridad, el puente con el escaparate 3D (incluido que el
nombre de archivo coincide con el de `sincronizar.mjs`), el guion de PowerShell del modo MTP
(con su prueba de inyección), los recursos incrustados, y el servidor completo levantado de verdad
(subida cortada y reanudada, rangos, permisos de ruta y enlaces compartidos).

### Qué falta por hacer

1. **Probar el modo MTP sobre un iPhone real** y ajustar los nombres de carpeta que use cada versión
   de iOS/Android.
2. **Ventana nativa con Tauri** alrededor del ejecutable, si molesta que se abra una pestaña del
   navegador (no ahorra tamaño, ver arriba).
3. **Compresión opcional** de vídeos largos antes de importar (ffmpeg como binario externo).
4. **Copia de seguridad automática** a una segunda carpeta o disco.
