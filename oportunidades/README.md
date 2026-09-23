# Oportunidades Únicas

Gestión de inmuebles y clientes de Asesoría Castresana: la cartera, la ficha de
cada inmueble, los clientes con lo que buscan, a quién le encaja cada cosa y el
portal privado donde el comprador dice qué quiere ver.

Reconstruida dentro de este monorepo (antes era una demo suelta que guardaba
todo en el navegador y se perdía al limpiar el historial).

---

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `index.html` + `app.js` + `estilo.css` | La aplicación del despacho (acceso, panel, inmuebles, clientes, actividad) |
| `portal.html` + `portal.js` | Lo que abre el cliente cuando le mandas su selección por WhatsApp |
| `esquema.sql` | Las tablas, los permisos y las funciones de Supabase |
| `../api/oportunidades.js` | El backend: lo único que habla con la base de datos |
| `../lib/oportunidades.js` | Catálogos, validación y el cálculo de coincidencias |
| `../test/oportunidades.test.mjs` | 67 comprobaciones (van en `npm test`) |

**Necesita servirse por HTTP** (usa módulos ES): en local, `npx serve` o
cualquier servidor estático; en producción, Vercel.

---

## Puesta en marcha

### 1. Crear el proyecto de Supabase

1. <https://supabase.com> → **New project**. Región: **Frankfurt (eu-central-1)**
   o cualquier europea — son datos de clientes españoles.
2. **SQL Editor** → pega `esquema.sql` entero → **Run**. Se puede repetir sin
   romper nada.
3. **Authentication → Providers → Email**: activado (viene de serie).

### 2. Las tres claves, en Vercel

**Settings → Environment Variables**:

| Variable | Dónde está | Secreta |
|---|---|---|
| `SUPABASE_URL` | Settings → API → Project URL | No |
| `SUPABASE_ANON_KEY` | Settings → API → `anon public` | No (es publicable por diseño) |
| `SUPABASE_SERVICE_KEY` | Settings → API → `service_role` | **Sí. Nunca en el navegador** |

La de servicio solo la usa el portal del comprador, que se identifica con un
token del enlace y no tiene sesión de Supabase. Todo lo demás va con el token
del usuario, para que manden las políticas RLS.

### 3. Tu usuario

1. Supabase → **Authentication → Users → Add user**: tu correo y una contraseña.
2. **SQL Editor**, cambiando el correo:

```sql
insert into public.ou_usuarios (id, nombre, email, rol)
select id, 'Pau', email, 'admin' from auth.users where email = 'tu@correo.com'
on conflict (id) do update set rol = 'admin', activo = true;
```

Sin esa fila puedes entrar pero no verás nada: el rol es lo que abre las
puertas. Repite con `'agente'` para el resto del equipo y `'lector'` para quien
solo deba mirar.

---

## Cómo está pensado

**El navegador nunca habla con Supabase.** Habla con `/api/oportunidades`, y ese
endpoint reenvía a Supabase con el token de quien ha iniciado sesión. Así no hay
claves en la página, todas las entradas pasan por la validación de
`lib/oportunidades.js` y las políticas RLS deciden qué ve cada uno.

**Lo privado no se publica.** La dirección exacta, las notas y el teléfono del
cliente viven en columnas que la vista pública (`ou_publico`) no incluye. El
portal del comprador devuelve el nombre de pila y nada más.

**Los números se explican.** Las coincidencias cliente ↔ inmueble dan una
puntuación de 0 a 100 **con sus motivos escritos** ("encaja en su presupuesto,
zona que busca; pero sin ascensor"). El porcentaje de exceso sobre presupuesto
está acotado: la versión anterior llegó a mostrar *"supera presupuesto 64018%"*
delante de un cliente.

**Nada se inventa.** Si un cliente no tiene presupuesto anotado, la ficha dice
"no tiene presupuesto anotado" en vez de suponer uno.

---

## Fotos

Se suben desde la ficha del inmueble, con el inmueble ya guardado. **El navegador
las reduce antes de mandarlas**: 1600 px de lado largo y JPEG al 82 %, así que
una foto de móvil de 4 MB viaja como 20-40 KB. Eso importa cuando subes fotos
desde la calle con cobertura regular.

La primera foto se pone de portada sola; se puede cambiar con un botón y, si
borras la portada, pasa a serlo la siguiente. Van a un bucket público de lectura
(una foto de un piso en venta está para enseñarse) pero solo el personal puede
subir o borrar.

El backend comprueba **la cabecera real del archivo**, no la extensión: un
archivo con nombre de foto que no lo sea se rechaza.

## Ficha pública compartible

Al marcar un inmueble como **público** (hace falta precio y estado disponible o
reservado) se genera su dirección: **`tudominio.com/p/<slug>`**. En la ficha del
inmueble aparece el botón **Compartir ficha**, con el enlace, el mensaje ya
redactado y el botón de WhatsApp.

Esa página **la monta el servidor** (`api/oportunidades-ficha.js`), no el
navegador. El motivo es concreto: WhatsApp lee las etiquetas Open Graph sin
ejecutar JavaScript, así que si la página se montara en el navegador, al pegar
el enlace saldría una tarjeta vacía. Montada en el servidor, sale con la foto,
el título y el precio.

La ficha lee de la vista `ou_publico`: la dirección exacta y los datos de
clientes no salen de ahí ni por error. Lleva `noindex` por defecto —es un
enlace para mandar a un cliente, no para que lo encuentre cualquiera en
Google—; si algún día quieres que se indexe la cartera, está señalado en el
código dónde cambiarlo.

El botón de contacto escribe al WhatsApp del despacho: **663 26 38 42**
(centralizado en `CONTACTO`, dentro de `lib/oportunidades.js`).

## Enviar pisos por WhatsApp

Tres caminos, los tres acaban en el mismo mensaje editable:

- **Desde el cliente** (el de todos los días): *Clientes → Enviar pisos*. Salen
  los inmuebles disponibles ordenados por lo que mejor le encajan, con los tres
  mejores que aún no tiene ya marcados; lo que ya le mandaste va al final con la
  etiqueta *ya enviado*.
- **Desde la cartera**: marca varios inmuebles y *Enviar por WhatsApp*.
- **Desde un inmueble**: *Ver coincidencias* → marca clientes → *Preparar envío*.

El mensaje sale en tres tonos (**Completo**, **Corto**, **De usted**), se puede
retocar a mano y el botón verde abre el WhatsApp **de ese cliente** con lo que
haya escrito en la caja. Los móviles de 9 cifras se mandan con el 34 delante
(`numeroWhatsapp()` en `lib/oportunidades.js`).

**Las respuestas del portal ya se ven.** Cuando un cliente marca en su portal
que un piso le interesa, quiere visitarlo, quiere parecidos o no le encaja, sale
en *Inicio → Respuestas de clientes* y en su ficha, con un botón *Contestar* que
abre su WhatsApp con la contestación ya escrita («¿qué día y a qué hora te viene
bien?»). Antes se guardaban en `ou_respuestas` pero no se enseñaban en ningún sitio.

Todo esto no cambia la base de datos: usa las tablas que ya había.

## Alta rápida, seguimientos y tarjeta visual

**Alta rápida** (*Añadir inmueble*, arriba del todo): se escribe o se **dicta**
(botón 🎤, reconocimiento de voz del navegador en español) lo que se sabe del
piso y la ficha se rellena sola: título, operación, precio, ciudad, zona,
habitaciones, baños, metros, características y el anuncio. Con
`ANTHROPIC_API_KEY` lo redacta Claude (como llamada a la herramienta
`rellenar_ficha`, para que el JSON llegue siempre entero; si no, reintenta una vez); sin ella, el extractor local de
`lib/oportunidades-extras.js`. **Lo que no está en las notas no entra**: los
números de la IA se comprueban contra el texto y una característica que no se
menciona se descarta. Dice qué falta para vender más. En un inmueble ya
guardado solo rellena lo vacío y el anuncio nuevo se ofrece, no se impone.

**Seguimientos** (*Inicio → Seguimientos de hoy*): clientes a los que les
mandaste pisos hace 3 días o más y no han contestado en su portal, con el
recordatorio de WhatsApp escrito según los días (4: «¿pudiste echarles un
vistazo?», 6: «¿alguno para verlo?», 10+: «¿sigues buscando?»). *Recordar* o
*Hecho* ponen su fecha de contacto a hoy (acción `cliente.contactado`) y vuelve
a salir si pasan otros 3 días sin respuesta.

**Tarjeta para WhatsApp** (botón en la ficha del inmueble): imagen con la foto
de portada, precio, título, zona, datos y la marca, en **publicación 4:5** o
**estado 9:16**. *Compartir por WhatsApp* abre el menú de compartir del móvil
con la imagen y el enlace de la ficha; en ordenador se descarga el PNG. La
dibuja el navegador (canvas); las fotos del almacén de Supabase se pueden usar
porque se sirven con CORS abierto.

## Referencia = calle y número

La **referencia** de cada inmueble es su calle y número («Uría 12, 3ºB»): es
como Pau identifica el piso, y va en todos los WhatsApp (📍 en los estilos
completo y corto, «Referencia:» en el de usted), en *Compartir ficha* y en el
texto de la tarjeta. Si se escribe la dirección exacta y la referencia está
vacía, se propone sola (lo anterior a la primera coma que lleve número). Los
códigos automáticos antiguos (`OU-2026-0001`) no se mandan. Como la referencia
es única, dos pisos del mismo portal necesitan planta o letra: si no, avisa.
Ojo: la referencia sí la ven los clientes (va en el mensaje y en la ficha
pública); la dirección exacta completa sigue sin publicarse.

## 18 fotos y un vídeo por piso

Hasta **18 fotos** por inmueble (`MAX_FOTOS`); si eliges más de las que caben,
sube las que quepan y lo avisa. Y **un vídeo propio** que se sube desde el móvil
(MP4, MOV de iPhone o WebM, **máximo 50 MB**, el límite por archivo del plan
gratuito de Supabase: un minuto en 1080p cabe, en 4K no). El vídeo no pasa por
Vercel —su límite es 4,5 MB por petición—: `video.preparar` comprueba quién es
y qué sube y devuelve una **dirección firmada** para subirlo directo al bucket
`videos` de Supabase (se crea solo la primera vez, con la clave de servicio);
`video.guardar` comprueba que ha llegado y lo pone en `video_url`. Al cambiarlo
o quitarlo, el anterior se borra del almacén. Sigue valiendo pegar un enlace de
YouTube o Vimeo.

## Logo 3D e instalar en el móvil

La marca es una **casa dorada con una gema tallada dentro** (el inmueble y la
oportunidad única), hecha con geometría propia en Three.js: `logo3d.js`. En la
pantalla de acceso se ve viva —flota, la gema gira y se inclina hacia el dedo—
y se apaga al entrar para no gastar batería. Sin WebGL se queda la sigla «OU».

Los iconos de `iconos/` salen de ese mismo logo:
`node oportunidades/herramientas/generar-iconos.mjs` (Playwright, sin red).
Con `manifest.webmanifest` la app se instala: en Android, *Instalar app*; en
iPhone, Safari → Compartir → *Añadir a pantalla de inicio*.

## Lo que falta (siguiente fase)
- Tareas y analítica con pantalla propia (los datos ya se guardan).
- Asistente de redacción con Claude, reutilizando `ANTHROPIC_API_KEY`.
