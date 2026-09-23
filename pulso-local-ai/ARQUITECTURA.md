# PULSO LOCAL AI — Arquitectura

> **El QR que convierte visitas en clientes que vuelven.**
>
> «No te vendo una carta digital. Te instalo un punto de captación y
> fidelización en cada mesa, ticket o mostrador.»

Documento previo al código: arquitectura, modelo de datos, rutas, flujos,
seguridad y RGPD. Es el entregable 1-6 del encargo. El código va después y se
apoya en lo que aquí queda decidido.

---

## 0. Qué es y qué no es

**Es** un SaaS multi-tenant donde cada negocio local tiene un espacio público
(`/b/<slug>`) al que se llega por QR, y un panel privado (`/dashboard`) donde el
dueño edita su contenido y ve qué pasa con él.

**No es** una carta QR. La carta es la excusa para que el cliente escanee; el
producto es lo que ocurre después: reserva, WhatsApp, feedback, reseña, contacto
captado y la medición de todo ello.

La diferencia se ve en una frase: una carta QR termina cuando el cliente ha
leído los platos. Pulso Local AI empieza ahí.

### Tres verdades incómodas que el diseño respeta

1. **El negocio no va a mantener esto.** Un hostelero no entra a un panel cada
   día. Por eso el menú del día se puede programar por fechas de golpe, y por
   eso nada se rompe si el contenido está viejo: se muestra lo publicado, y lo
   caducado desaparece solo.
2. **Nunca se inventa nada.** Ni un plato, ni un alérgeno, ni un horario. El
   contenido sin confirmar se marca como DEMO y se ve marcado en la propia
   página. Un alérgeno inventado es un problema sanitario y legal, no un bug.
3. **Las reseñas no se manipulan.** El botón de Google se enseña igual con un 1
   que con un 5. Filtrar reseñas por puntuación («review gating») viola las
   políticas de Google y de la CNMC, y puede tumbar la ficha del negocio.
   Está blindado en el diseño, no en un `if` que alguien pueda cambiar.

---

## 1. Arquitectura

### 1.1 Vista general

```
                    ┌──────────────────────────────────────────┐
   QR mesa/barra    │            Next.js 15 (App Router)        │
   ticket/cartel ──▶│                                           │
   redes/escaparate │  /b/[slug]        público, RSC, ISR       │
                    │  /b/[slug]/opinion                        │
                    │  /dashboard       privado, por sesión     │
                    │  /api/*           Route Handlers          │
                    └────────────┬──────────────────────────────┘
                                 │ supabase-js (anon + service role)
                    ┌────────────▼──────────────────────────────┐
                    │              Supabase                      │
                    │  PostgreSQL + RLS   Auth   Storage         │
                    └────────────────────────────────────────────┘
```

Un solo despliegue en Vercel sirve a todos los negocios. El tenant se resuelve
por el `slug` de la URL, nunca por subdominio: un subdominio por cliente obliga
a tocar DNS en cada alta y rompe la venta en frío («te lo tengo mañana»).

### 1.2 Decisiones y por qué

| Decisión | Motivo |
|---|---|
| **App Router + Server Components** | La página pública es sobre todo lectura. Renderizada en servidor va más rápida en el móvil de alguien sentado en una mesa con 3 barras de cobertura, y el JS que baja es mínimo. |
| **Un despliegue multi-tenant** | 200 clientes, un `vercel deploy`. Alta de cliente = una fila, no un despliegue. |
| **Tenant por ruta `/b/<slug>`** | Sin DNS por cliente. El QR apunta a una URL fija desde el minuto uno. Dominio propio del cliente, si lo quiere, más adelante por rewrite. |
| **RLS en la base, no en el código** | La autorización vive en Postgres. Aunque un Route Handler tenga un fallo, la base no devuelve datos de otro negocio. Es la única defensa que no depende de que yo no me equivoque. |
| **`service_role` solo en servidor** | Nunca sale al navegador. Solo lo usan los Route Handlers para escribir formularios públicos y eventos de analítica. |
| **ISR con revalidación por etiqueta** | La carta se cachea; al guardar en el panel se invalida esa etiqueta. El cliente ve el cambio en segundos y el servidor no consulta la base en cada escaneo. |
| **Analítica propia, sin cookies** | Eventos anidados al negocio, sin identificar a la persona. Sin cookies de terceros no hace falta banner de consentimiento, que es justo lo que arruina la experiencia del QR en la mesa. |
| **PWA** | Instalable, y la carta sigue leyéndose si el WiFi del local va mal. |

### 1.3 Relación con lo que ya existe en el monorepo

`escaparate3d-pro/` ya resuelve, en HTML plano, el 60% de esto para
restaurante, inmobiliaria y cita previa: carta, pedidos, reservas, QR, tema por
JSON, leads y modo escaparate. **No se tira.** Dos caminos y hay que elegir con
los ojos abiertos:

- **Sigue como está**, para el cliente que quiere algo hoy por 180 € sin panel
  ni base de datos. Es la demo que se manda por WhatsApp en frío.
- **Pulso Local AI es el producto de suscripción**: panel, métricas, multi-tenant
  y fidelización. Es lo que se cobra cada mes.

La carta real de La Taberna (44 platos verificados) y los datos de La Viña se
portan de `escaparate3d-pro/config/ejemplos/` al seed. No se vuelven a teclear
ni se vuelven a buscar.

---

## 2. Modelo de datos

26 tablas en cuatro bloques. El detalle ejecutable está en
[`sql/01_esquema.sql`](sql/01_esquema.sql); aquí va el mapa y las decisiones.

### 2.1 Identidad y tenencia

```
profiles ──< business_members >── businesses ──┬── business_settings (1:1)
                                                ├── subscriptions
                                                ├── trial_settings
                                                └── business_templates
```

- `businesses` es el tenant. Todo lo demás cuelga de `business_id`.
- `business_members` da el rol: `owner`, `admin`, `staff`, `viewer`.
- `business_settings` guarda lo editable: horario, `review_url`, WhatsApp,
  colores, textos legales, canales.
- `business_templates` es la plantilla de sector (taberna urbana, parrilla y
  grupos…), que decide qué módulos vienen encendidos al crear el negocio.

**Por qué `business_settings` aparte de `businesses`**: los ajustes se leen en
cada visita pública y se escriben desde el panel. Separarlos deja `businesses`
pequeña, cacheable y con una política RLS simple.

### 2.2 Contenido

```
menu_categories ──< menu_items ──┬──< menu_item_allergens
                                  └──< menu_item_extras

daily_menus ──< daily_menu_items          special_menus
events        promotions                  faqs   ai_knowledge_entries
```

- `menu_items.status` (`draft` | `published` | `sold_out`) y
  `available_from` / `available_to` deciden qué ve el público. El panel ve todo.
- `menu_items.is_demo` marca el contenido de muestra. **La página pública lo
  pinta como DEMO**: si no está confirmado, se dice.
- `daily_menus` tiene `service_date`, así que el menú del día se programa a
  futuro. El del día de hoy se destaca solo, sin que nadie toque nada.
- `menu_item_allergens` es tabla aparte, con enum cerrado de los 14 alérgenos
  del Reglamento (UE) 1169/2011. Ni texto libre ni invención: o está declarado
  por el negocio, o la ficha dice que hay que preguntar al personal.

### 2.3 Conversión (datos personales)

```
reservations   group_requests   leads   feedback   consent_records
```

Todas llevan `business_id`, `consent_version`, origen (`qr_code_id`, UTM) y
`created_at`. **Ninguna es legible por el rol público**: se escriben por Route
Handler con `service_role` y se leen solo desde el panel autenticado.

`reservations.status` es `pending | confirmed | cancelled | completed` y nace
siempre en `pending`. La web **no confirma nada**: prometer una mesa que no
existe es peor que no tener web.

### 2.4 Medición y operación

```
qr_codes ──< analytics_events        legal_text_versions
```

- `qr_codes` guarda etiqueta, destino, ubicación (`table` | `bar` | `ticket` |
  `window` | `social` | `event`) y un `token` corto que viaja en la URL. Así se
  sabe si convierte más el QR de la mesa o el del escaparate.
- `analytics_events` es append-only, sin datos personales, con índice por
  `(business_id, created_at)` y por `event_type`.
- `legal_text_versions` + `consent_records`: cuando alguien consiente, se guarda
  **qué texto exacto** aceptó. Sin esto, el consentimiento no se puede
  demostrar y no vale.

---

## 3. Rutas y permisos

### 3.1 Público

| Ruta | Qué hace | Quién entra |
|---|---|---|
| `/b/[slug]` | Landing: hero, menú del día, carta, secciones | Cualquiera |
| `/b/[slug]/carta` | Carta completa por categorías | Cualquiera |
| `/b/[slug]/menu-del-dia` | Menú de hoy y los programados | Cualquiera |
| `/b/[slug]/reservar` | Formulario de reserva | Cualquiera |
| `/b/[slug]/grupos` | Celebraciones y grupos | Cualquiera |
| `/b/[slug]/opinion` | Feedback privado + botón de Google | Cualquiera |
| `/b/[slug]/expirada` | Demo caducada | Se redirige aquí |

Todas comprueban **en servidor** que el negocio esté activo o en trial vigente.

### 3.2 Panel

| Ruta | Rol mínimo |
|---|---|
| `/dashboard` | `viewer` |
| `/dashboard/carta`, `/menu-del-dia`, `/menus-especiales` | `staff` |
| `/dashboard/reservas`, `/grupos`, `/feedback` | `staff` |
| `/dashboard/contactos`, `/promociones`, `/qr` | `admin` |
| `/dashboard/configuracion`, `/legales` | `owner` |
| `/admin` (todos los negocios) | superadmin |

### 3.3 API

| Endpoint | Método | Nota |
|---|---|---|
| `/api/public/reservation` | POST | Zod + honeypot + rate limit por IP |
| `/api/public/group-request` | POST | ídem |
| `/api/public/feedback` | POST | ídem |
| `/api/public/lead` | POST | ídem, consentimiento obligatorio |
| `/api/public/track` | POST | Evento de analítica, sin datos personales |
| `/api/ai/ask` | POST | Mock en MVP; contrato listo para RAG |
| `/api/qr/[id]` | GET | PNG/SVG del QR |

Los públicos son `POST` sin sesión, así que **toda** la defensa está en el
servidor: validación Zod, honeypot, límite por IP y `service_role` acotado a
insertar en esa tabla y ese negocio.

---

## 4. Flujos

### 4.1 El cliente en la mesa (el flujo que da dinero)

```
Escanea el QR de la mesa
   └─ /b/thewhitebar-mieres?qr=<token>
      ├─ qr_landing_view                    (se registra el QR de origen)
      ├─ Ve el MENÚ DE HOY arriba del todo  daily_menu_view
      ├─ Abre un plato                      dish_view
      └─ Y entonces, una de estas cuatro:
         ├─ Reservar        reservation_submit  → pending, aviso al negocio
         ├─ WhatsApp        whatsapp_click      → mensaje ya redactado
         ├─ Dejar opinión   feedback_submit     → y botón de Google, siempre
         └─ Apuntarse       lead_submit         → contacto con consentimiento
```

Lo importante del flujo: **el menú del día va primero**. Es lo que la persona
sentada quiere ahora. La carta completa va después.

### 4.2 Opinión y reseña

```
/b/<slug>/opinion
   ├─ 1 a 5 estrellas
   ├─ Comentario privado (opcional, SIEMPRE, con cualquier nota)
   ├─ Nota baja  → "Gracias por decírnoslo. ¿Qué podemos mejorar?"
   ├─ Nota alta  → "Nos alegra. Si quieres, compártelo en Google."
   └─ Botón a Google: VISIBLE CON CUALQUIER NOTA, voluntario, a review_url
```

El botón no depende de la puntuación en ninguna rama del código. Si
`review_url` no está configurada, no hay botón — nunca un enlace inventado.

### 4.3 Demo de 7 días

```
Alta  → status=trial, trial_ends_at = now() + 7d (UTC)
        Banner privado al dueño: "Demo activa: quedan X días"

Cada petición pública → comprobación EN SERVIDOR
        ¿trial vigente o status=active?  sí → se sirve
                                          no → /b/<slug>/expirada

Expirada → se ocultan carta, menú, reservas, formularios, chatbot y promociones
           CTA "Reactivar mi espacio" → WhatsApp de Pulso Local AI
           Datos guardados 30 días; captación y automatismos, desactivados
```

La comprobación es server-side y además está en las políticas RLS: aunque
alguien llame a la API directamente, no lee nada.

### 4.4 Alta de un negocio nuevo (lo que Pau hace al vender)

```
1. Crear business + slug + plantilla de sector
2. Cargar contenido DEMO bonito desde la plantilla
3. Marcar TODO como is_demo = true
4. Mandar la demo por WhatsApp con su QR
5. El cliente confirma carta, fotos, horario, redes, review_url y WhatsApp
6. Se quita is_demo pieza a pieza, según se confirma
7. status = active
```

El paso 5 no se salta. Es tu propia regla y el diseño la hace cumplir: mientras
haya `is_demo`, la página lo dice.

---

## 5. Seguridad y RGPD

### 5.1 Seguridad

- **El panel, tras middleware.** `/dashboard` no se renderiza sin sesión: la
  comprobación corre antes. Es necesario porque el panel lee con `service_role`,
  que salta RLS. La sesión es una cookie firmada con HMAC, httpOnly y de ocho
  horas; sin configuración de acceso, el panel se cierra en vez de abrirse.
- **RLS en todas las tablas**, sin excepción. El rol `anon` solo lee contenido
  publicado de negocios vigentes; nunca `reservations`, `leads`, `feedback`,
  `consent_records` ni `business_settings` privados.
- **Validación Zod en cliente y servidor.** La del cliente es comodidad; la que
  cuenta es la del servidor.
- **Honeypot** (campo oculto) y **rate limit por IP y negocio** en cada
  endpoint público.
- **UUID v4** en todo. Nada de IDs correlativos que se puedan recorrer.
- **Sin secretos en el cliente**: `NEXT_PUBLIC_*` solo lleva la URL y la clave
  `anon` de Supabase, que es pública por diseño y está limitada por RLS.
- **Sanitización** de todo texto libre antes de pintarlo.

### 5.2 RGPD

> Esto es una plantilla técnica seria, no un dictamen jurídico. Antes de
> publicar con datos reales, que lo revise un asesor legal.

| Exigencia | Cómo se cumple |
|---|---|
| Base jurídica | Reserva y grupos: ejecución de contrato. Novedades: consentimiento explícito, casilla sin premarcar. |
| Consentimiento demostrable | `consent_records` guarda la versión exacta del texto aceptado, con fecha y origen. |
| Minimización | Se pide nombre y teléfono. Nada más para una cita. |
| Datos de salud | En hostelería, las alergias se piden como **aviso voluntario** para preparar el servicio, no como historial. |
| Derechos ARCO | Borrado por negocio y por contacto desde el panel. |
| Conservación | Demo caducada: 30 días y se purga. |
| Analítica | Sin cookies y sin identificar a nadie: por eso no hay banner. |
| No automatizar | En MVP no se manda ni un mensaje solo. Se captan segmentos; el negocio decide. |

---

## 6. Estructura del proyecto

```
pulso-local-ai/
  ARQUITECTURA.md            este documento
  sql/
    01_esquema.sql           tablas, enums, índices, triggers
    02_rls.sql               políticas
    03_seed.sql              La Taberna y La Viña, marcados DEMO
  app/
    (public)/b/[slug]/       landing, carta, menú, reservar, grupos, opinión
    (dashboard)/dashboard/   resumen, contenido, reservas, contactos, QR
    api/public/              reserva, grupo, feedback, lead, track
    api/ai/ask/              mock con contrato de RAG
  components/
    ui/                      shadcn
    public/                  hero, carta, menú del día, formularios
    dashboard/               tablas, gráficas (Recharts), editores
  lib/
    supabase/                cliente navegador, servidor y admin
    schemas/                 Zod, compartidos cliente/servidor
    analytics/               track()
    qr/                      PNG/SVG y carteles A5/A4
    whatsapp/                mensajes contextuales
    trial/                   comprobación server-side
  types/database.ts          tipos generados de Supabase
```

---

## 7. Roadmap

**MVP (lo que pediste primero):** carta, menú del día, WhatsApp, reserva,
feedback, reseñas y QR. Más el panel mínimo para editarlo y la analítica.

**v2:** menús especiales, grupos y celebraciones, eventos, promociones,
segmentos de contactos, carteles A5/A4, asistente IA sobre RAG real.

**Después:** Stripe, confirmación de reserva por WhatsApp, Google Calendar,
pedido en mesa, pagos, TPV, campañas consentidas, integración con centrales de
reservas.

---

## 8. Lo que hace falta de fuera (y que yo no puedo inventar)

Lo confirmado y lo pendiente, con su origen y su fecha, vive en
[`herramientas/confirmado.mjs`](herramientas/confirmado.mjs). Lo que no esté
ahí sigue marcado como muestra **y se ve marcado en el pie de la web**.

### Confirmado (2026-09-14)

| Dato | Estado |
|---|---|
| Horario de los dos locales | ✅ De sus fichas de Google. El de La Taberna coincide además con lo fichado el 09-09 desde otra fuente. |
| Teléfono y WhatsApp | ✅ Al móvil en los dos, como pidió Pau: La Taberna 684 65 05 16, La Viña 620 58 37 70. |
| Los fijos, como segunda opción | ✅ En el pie y etiquetados. |
| Dirección, correo, Instagram y TripAdvisor de La Viña | ✅ |

### Pendiente — bloquea publicar, no desarrollar

| Dato | Estado |
|---|---|
| Dominio `pulsolocal.ai` | **No existe todavía.** Hay que comprarlo y apuntarlo a Vercel. Mientras, la demo vive en la URL de Vercel. |
| `review_url` de Google | Falta en los dos. Sin ella no hay botón de reseña, y no se inventa una. |
| WhatsApp activo | Tener el número no es saber que lo leen. Confirmar con los locales. |
| Fotos de platos | Faltan. Sin foto, la ficha se ve pobre. |
| Precios sin confirmar | 30 de los 44 platos de La Taberna. Van marcados en la web. |
| Carta completa de La Viña | Solo están sus especialidades conocidas, sin precios. |
| Menú del día real | Cambia a diario: lo carga el negocio desde el panel. |
| Proyecto Supabase | Hay que crearlo y poner las claves. |
