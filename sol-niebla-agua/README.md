# Sol Niebla y Agua

PWA personal del tiempo para **Asturias central y costa**: Oviedo, Mieres y
Gijón. No enseña datos crudos, sino la decisión: si conviene salir ahora,
esperar, coger el coche o dejarlo para mañana.

Abrir en local: `python3 -m http.server` y entrar en
`http://localhost:8000/sol-niebla-agua/app.html`.
En el móvil: abrir esa dirección y **Añadir a pantalla de inicio**.

## Qué hace

- **Índice Sol Niebla y Agua (0-100)** propio, recalculado según el modo de
  uso: Paseo, Fotos, Visitas inmobiliarias y Carretera.
- **Ranking de las tres ciudades** y diferencia entre interior y costa.
- **Próximas 12 horas** con la ventana buena y el momento en que se estropea.
- **Recomendación accionable**: "sal ahora", "espera a las 17:00", "lleva
  paraguas", "evita carretera por niebla".
- Funciona **sin cobertura** con lo último que descargó.

## Archivos

| Archivo | Papel |
|---|---|
| `app.html` | Estructura y textos fijos |
| `styles.css` | Sistema visual completo (tokens, claro/oscuro) |
| `app.js` | Datos, índice, etiquetas y render, en secciones numeradas |
| `manifest.json` | Instalación como app |
| `service-worker.js` | Funcionamiento sin conexión |
| `herramientas/generar-iconos.mjs` | Regenera los PNG de los iconos |
| `../api/tiempo.js` | Backend opcional: AEMET + Open-Meteo |

## De dónde salen los datos

`app.js` sólo habla con `Proveedores`. Cada proveedor tiene la misma forma
—`{ id, etiqueta, obtener() }`— y devuelve el mismo objeto normalizado, así
que el motor del índice y el render no se enteran de cuál está en uso.

La cascada se elige en **Ajustes → Origen de los datos**:

| Origen | Qué hace |
|---|---|
| **Automático** (por defecto) | `/api/tiempo` → Open-Meteo directo → simulados |
| **AEMET + modelo** | Sólo `/api/tiempo`. Si no está desplegado, avisa en vez de inventar |
| **Open-Meteo directo** | Del navegador a Open-Meteo, sin backend |
| **Simulados** | Escenarios plausibles de Asturias, sin red |

El sello de la cabecera dice siempre cuál se está viendo. Si los datos pasan
de 40 minutos, el sello cambia a "Hace X min".

### El backend (`api/tiempo.js`)

Existe por dos razones que el navegador no puede resolver: la clave de AEMET
no puede ir en el cliente, y AEMET no da CORS ni una serie horaria completa.

Composición: **Open-Meteo** aporta la malla horaria (visibilidad, nubosidad,
probabilidad de lluvia hora a hora) y **AEMET** corrige el "ahora mismo" con
la observación real de la estación más cercana a cada ciudad. El resultado es
observación española para el momento actual y modelo para el resto.

Para activarlo basta con definir `AEMET_API_KEY` en Vercel (se pide gratis en
`opendata.aemet.es`). **Sin la clave el backend sigue funcionando**: devuelve
sólo Open-Meteo y lo dice en `avisos`.

### Añadir otra fuente

```js
const ProveedorX = {
  id: 'x',
  etiqueta: 'Lo que verá el usuario',
  async obtener(){
    // …devuelve { ciudades, origen, instante } con la forma normalizada
  }
};
```

Registrarlo en `Proveedores`, añadirlo a `CASCADAS` y listarlo en `FUENTES`
para que salga en Ajustes. No hay que tocar nada más.

## El índice, en corto

Se parte de 100 y se restan penalizaciones por precipitación, nubosidad,
visibilidad, viento, humedad, confort térmico y luz. No se promedian: se
combinan de forma **saturante**, para que dos factores malos se acumulen y
uno muy malo no quede diluido por los que van bien (una media ponderada le
daba "excelente" a un día con 75 % de lluvia). Cada modo pondera distinto, y
hay topes duros para niebla densa, lluvia fuerte y rachas.

| Índice | Lectura |
|---|---|
| 85-100 | Excelente |
| 70-84 | Muy aprovechable |
| 50-69 | Aceptable |
| 30-49 | Día cerrado |
| 0-29 | Muy mala ventana |

Para ajustar el criterio se tocan los pesos de `MODOS` en `app.js`.

## Iconos

Los PNG se generan desde el código, sin dependencias ni programas externos:

```bash
node sol-niebla-agua/herramientas/generar-iconos.mjs
```

Hacen falta en PNG porque iOS ignora los `apple-touch-icon` en SVG y pondría
una captura borrosa en la pantalla de inicio.
