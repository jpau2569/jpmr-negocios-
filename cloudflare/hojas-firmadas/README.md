# Hojas firmadas: hojas de visita y de captación firmadas con el dedo

Una app para el móvil (se instala como una aplicación) con la que el agente rellena una **hoja de visita** o una **hoja de captación (encargo)** y el cliente y el agente **firman con el dedo** en la pantalla. Funciona con un **Worker de Cloudflare** y una base de datos **D1**. Es el proyecto 8 de la skill `skills/cloudflare-proyectos/SKILL.md`.

**Sirve para cualquier inmobiliaria.** Cada inmobiliaria tiene **su propia copia**: su Worker y su base de datos. No se mezclan datos de una con otra. El nombre, el logo, los colores, los datos legales y los textos se cambian desde la propia app, en **Ajustes**. De serie viene con la marca de **Asesoría Castresana**.

> **Regla de oro (puesta por Pau):** cada paso que toca Cloudflare se hace **solo con su permiso** y **solo con lo incluido en su plan de 5 USD/mes**. Nada de compras, cambios de plan ni dominios de pago. Si algo pudiera costar más, se para y se le avisa. Los pasos marcados con 🔐 tocan Cloudflare. **No usa R2** (los archivos), porque puede pedir método de pago: todo, firmas y logo incluidos, va en D1.

---

## Qué hace

| | |
|---|---|
| **Hoja de visita** | Visitante (nombre, DNI/NIE opcional, teléfono, correo opcional), piso (referencia, dirección y, si quieres, el resto de datos del piso de Cerebro), fecha y hora, la declaración y la protección de datos. Firman **el visitante y el agente**. Un piso por hoja, como en Cerebro. |
| **Hoja de captación** | Propietario y piso (los datos de Cerebro), condiciones del encargo (tipo, honorarios, duración, llaves, dónde anunciar, lugar de firma). **La app no pone ningún valor por su cuenta**: honorarios y duración salen en blanco. Si se firma **fuera de la oficina**, aparece el **desistimiento de 14 días**. Firman **el propietario y el agente**. |
| **Al firmar** | Se guarda todo en D1: datos, textos legales tal como estaban, las dos firmas, la hora del servidor, la IP resumida (no se puede saber cuál era) y un **código de comprobación SHA-256** de todo lo firmado. Ese código va al pie del PDF: si el PDF que tiene el cliente da el mismo código que el guardado, es que coincide con lo que se firmó. El servidor anota además si los textos legales y la marca de la hoja eran los de Ajustes en ese momento. |
| **Una hoja firmada no se puede cambiar desde la app** | Ni la app ni la API tienen ninguna forma de cambiar una hoja firmada, y en D1 un *trigger* rechaza cualquier cambio (y cualquier borrado que no deje constancia en el registro). Si hay un error, se **anula con un motivo** y se firma otra; la anulada se conserva. **Lo que no se puede prometer:** quien tenga acceso a la cuenta de Cloudflare podría quitar el trigger y cambiar o borrar la hoja en la base de datos. Por eso la prueba que vale es el **SHA-256**: permite comprobar que el PDF del cliente coincide con el guardado, y si alguien tocara la hoja guardada ya no coincidiría con el PDF que tiene el cliente. |
| **PDF** | El de Cerebro, con tu logo, tus colores y tu encabezado de firmas. Al pie lleva el código SHA-256 y las fechas. Se puede **compartir** (WhatsApp, correo, Drive…), **descargar**, o abrir WhatsApp o el correo con el texto ya escrito. **Al cliente no se le envía nada solo.** |
| **Sin cobertura** | Se firma igual. La hoja se queda en el móvil con el aviso **«pendiente de subir»** y se sube **sola** al volver la conexión, **sin duplicarse**. |
| **Hojas** | Lista con filtros (tipo, fechas, referencia, nombre), detalle, volver a sacar el PDF, anular, **Excel (CSV)** y **«Borrar datos»**. |
| **Agentes** | El titular entra con su clave. Si quieres, añades agentes con su usuario y su clave; cada hoja dice quién la firmó (el servidor comprueba que es quien tiene la sesión abierta). De serie, **cada agente solo ve sus hojas** (se cambia en Ajustes → Agentes). |

---

## 1. Probarla en tu PC sin Cloudflare (2 minutos, sin cuenta)

Solo necesitas Node.js 22.18 o superior. Desde la carpeta del repositorio:

```
node cloudflare/hojas-firmadas/herramientas/probar-en-local.mjs
```

1. Abre **http://localhost:8790**.
2. La **clave del titular** sale escrita en la pantalla negra. Es **aleatoria y nueva cada vez** (el repositorio es público, así que no hay ninguna clave fija). Si quieres una tuya, arranca con la variable `PANEL_CLAVE`.
3. En «Usuario» no escribas nada: así entras como titular.
4. Los datos de prueba se guardan en `cloudflare/hojas-firmadas/.local/`, que no se sube a git. Para que se borren al cerrar, añade `--memoria`. Se para con **Ctrl+C**.

Para probarla **en el móvil**, usa el link temporal (`cloudflare/link-temporal.bat`, puerto **8790**; ver el README de `castresana-web`, apartado 7). Cierra el túnel en cuanto acabes.

**En Mac:** el `.bat` no funciona (es de Windows). Haz doble clic en `cloudflare/probar-en-mac.command`: arranca la app, abre el navegador y, si dices que sí, crea el link temporal (instala `cloudflared` con Homebrew o lo descarga de GitHub). La primera vez, si macOS lo bloquea: clic derecho → **Abrir** → **Abrir**.

Es **el mismo código** que irá a Cloudflare, con SQLite haciendo de D1.

---

## 2. Publicarla en Cloudflare (en tu PC, paso a paso)

Lo que **sí he comprobado** aquí, en local, con `cf` 1.0.0-beta.16:
- `cf deploy --dry-run --no-provision` construye y enumera los enlaces (DB y ASSETS) sin subir nada.
- `cf d1 migrations apply … --local` crea las tablas **y el candado** que impide cambiar una hoja firmada.
- `cf dev` arranca la app en el motor real de Cloudflare (workerd): entrar, alta de agente, subir hojas (4 a la vez → 1 nueva y 3 repetidas), lista, CSV, anular y borrar.
- Tras la revisión de NICER, otra vez con `cf dev` (workerd): un agente no puede firmar con el nombre de otro, «revisados» falsos se rechazan, marca distinta se acepta marcada, el agente solo ve sus hojas, anular (en una transacción), borrar (con el trigger que exige constancia), CSV, logo falso rechazado y «Salir» que invalida la cookie en el servidor. En la D1 local de workerd, un `DELETE` directo sin constancia queda bloqueado.

Lo que **no he podido comprobar**, porque desde aquí no hay conexión con Cloudflare: todo lo que va contra tu cuenta real. Esos comandos van marcados **«sin verificar contra la cuenta»**. Si alguno da un error, cópialo tal cual y pregunta antes de seguir.

### Paso 0: Node.js 22.18 o superior
```
node --version
```

### Paso 1: instalar las herramientas del proyecto (no toca Cloudflare)
```
cd cloudflare/hojas-firmadas
npm install
```
Instala `cf` y `wrangler` dentro de esta carpeta (`node_modules`, que no se sube a git).

### Paso 2 🔐: entrar en tu cuenta (pide permiso / solo lo incluido en los 5 USD)
```
npx cf auth login
npx cf auth whoami
```
Se abre el navegador para que **apruebes el acceso**. Ninguna clave pasa por el chat.

### Paso 3: ensayo (no sube nada)
```
npx cf deploy --dry-run --no-provision
```
Debe acabar con «--dry-run: exiting now» y los enlaces `env.DB` y `env.ASSETS`.

### Paso 4 🔐: crear la base de datos D1 (pide permiso / solo lo incluido en los 5 USD)
```
npx cf d1 create --name hojas-firmadas-db --dry-run
npx cf d1 create --name hojas-firmadas-db
```
- Primero el ensayo y, si lo apruebas, el de verdad. **Sin verificar contra la cuenta.**
- Copia el **identificador (UUID)** que te devuelve en `cloudflare.config.ts`, en `id:`, en lugar de `00000000-0000-4000-8000-000000000000`. Si se pierde: `npx cf d1 list`.

### Paso 5 🔐: crear las tablas (pide permiso / solo lo incluido en los 5 USD)
```
npx cf d1 migrations apply <ID-DE-LA-D1> --dir . --pattern schema.sql --dry-run
npx cf d1 migrations apply <ID-DE-LA-D1> --dir . --pattern schema.sql
```
Hay que poner el **ID**, no el nombre. Repetirlo no borra nada. En local funciona; contra la cuenta, **sin verificar**.

### Paso 6 🔐: publicar (pide permiso / solo lo incluido en los 5 USD)
```
npx cf deploy --dry-run --no-provision
npx cf deploy --no-provision
```
- Te dará una dirección del tipo `https://hojas-firmadas.<tu-subdominio>.workers.dev`. **Sin verificar contra la cuenta.**
- **`--no-provision` siempre.** Sin él, `cf deploy` crea por su cuenta lo que falte. Con él, si falta algo, falla y no crea nada que no hayas aprobado. `npm run publicar` ya lo lleva.

### Paso 7 🔐: secretos (pide permiso / solo lo incluido en los 5 USD)
Las claves **nunca** van en el código, en el repositorio ni en el chat.

| Secreto | ¿Obligatorio? | Para qué |
|---|---|---|
| `PANEL_CLAVE` | **Sí** | La clave del **titular**. **Mínimo 12 caracteres**; mejor una frase de 3 o 4 palabras. Sin ella la app dice «App apagada»: nunca se abre sin clave. Si la cambias, se cierran todas las sesiones (también las de los agentes). |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | No | Aviso de cada hoja firmada. Solo lleva **el tipo de hoja, el nombre de pila y la referencia**: nunca DNI, teléfono, correo, dirección ni firmas. |
| `IP_SECRETO` | No | Clave para resumir las IP (mínimo 16 caracteres). Sin ella se deriva de `PANEL_CLAVE`. |

**Forma recomendada:** en el panel de Cloudflare, Workers → `hojas-firmadas` → Settings → Variables and Secrets → *Add* → tipo **Secret**. Los nombres de los menús pueden variar un poco.

**Con el CLI:** crea en esta carpeta un archivo `.secretos.env` (ya está en `.gitignore`) con una línea por secreto (`PANEL_CLAVE=…`) y ejecuta `npx cf deploy --no-provision --secrets-file .secretos.env`. **Sin verificar contra la cuenta.** Borra el archivo al acabar. No uses `cf workers secrets update NOMBRE --text VALOR`: el valor quedaría en el historial de la terminal.

### Paso 8: comprobar que va
1. Abre la dirección en el móvil y entra con la clave del titular (usuario vacío).
2. En el navegador del móvil, «Añadir a la pantalla de inicio» o «Instalar app».
3. Haz una hoja de visita de prueba con tus datos, firma y mira el PDF.
4. Pon el móvil en modo avión, firma otra y comprueba el aviso «pendiente de subir». Quita el modo avión: se sube sola.
5. En **Inicio** y en **Ajustes** salen los avisos de lo que falta (datos de la marca, logo o textos que aún dicen Castresana, textos BORRADOR, avisos por Telegram).
6. Borra las hojas de prueba con **«Borrar datos»**.

---

## 3. Poner la marca (Ajustes, solo el titular)

| Qué | Dónde sale |
|---|---|
| **Nombre comercial** | Nombre de la app, título al instalarla y PDF. |
| Razón social, CIF, dirección, correo, n.º de colegiado o API | Línea pequeña bajo la cabecera del PDF. Lo que esté como `[PENDIENTE: …]` no se imprime. |
| Ciudad, teléfono, web | Cabecera del PDF y «En …, a …» de las firmas. |
| **Logo** | Barra de la app y cabecera del PDF. Se sube desde el móvil o el PC (JPG o PNG); la app lo reduce sola a menos de 200 KB y lo guarda en D1. Se puede quitar o volver al de serie. |
| **Color principal y de acento** | App, icono y PDF. La app elige sola **texto blanco o negro** según el contraste (WCAG) y te enseña la medida. |
| **Encabezado de firmas** | Encima de las dos firmas del PDF (de serie, «ASESORIA CASTRESANA INMO»). |
| **Nombre del titular** | El agente que entra con la clave principal; sale en sus hojas. |
| **Textos legales** | Declaración de la visita, protección de datos, conformidad del encargo y desistimiento. |

**Datos de Asesoría Castresana de serie:** teléfono y web (de Cerebro), correo y dirección (los del escaparate publicado). **Razón social y CIF quedan como [PENDIENTE]**: no constan en el repositorio y no se inventan. Compruébalos todos antes de usarla con clientes.

**Textos legales: BORRADOR.** Son los de Cerebro (fuentes en `cerebro/FUENTES-CAPTACION.md` y `cerebro/FUENTES-OPERACIONES.md`). El PDF dice «BORRADOR» hasta que pulses **«Revisados por un profesional»**, y no te deja hacerlo mientras quede algún `[corchete]` por completar. Si cambias un texto después, vuelve a ser BORRADOR. **Cada hoja guarda los textos tal como estaban al firmarla**: cambiarlos luego no altera las hojas ya firmadas.

**Agentes:** en Ajustes → Agentes, nombre, usuario (por ejemplo `ana.garcia`) y clave de 10 caracteres o más. Dísela en persona. La clave se guarda cifrada (PBKDF2): no se puede ver, solo cambiar. Cambiarla o dar de baja al agente cierra sus sesiones; sus hojas se conservan. Los agentes firman y ven **sus** hojas; si quitas la casilla **«Los agentes solo ven sus hojas»** (está puesta de serie), cada agente verá también las de los demás, con los datos de sus clientes. **Anular, borrar, exportar y Ajustes son solo del titular**.

**Avisos de marca:** en Inicio y en Ajustes el titular ve un aviso si el nombre comercial no es Asesoría Castresana y sigue el logo de serie, si el encabezado de firmas o algún texto legal todavía dice «Castresana», o si la razón social o el CIF siguen como [PENDIENTE]. El texto de protección de datos de la visita de serie ya no nombra a Asesoría Castresana: pone `[razón social y NIF]`.

**Textos y marca de cada hoja:** cada hoja guarda los textos y la marca con los que se firmó. Si se firmó sin conexión y antes de subirla cambiaste los Ajustes, se acepta igual (no se queda atascada en el móvil), pero el detalle y el CSV dicen que sus textos o su marca eran **distintos** de los de Ajustes al subirla. Una hoja solo puede decir «textos revisados por un profesional» si esa versión de los textos la marcaste como revisada en Ajustes (ahora o antes de cambiarla); si no, el servidor la rechaza.

---

## 4. Cómo montarla para otra inmobiliaria

Cada inmobiliaria tiene **su copia**: su Worker, su D1, su clave y su marca. Hay dos formas.

**A) En la cuenta de Cloudflare de la otra inmobiliaria (lo recomendable).** Así los datos de sus clientes quedan en su cuenta y bajo su responsabilidad.
1. Ellos (o tú, con su permiso y en su ordenador) siguen el apartado 2 entero con **su** cuenta: `cf auth login` con su usuario.
2. No hay que cambiar nombres: en su cuenta no chocan con los tuyos.
3. Ponen **su** `PANEL_CLAVE`.
4. Entran y, en **Ajustes**, ponen su nombre comercial, logo, colores, datos legales, encabezado de firmas, titular y **sus** textos legales (revisados por su profesional).

**B) En tu misma cuenta, con otro nombre** 🔐 (pide permiso / solo lo incluido en los 5 USD). Cuenta para tus límites del plan: compruébalos antes en https://developers.cloudflare.com/workers/platform/pricing/ (no los doy de memoria).
1. Haz una copia de esta carpeta, por ejemplo `cloudflare/hojas-pisos-norte/`.
2. En su `cloudflare.config.ts` cambia `name: "hojas-firmadas"` por `name: "hojas-pisos-norte"` y el `name` de la D1 por `hojas-pisos-norte-db`.
3. Crea **otra** D1 (paso 4 con el nombre nuevo) y pon su `id`.
4. Pasos 5, 6 y 7 desde la carpeta nueva, con **otra** `PANEL_CLAVE`.
5. Su marca, en sus Ajustes.

**Nunca** compartas una D1 entre dos inmobiliarias: la app no es multiempresa a propósito.

> Quién es responsable de los datos de sus clientes (y si hace falta un contrato de encargado del tratamiento si tú se la gestionas) es una cuestión legal: que lo revise un profesional. **Sin verificar.**

---

## 5. Cómo protege los datos

- **Todo lo que tiene datos va detrás de la clave** (`/api/…`). La app en sí (pantallas, estilos, icono y logo) es pública y no lleva datos de clientes.
- **Titular:** clave en el secreto `PANEL_CLAVE`, comparada en tiempo constante. **Agentes:** clave en D1 con PBKDF2-SHA256 y sal (100.000 vueltas). Si el usuario no existe, se hace el mismo trabajo, para que no se sepa qué usuarios hay.
- **Sesión:** cookie `__Host-sesion` firmada (HMAC-SHA256), `HttpOnly; Secure; SameSite=Strict`, de **7 días** (el móvil es del agente y en un piso sin cobertura no puede volver a entrar). La cookie lleva una **versión** que se guarda en D1 (tabla `sesion_titular` para el titular, columna `version` de `agentes` para cada agente). **«Salir» la sube en el servidor**: la cookie deja de valer aunque alguien la hubiera copiado. Ojo: como es una versión por persona, al salir se cierra su sesión **en todos sus móviles**. Cambiar la clave de un agente o darle de baja hace lo mismo; cambiar `PANEL_CLAVE` cierra todas.
- **Intentos:** 5 claves fallidas por IP en 15 minutos y 200 en total. Se suman **antes** de comparar, de una vez en D1: 40 intentos a la vez desde una IP comparan 5 como mucho. Si te bloquea, espera 15 minutos (ver «Si el panel queda bloqueado» en el README de `castresana-web`; aquí la tabla y las claves son las mismas: `limites`, `login:%`).
- **Envíos** solo desde la propia web (`Sec-Fetch-Site` / `Origin`) y en JSON.
- **Hojas:** la app comprueba en el móvil y otra vez en el Worker que la hoja está completa y que el SHA-256 cuadra; si algo no cuadra, no se guarda (no se «arregla» en silencio). El servidor no se cree lo que dice el móvil: un agente solo sube hojas con **su** id y **su** nombre; el titular puede subir las de un agente que exista y con su nombre; «revisados» solo vale si esa versión de los textos se marcó como revisada en Ajustes. No acepta hojas con fecha del futuro ni de hace más de 90 días.
- **Firmas y logo:** JPEG de verdad (`public/static/nucleo/jpeg.js` recorre el archivo: inicio SOI, segmentos sin salirse, cabecera SOF con medidas razonables, datos de imagen y final EOI) y con las medidas que dicen; firmas de 150 KB como mucho y logo de 200 KB. **Lo que no se puede detectar:** una firma en blanco bien formada es un JPEG válido. El móvil exige un trazo de cierta longitud antes de firmar, pero alguien que manipule la app podría mandar un recuadro en blanco y el servidor no lo distingue de una firma muy clara.
- **No se pueden tocar desde la app:** ni la app ni la API tienen forma de cambiar una hoja firmada. En D1, un *trigger* rechaza cualquier cambio salvo pasarla a «anulada» con fecha, motivo y quién (la anulación y su línea en el registro van en una sola transacción), y otro *trigger* impide **borrar** una hoja si antes no se ha escrito «borrada» en el registro. Quien tenga acceso a la cuenta de Cloudflare podría quitar los triggers: lo que lo demuestra es el **SHA-256** (si cambiara la hoja guardada, ya no coincidiría con el PDF que tiene el cliente).
- **IP:** nunca en claro; se guarda un HMAC.
- **HTML:** todo escapado; CSP sin scripts ni estilos en línea; `X-Frame-Options: DENY`, `nosniff`, HSTS, `noindex`.
- **SQL:** siempre con parámetros.
- **Móvil:** las hojas pendientes viven en el móvil (IndexedDB) **solo hasta que se suben**; luego se borran. Si en el mismo móvil firman dos personas, cada una ve solo sus hojas pendientes y de las otras solo **cuántas** hay; un agente no sube las del titular ni las de otro agente (el titular sí puede subirlas todas). El service worker nunca guarda nada de `/api/`.
- **CSV:** «;» y BOM para Excel; fórmulas neutralizadas; sin firmas. Lleva dos columnas que dicen si los textos legales y la marca de cada hoja eran los de Ajustes al subirla.

---

## 6. Si un cliente pide que borres sus datos

> **BORRADOR.** Una hoja firmada puede tener que **conservarse** por obligación legal (por ejemplo, para defender una reclamación o por la normativa de prevención del blanqueo de capitales). La app **no sabe** qué plazos se aplican a tu caso y no los inventa. **La decisión de borrar o de conservar (bloqueada) es de la inmobiliaria**, con su gestor o abogado.

Si decides borrar:
1. Entra como titular → **Hojas** → busca su nombre → abre la hoja.
2. En **«Borrar datos»**, escribe `BORRAR` y confirma. Se borran del todo los datos y las firmas (y el motivo, si estaba anulada). En el registro solo queda que existió una hoja de ese tipo, cuándo se borró y quién lo hizo, sin ningún dato de la persona. Si algún móvil la tenía pendiente, ya no se puede volver a subir.
3. Borra a mano el aviso de Telegram (lleva su nombre de pila y la referencia), los PDF y CSV que hayas descargado y los WhatsApp o correos en los que la enviaste.
4. Contéstale que ya está hecho.

---

## 7. Borrarlo todo 🔐 (pide permiso / solo lo incluido en los 5 USD)

Antes, descarga el CSV y los PDF que quieras conservar (piensa en la obligación de conservar del apartado 6). **Borrar es definitivo.**

```
npx cf workers delete hojas-firmadas --dry-run
npx cf workers delete hojas-firmadas
npx cf d1 delete <ID-DE-LA-D1> --dry-run
npx cf d1 delete <ID-DE-LA-D1>
```
- El primero borra la app (con sus secretos); el segundo, **todas las hojas firmadas**.
- **Sin verificar contra la cuenta.** No uses `--force`.
- En los móviles: desinstala la app y borra los datos del sitio en el navegador.
- En local basta con borrar `.local/` y `.wrangler/`.

---

## 8. Archivos

| Archivo | Qué hace |
|---|---|
| `src/index.js` | Rutas, permisos y cabeceras (el Worker). |
| `src/sesion.js` | Claves (tiempo constante y PBKDF2) y cookie firmada. |
| `src/datos.js` | Consultas a D1 (subida idempotente, anular, borrar, agentes). |
| `src/html.js` | Esqueleto de la app y manifiesto con la marca. |
| `src/icono.js` | Icono PNG dibujado con los colores de la marca. |
| `src/csv.js` | CSV para Excel (copia exacta del de `castresana-web`). |
| `src/telegram.js` | Aviso con datos mínimos. |
| `schema.sql` | Tablas de D1 y los dos candados (no cambiar y no borrar sin constancia). Si probaste una versión anterior en local, borra `.local/` antes: no añade columnas a tablas que ya existen. |
| `public/static/nucleo/hoja.js` | La hoja: forma canónica, SHA-256 y validación (la usan el móvil y el Worker). |
| `public/static/nucleo/jpeg.js` | Comprueba que una firma o un logo son un JPEG de verdad (estructura completa, no solo la cabecera). |
| `public/static/nucleo/marca.js` | Marca de serie, validación, textos legales y contraste. |
| `public/static/nucleo/pdf-hoja.js` | Pasa la hoja al PDF de Cerebro con la marca, la nota de las firmas (visita, firma y registro, cada uno con su hora; «Registrada» solo si el servidor la ha confirmado) y un pie que siempre cabe entero. |
| `public/static/app/` | La app: `app.js` (pantallas y eventos), `vistas.js` (HTML escapado) y `cola.js` (cola sin conexión). |
| `public/static/cerebro/` | **Copias exactas** de Cerebro (`campos-piso.js`, `pdf.js`, `documentos.js`, textos legales, firma…). Se regeneran con `node herramientas/copiar-cerebro.mjs`; el test falla si se desincronizan. |
| `public/sw.js` | Service worker (la app abre sin cobertura). Al cambiar un archivo, sube `VERSION`. |
| `herramientas/probar-en-local.mjs` | Servidor local sin Cloudflare. |
| `herramientas/d1-local.mjs` | D1 de mentira sobre `node:sqlite` (para las pruebas). |

**Pruebas:** `node test/hojas-firmadas.test.mjs` (lógica y el Worker entero con D1 simulada) y `node test/hojas-firmadas.ui.test.mjs` (Chromium a 360 px con firma táctil y a 1366 px, y sin conexión).

### Probarla con el motor real de Cloudflare (opcional, sin publicar)
```
npx cf d1 migrations apply 00000000-0000-4000-8000-000000000000 --local --persist-to .wrangler/state --dir . --pattern schema.sql
npx cf dev
```
La clave del titular en local va en un archivo `.dev.vars` con la línea `PANEL_CLAVE=…` (ya está en `.gitignore`).
