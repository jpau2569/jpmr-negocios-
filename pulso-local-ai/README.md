# PULSO LOCAL AI

> **El QR que convierte visitas en clientes que vuelven.**
>
> «No te vendo una carta digital. Te instalo un punto de captación y
> fidelización en cada mesa, ticket o mostrador.»

SaaS multi-tenant para negocios locales. Cada negocio tiene un espacio público
al que se llega por QR (`/b/<slug>`) y un panel donde ve qué pasa con él.

La arquitectura completa —modelo de datos, rutas, permisos, flujos, seguridad y
RGPD— está en **[`ARQUITECTURA.md`](ARQUITECTURA.md)**.

---

## Arrancarlo

```bash
cd pulso-local-ai
npm install
cp .env.example .env.local     # funciona sin rellenar nada: modo demostración
npm run dev                    # http://localhost:3000
```

Sin Supabase configurado, la aplicación **funciona igual**: lee el respaldo de
`lib/datos-demo.json` y los formularios avisan de que no guardan nada. Es
deliberado — así se puede enseñar una demo en el bar desde el móvil antes de
montar la base de datos.

| Dirección | Qué es |
|---|---|
| `/` | Hub comercial con las dos demos y sus QR |
| `/b/thewhitebar-mieres` | La Taberna · The White Bar (Mieres) |
| `/b/la-vina-cenera` | Restaurante La Viña (Cenera) |
| `/b/<slug>/carta` · `/menu-del-dia` · `/reservar` · `/grupos` · `/opinion` | Las secciones |
| `/b/<slug>/expirada` | Demo caducada |
| `/dashboard` | Resumen y métricas |
| `/dashboard/menu-del-dia` | Cargar el menú de hoy pegándolo |
| `/dashboard/reservas` | Reservas y grupos, con teléfono y WhatsApp |
| `/dashboard/carta` | Confirmar precios y marcar agotados |
| `/dashboard/qr` | Generador de QR y carteles |

## Estado

| Pieza | Estado |
|---|---|
| Arquitectura, modelo, rutas, flujos, seguridad | ✅ |
| Datos reales de los dos locales (horario, contacto, redes) | ✅ confirmados 2026-09-14 |
| Esquema de base de datos (28 tablas) + RLS + seed | ✅ verificado contra PostgreSQL real |
| Carta, menú del día, WhatsApp, reservas, grupos, feedback, reseñas, QR | ✅ |
| Fidelización, analítica, PWA, demo de 7 días | ✅ |
| Asistente «TheWhiteBar 24/7» | ✅ buscador sobre lo publicado, sin modelo |
| Panel: resumen, métricas y generador de QR | ✅ |
| Acceso al panel (middleware + sesión firmada) | ✅ |
| Editor del menú del día (pegar y repartir) | ✅ |
| Bandeja de reservas y grupos | ✅ |
| Editor de carta (precios, confirmar, agotado) | ✅ |
| Cuentas por persona y roles (Supabase Auth) | ⏳ hoy la clave da acceso completo |
| Editar contacto, horario y colores desde el panel | ⏳ pendiente |
| Stripe, confirmaciones por WhatsApp, RAG | ⏳ roadmap |

### El acceso al panel

`/dashboard` está protegido por `middleware.ts`, que corre **antes** de
renderizar: sin sesión no se llega. Hace falta porque el panel lee con
`service_role`, que salta RLS — ahí la base ya no protege nada.

Se entra con `PANEL_CLAVE`, y la sesión es una cookie firmada con HMAC
(httpOnly, sameSite lax, ocho horas). Una cookie fabricada, copiada de otro
despliegue o caducada no vale.

**Y si no se configura nada, el panel se cierra.** Un despliegue al que se le
olvidó poner la clave no deja los datos de los clientes abiertos: deja el panel
inaccesible y explica qué falta. Una clave de menos de 12 caracteres también se
rechaza.

Queda pendiente Supabase Auth: una cuenta por persona y el rol sacado de
`business_members`, para que un empleado vea las reservas pero no la
configuración. Hoy la clave da acceso completo, y es de Pau.

## Probarlo

```bash
npm run typecheck                 # TypeScript strict, sin errores
npm test                          # 45 comprobaciones (lógica, acceso y panel)
npm run test:sql                  # 36 comprobaciones de aislamiento contra PostgreSQL real
npm run build                     # build de producción
```

`test:sql` levanta un PostgreSQL desechable, aplica esquema + RLS + seed y
comprueba que el público lee la carta pero **no alcanza una sola reserva,
feedback, contacto ni consentimiento**; que al caducar la demo el negocio
desaparece; y que el dueño de un negocio no ve nada del otro.

## Regenerar los datos

La carta de La Taberna (46 platos) y la ficha de La Viña ya estaban verificadas
en `escaparate3d-pro/config/ejemplos/`. Todo se genera de ahí, no se teclea:

```bash
node herramientas/generar-seed.mjs         # → sql/03_seed.sql      (Supabase)
node herramientas/generar-datos-demo.mjs   # → lib/datos-demo.json  (respaldo del front)
```

Los dos usan los **mismos identificadores**, así que la analítica sigue siendo
válida al pasar del respaldo a la base. Y conservan lo importante:
`confirmado: false` en el JSON → `is_demo = true` → **la web lo dice**.

## Desplegar en Vercel

Los pasos exactos están en **[`DESPLIEGUE.md`](DESPLIEGUE.md)**. En resumen:
importar el repositorio con **Root Directory = `pulso-local-ai`**, poner
`PANEL_CLAVE` y `PANEL_SECRETO`, desplegar, y comprobar que `/dashboard` pide
la clave antes de enseñar nada.

## Las reglas que el código hace cumplir

No son buenas intenciones: hay tests que fallan si alguien las rompe.

1. **No se inventa nada.** Ni un plato, ni un precio, ni un alérgeno, ni un
   horario, ni un número de WhatsApp, ni una URL de reseñas. Lo que el negocio
   no ha confirmado va marcado como muestra **y se ve marcado en la página**.
   Un alérgeno inventado es un problema sanitario, no un bug de formato.
2. **Las reseñas no se manipulan.** El botón de Google se enseña con un 1 igual
   que con un 5, y solo si el negocio ha dado su enlace oficial. Filtrar reseñas
   por puntuación incumple las políticas de Google y puede costarle al negocio
   su ficha entera. Hay un test que vigila que nadie lo «optimice».
3. **Nada se confirma solo.** Una reserva nace en `pending`. La web no promete
   una mesa que no puede prometer.
4. **El asistente no sabe lo que no está publicado.** Responde con la carta, el
   menú y el horario cargados; si no lo sabe, remite al local. En el MVP no
   llama a ningún modelo de lenguaje: un modelo suelto respondiendo sobre
   alérgenos es exactamente lo que no se debe hacer.
5. **La analítica no identifica a nadie.** Sin cookies, sin IP en claro, sin
   identificador de persona. Por eso esta web no necesita banner de consentimiento.

## Datos confirmados y pendientes

Lo confirmado vive en [`herramientas/confirmado.mjs`](herramientas/confirmado.mjs),
con su origen y su fecha. Lo que no esté ahí sigue marcado como muestra y **se
ve marcado en la propia página**, en el pie.

### Confirmado el 2026-09-14

- [x] **Horario de los dos locales.** La Taberna: dom 11-17, lun/mar/jue 11-23,
      miércoles cerrado, vie/sáb hasta la 1. La Viña: 12:00-2:00 todos los días
      menos el martes, que cierra.
- [x] **Contacto al móvil en los dos**, como pidió Pau: La Taberna
      `684 65 05 16`, La Viña `620 58 37 70`. Son los que llevan el botón de
      llamar y el de WhatsApp.
- [x] **Los fijos, como segunda opción** en el pie y etiquetados: La Taberna
      `984 25 33 52` (reservas), La Viña `985 42 66 90`. Hay clientes que
      prefieren llamar al local de toda la vida.
- [x] **Dirección, correo, Instagram y TripAdvisor de La Viña.**

### Pendiente (bloquea publicar, no desarrollar)

- [ ] **Enlace oficial de Google Reviews** de los dos. Sin él no hay botón.
- [ ] Confirmar que los dos móviles tienen **WhatsApp activo y lo atiende
      alguien**: tener el número no es lo mismo que saber que lo leen.
- [ ] Fotos de los platos.
- [ ] Los 30 precios de La Taberna marcados como muestra, confirmados uno a uno.
- [ ] La carta completa de La Viña con precios (ahora solo están sus
      especialidades conocidas).
- [ ] Escanear un QR impreso con el móvil antes de imprimir la tirada.

## Estructura

```
pulso-local-ai/
  ARQUITECTURA.md          arquitectura, modelo, rutas, flujos, seguridad, RGPD
  sql/                     01 esquema · 02 RLS · 03 seed · 99 pruebas
  herramientas/            generadores del seed y del respaldo, pruebas de SQL
  app/
    page.tsx               hub comercial
    b/[slug]/(vivo)/       espacio público (exige demo vigente)
    b/[slug]/expirada/     demo caducada (fuera del layout que redirige)
    api/public/            reserva, grupo, feedback, lead, analítica
    api/ai/ask/            asistente
    api/qr/[token]/        QR en PNG/SVG y carteles A5 y de mesa
    dashboard/             resumen, métricas y generador de QR
  components/              ui/, publico/, dashboard/, tema
  lib/                     supabase, schemas, whatsapp, horarios, trial, qr, analítica
  test/                    pruebas de la lógica
```

## Relación con `escaparate3d-pro/`

Son dos productos distintos, no uno duplicado:

- **`escaparate3d-pro/`** es la demo de 180 € que se manda por WhatsApp en frío.
  HTML plano, sin base de datos, lista hoy. Cubre restaurante, inmobiliaria y
  cita previa (peluquería, clínica, taller).
- **Pulso Local AI** es el producto de suscripción: panel, métricas,
  multi-tenant, fidelización y reputación.

El contenido verificado se comparte: el seed y el respaldo salen de sus JSON.

## Roadmap

**Siguiente**: login del panel y editores de carta, menú del día y reservas.

**Después**: Stripe, confirmación de reserva por WhatsApp, Google Calendar,
pedido en mesa, pagos, TPV, RAG real para el asistente, campañas consentidas e
integración con centrales de reservas.
