# Escaparate 3D Pro — producto white-label

> **¿Retomando el trabajo?** El estado de la última sesión y lo que queda
> pendiente están en [`ESTADO.md`](ESTADO.md).

Un mismo código, un negocio distinto por despliegue. El cliente (restaurante o
inmobiliaria) solo toca `config/negocio.json` y tiene su propio escaparate 3D
con **pedidos, reservas, QR de mesas y solicitudes de visita funcionando de
verdad** — no un maquetado.

Es el producto vendible. La carpeta hermana `escaparate3d/` es el escaparate
concreto de Asesoría Castresana, hecho a medida y anterior a esto.

## Probarlo en 30 segundos

Hay que servirlo por HTTP (usa módulos ES; con `file://` el navegador los bloquea):

```bash
python3 -m http.server 8080      # desde la raíz del repositorio
```

| Dirección | Qué enseña |
|---|---|
| `/escaparate3d-pro/demos.html` | El hub comercial con las dos demos |
| `/escaparate3d-pro/index.html?negocio=la-vina` | Demo de restaurante (La Viña, Cenera) |
| `/escaparate3d-pro/index.html?negocio=castresana` | Demo de inmobiliaria (cartera real) |
| `…?negocio=la-vina&mesa=7#pedido` | Lo que ve un cliente al escanear el QR de la mesa 7 |
| `…?auto=1` | Modo escaparate: gira solo, para la tele del local |
| `/escaparate3d-pro/admin/` | Panel del dueño del negocio |
| `/escaparate3d-pro/admin/construir-total.html` | Construir Total: de la demo a la app real |

## Estructura

```
escaparate3d-pro/
  index.html            escena 3D + overlay (no se toca para adaptar clientes)
  demos.html            hub comercial con las dos demos
  config/
    negocio.json        LA configuración de este despliegue
    ejemplos/           castresana, la-vina y dos ficticias
  css/base.css          hoja única; ni un color escrito a mano
  js/
    config.js           carga y normaliza la configuración (fetchConfig)
    tema.js             colores del JSON → CSS custom properties y materiales 3D
    escena.js           carrusel 3D genérico (Three.js por CDN)
    ui.js               overlay: botones, modal, formularios, enlaces
    datos.js            saveOrder / saveBooking / saveLead: local | api | firebase
    carrito.js          carrito compartido carta ↔ pedidos
    qr.js               generador de QR propio (copia de fotos-faciles/nucleo/qr.mjs)
    zip.js              ZIP sin librerías, para el paquete del cliente
    produccion.js       requisitos de "esto ya no es una demo"
    app.js              orquestador: carga solo los módulos contratados
  modules/
    carta.js            catálogo del restaurante (siempre, en ese sector)
    pedidos.js          pedidos a domicilio / recogida / en mesa
    reservas.js         reservas con turnos, aforo y días de cierre
    qr.js               QR imprimible por mesa
    inmuebles.js        cartera en cascada, filtros, favoritos y visita
    valoracion.js       valoración gratis para propietarios
    demo.js             apartado "quiero esto para mi negocio"
  admin/
    index.html          panel del dueño (colores, contacto, redes, carta)
    construir-total.html  panel de quien vende: demo → aplicación real
  api/ + lib/           el backend que se lleva cada cliente (ver api/LEEME.md):
                        cartera, proxy de fotos y alta de leads. Son copia
                        exacta del monorepo y un test lo vigila.
```

## Las reglas que no se rompen

1. **Cero datos de negocio fuera de `negocio.json`.** Ningún nombre, teléfono,
   color ni enlace vive en el HTML, el CSS o el JS.
2. **Los colores mandan en todo.** `js/tema.js` los vuelca como custom
   properties y también tiñe el borde de las tarjetas 3D, la luz de acento y el
   halo del suelo. El color de texto sobre el acento se elige por contraste
   WCAG, no a ojo.
3. **Las redes son botones HTML de verdad**, en la cabecera y en el pie, nunca
   solo dentro del canvas. El enlace que el cliente no rellena no se pinta.
4. **Funciona sin backend** (modo `local`) y escala a Firebase o a los endpoints
   del despliegue sin tocar los módulos: solo cambia `datos.modo`.
5. **Nunca una pantalla en blanco.** Sin WebGL, sin red o sin CDN, la lista 2D
   enseña lo mismo. La cartera va en cascada y acaba en el respaldo del JSON.
6. **Lo que no está confirmado, se dice.** `demo.activa` y
   `verificacion.pendiente` se pintan en la propia página.

## Los módulos, uno a uno

Cada interruptor de `modulos` enciende un archivo de `modules/`. Un módulo de
otro sector no se enciende aunque venga a `true` en el JSON.

| Interruptor | Sector | Qué hace |
|---|---|---|
| `pedidosDomicilio` | restaurante | Carrito, zona de reparto con coste y mínimo, recogida, pedido en mesa, pago y confirmación con referencia |
| `reservas` | restaurante | Día, turno y comensales, respetando días de cierre y antelación máxima |
| `qrMesas` | restaurante | Un QR por mesa, imprimible, generado en local (sin servicios externos) |
| `catalogoInmuebles` | inmobiliaria | Cartera en cascada, filtros, favoritos y solicitud de visita **solo con los marcados** |
| `valoracionGratis` | inmobiliaria | Captación de propietarios; solo da horquilla de precio si la agencia ha cargado sus € /m² |
| `pedirDemo` | los dos | "Quiero esto para mi negocio" → va al contacto **comercial**, no al del negocio de la demo |

## De demo a aplicación real: Construir Total

`admin/construir-total.html` es la pantalla de quien vende. Rellena el cliente
real, enciende lo contratado, decide dónde caen los pedidos y descarga el
paquete completo (`.zip` con el producto + su `negocio.json` + el README de
despliegue).

Arriba a la derecha hay un semáforo con 9 requisitos (`js/produccion.js`).
Mientras quede uno sin marcar, eso sigue siendo una demo: datos sin confirmar,
contacto incompleto, catálogo de muestra o pedidos que no salen del navegador.

## Dónde caen los datos

`datos.modo` en `negocio.json`:

- `local` — navegador del visitante. Para enseñar. Nada se pierde, pero nada sale.
- `api` — POST a los endpoints del despliegue (`/api/lead` del monorepo ya vale).
- `firebase` — Firestore por REST, sin SDK ni empaquetador. Con `datos.firebase.projectId`
  puesto, la configuración también se lee del documento remoto: el dueño edita en
  `/admin/`, pulsa «Publicar» y cambia la web sin volver a desplegar.

Pase lo que pase, siempre queda copia local del pedido, la reserva o el lead, y
la pantalla ofrece mandarlo por WhatsApp o llamar.

## Las dos demos

- **Asesoría Castresana** (`castresana`): datos de contacto y cartera reales.
  Los inmuebles vienen en cascada `/escaparate3d/pisos.json` → `/api/escaparate`
  (que lee la web oficial) → respaldo del JSON. Las fotos pasan por
  `/api/foto?u=` porque WebGL no puede pintar imágenes de otro dominio.
- **Restaurante La Viña, Cenera (Mieres)** (`la-vina`): dirección, teléfono,
  Facebook y las especialidades salen de sus fichas públicas. La carta completa,
  los precios, el horario, las zonas de reparto y los turnos son **de muestra**;
  están marcados como pendientes en el JSON y se ven marcados en la propia web.
  Antes de enseñarla como algo cerrado, hay que confirmarlos con el restaurante.

## Tests

```bash
npm test                       # incluye test/escaparate3d-pro.test.mjs
node test/escaparate3d-pro.test.mjs
```

113 comprobaciones: lógica pura en Node (configuración, tema, contraste, QR,
ZIP, requisitos de producción) y las dos demos abiertas en un Chromium real,
haciendo un pedido, una reserva, una visita y descargando el paquete. La escena
3D se comprueba de verdad sirviendo Three.js desde `node_modules`, y también se
comprueba que **sin** Three.js la web sigue entera con la lista 2D.
