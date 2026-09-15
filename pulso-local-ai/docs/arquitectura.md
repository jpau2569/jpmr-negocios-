# Arquitectura

## En una frase

Next.js 15 (App Router) sobre Supabase, multi-tenant por `business_id`, con la
seguridad puesta en la base de datos (RLS y vistas) y no en el frontend.

## El mapa

```
   Cartel / escaparate / dossier
              │  (QR impreso)
              ▼
        /q/<codigo>  ──────► cuenta el escaneo y redirige
              │
              ▼
   /b/<slug>  ·  /b/<slug>/inmuebles  ·  /valoracion  ·  /opinion  …
              │                                  │
   lectura ◄──┘                                  └──► POST /api/publico/*
   (vistas v_* con clave anónima)                     (validación + cupo +
              │                                        honeypot + negocio activo)
              ▼                                                 │
      ┌───────────────────┐                                      ▼
      │     Supabase      │ ◄──────── service role ────── rutas de servidor
      │  Postgres + RLS   │
      │  Auth + Storage   │ ◄──────── sesión del usuario ── /dashboard, /admin
      └───────────────────┘
```

## Decisiones y por qué

### 1. La frontera de seguridad está en Postgres, no en React

Un producto multi-tenant se juega la vida en que el negocio A no vea los datos
del negocio B. Si eso depende de acordarse de poner `.eq("business_id", …)` en
cada consulta, es cuestión de tiempo que alguien lo olvide.

Aquí hay tres capas y la de abajo es la que manda:

1. **La aplicación** comprueba sesión y rol (`requerirSesionPanel`), para dar
   mensajes claros.
2. **RLS** comprueba la pertenencia en cada fila. Aunque la aplicación fallara,
   la consulta devuelve cero filas.
3. **Los privilegios** rematan: el rol `anon` no tiene ningún permiso sobre
   ninguna tabla.

### 2. Lo público se lee por vistas, no por tablas

`anon` solo puede leer ocho vistas `v_*`. Son vistas SECURITY DEFINER con
`security_barrier`: su cláusula `WHERE` es la frontera y su lista de columnas es
la lista de lo que es público.

Se valoró `security_invoker = on`, que mantiene el RLS de la tabla base, pero
obligaba a conceder `SELECT` sobre las tablas a `anon` y entonces proteger
`private_address` dependería de acertar con un `REVOKE` columna a columna. Con
vistas definer, la pregunta «¿puede el público leer la dirección exacta de una
vivienda?» se responde leyendo diez líneas de SQL.

### 3. Los formularios públicos escriben desde el servidor

`anon` no tiene `INSERT` en ninguna tabla. Cada envío pasa por
`/api/publico/*` → `manejarFormulario()`:

```
cupo por IP hasheada → Zod → honeypot → negocio activo → escritura → consentimiento → evento
```

Ventajas: el cupo y el honeypot no se pueden saltar desde el navegador, la
comprobación de «¿esta demo sigue viva?» ocurre en un sitio, y la analítica de
conversión la escribe el servidor (nadie infla métricas desde la consola).

### 4. La caducidad de la demo se calcula en cada consulta

`negocio_publicable(uuid)` compara `trial_ends_at` con `now()` de Postgres. Está
dentro de todas las vistas públicas y en el alta de leads. Consecuencia: **una
demo vencida deja de publicarse en el mismo segundo**, sin depender de ningún
proceso programado. El cron diario solo actualiza el estado que ve el vendedor.

### 5. Generador de QR propio

Se reutiliza `fotos-faciles/nucleo/qr.mjs` del monorepo (QR modelo 2, byte,
versiones 1-10, niveles L/M/Q/H), ya verificado módulo a módulo contra la
librería `qrcode`. Un test compara las dos implementaciones en cada ejecución.

Motivo: un QR impreso en 200 carteles no puede depender de que un paquete de npm
no cambie de comportamiento en su próxima versión mayor. Y el PNG se genera en el
navegador con un `<canvas>`: cero dependencias, cero trabajo en el servidor.

### 6. Gráficos y iconos propios

Recharts añade unos 90 kB de JavaScript para tres gráficos sencillos. Los de aquí
son SVG renderizados en el servidor: salen pintados en el primer HTML y no llevan
JavaScript de cliente. Lo mismo con los iconos (veinte trazos inline en vez de
una librería completa).

Es un panel que se abre desde el móvil entre visita y visita: cada kilobyte que
no se manda es medio segundo que no se espera.

### 7. Sin webfont

La pila del sistema (San Francisco en iOS, Roboto en Android) es moderna,
legible y pesa cero. La página se abre desde un cartel, a menudo con mala
cobertura: ahorrar dos peticiones y el parpadeo del texto vale más que una
tipografía de marca.

### 8. El tema del negocio son variables CSS

`businesses.theme` se convierte en `--marca`, `--acento` y compañía, inyectadas
en línea en el layout del negocio. Cambiar los colores de un cliente es editar
una fila, no volver a desplegar. El texto que va encima de cada color se elige
por contraste WCAG, y si un color no llega a 4,5:1 ni con blanco ni con negro, el
panel lo avisa con el número concreto.

## El MVP, la 2.0 y lo que viene

### MVP (esto)

Landing pública completa, catálogo y fichas, cuatro embudos de captación,
opinión y reputación, asistente con base aprobada, panel de negocio entero
(resumen, inmuebles, contactos, visitas, opiniones, QR, analítica,
configuración), panel del SaaS con demos de 7 días, y página de demo finalizada.

### Versión 2.0

Stripe y autoservicio, WhatsApp Cloud API con consentimiento y confirmación
humana, Google Calendar para visitas, RAG real para el asistente, campañas que
de verdad envían, y app instalable con notificaciones para el agente.

### Más adelante

Sincronización con portales inmobiliarios y CRM, tours virtuales propios, firma
digital, gestión documental segura y verticales nuevos (restauración, clínicas,
talleres) sobre el mismo motor de plantillas.
