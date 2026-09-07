# 🟢 Empezar aquí — Fotos Fáciles en 10 minutos

Guía para ponerlo en marcha la primera vez en un PC con Windows.
Si algo no encaja, salta al final: **«Cuando algo no va»**.

---

## Paso 1 · Instala Node.js (una sola vez, 3 minutos)

1. Entra en **[nodejs.org](https://nodejs.org)**.
2. Descarga el botón grande que pone **LTS**.
3. Ábrelo y dale a Siguiente hasta el final. No hay que configurar nada.

> ¿Ya lo tienes? Para comprobarlo: pulsa la tecla **Windows**, escribe `cmd`, Intro,
> y escribe `node -v`. Si sale algo tipo `v22.x.x`, ya está instalado.

---

## Paso 2 · Trae la carpeta a tu ordenador

### Opción A — La automática (una sola línea, lo hace todo)

1. Pulsa la tecla **Windows**, escribe `powershell` y pulsa Intro.
2. Pega **esta línea** y dale a Intro:

```powershell
irm https://raw.githubusercontent.com/jpau2569/jpmr-negocios-/claude/fotos-faciles-transferencia-a7urec/fotos-faciles/instalar-windows.ps1 | iex
```

Descarga el programa, lo deja en `Documentos\..\FotosFaciles`, te crea el acceso directo
**«Fotos Faciles»** en el Escritorio y lo abre. A partir de ahí, doble clic en ese icono y ya está.

Volver a pegar la misma línea **actualiza** el programa. Tus fotos y tus ajustes no se tocan:
viven fuera de esa carpeta.

### Opción B — A mano (sin saber nada de Git)

1. Abre esta dirección:
   `https://github.com/jpau2569/jpmr-negocios-/tree/claude/fotos-faciles-transferencia-a7urec`
2. Botón verde **Code** → **Download ZIP**.
3. Descomprime el ZIP donde quieras, por ejemplo en `C:\JPMR`.

Con esto ya puedes usarlo. Lo único: para recibir mejoras habrá que volver a bajar el ZIP.

### Opción C — Con Git (si ya tienes el proyecto clonado)

Abre el terminal **dentro de la carpeta del proyecto** y ejecuta, en este orden:

```bash
git fetch origin
git checkout claude/fotos-faciles-transferencia-a7urec
git pull
```

⚠️ **Ojo con esto:** `git pull` a secas *no* trae Fotos Fáciles, porque vive en esa rama
y no en `main`. Hay que hacer el `checkout` primero. Cuando la rama se fusione a `main`,
bastará con `git checkout main && git pull`.

Atajo: doble clic en **`ActualizarYAbrir.bat`**, que hace todo eso y arranca el programa.

---

## Paso 3 · Arranca el programa

Entra en la carpeta `fotos-faciles` y **haz doble clic en `FotosFaciles.bat`**.

Pasan dos cosas:

1. Se abre una **ventana negra** con un código QR, tu dirección y un **PIN de 4 cifras**.
   Esa ventana es el programa: **si la cierras, se apaga**. Déjala minimizada.
2. Se abre el **navegador** con la pantalla del programa.

### ⚠️ El aviso del cortafuegos (esto es lo que más falla)

La primera vez, Windows preguntará algo como *«¿Permitir que Node.js se comunique en estas redes?»*.

👉 **Marca la casilla de «Redes privadas» y pulsa «Permitir acceso».**

Si le das a Cancelar, el móvil no podrá conectarse y parecerá que el QR no funciona.
Se arregla desde *Panel de control → Sistema y seguridad → Firewall de Windows Defender →
Permitir una aplicación*, buscando **Node.js** y marcando **Privada**.

---

## Paso 4 · Manda las primeras fotos desde el móvil

1. Comprueba que el **móvil y el PC están en la misma WiFi**
   (ojo: no vale que el PC esté por cable en una red y el móvil en la WiFi de invitados).
2. Abre la **cámara** del iPhone o del Android y apunta al QR de la pantalla del PC.
3. Toca el aviso que sale arriba: se abre el navegador del móvil.
4. Elige arriba **dónde quieres que se guarden**:
   - **Por día** → `Fotos Faciles / 2026-09-07`
   - **En un inmueble** → sale tu cartera; elige el piso.
   - **En una carpeta del PC** → navegas por tus carpetas *desde el móvil*, puedes crear
     una nueva («➕ Nueva») y pulsas **«Guardar aquí»**.
5. Pulsa **«Elegir fotos y vídeos»**, selecciona 10 fotos y espera a que ponga **¡Listo! ✅**.

Las verás aparecer solas en la pantalla del ordenador.

---

## Paso 5 · Publicarlas en el escaparate 3D

Al terminar de enviar, en el móvil aparece **«¿Las pongo en el escaparate 3D?»**.
Eliges el inmueble y pulsas el botón. Las fotos se reducen solas al tamaño correcto y
se ponen **de portada** del inmueble.

### Si el desplegable de inmuebles sale vacío

Es que tu cartera aún no está descargada. Una sola vez, en el terminal y **desde la carpeta
raíz del proyecto** (la que tiene dentro `escaparate3d`, no dentro de `fotos-faciles`):

```bash
node escaparate3d/herramientas/sincronizar.mjs
```

Tarda un poco (lee la web oficial y baja las fotos). Cuando acabe, cierra y vuelve a abrir
Fotos Fáciles y ya te saldrá toda tu cartera en el desplegable.

Mientras tanto **no estás bloqueado**: escribe la referencia a mano (`PIS0190`) y funciona igual.

---

## Cuando algo no va

| Lo que ves | Qué pasa y cómo se arregla |
|---|---|
| El móvil no abre la página al escanear | El PC y el móvil están en redes distintas, o dijiste «Cancelar» al cortafuegos. Mira el aviso del Paso 3. |
| «No se puede conectar» en el navegador del PC | La ventana negra se ha cerrado. Vuelve a hacer doble clic en `FotosFaciles.bat`. |
| El QR va, pero pide un PIN | Normal si escribiste la dirección a mano. El PIN está en la pantalla del ordenador, y **cambia cada vez que arrancas**. |
| «No se ha encontrado Node.js» | Falta el Paso 1, o hay que reiniciar el ordenador después de instalarlo. |
| El desplegable de inmuebles vacío | Falta sincronizar la cartera (Paso 5). |
| Fotos HEIC que no se publican | El iPhone las manda en HEIC y el navegador no las sabe pintar. Arréglalo de raíz: *Ajustes → Cámara → Formatos → **Más compatible***. |
| El puerto 4321 está ocupado | Arranca con otro: `node fotos-faciles/iniciar.mjs --puerto 5000`. |

---

## Lo que conviene tener claro

- **Nada sale a internet.** Las fotos van del móvil a tu PC por la WiFi de casa o de la oficina.
- **La ventana negra es el programa.** Mientras esté abierta, funciona; al cerrarla, se apaga
  (y los enlaces que hayas compartido dejan de abrirse).
- **Nunca se sobrescribe nada.** Si mandas dos veces la misma foto, se ignora; si hay dos
  distintas con el mismo nombre, la segunda se guarda como `IMG_001 (2).jpg`.
- **El PIN cambia en cada arranque.** Es a propósito.

Detalle completo de todo en [`README.md`](README.md).
