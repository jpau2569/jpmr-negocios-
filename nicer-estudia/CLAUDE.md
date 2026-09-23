# CLAUDE.md — Nicer Estudia

Instrucciones para trabajar dentro de `nicer-estudia/`.
Las reglas generales del repositorio están en el `CLAUDE.md` de la raíz.

## Para quién es

Nicer, hijo de Pau, alumno de ESO en el Colegio Lastra (Mieres, Asturias).
No es una app de productividad para adultos. Todo se juzga con una pregunta:
**¿esto hace que un chaval de 12-14 años la abra mañana otra vez?**

Los cuatro problemas que existe para resolver, en este orden:

1. Se le olvidan los deberes → agenda, prioridad, tareas que se repiten y mochila de mañana
2. Le cuesta arrancar y se distrae → concentración, sonido de fondo, planta, racha, "solo 5 minutos"
3. Estudia y se le olvida → tarjetas con repaso espaciado, tests y esquemas
4. Hay cosas que no entiende → Clara (escrita, hablada o con una foto)

Si una idea nueva no ataca uno de esos cuatro, probablemente sobra.

## Stack

HTML, CSS y JavaScript puro (módulos ES nativos, sin empaquetador ni build).
PWA con `manifest.json` y `service-worker.js`. No meter frameworks.

Se sirve por HTTP, no con `file://`.

## Reglas que no se rompen

- **Los datos son de un menor y no salen del dispositivo.** Nada de cuentas,
  analítica, cookies ni sincronización en la nube. Lo único que viaja es lo
  que él decide mandarle a Clara: la pregunta y, si quiere, una foto (que se
  reduce antes en el móvil y la app no guarda).
- **La clave de la API nunca en el navegador.** El Profe va por
  `../api/_profe.js` (URL `/api/profe`, a través del enrutador `api/[ruta].js`)
  con `ANTHROPIC_API_KEY` en el servidor. No lo conviertas en una función
  suelta: el plan Hobby de Vercel solo admite 12.
- **Clara es la de Pau, pero con un solo sombrero: el de profesora.** Se queda
  con su voz, su calidez y el buscador (`buscarConGemini`, importado de
  `api/_clara.js`); **no** se lleva la memoria de Pau, su cartera ni el modo
  psicóloga. No conectes la pestaña de Nicer con `clara.html`.
- **Clara no da los deberes hechos** (ni escribe los trabajos) y **no hace de
  psicóloga**: ante algo serio, manda a un adulto y recuerda el 024 y el
  116 111. Está en el prompt de `api/_profe.js`; no lo suavices.
- **Lo que busca en Internet lo cita**, y la app lo marca con «Ha buscado en
  internet». Sin `GEMINI_API_KEY` no se le ofrece el buscador (para que no
  prometa lo que no puede hacer).
- **El horario leído de una foto se enseña antes de ponerlo** y solo cambia
  los días que salen en la foto.
- **Todo lo que escribe el alumno pasa por `escapa()`** antes de ir al HTML.
- **La lista de "qué toca ahora" no pasa de 5** y el repaso diario tiene tope.
- **El sonido de fondo se genera en el móvil** (`ambiente.js`), no se descarga:
  así funciona sin conexión y no depende de nadie. No metas archivos de audio.
- **Lo que se falla en un test vuelve al repaso.** Un test que solo pone nota
  y no cambia nada no sirve para estudiar.
- Nada de bloquear otras apps: una web no puede, y prometerlo sería mentir.
  Lo que sí se hace es contar las salidas de la app durante una sesión.
- Fechas siempre con `aISO()`/`deISO()`, nunca `toISOString()` a pelo: a las
  22:00 en España eso devuelve el día siguiente.
- Al tocar cualquier `.js`, añadirlo a `RECURSOS` del service worker y subir
  `VERSION`, o el móvil seguirá con la versión vieja.

## Separación por capas

`utiles.js` → `datos.js` / `repaso.js` / `cuestionario.js` / `esquema.js` /
`ambiente.js` / `calendario.js` → `interfaz.js` → `app.js`

`voz.js` (dictado y lectura en voz alta) y `foto.js` (reducir la foto en el
móvil) tocan el navegador, pero su lógica pura (`idiomaDe`, `limpiaParaLeer`,
`medidas`) se prueba en Node.

Los módulos del medio son **funciones puras** (el azar y la fecha entran
por parámetro): por eso se pueden probar en Node sin navegador. No metas
`localStorage` ni DOM en ellos.

`interfaz.js` es render puro: recibe `(estado, ctx)` y devuelve HTML. No
importa a `app.js` ni guarda nada. El estado vive solo en `app.js`. No juntar
capas.

## Estilo visual

Móvil primero, excelente a 360 px. Limpio, con buen contraste, sin infantilizar
y sin estética de "app de deberes de los años noventa". Nada de gradientes
chillones ni confeti. La recompensa es la racha y ver el anillo lleno, no un
muñeco animado.

Objetivos táctiles de 44 px como mínimo, contraste de texto por encima de
4.5:1 en los dos temas, y cero desborde horizontal desde 320 px.

## Tono de los textos

Español de España, de tú, corto y directo. Como un hermano mayor que ya pasó
por eso: "Cinco minutos y listo", no "¡Optimiza tu productividad!". Nunca
regañar: si algo está atrasado, se dice y se ofrece el siguiente paso.

## Al terminar un cambio

```bash
node test/nicer-estudia.test.mjs      # tiene que quedar en 0 fallidas
node test/nicer-estudia.ui.test.mjs   # navegador real, recorrido completo
```

Si añades una función del motor, añade su prueba. Si tocas una pantalla,
mírala de verdad a 360 px, en claro y en oscuro.

Al añadir un `.js` nuevo: métele su entrada en `RECURSOS` del service worker
y sube `VERSION`.
