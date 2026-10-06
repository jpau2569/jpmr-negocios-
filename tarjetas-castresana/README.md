# Tarjetas digitales de Asesoría Castresana

Las tarjetas digitales (la de la agencia y una por persona: Pau, Javier, Jorge,
Carolina y Alejandro) **no se publican desde este repositorio**: viven en su propio
proyecto de Vercel, **`asesoria-castresana-links`**
(`https://asesoria-castresana-links.vercel.app/pau`, `/javier`, `/jorge`, `/carolina`,
`/alejandro`), y hasta ahora solo existían publicadas, sin copia en GitHub.

Esta carpeta es la copia versionada de lo que se va tocando. **Equivale a la carpeta
`src/` publicada** (`pau/index.html` aquí = `src/pau/index.html` allí).
`.vercelignore` la deja fuera del despliegue del monorepo.

## Qué hay aquí

| Archivo | Para qué sirve |
|---|---|
| `pau/index.html` | La tarjeta de Pau. Idéntica a la publicada, más el bloque «Nuestros pisos». |
| `pau/enviar.html` | Página interna para mandar la tarjeta (asunto, texto, WhatsApp/correo). Idéntica a la publicada, más la casilla del escaparate. |
| `pisos3d.js` | El bloque «Nuestros pisos». **Un solo archivo para todas las tarjetas.** |
| `vercel.json` | Configuración del proyecto (URLs limpias, cabeceras de los `.vcf`). Sin cambios. |

Las copias de `pau/index.html`, `pau/enviar.html` y `vercel.json` se comprobaron
**byte a byte** contra lo publicado (huella SHA-1 idéntica) antes de modificarlas.
Lo demás (las otras cuatro tarjetas, `.vcf`, la portada…) sigue solo en Vercel y se
trae aquí cuando se toque cada una.

## Pisos en 3D dentro de la tarjeta

La tarjeta enseña 4 pisos reales (foto, precio, zona) y un botón que abre el
**escaparate 3D** (`/escaparate3d/`). Qué pasa por dentro:

1. `pisos3d.js` lee la cartera en vivo de `https://jpmr-negocios.vercel.app/api/escaparate`
   (la misma que alimenta el escaparate) y reparte la muestra por toda la lista,
   solo ventas, solo pisos con foto.
2. Los enlaces llevan `?ag=pau`. El escaparate (`escaparate3d/index.html`) solo
   admite claves de su lista cerrada `CONFIG.equipo`: manda las **visitas al WhatsApp
   de esa persona** y apunta al cliente como origen `escaparate3d-tarjeta-pau`
   (se ve en el panel de leads), así se sabe qué tarjeta trae clientes.
3. **Si algo falla** (sin red, cartera vacía, sin fotos) el bloque no se muestra y la
   tarjeta queda exactamente como antes.
4. En `enviar.html`, la casilla **«Incluir enlace a nuestros pisos»** añade al
   mensaje el enlace al escaparate. Viene marcada, salvo en los motivos «Fiscal,
   laboral y contable» y «Consulta jurídica», donde un enlace a pisos sobra.

**Límite que conviene saber:** el escaparate enseña el carrusel 3D en pantallas de
más de 860 px (ordenador, tablet). En el móvil enseña la **lista** con las mismas
acciones (marcar, comparar, pedir visita). Por eso el botón de la tarjeta solo dice
«en 3D» en pantalla ancha: en el móvil no promete lo que el cliente no va a ver.

### Poner el bloque en otra tarjeta (Javier, Jorge, Carolina, Alejandro)

1. En `escaparate3d/index.html`, añadir a `CONFIG.equipo` la clave y el WhatsApp de la
   persona (formato internacional sin `+`, p. ej. `javier: { nombre: "Javier", whatsapp: "34…" }`).
   Es lista cerrada a propósito: ver el comentario del código.
2. En su `index.html`, tras el botón «Guardar en mis contactos»:
   `<section id="pisos3d" data-agente="javier" aria-label="Nuestros pisos" hidden></section>`
   y antes de `</body>`: `<script src="/pisos3d.js" defer></script>`.
3. En su `enviar.html`, cambiar `?ag=pau` por la clave de esa persona (y añadir la casilla
   igual que en la de Pau).
4. Publicar `pisos3d.js` junto a las tarjetas (va en la raíz del proyecto).

## Cómo se publica

Las tarjetas se publican en el proyecto de Vercel `asesoria-castresana-links`.
Como no hay Git conectado, se redespliega **subiendo solo los archivos cambiados y
reutilizando los demás por su huella** (así no hace falta tener las otras tarjetas en
local). Los enlaces y QR ya enviados no cambian porque el proyecto y su dominio son
los mismos.

Orden recomendado: primero el escaparate (cambio en `main` + despliegue del
monorepo) y después las tarjetas. Si la tarjeta sale antes, funciona igual: el
escaparate ignora un `?ag=` que todavía no conoce y manda las visitas al WhatsApp de
siempre (que hoy es el de Pau).

## Pruebas

```
node test/tarjetas-pisos3d.test.mjs     # Chromium real, sin salir a Internet (47 comprobaciones)
```

Cubre el bloque (móvil y ancho), los fallos de la cartera, texto malicioso en los
datos, la casilla de `enviar` por motivo y la lista cerrada de `?ag=` del escaparate.
