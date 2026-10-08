# CAPTAOPORTUNIDADES ASTURIAS — Fase 1

CRM inmobiliario **local, independiente** (sin Inmoweb ni conexiones externas) para captar y gestionar pisos, casas, chalets y parcelas en Asturias, de la primera oportunidad al seguimiento. Guía para usuarios: [`EMPEZAR-AQUI.md`](EMPEZAR-AQUI.md).

## Arquitectura

```
iniciar.mjs            arranque (CLI y función iniciar() que usan los tests)
nucleo/                backend, sin dependencias npm
  bd.mjs               ÚNICO archivo que conoce el motor (node:sqlite): pragmas, migraciones, transacciones
  migraciones.mjs      esquema por versiones (PRAGMA user_version); nunca se edita una publicada
  campos.mjs           validación con lista blanca de campos por entidad
  catalogos.mjs        estados, enumeraciones, 78 concejos (fuente de verdad también para la web)
  contactos / oportunidades / inmuebles / demandas / tareas / actividades .mjs   reglas de negocio
  copias.mjs + zip.mjs copias completas (ZIP propio con SHA-256), restauración con marcha atrás
  servidor.mjs + rutas.mjs   HTTP en 127.0.0.1 y API REST (/api/…)
web/                   interfaz (JS de módulos, sin build, sin recursos externos)
```

- **Datos**: SQLite real en `~/.captaoportunidades/captao.sqlite` (`CAPTAO_DATOS` o `--datos` lo cambian). WAL + `synchronous=FULL`, claves foráneas activas. **No** se usa `localStorage` para datos: solo recuerda el modo real/demo y la vista tabla/tarjetas.
- **Demostración**: otra base (`demo/captao-demo.sqlite`), con cabecera `X-Captao-Modo: demo`. Una copia de seguridad nunca la incluye; un valor de modo extraño cae siempre en lo real.
- **Requisitos**: Node ≥ 22.13. `node:sqlite` figura como *experimental* en Node 22 (el aviso se silencia); si cambiara, solo hay que tocar `bd.mjs`.
- **Coste**: 0 € de licencias. Costes futuros posibles y ajenos a esta fase: alojamiento (si sale del PC), API de IA (Fase 4, por uso), mensajería oficial de WhatsApp.

## Qué hay implementado (Fase 1)

Contactos con roles múltiples y duplicados avisados · habilitación de comunicaciones **por canal** con base y evidencia · «No contactar» con efecto real · oportunidades con 12 estados y reglas · **Confirmar encargo** (crea/reutiliza inmueble, vincula propietarios, conserva el historial, aviso de vencimiento automático) · cartera con historial de precios, varios propietarios, ubicación pública ≠ dirección interna y datos pendientes de confirmar · compradores y demandas (sin financiación «aprobada» sin evidencia; caducidad) · agenda (hoy, semana, pendientes, vencidas, calendario) y recordatorios internos · panel con datos reales · buscador global · exportación CSV (con opción sin datos personales) · copias completas y restauración · modo demostración.

## Pendiente (no simulado)

| Fase | Contenido |
|---|---|
| 2 | Visitas, ofertas, operaciones (hitos configurables), documentos y fotografías, cruce demanda↔cartera, importación CSV con vista previa y detección de duplicados, historial ampliado |
| 3 | Informes (conversión, tiempos, coste por encargo), marketing y dosieres imprimibles, plantillas, generador de prompts para Claude, logotipo |
| 4 | Multiusuario, acceso remoto (autenticación, roles, HTTPS), IA por API, mensajería sujeta a revisión |

## Seguridad (qué hay y qué no)

Escucha solo en `127.0.0.1` · comprobación de `Host` (anti DNS rebinding) y de `Origin`/`Sec-Fetch-Site` · cabecera `X-Captao` obligatoria al escribir (anti CSRF) · CSP estricta (sin scripts/estilos en línea ni recursos externos) · texto de los datos siempre como nodo de texto (nunca `innerHTML`) · consultas parametrizadas y columnas de orden en lista blanca · límite de 1 MB en JSON · ZIP con rutas seguras, CRC/SHA-256 y límite de expansión · el historial no copia datos personales.
**No es apta para exposición pública**: un usuario, sin contraseña. Nada de lo implementado garantiza por sí solo el cumplimiento del RGPD/LSSI.

## Pruebas

```bash
node test/captaoportunidades.test.mjs      # núcleo + servidor HTTP real
node test/captaoportunidades.ui.test.mjs   # Chromium real (necesita playwright)
```
Se ejecutan también con `npm test` y `npm run test:ui`. Usan carpetas temporales y un reloj fijo; no tocan datos reales.

## Decisiones de diseño que conviene conocer

- Los **estados son fijos** (de ellos dependen reglas y panel); catálogos configurables: municipios, fuentes, tipos y motivos de descarte.
- Procedencia obligatoria si se guarda teléfono o correo (principio de procedencia de los datos). Es una regla en `contactos.mjs` fácil de relajar.
- La ficha de un inmueble nacido de una oportunidad no se puede borrar (es su historial de captación): se archiva.
- Las fechas de agenda son locales sin zona horaria (una inmobiliaria en una sola zona); los sellos de sistema son UTC.
