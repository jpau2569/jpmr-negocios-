# PULSO LOCAL AI

> **El QR que convierte visitas en clientes que vuelven.**
>
> No te vendo una web inmobiliaria. Te instalo un punto de captación y seguimiento
> en cada cartel, vivienda, escaparate, dossier y visita.

SaaS multi-tenant para negocio local. La primera plantilla es **«Inmobiliaria y
Asesoría Local»** y la demo de referencia es **Asesoría Castresana** (Oviedo):
gestión inmobiliaria, administración de fincas y asesoría fiscal, laboral y
jurídica.

---

## Qué hace

| Para el cliente que escanea | Para el negocio |
| --- | --- |
| Landing móvil con llamada, WhatsApp y cómo llegar | Panel con escaneos, leads, visitas y conversión por QR |
| Catálogo y fichas de inmuebles | Alta, edición, fotos, publicación y duplicado de inmuebles |
| Valoración en 6 pasos, revisada por una persona | CRM ligero: estados, notas, asignación y exportación a CSV |
| Buscador de vivienda («avísame cuando entre algo») | Agenda de visitas con estados |
| Opinión privada + acceso voluntario a Google | Opiniones, avisos de notas bajas y enlace oficial de reseñas |
| Asistente que solo responde lo aprobado | Generador de QR con cartel imprimible A4/A5/escaparate/tarjeta |

Y para quien vende el producto: panel `/admin` con demos de 7 días que **se apagan
solas**, métricas globales y conversión de demo a cliente.

---

## Requisitos

- **Node.js 20 o superior** (probado con 22).
- Una cuenta de **Supabase** (plan gratuito suficiente para la demo).
- Opcional para las migraciones por línea de comandos: `psql`.

## Instalación local

```bash
git clone <este repositorio>
cd pulso-local-ai
npm install
cp .env.example .env.local     # y rellénalo (ver más abajo)
npm run db:reset               # migraciones + seed de Asesoría Castresana
npm run dev                    # http://localhost:3000
```

Rutas para ver enseguida que funciona:

- `http://localhost:3000` — landing del producto.
- `http://localhost:3000/b/asesoria-castresana` — la demo.
- `http://localhost:3000/dashboard` — panel (pide cuenta; ver «Crear tu usuario»).

## Variables de entorno

| Variable | Para qué | ¿Secreta? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (la limita RLS) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | **Salta RLS.** Solo en rutas de servidor | **Sí** |
| `SUPABASE_DB_URL` | Conexión directa para migraciones y seed | **Sí** |
| `NEXT_PUBLIC_URL_APP` | URL pública; es la que se imprime en los QR | No |
| `SAL_CONSENTIMIENTO` | Sal de los hashes de IP (consentimiento y cupo) | **Sí** |
| `WHATSAPP_SAAS` | WhatsApp para «Reactivar mi espacio» | No |
| `CRON_SECRET` | Protege el cron que caduca las demos | **Sí** |
| `NEXT_PUBLIC_DOMINIOS_IMAGEN` | Dominios permitidos en `next/image` | No |

Todo lo que no lleva `NEXT_PUBLIC_` se queda en el servidor. Si alguna vez ves
`SUPABASE_SERVICE_ROLE_KEY` en un componente con `"use client"`, es un fallo
grave: hay un test (`test/seguridad.test.mjs`) que lo comprueba en cada ejecución.

## Supabase: migraciones y seed

```bash
npm run db:migrate    # solo el esquema
npm run db:seed       # solo los datos de demostración
npm run db:reset      # los dos, en orden
```

Si no tienes `psql`, saca el SQL y pégalo en el editor de Supabase:

```bash
node scripts/db.mjs reset --print > /tmp/todo.sql
```

Las migraciones se pueden repetir sin romper nada (`create ... if not exists`,
`create or replace`, `drop policy if exists`).

### Qué hay en el seed, y qué es real

El seed crea Asesoría Castresana con sus **datos de contacto reales** (nombre,
dirección, teléfonos y web, facilitados por el negocio) y con **contenido de
demostración claramente marcado**: 6 inmuebles ficticios, sus fotos placeholder,
leads, opiniones y 30 días de analítica sintética. Todo eso lleva
`is_demo_data = true` y la interfaz pinta el aviso «Datos de demostración.
Consultar disponibilidad».

**No se ha inventado** ninguna reseña, certificación, valoración, disponibilidad
ni enlace de Google: el enlace oficial de reseñas se deja vacío para que lo pegue
el propietario desde el panel.

### Crear tu usuario

El seed no crea cuentas (las gestiona Supabase Auth). Regístrate o invítate desde
Supabase → Authentication, y después:

```sql
-- Vincular tu cuenta con el negocio
insert into public.business_members (business_id, user_id, role, display_name)
select '22222222-0000-4000-8000-000000000001', id, 'owner', 'Tu nombre'
  from auth.users where email = 'tu@correo.com';

-- Y, si eres el dueño del SaaS:
update public.profiles set is_superadmin = true
 where id = (select id from auth.users where email = 'tu@correo.com');
```

### Storage

La migración `0010_storage.sql` crea el bucket `medios` (lectura pública,
escritura solo para miembros del negocio, 10 MB por archivo). Las fotos se suben
desde el navegador a `<business_id>/<property_id>/<archivo>`: la política de
Storage usa esa primera carpeta para decidir quién puede escribir, así que nadie
puede subir a la carpeta de otro negocio.

## Desarrollo

```bash
npm run dev          # servidor de desarrollo
npm run typecheck    # TypeScript en modo estricto
npm run lint         # ESLint
npm test             # 57 comprobaciones (ver más abajo)
npm run build        # build de producción
```

### Estructura

```
pulso-local-ai/
├── src/
│   ├── app/
│   │   ├── page.tsx                    Landing del producto
│   │   ├── b/[slug]/                   Todo lo público de un negocio
│   │   │   ├── inmuebles/[propertySlug]/
│   │   │   ├── servicios/ valoracion/ buscar-vivienda/ opinion/ contacto/
│   │   ├── dashboard/                  Panel del negocio
│   │   │   ├── inmuebles/ leads/ visitas/ feedback/ qr/ analitica/ configuracion/
│   │   ├── admin/                      Panel del SaaS
│   │   ├── trial-expired/[slug]/       Demo finalizada
│   │   ├── q/[code]/                   URL corta de los QR impresos
│   │   └── api/
│   │       ├── publico/                Formularios y eventos (service role)
│   │       ├── panel/leads.csv/        Exportación
│   │       └── cron/caducar-demos/
│   ├── components/{ui,publico,panel}/
│   ├── lib/                            Dominio: negocio, captación, QR, analítica…
│   └── types/dominio.ts
├── supabase/
│   ├── migrations/                     11 migraciones numeradas
│   └── seed/                           Asesoría Castresana DEMO
├── scripts/db.mjs                      Aplica migraciones y seed
├── test/                               Pruebas con el runner de Node
└── docs/                               Arquitectura, permisos, flujos, seguridad
```

## Pruebas

```bash
npm test
```

`test/preparar.mjs` compila a JavaScript los módulos puros (validación, QR, tema,
asistente) y los tests los importan: se prueba **el mismo código que se
despliega**, no una copia.

Qué cubren:

- **`qr.test.mjs`** — el QR generado coincide módulo a módulo con el generador ya
  verificado del monorepo, los carteles salen en milímetros reales y el contraste
  ilegible se rechaza.
- **`asistente.test.mjs`** — las preguntas fiscales, legales, laborales y
  financieras se derivan a una persona; sin material aprobado, el asistente calla.
- **`formularios.test.mjs`** — ningún formulario acepta un lead sin
  consentimiento; honeypot, teléfonos y saneado de texto.
- **`negocio.test.mjs`** — contraste AA, caducidad de la demo, precios y enlaces.
- **`seguridad.test.mjs`** — RLS activo en todas las tablas, `anon` sin
  privilegios sobre ninguna tabla ni ningún permiso de escritura, `private_address`
  fuera de las vistas públicas, funciones `SECURITY DEFINER` con `search_path`
  fijado, RPC que comprueban pertenencia y endpoints públicos con cupo y honeypot.

Las pruebas de RLS **contra una base de datos real** (aislamiento entre dos
negocios de verdad) están en `docs/pruebas-rls.md` como guion SQL para ejecutar
en Supabase.

## Despliegue en Vercel

1. **Importa el proyecto** y pon como *Root Directory* `pulso-local-ai` (esta
   aplicación vive dentro de un monorepo).
2. **Variables de entorno**: las de la tabla de arriba. `NEXT_PUBLIC_URL_APP`
   tiene que ser el dominio definitivo **antes de imprimir ningún QR**.
3. **Cron**: `vercel.json` ya declara `/api/cron/caducar-demos` a las 03:00 UTC.
   Necesita `CRON_SECRET`.
4. **Supabase**: en Authentication → URL Configuration añade tu dominio a las
   *Redirect URLs*.

> La caducidad de las demos **no depende del cron**. Una demo vencida deja de
> publicarse en el mismo instante en que vence, porque la función
> `negocio_publicable()` mira la fecha en cada consulta. El cron solo pone al día
> el estado que se ve en el panel del SaaS.

## Seguridad, en corto

- **`anon` no toca ninguna tabla.** Solo lee las vistas `v_*`, que enumeran
  columna a columna lo que es público.
- **Ningún formulario público escribe con la clave anónima.** Todo pasa por rutas
  de servidor que validan con Zod, comprueban honeypot y cupo por IP hasheada, y
  verifican que el negocio siga activo antes de guardar nada.
- **Cada lead guarda su consentimiento**: fecha, versión del texto legal, URL de
  origen y hash con sal de la IP. Nunca la IP en claro.
- **La analítica no guarda datos personales.** La sesión es un identificador
  aleatorio que muere al cerrar la pestaña.
- **El asistente no improvisa**: responde solo con lo aprobado y deriva cualquier
  cuestión legal, fiscal, laboral o financiera.
- **Las reseñas no se manipulan**: el enlace de Google se ofrece siempre, con
  cualquier nota, sin premios ni filtros. No es configurable a propósito.
- **El MVP no envía nada solo**: ni WhatsApp, ni email, ni SMS, ni eventos de
  calendario. Prepara borradores; envía una persona.

Detalle completo en [`docs/seguridad.md`](docs/seguridad.md).

## Personalizar para otro cliente

Desde `/admin`, «Nueva demo de 7 días»: nombre, teléfonos, plantilla y, si
quieres, de qué negocio copiar servicios y FAQs (**solo contenido editorial**;
nunca contactos, opiniones ni analítica). El negocio nace en `trial` con su
`trial_ends_at` calculado en servidor.

Después, desde el panel del cliente: logo, portada, colores (con aviso automático
si el color elegido no llega a contraste accesible), horarios, textos de la
landing, servicios, inmuebles, FAQs y QR.

Para un **vertical nuevo** (restaurante, clínica, taller):

1. Añade el valor al enum `business_vertical` en una migración nueva.
2. Inserta una fila en `business_templates` con su tema, módulos y textos.
3. Ajusta los módulos que se muestran en `businesses.modules`.

## Siguientes pasos

La lista priorizada está en [`docs/roadmap.md`](docs/roadmap.md): Stripe,
WhatsApp Cloud API con consentimiento, Google Calendar, sincronización con CRM y
portales, RAG real para el asistente, tours virtuales, firma digital y gestión
documental.

## Documentación

| Documento | Contenido |
| --- | --- |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Decisiones técnicas y por qué |
| [`docs/modelo-datos.md`](docs/modelo-datos.md) | Tablas, relaciones y diagrama |
| [`docs/rutas-y-permisos.md`](docs/rutas-y-permisos.md) | Cada ruta y quién entra |
| [`docs/flujos.md`](docs/flujos.md) | Los siete recorridos de usuario |
| [`docs/seguridad.md`](docs/seguridad.md) | Decisiones de seguridad y RGPD |
| [`docs/pruebas-rls.md`](docs/pruebas-rls.md) | Guion SQL para probar el aislamiento |
| [`docs/roadmap.md`](docs/roadmap.md) | Qué viene después y en qué orden |

---

**Aviso legal.** Los textos legales incluidos (consentimiento y privacidad) son
una **plantilla técnica** y deben ser revisados por un profesional legal antes de
publicarse.
