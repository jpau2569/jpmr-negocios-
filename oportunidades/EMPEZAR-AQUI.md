# Poner en marcha Oportunidades Únicas

Para Pau. Quince minutos, de principio a fin. No hace falta saber programar:
es copiar, pegar y comprobar.

Si algo no sale, en la pantalla de acceso hay un enlace —**«¿No consigues
entrar? Comprobar la instalación»**— que te dice exactamente qué falta.

---

## 1. Crear la base de datos (5 minutos)

1. Entra en <https://supabase.com> y pulsa **New project**.
2. Nombre: `oportunidades-unicas`. Contraseña de la base de datos: la que te
   proponga, y **guárdala en tu gestor de contraseñas**.
3. Región: **Frankfurt (eu-central-1)** o cualquier europea. Son datos de
   clientes españoles y tienen que quedarse en Europa.
4. Espera a que termine de crearse (un par de minutos).

## 2. Crear las tablas (2 minutos)

1. En el menú de la izquierda: **SQL Editor** → **New query**.
2. Abre el archivo `oportunidades/esquema.sql` de tu repositorio, **cópialo
   entero** y pégalo ahí.
3. Pulsa **Run**.

Verás *Success. No rows returned*. Eso es correcto: acaba de crear las tablas,
los permisos, el almacén de fotos y las funciones del portal.

> Puedes volver a ejecutarlo las veces que quieras: está escrito para no
> romper nada si ya existe. De hecho, **cada vez que yo añada algo al esquema,
> vuelve a pegarlo entero**.

## 3. Copiar las tres claves a Vercel (3 minutos)

En Supabase: **Settings → API**. Ahí están los tres valores.

En Vercel: tu proyecto → **Settings → Environment Variables** → añade uno a uno:

| Nombre exacto | Qué copiar de Supabase | ¿Secreta? |
|---|---|---|
| `SUPABASE_URL` | *Project URL* | No |
| `SUPABASE_ANON_KEY` | la clave **anon public** | No, va dentro de la web por diseño |
| `SUPABASE_SERVICE_KEY` | la clave **service_role** | **Sí. No la pegues en ningún chat ni en el código** |

Después, en Vercel: **Deployments → … → Redeploy**. Las variables solo entran
en un despliegue nuevo.

## 4. Crear tu usuario (3 minutos)

1. Supabase → **Authentication → Users → Add user**.
2. Tu correo y una contraseña buena. Marca *Auto Confirm User*.
3. Vuelve al **SQL Editor** y ejecuta esto, cambiando el correo por el tuyo:

```sql
insert into public.ou_usuarios (id, nombre, email, rol)
select id, 'Pau', email, 'admin' from auth.users where email = 'tu@correo.com'
on conflict (id) do update set rol = 'admin', activo = true;
```

⚠️ **Este paso no te lo puedes saltar.** Sin esa fila entras, pero no ves
nada: el rol es lo que abre las puertas. Es el fallo más habitual, y el
comprobador de la pantalla de acceso te lo dirá con todas las letras.

Para Marta, lo mismo cambiando `'admin'` por `'agente'`. Para alguien que solo
deba mirar sin tocar, `'lector'`.

## 5. Comprobar (1 minuto)

Abre `tudominio.com/oportunidades/` y, **antes de entrar**, pulsa
**«¿No consigues entrar? Comprobar la instalación»**.

Tiene que salir **todo con ✓**. Si algo sale con ✕, ahí mismo pone qué hacer.

Después entra con tu correo y tu contraseña.

---

## La primera vuelta completa (para ver que funciona de verdad)

Haz esto una vez con un piso real. Son cinco minutos y te deja tranquilo:

1. **Añadir inmueble** → título, ciudad, precio → *Guardar*.
2. Ábrelo otra vez y **sube dos o tres fotos**. Se reducen solas; la primera se
   pone de portada.
3. Pega el enlace de un **vídeo** de YouTube si lo tienes.
4. Cambia el estado a **Disponible**, marca **Publicar la ficha** y guarda.
5. Pulsa **Compartir ficha** → *Abrir la ficha*. Debe verse con las fotos y el
   vídeo.
6. **Mándate a ti mismo el enlace por WhatsApp.** Tiene que salir la tarjeta con
   la foto y el precio. Si sale, está todo bien.
7. **Añade un cliente** con su teléfono y lo que busca.
8. En **Inmuebles**, marca ese piso (la casilla de la esquina) y pulsa
   **Enviar por WhatsApp** → elige el cliente → *Preparar mensaje* → *Abrir
   WhatsApp*.
9. Abre el enlace del portal que le has mandado y pulsa **Quiero visitarlo**:
   en la app te aparecerá la tarea de llamarle.

Si los nueve pasos salen, el sistema está funcionando entero.

---

## Preguntas que te van a surgir

**¿Cuánto cuesta Supabase?** El plan gratuito da 500 MB de base de datos y 1 GB
de fotos. Para la cartera de un despacho es de sobra durante mucho tiempo. No
pide tarjeta.

**¿Y si borro algo sin querer?** Los clientes no se borran: se *anonimizan*
(está previsto en el esquema por el RGPD). Los inmuebles sí se pueden archivar
en vez de borrar, cambiando el estado a *Archivado*.

**¿Puedo entrar desde el móvil?** Sí. La app está pensada para usarse desde el
teléfono en una visita: subir fotos ahí mismo y mandar el piso por WhatsApp
antes de salir del portal.

**¿Las fichas públicas salen en Google?** No, llevan `noindex` a propósito: son
enlaces para mandar a un cliente concreto. Si algún día quieres que la cartera
se indexe, dímelo y se cambia una línea.

**¿Dónde están mis fotos?** En el almacén de tu proyecto de Supabase, en un
bucket llamado `inmuebles`. Son tuyas y te las puedes descargar cuando quieras.

---

## Si algo falla

1. Pulsa **Comprobar la instalación** en la pantalla de acceso. Resuelve el
   90 % de los casos.
2. Si dice que todo está bien y aun así no entras: revisa que el correo sea
   exactamente el que diste de alta en Authentication.
3. Si la ficha pública da error: comprueba que el inmueble está en estado
   *Disponible* y con la casilla de **Publicar** marcada.
4. Si una foto no sube: mira que sea JPG, PNG o WebP. El sistema comprueba el
   archivo por dentro, no por el nombre.

---

*Escrito por Clara para Pau · Asesoría Castresana · Gestión Inmobiliaria*
