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

## Lo que falta (siguiente fase)
- Tareas y analítica con pantalla propia (los datos ya se guardan).
- Asistente de redacción con Claude, reutilizando `ANTHROPIC_API_KEY`.
