# CLAUDE.md — Chivato AI

Instrucciones para trabajar dentro de `chivato/`.
Las reglas generales del repositorio están en el `CLAUDE.md` de la raíz.

## Propósito

App para el conductor que ve una luz rara en el salpicadero y no sabe si puede
seguir o tiene que parar. Todo se mide por eso: **una foto, una respuesta clara
y una decisión**.

Prioridades, por orden:

1. Que no se dé un consejo peligroso. Un rojo crítico siempre dice «para».
2. Que se lea de un vistazo, con el móvil en una mano y de pie junto al coche.
3. Que funcione sin cobertura (los aparcamientos subterráneos no tienen red).
4. Que nunca invente un dato: ni un coste, ni una causa, ni un testigo.

## La regla de oro

**La IA identifica; el catálogo explica.**

El modelo de visión solo devuelve identificadores de `datos/testigos.json`. El
significado, las causas, el «qué hacer» y el coste salen siempre del catálogo,
que está escrito a mano y revisado.

No cambies esto para «ahorrar trabajo» dejando que el modelo redacte la ficha:
es lo que impide que un conductor asustado reciba un presupuesto inventado.
Si un testigo falta, se añade al catálogo, no se delega en el modelo.

## Stack

- HTML, CSS y JavaScript puro (módulos ES nativos, sin empaquetador ni build).
- PWA con `manifest.json` y `service-worker.js`.
- Una función serverless en `api/chivato.js` (Anthropic SDK).

No introducir frameworks ni dependencias de navegador salvo necesidad muy
justificada. **La app se sirve por HTTP**, no con `file://`.

Esta carpeta es autosuficiente: se puede desplegar sola en Vercel con Root
Directory = `chivato`. Por eso la función vive aquí y en la raíz solo queda el
reenvío `api/chivato.js`.

## Al tocar el catálogo

- Cada testigo necesita **todos** los campos; los tests lo comprueban.
- `gravedad: "critico"` nunca puede llevar `conducir: "si"`.
- Los rangos de coste son orientativos y en euros, siempre como rango.
- Si añades un testigo, añade también su dibujo en `js/iconos.js` (o reutiliza
  uno existente): el test exige que no falte ninguno ni sobre ninguno.
- Sube `version` en la cabecera del JSON y la del `service-worker.js` para que
  los móviles que ya tengan la app se descarguen el catálogo nuevo.

## Al tocar la interfaz

- `interfaz.js` es render puro: recibe datos y devuelve HTML. No toca estado ni
  red. Todo lo que venga de fuera pasa por `esc()`.
- El aviso legal tiene que seguir visible en la portada y al pie del resultado.
- Los colores de gravedad (rojo / naranja / amarillo) no se tocan: son la
  lectura rápida de la app.

## Archivos principales

| Archivo | Qué hace |
|---|---|
| `index.html` | Las cuatro vistas (foto, catálogo, resultado, historial) y la ficha |
| `js/app.js` | Estado, eventos, PWA, delegación de clics |
| `js/catalogo.js` | Carga con copia local y buscador que ignora tildes |
| `js/camara.js` | Compresión de la foto antes de enviarla |
| `js/vision.js` | Llamadas a `/api/chivato` |
| `js/interfaz.js` | Render de tarjetas, filas, resumen e historial |
| `js/iconos.js` | Los 95 dibujos SVG de los testigos |
| `js/historial.js` | `localStorage`: historial y datos del coche |
| `api/chivato.js` | Proxy a Claude: análisis y preguntas de seguimiento |
| `datos/testigos.json` | El catálogo revisado |
| `herramientas/generar-iconos.mjs` | Iconos de la PWA desde la marca, sin dependencias |
| `herramientas/calibrar.mjs` | Banco de calibración: pasa fotos reales y mide cobertura y precisión |
| `herramientas/generar-enlace.mjs` | Enlace corto, QR y cartel; pone las URL absolutas de canonical y Open Graph |
| `herramientas/qr.mjs` | Generador de QR, copia literal de `fotos-faciles/nucleo/qr.mjs` |
| `DOMINIO.md` | Pasos para poner la app en su propio dominio |
| `../chivato.html` | Ficha pública para enseñar y compartir la app |

## Al tocar el QR

`herramientas/qr.mjs` es una **copia literal** de `fotos-faciles/nucleo/qr.mjs`,
no un import: `chivato/` tiene que poder desplegarse sola. Si arreglas algo en
una de las dos, llévalo a la otra — el test comprueba que las dos generan el
mismo QR para las mismas direcciones.

## Antes de tocar el prompt de visión

No lo cambies a ojo. Pasa el banco de calibración (`herramientas/calibrar.mjs`)
sobre las mismas fotos antes y después: si la cobertura o la precisión bajan, el
cambio no vale, por bien que suene. Un rojo que se escapa es peor que diez
falsas alarmas.

## Tests

`node test/chivato.test.mjs` desde la raíz (entra en `npm test`). No sale a
Internet: intercepta `fetch` para fingir la respuesta del modelo.

Detalle técnico y despliegue: `README.md` de esta carpeta.
