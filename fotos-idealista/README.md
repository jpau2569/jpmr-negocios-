# Fotos para Idealista

Pau saca entre 10 y 20 fotos de un piso con el iPhone. Esta herramienta las prepara para subirlas a Idealista, en el móvil o en el PC:
`https://jpmr-negocios.vercel.app/fotos-idealista.html` (enlace corto a `fotos-idealista/app.html`).

1. **Cargar**: muchas a la vez (botón o arrastrar). Admite JPG, PNG, WebP y HEIC. Safari abre el HEIC por sí mismo. Chrome, Android y Windows no pueden, así que en ese caso se descarga `heic2any@0.0.4` desde cdn.jsdelivr.net (con huella SRI y solo si hace falta).
2. **Preparar en el aparato**: respeta la orientación EXIF, reduce a 2560 px de lado largo (sin ampliar nunca), aplica un retoque suave que se puede apagar (autocontraste ligero, +5 % de brillo, +6 % de contraste, +4 % de saturación y enfoque suave) y guarda en JPEG al 90 %. Al redibujar en `<canvas>` se pierden el EXIF y el **GPS**.
3. **Repetidas**: se compara el dHash 9×8 con la distancia de Hamming (umbral 10). De cada grupo de fotos parecidas se queda la más nítida (varianza del laplaciano) o, si empatan, la de más resolución. Las demás se apartan, pero Pau puede volver a ponerlas.
4. **IA opcional**: `/api/fotos-idealista` (`api/_fotos-idealista.js`) recibe miniaturas de 768 px, 20 como máximo por envío (el cliente trocea para no pasar de los 4,5 MB de Vercel). Claude, con la herramienta forzada `clasificar_fotos`, devuelve **solo identificadores** del catálogo: estancia, calidad 1-5 (luz, encuadre y nitidez), objetos que conviene retirar, avisos y candidata a portada. El servidor descarta cualquier identificador que no esté en el catálogo. Los textos que lee Pau salen del catálogo. La IA ve todas las fotos juntas para poder avisar de «puede ser de otro inmueble». Pide la **clave de sincronización** (la misma de Clara y Cerebro, comprobada con `autoriza` de `api/_cerebro.js`) para que nadie gaste el crédito de la API. Si no hay clave, falla la API o se apaga la IA, Pau elige la estancia con el desplegable.
5. **Orden** (`ordenarParaIdealista`, sin IA): portada, salón, cocina, dormitorio principal, dormitorios, baños, terraza y balcón, el resto y, al final, las vistas y la zona común. Se puede cambiar con ↑ ↓, arrastrando con el ratón y con «Quitar».
6. **Nombres**: `01-salon.jpg`, `02-dormitorio-principal.jpg`, `03-dormitorio-2.jpg`… (sin tildes). La referencia del inmueble va delante del nombre del ZIP.
7. **Salida**: un ZIP (`zip.js`, copia exacta de `escaparate3d-pro/js/zip.js`, que vigila el test), las fotos una a una o *Compartir* con la Web Share API, que en el iPhone permite *Guardar imágenes*.

## Archivos

| Archivo | Qué hace |
|---|---|
| `catalogo.js` | Catálogos, herramienta de Claude, `normalizarRespuestaIA`, `ordenarParaIdealista`, `nombresArchivo`, `nombreZip`, `dHashDesdeGris` y `hammingDHash`. Es puro y lo usan tanto el navegador como el servidor. `lib/fotos-idealista.js` lo reexporta. |
| `procesar.js` | Funciones puras sobre los píxeles: retoque, enfoque, nitidez, detección de HEIC y de EXIF. |
| `duplicados.js` | Detecta las parejas parecidas, las agrupa y propone cuál se queda (funciones puras). |
| `cargar.js` | Parte del navegador: abre la foto (y el HEIC), la reduce, la retoca y la exporta, y saca la miniatura, la nitidez y el hash. |
| `interfaz.js` | Pinta la pantalla (datos → HTML) y compone los avisos a partir del catálogo. |
| `app.js` | Estado, eventos, llamadas a la IA, ZIP y compartir. |

Las fotos solo están en la memoria de la pestaña. En `localStorage` (`fotos-idealista:ajustes`) solo se guardan el retoque, la IA, el tema y la clave de este aparato.

## Tests

- `node test/fotos-idealista.test.mjs` (dentro de `npm test`): funciones puras y el endpoint, con Anthropic simulado.
- `node test/fotos-idealista.ui.test.mjs` (dentro de `npm run test:ui`): Chromium real. Carga 4 JPEG (uno con EXIF de orientación 6 y otro casi repetido) y comprueba la repetida apartada, el orden, los nombres, los avisos, el ZIP (JPEG sin EXIF y girado), que se puede reordenar, el caso sin IA y los tamaños de 390 y 1366 px.

## Límites conocidos

- **HEIC en Windows/Android**: depende de heic2any (libheif en JavaScript). Es lento (unos segundos por foto de 24 MP) y consume mucha memoria. No está probado con fotos HEIC reales. Si falla, se puede cambiar el iPhone a *Ajustes → Cámara → Formatos → Más compatible*, o mandar las fotos por AirDrop o WhatsApp, que las convierten a JPG.
- **Color**: el lienzo trabaja en sRGB. Las fotos Display P3 del iPhone pueden perder un poco de saturación en los rojos y verdes más intensos.
- El retoque es global (niveles y color), no por zonas. No quita objetos: para eso está `/marcadeagua.html`.
