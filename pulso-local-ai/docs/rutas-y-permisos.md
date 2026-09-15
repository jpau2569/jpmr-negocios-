# Rutas y permisos

## Públicas (sin registro)

| Ruta | Qué es | Quién entra |
| --- | --- | --- |
| `/` | Landing del producto | Cualquiera |
| `/b/[slug]` | Landing del negocio | Cualquiera, **si el negocio está activo o en demo vigente** |
| `/b/[slug]/inmuebles` | Catálogo con filtros | Íd. |
| `/b/[slug]/inmuebles/[propertySlug]` | Ficha del inmueble | Íd., y solo inmuebles publicados |
| `/b/[slug]/servicios` | Servicios por área | Íd. |
| `/b/[slug]/valoracion` | Embudo de valoración (6 pasos) | Íd. |
| `/b/[slug]/buscar-vivienda` | Demanda de comprador o inquilino | Íd. |
| `/b/[slug]/opinion` | Opinión privada + reseña voluntaria | Íd. |
| `/b/[slug]/contacto?tipo=…` | Formulario contextual | Íd. |
| `/q/[code]` | URL corta del QR: cuenta y redirige | Cualquiera |
| `/trial-expired/[slug]` | Demo finalizada | Cualquiera. **No enseña nada del contenido anterior** |
| `/login` | Acceso del equipo | Cualquiera |

Si la demo ha caducado, `/b/[slug]` redirige a `/trial-expired/[slug]`: las
vistas públicas no devuelven ni una fila.

## Panel del negocio (sesión + membresía)

Todas bajo `/dashboard`, protegidas por `requerirSesionPanel()` y por RLS.

| Ruta | Qué hace | Rol mínimo |
| --- | --- | --- |
| `/dashboard` | Resumen y métricas | viewer |
| `/dashboard/inmuebles` | Listado, publicar, duplicar, archivar | viewer para ver; agent para editar; admin para archivar |
| `/dashboard/inmuebles/nuevo` · `/[id]` | Alta y edición + fotos | agent |
| `/dashboard/leads` | CRM: estados, notas, asignación, CSV | viewer para ver; agent para gestionar |
| `/dashboard/visitas` | Agenda de solicitudes | agent |
| `/dashboard/feedback` | Opiniones y reputación | agent |
| `/dashboard/qr` | Crear QR, descargar PNG/SVG, carteles | agent; archivar, admin |
| `/dashboard/analitica` | Métricas por periodo | viewer |
| `/dashboard/configuracion` | Perfil, colores, textos, equipo | **admin** |

### Los cuatro roles

| Rol | Puede |
| --- | --- |
| `owner` | Todo en su negocio |
| `admin` | Todo salvo lo reservado al SaaS (estado de la suscripción, fechas de demo) |
| `agent` | Crear y editar contenido, gestionar leads y visitas. No borra ni cambia la configuración |
| `viewer` | Solo lectura |

En SQL: `puede_escribir()` = owner, admin o agent. `puede_administrar()` = owner
o admin. `es_miembro()` = cualquiera de los cuatro, **o** superadministrador.

## Panel del SaaS

| Ruta | Qué hace | Quién |
| --- | --- | --- |
| `/admin` | Crear demos, cambiar estados, ajustar días, métricas globales, notas comerciales | Solo `profiles.is_superadmin` |

El superadministrador ve **el número** de leads por negocio, no los contactos. No
necesita leer los datos de los clientes de sus clientes para saber si el producto
funciona.

## API

| Endpoint | Método | Protección |
| --- | --- | --- |
| `/api/publico/contacto` | POST | Cupo 6/10 min por IP + Zod + honeypot + negocio activo |
| `/api/publico/visita` | POST | Cupo 6/10 min |
| `/api/publico/valoracion` | POST | Cupo 5/10 min |
| `/api/publico/busqueda` | POST | Cupo 5/10 min |
| `/api/publico/opinion` | POST | Cupo 8/10 min |
| `/api/publico/evento` | POST | Cupo 120/10 min + lista blanca de tipos |
| `/api/publico/asistente` | POST | Cupo 20/10 min |
| `/api/panel/leads.csv` | GET | Sesión con acceso al negocio; RLS filtra las filas |
| `/api/cron/caducar-demos` | GET | `Authorization: Bearer $CRON_SECRET` |

El endpoint de eventos **no acepta** los tipos `*_submit`: esos los escribe el
servidor cuando la escritura ocurre de verdad. Si los aceptara, cualquiera podría
inflar las conversiones desde la consola del navegador.

## Middleware

`src/middleware.ts` solo refresca las cookies de sesión en `/dashboard`, `/admin`
y `/login`. **No decide quién entra**: eso es trabajo de `requerirSesionPanel()`
y de RLS. Un middleware es un control de frontend con otro nombre.
