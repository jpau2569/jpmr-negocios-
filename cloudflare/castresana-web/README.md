# castresana-web: «Valora tu piso» y reservas de visitas en Cloudflare

Un único **Worker de Cloudflare** con base de datos **D1** para Asesoría Castresana. Son los proyectos 1 y 2 de la skill `skills/cloudflare-proyectos/SKILL.md`.

| Dirección | Qué es |
|---|---|
| `/valora` | **«Valora tu piso»**: el propietario deja nombre, teléfono, correo (opcional), si quiere vender o alquilar, tipo, zona, m², habitaciones y un comentario. **No se da ningún precio**: la página dice que Pau le llamará para valorarlo. |
| `/visitas` | **Reservas de visitas sin choques**: el cliente elige el inmueble, el día y una hora libre, y deja su nombre y su teléfono. Dos personas no pueden coger la misma hora, ni aunque reserven a la vez. |
| `/panel` | **Panel privado de Pau**, con clave: valoraciones (de la más nueva a la más vieja), visitas por día, cancelar una visita, bloquear huecos, lista de inmuebles y descarga en Excel (CSV). |
| `/privacidad` | Información de privacidad. Es un **BORRADOR** con huecos [PENDIENTE] (CIF, dirección, plazo y correo para ejercer los derechos). |

Telegram avisa a Pau de cada valoración y de cada visita (es opcional), **con datos mínimos**: nombre de pila, qué quiere, tipo y zona (o inmueble, día y hora). Nunca el correo ni el comentario; el teléfono, solo si lo pides (ver `TELEGRAM_CON_TELEFONO`). Lo demás está en el panel. **Al cliente no se le envía nada automático.** En el panel, cada ficha tiene un botón **WhatsApp** que abre `wa.me` con el mensaje ya escrito. Pau lo revisa y lo envía a mano.

> **Regla de oro (puesta por Pau):** cada paso que toca Cloudflare se hace **solo con su permiso** y **solo con lo incluido en su plan de 5 USD/mes**. Nada de compras, cambios de plan ni dominios de pago. Si algo pudiera costar más, se para y se le avisa. Los pasos marcados con 🔐 tocan Cloudflare.

---

## 1. Probarlo en tu PC sin Cloudflare (2 minutos, sin cuenta)

Solo necesitas Node.js 22.18 o superior. Desde la carpeta del repositorio:

```
node cloudflare/castresana-web/herramientas/probar-en-local.mjs
```

Abre **http://localhost:8788**. La clave del panel de prueba sale escrita en la pantalla: es **aleatoria y nueva en cada arranque** (el repositorio es público, así que no hay ninguna clave fija). Si quieres una tuya, arranca con la variable `PANEL_CLAVE`. Para que haya visitas, entra en **Panel → Inmuebles** y carga alguno, por ejemplo `PIS0190; Piso en Uría; Centro`. Los datos de prueba se guardan en `cloudflare/castresana-web/.local/`, que no se sube a git. Para que se borren al cerrar, añade `--memoria`. Se para con **Ctrl+C**.

Esta prueba usa **el mismo código** que irá a Cloudflare, con SQLite haciendo de D1. Así es como se prueba con `npm test`.

---

## 2. Publicarlo en Cloudflare (en tu PC, paso a paso)

### Por qué se usa `cf` y estos archivos de configuración
- Se usa el CLI oficial **`cf`**, versión `1.0.0-beta.16`. Está en **beta**, así que los comandos pueden cambiar.
- He comprobado con esa versión que `cf build` y `cf deploy` **delegan en Wrangler** y **exigen `cloudflare.config.ts`**. Con solo `wrangler.jsonc`, falla con «cloudflare.config.ts is required».
- Por eso el proyecto trae `cloudflare.config.ts` (Worker, D1 y variables) y `wrangler.config.ts` (carpeta de los archivos estáticos), con la misma forma que genera `cf migrate`.
- `package.json` fija las dos herramientas que hacen falta: `cf` y `wrangler`. La segunda la usa `cf` por dentro para construir.

Lo que **sí está comprobado** aquí, en local:
- `cf deploy --dry-run` construye y enumera los enlaces (DB, ASSETS y variables) sin subir nada.
- `cf dev` arranca el Worker en el motor real de Cloudflare (workerd) con una D1 local.
- `cf d1 migrations apply … --local` aplica el esquema.

Lo que **no he podido comprobar**, porque no había conexión con Cloudflare: todo lo que va contra tu cuenta real. Esos comandos están marcados como **«sin verificar contra la cuenta»**. Si alguno da un error, cópialo tal cual y pregunta antes de seguir.

### Paso 0: Node.js 22.18 o superior
```
node --version
```
Si sale un número menor, instala la versión LTS desde https://nodejs.org.

### Paso 1: instalar las herramientas del proyecto (no toca Cloudflare)
```
cd cloudflare/castresana-web
npm install
```
Instala `cf` y `wrangler` **dentro de esta carpeta**, en `node_modules`, que no se sube a git. A partir de aquí, los comandos llevan `npx` delante para usar esas versiones.

### Paso 2 🔐: entrar en tu cuenta (pide permiso / solo lo incluido en los 5 USD)
```
npx cf auth login
npx cf auth whoami
```
- Se abre el navegador para que **apruebes el acceso**. **Ninguna clave pasa por el chat.**
- En el código de la beta 16, `cf auth login` deja fuera por defecto los permisos de facturación (`billing:read` y `billing:write`).

### Paso 3: comprobar que construye (ensayo, no sube nada)
```
npx cf deploy --dry-run
```
Debe terminar con «--dry-run: exiting now» y la lista de enlaces: DB, ASSETS, HORARIO…

### Paso 4 🔐: crear la base de datos D1 (pide permiso / solo lo incluido en los 5 USD)
```
npx cf d1 create --name castresana-web-db --dry-run
npx cf d1 create --name castresana-web-db
```
- Primero el ensayo y, si lo apruebas, el de verdad. **Sin verificar contra la cuenta.**
- La respuesta trae un **identificador (UUID)**. Cópialo en `cloudflare.config.ts`, en `id:`, en lugar de `00000000-0000-4000-8000-000000000000`.
- Si se pierde: `npx cf d1 list`.

### Paso 5 🔐: crear las tablas (pide permiso / solo lo incluido en los 5 USD)
```
npx cf d1 migrations apply <ID-DE-LA-D1> --dir . --pattern schema.sql --dry-run
npx cf d1 migrations apply <ID-DE-LA-D1> --dir . --pattern schema.sql
```
- Hay que poner el **ID**: el nombre no vale, lo he comprobado.
- Con `--local` funciona aquí. Contra la cuenta, **sin verificar**.
- El esquema es idempotente: repetirlo no borra nada.

### Paso 6 🔐: publicar (pide permiso / solo lo incluido en los 5 USD)
```
npx cf deploy --dry-run --no-provision
npx cf deploy --no-provision
```
- Te dará una dirección del tipo `https://castresana-web.<tu-subdominio>.workers.dev`. **Sin verificar contra la cuenta.**
- Si tu cuenta aún no tiene subdominio `workers.dev`, Cloudflare puede pedir que lo elijas una vez. Es gratuito, pero mira lo que te enseña antes de aceptar.
- **`--no-provision` siempre.** Sin él, `cf deploy` crea por su cuenta los recursos que falten (en la ayuda de la beta 16: `--provision`, «[boolean] [default: true]»). Con él, si falta algo, falla y no crea nada que no hayas aprobado. He comprobado que el ensayo lo acepta y que una opción mal escrita da error («Unknown argument»). `npm run publicar` ya lo lleva.
- Si falla porque falta la D1, vuelve al paso 4: no quites `--no-provision`.

### Paso 7 🔐: secretos (pide permiso / solo lo incluido en los 5 USD)
Las claves **nunca** van en el código, en el repositorio ni en el chat.

| Secreto | ¿Obligatorio? | Para qué |
|---|---|---|
| `PANEL_CLAVE` | **Sí** | Clave del panel. **Mínimo 12 caracteres**: mejor una frase de 3 o 4 palabras. Sin ella, el panel dice «Panel apagado», nunca se abre sin clave. |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | No | Avisos a tu Telegram (los mismos que usa CasteBot). |
| `TURNSTILE_SECRET` | No | Anti-robots. Va junto a la variable pública `TURNSTILE_SITEKEY`, en `cloudflare.config.ts`. |
| `IP_SECRETO` | No | Clave para el código de las IP (mínimo 16 caracteres). Sin ella se deriva de `PANEL_CLAVE`; ponla si quieres que cambiar la clave del panel no ponga a cero los límites por IP. |

**Forma recomendada, en el panel de Cloudflare:** Workers → `castresana-web` → Settings → Variables and Secrets → *Add* → tipo **Secret**. Así ves qué queda puesto y no se guarda en ningún archivo. Los nombres de los menús pueden variar un poco.

**Con el CLI:**
- Crea en esta carpeta un archivo `.secretos.env`. **Ya está en `.gitignore`.**
- Escribe una línea por secreto, con su **nombre** y su valor: `PANEL_CLAVE=…`, `TELEGRAM_BOT_TOKEN=…`, `TELEGRAM_CHAT_ID=…`.
- Ejecuta:
  ```
  npx cf deploy --no-provision --secrets-file .secretos.env
  ```
- En el ensayo (`--dry-run`) los valores salen como «(hidden)». Contra la cuenta, **sin verificar**. Tampoco he podido comprobar si en las publicaciones siguientes sin el archivo se conservan, así que tras cada publicación entra en `/panel` para comprobarlo (ver paso 8).
- **Borra el archivo** cuando acabes.

> No uses `cf workers secrets update NOMBRE --text VALOR`: el valor quedaría guardado en el historial de la terminal.

### Paso 8: comprobar que va
- Abre `/valora` desde el móvil, envía una prueba con tus datos y entra en `/panel`.
- **El propio panel avisa** si falta algo: Telegram o Turnstile apagados, o un horario mal escrito. Si sale «Panel apagado», falta `PANEL_CLAVE` o es demasiado corta.
- Carga los inmuebles en **Panel → Inmuebles**. Vale una línea por inmueble (`PIS0190; Piso en Uría; Centro; https://…`) o un JSON. Después prueba `/visitas`.

---

## 3. Configuración (variables de `cloudflare.config.ts`)

Se cambian en `cloudflare.config.ts` y se vuelve a publicar 🔐.

| Variable | Por defecto | Qué es |
|---|---|---|
| `HORARIO` | `L-V 10:00-14:00 16:30-19:30; S 10:00-13:00` | Días: L M X J V S D. Admite rangos (`L-V`) y listas (`L,X`); los tramos van separados por espacios y los grupos por `;`. Hora de Madrid. |
| `BLOQUE_MINUTOS` | `30` | Duración de cada visita. |
| `ANTELACION_HORAS` | `2` | No se puede reservar con menos antelación. |
| `DIAS_VISTA` | `30` | Como mucho, hasta hoy + 30 días (el día entero). |
| `FESTIVOS` | vacío | Fechas `AAAA-MM-DD` separadas por comas. Para algo puntual es más cómodo **Panel → Bloqueos**, que no necesita volver a publicar. |
| `TURNSTILE_SITEKEY` | vacío | Clave pública de Turnstile. Sin ella (o sin el secreto), Turnstile no se usa. |
| `TELEFONO_CONTACTO` | vacío | Teléfono del despacho (9 cifras) para «si no encuentras hueco, llámanos». Vacío = no se enseña. |
| `TELEGRAM_CON_TELEFONO` | `no` | Con `si`, el aviso de Telegram lleva también el teléfono del cliente. Correo y comentario no van nunca. |

- **Zona horaria:** todo va en hora de **Europe/Madrid**, también el día del cambio de hora. Está probado con el 29 de marzo y el 25 de octubre de 2026.
- **Un error al escribir no tumba la web:** se usa el valor por defecto y el panel enseña el aviso.

**Turnstile (opcional, gratuito):**
1. Crea un *widget* en el panel de Cloudflare 🔐 con la dirección del Worker.
2. Pon la clave pública en `TURNSTILE_SITEKEY` y la secreta como secreto `TURNSTILE_SECRET`.
   - El Worker comprueba también que el reto se resolvió **en esta web** (el `hostname` que devuelve Cloudflare tiene que ser el de la petición). Si un día le pones otro dominio, añádelo al widget.
3. Sin las dos, los formularios funcionan igual, con el campo trampa anti-robots y el límite por IP.

---

## 4. Cómo protege los datos
- **Sin choques:** la tabla `visitas` tiene un índice **UNIQUE parcial** sobre `fecha_hora` (solo para las activas). Aunque dos personas pulsen a la vez, la base de datos solo deja entrar una. La otra ve «Esa hora acaba de reservarla otra persona». Al cancelar, el hueco se libera; la visita no se borra, queda como «cancelada» en el historial. Probado con 10 reservas simultáneas en workerd: 1 entra y 9 reciben 409.
- **Límites:**
  - 5 valoraciones y 5 reservas por hora y por IP.
  - En las reservas cuentan las que se guardan y los envíos con datos mal (lo típico de un robot). **No cuentan las que chocan** con otra reserva (409): quien llega tarde a una hora no tiene la culpa.
  - Panel: 5 claves fallidas por IP en 15 minutos y 200 en total entre todas las IP. Si se superan, aunque luego se ponga la buena, hay que esperar (ver «Si el panel queda bloqueado»). Entrar con la clave buena no cuenta como fallo.
  - Los intentos se **suman antes de comparar** la clave (una sola orden atómica en D1). Así, aunque lleguen 40 a la vez desde la misma IP, como mucho se comparan 5.
  - La IP no se guarda tal cual: se guarda un código que no permite saber cuál era sin la clave secreta (HMAC-SHA256 con `IP_SECRETO` o, si no lo hay, con una clave derivada de `PANEL_CLAVE`).
- **Panel:**
  - La clave solo vive en el secreto `PANEL_CLAVE` y se compara en tiempo constante.
  - La sesión es una cookie `__Host-panel` firmada (HMAC-SHA256), `HttpOnly; Secure; SameSite=Strict`, que dura 12 h. Si cambias la clave, se cierran todas las sesiones.
  - Los envíos solo se aceptan desde la propia web (`Sec-Fetch-Site` / `Origin`).
- **HTML:**
  - Todo lo que escribe el cliente se escapa.
  - La CSP no permite scripts ni estilos en línea, y sí `challenges.cloudflare.com` cuando Turnstile está activo.
  - Además: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`, HSTS y `noindex` en el panel.
- **SQL** siempre con parámetros (`?`).
- **CSV:** usa «;» y BOM para que Excel lea bien las tildes. Las celdas que empiezan por `= + - @` se neutralizan para evitar fórmulas.

## 5. Archivos

| Archivo | Qué hace |
|---|---|
| `src/index.js` | Rutas, permisos y cabeceras (el manejador del Worker). |
| `src/horario.js` | Horario, huecos libres, antelación y zona horaria (puro). |
| `src/validacion.js` | Validación de formularios, teléfono español y lista de inmuebles (puro). |
| `src/csv.js` | CSV para Excel (puro). |
| `src/sesion.js` | Comparación segura y cookie firmada (puro, Web Crypto). |
| `src/mensajes.js` | Enlaces `wa.me` y `tel:` con el texto preparado (puro). |
| `src/telegram.js` | Avisos a Telegram en texto plano. |
| `src/html.js` | Plantillas HTML, todo escapado. |
| `src/datos.js` | Consultas a D1. |
| `schema.sql` | Tablas de D1. |
| `public/static/` | Logo, `estilos.css` y `app.js` (sin nada en línea). |
| `herramientas/probar-en-local.mjs` | Servidor local sin Cloudflare (clave del panel aleatoria si no pones `PANEL_CLAVE`). |
| `herramientas/d1-local.mjs` | D1 de mentira sobre `node:sqlite` (para las pruebas). |

**Pruebas:**
- `node test/cloudflare-web.test.mjs`: lógica pura y el Worker entero con D1 simulada.
- `node test/cloudflare-web.ui.test.mjs`: Chromium a 360 px y a 1366 px.

### Probarlo con el motor real de Cloudflare (opcional, sin publicar)
```
npx cf d1 migrations apply 00000000-0000-4000-8000-000000000000 --local --persist-to .wrangler/state --dir . --pattern schema.sql
npx cf dev
```
- Hace falta el `--persist-to .wrangler/state`: sin él, `cf` guarda la base local en otro sitio (`~/.config/cloudflare/state`) y `cf dev` no la ve. Lo he comprobado.
- La clave del panel en local va en un archivo `.dev.vars` con la línea `PANEL_CLAVE=…`. Ya está en `.gitignore`.

---

## 6. Borrarlo todo si un día no lo quieres 🔐 (pide permiso / solo lo incluido en los 5 USD)

Antes de borrar, descarga los CSV desde el panel si quieres guardar los datos. **Borrar es definitivo.**

```
npx cf workers delete castresana-web --dry-run
npx cf workers delete castresana-web
npx cf d1 delete <ID-DE-LA-D1> --dry-run
npx cf d1 delete <ID-DE-LA-D1>
```
- `workers delete` borra el Worker con sus versiones, sus variables y sus secretos.
- `d1 delete` borra la base de datos con **todas las valoraciones y visitas**.
- **Sin verificar contra la cuenta.**
- No uses `--force`, que se salta la confirmación.
- En local basta con borrar `.local/` y `.wrangler/`.

---

## 7. Link temporal para enseñar una demo (proyecto 6)

Sirve para que un cliente vea en su móvil algo que tienes en tu PC, sin publicarlo. Usa el **Quick Tunnel** de Cloudflare:
- **Sin cuenta ni dominio.** No usa tu plan.
- Te da una dirección aleatoria `https://xxxx.trycloudflare.com`.
- **Se apaga al cerrar la ventana.**
- **Es solo para pruebas.** Cloudflare no garantiza que esté siempre disponible, tiene un tope de 200 peticiones a la vez y no admite Server-Sent Events.
- **Cualquiera con el enlace puede entrar**, y se han visto direcciones de trycloudflare indexadas en Google. Ciérralo en cuanto acabes y no enseñes nada privado.

**Instalar `cloudflared` (una vez):**
- Página oficial de descargas: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
- Instalador de Windows (64 bits): https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi
- En Windows no se actualiza solo: de vez en cuando, vuelve a instalar la última versión.

**Usarlo:**
1. Doble clic en `cloudflare/link-temporal.bat`.
2. Escribe el puerto de lo que quieres enseñar. Solo admite cifras (de 1 a 65535, sin cero delante); cualquier otra cosa la rechaza sin ejecutar nada.
3. Copia la dirección `https://….trycloudflare.com` que sale y mándasela al cliente.
4. Cierra la ventana para apagarlo.

El comando que lanza es:
```
cloudflared tunnel --url http://localhost:PUERTO
```

**Ejemplos:**
- **Una demo del escaparate:**
  1. Desde la carpeta del repositorio, sirve la demo con `python -m http.server 8080` (o `npx serve -l 8080`).
  2. Abre el link temporal con el puerto **8080**.
  3. Manda al cliente `https://….trycloudflare.com/escaparate3d-pro/demos.html`.
- **Este Worker en local:** `node cloudflare/castresana-web/herramientas/probar-en-local.mjs` y puerto **8788**. Detrás del túnel, cada visitante cuenta con su IP real para los límites (el servidor local respeta la `cf-connecting-ip` que pone Cloudflare). La clave del panel es la aleatoria que sale en pantalla: no la compartas.
- **Fotos Fáciles** (puerto **4321**):
  1. Comparte solo **enlaces de álbum** (`/a/…`), que llevan su propio token de solo lectura.
  2. Fotos Fáciles **ya no trata como «del propio ordenador» lo que llega por un túnel**: antes, todo lo que entraba por `localhost` pasaba sin PIN, y con un túnel eso abría el programa entero a quien tuviera el enlace.
  3. Aun así, pantalla principal y PIN: **no dejes el túnel abierto más de lo necesario**.

---

## 8. Si un cliente pide que borres sus datos (derecho de supresión)

Cualquier persona puede pedir que borres sus datos. Hazlo cuanto antes (el RGPD da como mucho un mes).

1. Entra en `/panel`.
2. Busca su ficha:
   - Si pidió una valoración: pestaña **Valoraciones**.
   - Si reservó una visita: pestaña **Visitas** (cambia «Desde el día» si es antigua; las fechas pasadas también se ven).
3. Pulsa **Borrar datos** y confirma. Se borra **del todo** de la base de datos: no queda ni como cancelada ni en el CSV. Si la visita estaba activa, el hueco queda libre. No se puede deshacer.
4. **Borra a mano los avisos que ya estén en Telegram** de esa persona (mantén pulsado el mensaje → Eliminar, también para el bot). El Worker no puede borrarlos. Llevan poco, pero llevan su nombre de pila y la zona o la visita (y el teléfono si activaste `TELEGRAM_CON_TELEFONO`).
5. Borra también los **CSV** que hayas descargado y los **WhatsApp** o notas que guardes de ella.
6. Contéstale diciendo que ya está hecho.

> Ojo: «Cancelar visita» **no** borra los datos, solo libera el hueco y la deja en el historial. Para borrar, usa **Borrar datos**.

---

## 9. Si el panel queda bloqueado

Si al entrar sale «Demasiados intentos fallidos. Espera 15 minutos y vuelve a probar»:

1. **Espera 15 minutos** y vuelve a probar con la clave buena. Es lo normal: se ha equivocado alguien (o tú) 5 veces desde la misma conexión.
2. Si **sigue pasando** aunque tú no te hayas equivocado, alguien está probando claves desde muchas conexiones a la vez (hacen falta al menos 40 para gastar el tope de 200). Tus datos siguen a salvo: con una clave de 12 caracteres o más, 200 intentos cada 15 minutos no sirven para adivinarla. Entonces:
   - Cambia `PANEL_CLAVE` por una nueva y más larga (paso 7). Cerrará también las sesiones abiertas.
   - 🔐 (pide permiso / solo lo incluido en los 5 USD) Si necesitas entrar ya, puedes poner a cero los contadores del panel. Primero el ensayo y, si lo apruebas, el de verdad:
     ```
     npx cf d1 query <ID-DE-LA-D1> --sql "DELETE FROM limites WHERE clave LIKE 'login:%'" --dry-run
     npx cf d1 query <ID-DE-LA-D1> --sql "DELETE FROM limites WHERE clave LIKE 'login:%'"
     ```
     El ensayo lo he comprobado (enseña la petición sin mandarla). Contra la cuenta, **sin verificar**. En local no funciona («This command has no local equivalent»).
   - Avisa a Clara para mirar si conviene una regla de Cloudflare sobre `/panel/entrar`, **antes** de activar nada, por si saliera del plan.
