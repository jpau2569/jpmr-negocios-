# CLAUDE.md — Sol Niebla y Agua

Instrucciones para trabajar dentro de `sol-niebla-agua/`.
Las reglas generales del repositorio están en el `CLAUDE.md` de la raíz.

## Propósito

Este proyecto es una PWA móvil personal del tiempo para Asturias, centrada en
Oviedo, Mieres y Gijón. No es una app meteorológica genérica.

Su objetivo es ayudar a decidir rápidamente dónde hace mejor tiempo y si
conviene salir, conducir, hacer fotos o realizar visitas inmobiliarias.

La app debe priorizar:
- utilidad diaria real
- lectura instantánea en móvil
- estética premium y sobria
- arquitectura simple y mantenible
- datos reales de AEMET

## Stack

- HTML
- CSS
- JavaScript puro (módulos ES nativos, sin empaquetador ni build)
- PWA con `manifest.json` y `service-worker.js`

No introducir frameworks salvo necesidad muy justificada.
No complicar el proyecto innecesariamente.

**La app se sirve por HTTP**, no con `file://`: usa módulos ES y service
worker. En local, `python3 -m http.server`.

Esta carpeta es autosuficiente: se puede desplegar sola en Vercel poniendo
Root Directory = `sol-niebla-agua`. Por eso la función vive en
`sol-niebla-agua/api/tiempo.js`; en la raíz queda solo un reenvío para que
`/api/tiempo` siga existiendo si algún día se despliega el monorepo entero.

## Archivos principales

El código está separado por capas. Cada una solo conoce a la de debajo:

- `app.html`: estructura de la app
- `styles.css`: diseño visual y responsive
- `utiles.js`: herramientas sin estado (fechas, iconos de cielo, horas solares)
- `datos.js`: de dónde salen los números — proveedores, cascada y caché
- `indice.js`: Índice Sol Niebla y Agua, etiquetas y recomendaciones
- `interfaz.js`: render puro, sin estado global
- `app.js`: punto de entrada — estado, eventos, ajustes y PWA
- `manifest.json`: configuración PWA
- `service-worker.js`: caché y experiencia instalable
- `herramientas/generar-iconos.mjs`: regenera los PNG de los iconos
- `api/tiempo.js`: backend serverless (AEMET + Open-Meteo)
- `vercel.json`: despliegue de esta carpeta como proyecto propio

`interfaz.js` **no importa a `app.js`**: recibe en cada pintada un contexto
con la ciudad enfocada y las llamadas de vuelta. No volver a juntar capas ni
reintroducir ese ciclo.

Al tocar cualquier `.js`, añadirlo a la lista `RECURSOS` del service worker y
subir su `VERSION`, o el móvil seguirá sirviendo la versión vieja.

## Ciudades objetivo

Mantener siempre estas tres como núcleo:
- Oviedo (interior)
- Mieres (valle)
- Gijón (costa)

Añadir una ciudad es añadir una entrada a `CIUDADES` en `datos.js`; el resto
de la app no debería enterarse.

## Filosofía de producto

La app debe interpretar el clima, no solo mostrar cifras.

Debe responder a preguntas como:
- ¿Dónde está mejor ahora?
- ¿Hay niebla problemática?
- ¿Conviene salir o esperar?
- ¿Qué ciudad es mejor para fotos?
- ¿Dónde es mejor hacer visitas inmobiliarias?
- ¿Hay mala visibilidad para carretera?

## Modos obligatorios

Mantener y mejorar estos modos:
- Paseo
- Fotos
- Visitas inmobiliarias
- Carretera

Cada modo debe modificar el scoring y la recomendación textual. Los pesos
viven en `MODOS`, en `indice.js`: es ahí donde se ajusta el criterio.

## Índice principal

Mantener el índice **Índice Sol Niebla y Agua** (0 a 100), calculado con:
- precipitación
- estado del cielo
- visibilidad
- viento
- humedad
- momento del día
- modo de uso

Los factores se combinan de forma **saturante**, no promediando: dos cosas
malas se acumulan y una muy mala no queda diluida por las que van bien. Una
media ponderada le daba "excelente" a un día con 75 % de lluvia. Hay además
topes duros para niebla densa, lluvia fuerte y rachas. No sustituir esto por
un promedio.

Además del número, siempre devolver:
- etiqueta humana
- recomendación breve
- lectura útil y accionable

Escala: 85-100 Excelente · 70-84 Muy aprovechable · 50-69 Aceptable ·
30-49 Día cerrado · 0-29 Muy mala ventana.

## Estilo visual

El diseño debe ser mobile first real, excelente a 375 px, premium, limpio,
legible, compacto, serio, no genérico y sin aire de "demo de IA".

Evitar:
- gradientes chillones
- adornos innecesarios
- exceso de color
- secciones que parezcan plantilla
- estética de dashboard genérico

Buscar:
- aire suizo/minimalista
- tarjetas elegantes
- jerarquía visual muy clara
- buena densidad útil
- sensación de app nativa

Reglas ya verificadas que no hay que romper: sin desborde horizontal desde
320 px, ningún objetivo táctil por debajo de 44 px, y **todos los textos por
encima de 4.5:1 de contraste** en los dos temas.

Para lo último existen los tokens `--sol-txt`, `--niebla-txt`, `--agua-txt`:
el ámbar y el gris de la marca no llegan a 4.5:1 como texto pequeño sobre
fondo claro, así que la marca y el gráfico usan `--sol`/`--niebla` y el texto
usa las variantes `-txt`. No unificarlos.

## Marca

Logo propio: aro dorado, sol con rayos, banda de niebla, ola de agua y gota.
Dos variantes, porque la completa se empasta por debajo de 40 px:
- **compacta** (sin aro ni gota) en la cabecera
- **completa** en la pantalla inicial y en los iconos

Los colores salen de las variables del tema, así que la marca funciona en
claro y en oscuro. La niebla es gris azulado, no blanca: sobre el papel claro
el blanco es invisible.

## Reglas de código

- Mantener funciones pequeñas y claras
- Respetar la separación por capas ya existente
- Evitar duplicación
- Nombres de funciones y variables claros, en español
- No meter comentarios innecesarios; los que haya deben explicar el porqué
- Código fácil de editar por otra IA después

## Datos reales

Los datos entran por `Proveedores` en `datos.js`. Un proveedor es
`{ id, etiqueta, obtener() }` y todos devuelven el mismo objeto normalizado,
así que el motor y la interfaz no saben de dónde vienen los números.

Cascada configurable desde Ajustes:
`api/tiempo.js` (AEMET + Open-Meteo) → Open-Meteo directo → simulados.

**La clave de AEMET no va en el cliente.** Va en el servidor como variable de
entorno `AEMET_API_KEY` (Vercel → Settings → Environment Variables) y la lee
`api/tiempo.js`. Dos motivos, ninguno negociable: una clave en el navegador la
ve cualquiera, y AEMET no envía cabeceras CORS, así que una llamada directa
desde el móvil ni siquiera funcionaría. Nunca crear un hueco para la clave en
el JavaScript del navegador.

El backend compone la malla horaria de Open-Meteo con la observación real
de la estación AEMET más cercana a cada ciudad. Sin clave sigue funcionando y
devuelve solo el modelo.

Reglas:
- fallback a datos simulados si falla la API
- nunca romper la app si no hay conexión
- mostrar claramente si se usan datos simulados o reales
- fuentes distintas pueden contradecirse (el cielo del modelo con la
  visibilidad de una estación): `reconcilia()` las deja coherentes en la
  puerta de entrada, antes de que nadie las lea

## Estados UX obligatorios

Todos resueltos; no perderlos al editar:

| Estado | Dónde |
|---|---|
| cargando | esqueleto del hero |
| error | `hero--error` con botón de reintentar |
| sin conexión | cinta fija `#aviso-red` |
| datos simulados | sello ámbar "Simulados" |
| datos reales | sello azul "AEMET" o "En directo" |
| última actualización | hora en el pie del hero; "Hace X min" pasados 40 |

La app debe transmitir control y confianza. Antes que inventar un dato, decir
que no lo hay.

## Prioridades al editar

1. No romper lo que ya funciona
2. Mejorar utilidad real
3. Mejorar claridad móvil
4. Mejorar diseño premium
5. Mejorar arquitectura
6. Afinar AEMET
7. Revisar errores finales

## Formato de trabajo esperado

Cuando hagas cambios importantes:
1. audita brevemente
2. resume mejoras
3. reescribe archivos completos si hace falta
4. revisa errores potenciales
5. entrega versión final limpia

Comprobar de verdad, no de palabra: el motor se puede importar en Node y la
interfaz se puede abrir en un navegador sin cabeza. Antes de dar algo por
bueno, mirarlo a 320 y 375 px, en claro y en oscuro, y con la red cortada.

## Criterio de calidad

Una mejora solo vale si hace la app más útil, más clara, más bonita, más
robusta o más lista para uso diario.

Si una idea añade complejidad pero no mejora mucho la experiencia, no la
implementes.

## Trampas conocidas

- `evaluar()` recibe el reloj como tercer argumento y **no** usa
  `datos.instante`: con una caché de hace horas, la columna "Ahora" tiene que
  seguir siendo la hora actual.
- Open-Meteo devuelve las horas en la zona pedida pero sin indicarla. Hay que
  convertirlas con `utc_offset_seconds`, o el backend (que corre en UTC) le
  adjudica al "ahora mismo" la visibilidad de dos horas antes.
- `AbortSignal.timeout` no existe en iOS 15: usar el ayudante `conCorte`.
- El gráfico necesita al menos dos franjas; con menos, avisa en vez de
  dibujar coordenadas infinitas.

## Estaciones de AEMET

No hay indicativos escritos a mano. `api/tiempo.js` pide **todas** las
observaciones en una sola llamada (`/observacion/convencional/todas`) y elige
para cada ciudad la estación más cercana por distancia real, descartando las
que estén a más de 30 km. Así la app se autocorrige si AEMET cambia su red o
una estación deja de emitir. La respuesta dice qué estación usó y a cuántos
kilómetros está.
