# Nicer Estudia

App de estudio para el curso 26/27: agenda de deberes y exámenes, repaso
espaciado con tarjetas, tests de autoevaluación, esquemas visuales, apuntes,
modo concentración con sonido de fondo y un profesor de IA que explica dudas
y prepara el material.

Pensada para un alumno de 1º-2º de ESO que usa el móvil y el PC de casa.
**Todos los datos viven en el dispositivo** (`localStorage`): no hay cuenta,
no hay servidor de datos y no sale nada del móvil. Lo único que sale a
internet es la pregunta que se le escribe al Profe.

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
- `interfaz.js` — render puro: recibe estado, devuelve HTML
- `app.js` — estado, eventos, temporizador, Profe y PWA
- `manifest.json` + `service-worker.js` — instalable y sin conexión
- `herramientas/generar-iconos.mjs` — regenera los PNG de los iconos
- `../api/profe.js` — backend del Profe (Claude); la clave nunca toca el navegador

## El Profe

`POST /api/profe` con `{ mensajes, curso, nombre, asignaturas }` devuelve
`{ reply, tarjetas, test, esquema }`. Necesita `ANTHROPIC_API_KEY` en Vercel.

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
