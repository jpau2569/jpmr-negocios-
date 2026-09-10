# Chivato AI — ¿qué significa esa luz del coche?

PWA que identifica los **testigos del cuadro de mandos** a partir de una foto y
explica, en español llano, qué significan, si se puede seguir conduciendo y
cuánto suele costar arreglarlo.

> **Chivato** es como se llama en España a la luz del salpicadero: *«se me ha
> encendido el chivato del motor»*. El nombre ya cuenta lo que hace la app.

---

## La idea que la sostiene: la IA identifica, el catálogo explica

Es la decisión de diseño más importante del proyecto y conviene no deshacerla.

A la IA de visión **solo se le pide que diga qué símbolos ve encendidos**, y que
los devuelva como identificadores de nuestro catálogo. Todo lo demás —el
significado, las causas probables, el «qué hacer ahora» y el coste orientativo—
sale de `datos/testigos.json`, que está escrito y revisado a mano.

Ventajas frente a dejar que el modelo lo explique todo:

- **Ningún presupuesto inventado.** Un conductor asustado no se merece un
  «entre 2.000 y 4.000 €» alucinado por un modelo.
- **Respuestas idénticas** para el mismo testigo, hoy y dentro de un año.
- **Funciona sin conexión**: el catálogo es un fichero que vive en el móvil.
- **Más barato y más rápido**: la IA devuelve una lista de identificadores, no
  varios párrafos.
- Cuando la IA ve algo que no está en el catálogo, no lo fuerza: lo describe
  aparte, y la app dice claramente que hay que mirar el manual del coche.

## Qué hace

1. **Foto** desde la cámara trasera (`capture="environment"`) o desde la galería.
2. **Compresión en el propio móvil** a 1.280 px y calidad 0,72 con `<canvas>`,
   antes de que la imagen salga del dispositivo.
3. **Análisis** en `/api/chivato`, que llama a Claude con visión.
4. **Resultado** ordenado de más grave a menos: tarjeta por testigo, con color
   según gravedad, qué hacer destacado, causas probables y coste orientativo.
5. **Preguntas de seguimiento** en lenguaje normal («¿puedo llegar a casa?»).
6. **Historial** en el propio móvil, sin cuentas ni servidores.
7. **Catálogo buscable** de 99 testigos, disponible sin conexión.

## Catálogo de testigos

`datos/testigos.json` cubre lo que enciende cualquier coche actual:

| Familia | Ejemplos |
|---|---|
| Motor y propulsión | check engine, presión y nivel de aceite, temperatura, EPC, turbo, potencia reducida, Start&Stop |
| Frenos y estabilidad | sistema de frenos, freno de mano (manual y eléctrico), ABS, ESP/ESC, ESP OFF, pastillas, AUTO HOLD |
| Ruedas | TPMS y fallo del TPMS |
| Luces | posición, cruce, largas, largas automáticas, antiniebla delantera y trasera, diurnas, AUTO, intermitentes, emergencia, bombilla fundida, luz de freno, AFS, reglaje |
| Seguridad pasiva | airbag, airbag del acompañante desactivado, cinturón |
| Escape y emisiones | DPF/FAP, GPF, AdBlue (aviso y bloqueo), EGR, catalizador, sistema antipolución |
| Combustible | reserva, agua en el filtro de gasoil, GLP/GNC |
| Eléctrico y alta tensión | batería/alternador, inmovilizador, READY, EV, batería de tracción, carga en curso, sistema híbrido, regeneración, AVAS |
| Asistentes | crucero, crucero adaptativo, limitador, carril, ángulo muerto, tráfico cruzado, sensores de aparcamiento, cámara tapada, señales, fatiga, colisión |
| Transmisión, dirección y suspensión | caja automática, 4x4, bloqueo de diferencial, dirección asistida, suspensión neumática |
| Carrocería | puertas, capó, maletero, remolque |
| Confort y mantenimiento | limpiaparabrisas, escobillas, desempañado, luneta térmica, A/C, recirculación, hielo, revisión, cambio de aceite, filtros |

Cada entrada lleva: `id`, `nombre`, `otros_nombres` (para el buscador),
`color`, `gravedad`, `categoria`, `icono`, `forma` (cómo es el dibujo),
`significado`, `causas`, `que_hacer`, `conducir` y `coste`.

Los dibujos son SVG propios en `js/iconos.js`, sobre un lienzo de 48×48 que
hereda el color del contenedor. Siguen el espíritu de la **norma ISO 2575**,
pero cada marca dibuja los suyos con variaciones: la app lo dice donde toca.

## Estructura

```
chivato/
├── index.html            → toda la interfaz (cuatro vistas + ficha)
├── styles.css            → hoja única, móvil primero
├── manifest.json         → PWA instalable
├── service-worker.js     → casco y catálogo en caché; el análisis, nunca
├── datos/testigos.json   → el catálogo revisado (99 testigos)
├── js/
│   ├── app.js            → estado, eventos y PWA
│   ├── catalogo.js       → carga, copia local y buscador sin tildes
│   ├── camara.js         → captura y compresión con <canvas>
│   ├── vision.js         → llamadas a /api/chivato
│   ├── historial.js      → historial y datos del coche (localStorage)
│   ├── interfaz.js       → render puro (no toca estado ni red)
│   └── iconos.js         → los 95 dibujos SVG
├── api/chivato.js        → función serverless (proxy a Claude)
├── marca/logo-1024.png   → imagen maestra de la marca
├── icono-*.png           → iconos generados de la PWA
└── herramientas/
    ├── generar-iconos.mjs → iconos de la PWA desde la marca
    └── calibrar.mjs       → banco de calibración con fotos reales
```

La ficha pública (para enseñarla y compartirla) vive en la raíz del monorepo,
en `chivato.html`.

Módulos ES nativos, sin empaquetador y sin dependencias en el navegador.

## Probarlo en local

La app **necesita servirse por HTTP** (usa módulos ES y service worker):

```bash
cd chivato
python3 -m http.server 8000
# y abrir http://localhost:8000
```

Sin backend, el botón de la foto avisará de que no hay conexión con el
servidor, pero **el catálogo y el buscador funcionan igual**. Para probar el
análisis de verdad hace falta desplegar (o `vercel dev` desde la raíz del
monorepo con `ANTHROPIC_API_KEY` en `.env`).

Tests: `node test/chivato.test.mjs` desde la raíz del repositorio (también
entran en `npm test`). No salen a Internet: se intercepta `fetch`.

## Calibrar con fotos reales

El catálogo está revisado, pero **lo que hay que afinar con fotos de verdad es
la vista**: si la IA ve todos los testigos encendidos y no se inventa ninguno.
Para eso está el banco de calibración.

```bash
# 1. Deja tus fotos de salpicadero en una carpeta (no se suben a git)
mkdir -p chivato/fotos-calibracion

# 2. Primera pasada: genera la plantilla de respuestas correctas
node chivato/herramientas/calibrar.mjs chivato/fotos-calibracion \
  --url https://tu-app.vercel.app/api/chivato --plantilla

# 3. Corrige a mano `esperado.json` (quita lo que no estuviera encendido,
#    añade lo que la IA no vio) y vuelve a lanzarlo sin --plantilla
node chivato/herramientas/calibrar.mjs chivato/fotos-calibracion \
  --url https://tu-app.vercel.app/api/chivato
```

Escribe `informe-calibracion.md` en la misma carpeta con:

| Métrica | Qué mide | Objetivo razonable |
|---|---|---|
| **Cobertura** | De los testigos encendidos, cuántos vio | > 90 %, y **100 % en los rojos** |
| **Precisión** | De los que dijo ver, cuántos estaban de verdad | > 90 % |
| **Fotos clavadas** | Sin un olvido ni un sobrante | cuantas más, mejor |

Además lista qué testigos se le escapan y cuáles confunde, que es justo lo que
hay que tocar. Si tienes Playwright instalado (`npm install` en la raíz), las
fotos se reducen a 1.280 px igual que hace la app, para calibrar sobre lo mismo
que ve en producción.

Qué tocar según lo que falle:

- **Se le escapan testigos** → mira primero la columna de calidad de la foto.
  Si las fotos son buenas, endurece el punto 1 de `INSTRUCCIONES` en
  `api/chivato.js`.
- **Confunde dos símbolos parecidos** → afina el campo `forma` de esos testigos
  en `datos/testigos.json`: es lo único que el modelo tiene para distinguirlos.
- **Se inventa testigos** → refuerza el punto 7 del prompt.
- Cambia **una cosa cada vez** y repite sobre las mismas fotos.

Un buen banco son 15-20 fotos: tu coche, el de casa, los del local, con distinta
luz (día, noche, garaje) y algún caso difícil a propósito (reflejo, foto de
lejos, cuadro apagado).

## Desplegar

**Dentro del monorepo** (es lo que ya está configurado): la ruta
`/api/chivato` existe gracias al reenvío `api/chivato.js` de la raíz, y
`vercel.json` le da 60 segundos y le incluye `chivato/datos/**`.

**Como proyecto propio**: Root Directory = `chivato`. La carpeta lleva su
propio `api/`, `vercel.json` y `package.json`, así que se despliega sola.

Variable de entorno necesaria (Vercel → Settings → Environment Variables):

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | Análisis de la foto con Claude. Sin ella la app avisa y sigue sirviendo el catálogo. |

La clave **nunca** viaja al navegador: la llamada al modelo se hace desde la
función serverless.

## Regenerar los iconos

```bash
node chivato/herramientas/generar-iconos.mjs
```

Lee `marca/logo-1024.png` y escribe los PNG de 512, 192, 180, 96 y 32, más los
`maskable` (el logo al 82 % sobre el fondo, porque Android recorta en círculo).
Cero dependencias: descodifica y codifica el PNG con `zlib`.

Para partir de otra imagen maestra:

```bash
node chivato/herramientas/generar-iconos.mjs marca/otro-logo.png --maestro
```

## Privacidad

- La foto se comprime en el móvil y se envía solo para el análisis. No se
  guarda en ningún servidor.
- El historial, la miniatura y los datos del coche viven **únicamente** en el
  `localStorage` del dispositivo.
- No hay cuentas, ni registro, ni cookies de seguimiento.

## Aviso importante

Chivato AI es **orientativo** y no sustituye el diagnóstico de un profesional.
Ante un testigo rojo (frenos, temperatura, presión de aceite, airbag,
dirección), lo correcto es detener el vehículo en un lugar seguro.
