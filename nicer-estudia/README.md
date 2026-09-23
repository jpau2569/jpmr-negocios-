# Nicer Estudia

App de estudio para el curso 26/27: agenda de deberes y exámenes (con avisos
en el calendario del móvil), repaso espaciado con tarjetas que se pueden
escuchar, tests de autoevaluación, esquemas visuales, apuntes, modo
concentración con sonido de fondo y **Clara**, la profesora de IA: explica
dudas escritas, habladas o con una foto, busca información para los trabajos
citando la fuente, lee el horario de una foto y prepara el material.

Pensada para un alumno de 2º de ESO (curso por defecto; se cambia en Ajustes) que usa el móvil y el PC de casa.
**Todos los datos viven en el dispositivo** (`localStorage`): no hay cuenta,
no hay servidor de datos y no sale nada del móvil. Lo único que sale a
internet es lo que se le manda a Clara: la pregunta y, si él quiere, una foto
reducida en el propio móvil que la app no guarda.

## Por qué está hecha así

Tres cosas con evidencia detrás, traducidas a pantallas:

| Idea | Dónde está en la app |
|---|---|
| **Recuerdo activo** — preguntarte a ti mismo funciona mucho mejor que releer | Tarjetas: primero la pregunta, la respuesta tapada |
| **Repaso espaciado** — repasar justo antes de olvidar fija lo aprendido | Cajas de Leitner: 0, 1, 2, 4, 8, 16 y 32 días |
| **Práctica repartida** — cuatro ratos en cuatro días rinden más que una noche | Plan de examen automático en D-7, D-5, D-3, D-1 y el día |

Y una cuarta que no es pedagogía sino honestidad: **un test pone nota**.
Releer engaña, elegir entre cuatro opciones no. Lo que se falla vuelve solo
al repaso.

Y dos cosas de producto:

- **La lista de hoy nunca pasa de cinco cosas.** Una lista larga no se empieza.
- **El repaso diario tiene tope** (20 tarjetas por defecto). Una cola infinita
  es la forma más rápida de que un chaval cierre la app y no vuelva.

## De dónde salen las ideas

La versión 2.0 recoge lo que funciona de siete apps conocidas, pero dentro de
una sola, sin siete cuentas ni siete suscripciones, y sin que los datos de un
menor acaben en siete servidores:

| Idea de… | Cómo está aquí |
|---|---|
| **LifeAt** (espacio de trabajo con Pomodoro) | Modo concentración a pantalla completa con temporizador, planta que crece y sonido de fondo |
| **I Miss My Cafe** (sonido ambiente) | Lluvia, cafetería, biblioteca y mar **generados en el móvil** con la Web Audio API: cero archivos, cero red |
| **Cuestia** (cuestionarios con IA) | Tests de opción múltiple: del Profe, o generados sin conexión a partir de sus propias tarjetas |
| **Visme** (material visual) | Esquemas: el Profe convierte un tema en ramas y la app lo dibuja como mapa, descargable en PNG |
| **Focus Friend** (compañero y recompensas) | La planta de la racha (semilla → brote → planta → en flor → árbol) y el contador de salidas de la app |
| **Notion** (organización central) | Apuntes por asignatura, que con un botón se convierten en tarjetas |
| **Todoist** (tareas) | Prioridad alta y tareas que se repiten cada día o cada semana |

Lo que **no** se ha copiado, a propósito: cuentas de usuario, sincronización
en la nube y bloqueo de otras apps (una web no puede bloquear el móvil; en su
lugar se cuenta cuántas veces se sale, que es honesto y funciona parecido).

## Lecciones, libros y examen de prueba (versión 4.0)

La pestaña **Estudiar → Lecciones** es el cuaderno de todas sus materias:

1. **Mis libros**: añade a mano sus libros de texto por asignatura (y en Yo →
   Asignaturas, las asignaturas que falten).
2. **Meter la lección que estoy estudiando**: título, asignatura, libro y el
   contenido — escrito, pegado o con **hasta 6 fotos de las páginas** (se
   reducen en el móvil a 1400 px JPEG 72 % para que quepan juntas en una
   petición; no se guardan).
3. Al guardarla, **Clara la resume sola**: resumen, apuntes por apartados y
   conceptos clave (modo `leccion` de `/api/profe`, bloque `[[LECCION]]`).
4. Desde la lección, **sin gastar internet**: los conceptos se convierten en
   tarjetas de repaso (sin duplicarse) y los apuntes en esquema
   (`lecciones.js`).
5. **Examen de prueba** de una lección, o de un examen de la Agenda con las
   lecciones que se marcaron al apuntarlo (si no se marcó ninguna, se usan las
   resumidas de esa asignatura). Como uno de verdad de 2º de ESO: parte tipo
   test (se corrige sola) y 2-3 preguntas de desarrollo que **corrige Clara**
   con criterios, nota por pregunta, qué está bien, qué falta y la respuesta
   de 10. La nota final pesa el desarrollo como en un examen real (cada
   pregunta de desarrollo vale sus puntos; cada una de test, 1).
6. Lo fallado vuelve al repaso: las preguntas de test falladas y las de
   desarrollo por debajo de 5 (con la respuesta de 10 como respuesta de la
   tarjeta).

Sin conexión, el examen de prueba cae a un test con sus tarjetas de esa
asignatura; si Clara no puede corregir el desarrollo, la nota es solo la del
test y se enseña qué debía incluir cada respuesta.

## Clara, la profe (versión 3.0)

La pestaña de dudas es **Clara**, la misma asistente de Pau con un solo
sombrero: el de profesora de un alumno de ESO de un colegio bilingüe.

| Qué hace | Cómo |
|---|---|
| Explica dudas sin dar los deberes hechos | Prompt de `api/_profe.js` (regla de oro) |
| **Foto** de un ejercicio, del libro o de los apuntes | `foto.js` la reduce a 1600 px JPEG en el móvil; va delante del texto en el último mensaje |
| **Horario desde una foto** | Clara devuelve `[[HORARIO]]`; la app lo enseña, y al confirmar `aplicaHorario()` lo pone y crea las asignaturas que falten |
| **Busca información** para trabajos, citando la fuente | Herramienta `buscar_web` con `buscarConGemini` (el mismo buscador de la Clara de Pau). Solo si hay `GEMINI_API_KEY` |
| **Hablar** en vez de escribir y **escuchar** sus respuestas | `voz.js` (Web Speech API del navegador); detecta si la respuesta está en inglés para leerla con acento inglés |
| La charla **no se pierde** al cerrar la app | `cargarChat` / `guardarChat` (sin fotos, solo la marca de que la hubo) |

Lo que la Clara de Nicer **no** tiene, a propósito: la memoria de Pau, su
cartera de pisos y el modo psicóloga. Ante algo serio manda a un adulto y
recuerda el 024 y el 116 111.

## Exámenes al calendario del móvil

Una web no puede mandar avisos con la app cerrada sin un servidor de
notificaciones; el calendario del teléfono sí. El botón **📅 Avisos en el
móvil** de cada examen genera un `.ics` (`calendario.js`) con el examen (aviso
la tarde anterior) y cada paso del plan de estudio (aviso a las 17:00 de su
día). En iPhone se abre directo en Calendario; en Android se abre con el
calendario del móvil o se comparte si el navegador lo permite.

## Cómo se abre

Necesita servirse por HTTP (usa módulos ES y service worker); con `file://`
no arranca.

```bash
cd nicer-estudia
python3 -m http.server 8000
# y abrir http://localhost:8000/app.html
```

En producción va dentro del monorepo desplegado en Vercel:
`https://<dominio>/nicer-estudia/app.html`.

## Archivos

Cada capa solo conoce a la de debajo:

- `app.html` — estructura
- `styles.css` — diseño, tema claro y oscuro
- `utiles.js` — fechas ISO locales, textos, formatos (sin estado)
- `datos.js` — estado, validación, `localStorage`, copias y consultas derivadas
- `repaso.js` — motor: Leitner, plan de examen, racha, puntos, plan del día
- `cuestionario.js` — tests: generación desde tarjetas, corrección y nota
- `esquema.js` — el mapa del tema dibujado como SVG
- `ambiente.js` — sonido de fondo generado (ruido filtrado), sin archivos
- `voz.js` — dictado y lectura en voz alta (español e inglés)
- `foto.js` — reduce la foto en el móvil antes de mandársela a Clara
- `calendario.js` — el examen y su plan como archivo `.ics` con avisos
- `lecciones.js` — validar lo que devuelve Clara, lección → tarjetas y
  esquema, contenido para el examen, examen de prueba y nota final (puro)
- `clara.jpg` — la cara de Clara (192 px, recortada de `../clara-rostro.jpg`)
- `interfaz.js` — render puro: recibe estado, devuelve HTML
- `app.js` — estado, eventos, temporizador, Profe y PWA
- `manifest.json` + `service-worker.js` — instalable y sin conexión
- `herramientas/generar-iconos.mjs` — regenera los PNG de los iconos
- `../api/_profe.js` — backend de Clara (Claude), servido en `/api/profe` por el
  enrutador único `api/[ruta].js` (el plan Hobby de Vercel admite 12 funciones);
  la clave nunca toca el navegador

## El backend de Clara

`POST /api/profe` con `{ mensajes, curso, nombre, asignaturas, imagen? }`
devuelve `{ reply, tarjetas, test, esquema, horario, busquedas }`. Con
`modo: "leccion" | "examen" | "corregir"` hace el trabajo de ese modo (cada uno
con sus instrucciones en un bloque de sistema aparte, para que el prompt de
Clara siga en caché) y devuelve `leccion`, `examen` o `correccion`. Necesita
`ANTHROPIC_API_KEY` en Vercel; `GEMINI_API_KEY` es opcional (sin ella, Clara
no busca en Internet). Tope de 8000 tokens por respuesta: con los 1200 de la
primera versión, un test de diez preguntas podía cortarse a medias y perderse.

Dos reglas del prompt que no se tocan, porque al otro lado hay un menor:

1. **No resuelve los deberes.** Explica el método, pide que lo intente y
   corrige el intento.
2. **No hace de psicólogo.** Ante acoso, ánimo bajo o algo serio en casa,
   manda a hablar con su padre, su madre o su tutor, y recuerda el 024 y el
   116 111. Nada más.

Cuando el alumno pide material, el modelo añade un bloque con JSON que el
backend extrae y devuelve aparte; el alumno nunca ve el bloque:

| Bloque | Se convierte en |
|---|---|
| `[[TARJETAS]]` | Tarjetas de repaso espaciado |
| `[[TEST]]` | Un test de opción múltiple, con lo fallado volviendo al repaso |
| `[[ESQUEMA]]` | Un mapa del tema, dibujado por `esquema.js` |
| `[[HORARIO]]` | El horario semanal leído de una foto, para confirmar y poner |
| `[[LECCION]]` | Resumen, apuntes y conceptos de una lección (modo `leccion`) |
| `[[EXAMEN]]` | Examen de prueba: parte tipo test + desarrollo con criterios (modo `examen`) |
| `[[CORRECCION]]` | Nota, lo bueno, lo que falta y la respuesta de 10 por pregunta (modo `corregir`) |

Si el JSON viene roto o una pregunta no cuadra (opciones vacías, índice de
respuesta fuera de rango), esa pieza se descarta y el resto sigue: nunca se
guarda material inválido.

## Copias de seguridad

Los datos están solo en el navegador de ese dispositivo: si se borra el
navegador o se cambia de móvil, se pierden. En **Yo → Copia de seguridad**
se descarga un JSON y se restaura pegándolo. Conviene hacerlo una vez al
trimestre.

## Pruebas

```bash
node test/nicer-estudia.test.mjs      # motor, datos y API (rápido, sin red)
node test/nicer-estudia.ui.test.mjs   # recorrido completo en Chromium real
```

El segundo levanta un servidor estático, intercepta `/api/profe` y hace el
camino entero: apuntar deberes con prioridad y repetición, marcarlos (y
comprobar que la tarea diaria genera la de mañana), crear y repasar una
tarjeta, hacer un test del Profe y otro sin conexión, guardar un esquema y un
apunte, el modo concentración con sus ambientes, recargar y comprobar que a
360 px no hay desborde horizontal ni botones impulsables.
