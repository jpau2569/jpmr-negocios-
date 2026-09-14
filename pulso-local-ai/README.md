# PULSO LOCAL AI

> **El QR que convierte visitas en clientes que vuelven.**
>
> «No te vendo una carta digital. Te instalo un punto de captación y
> fidelización en cada mesa, ticket o mostrador.»

SaaS multi-tenant para negocios locales. Cada negocio tiene un espacio público
al que se llega por QR (`/b/<slug>`) y un panel privado donde el dueño edita su
contenido y ve qué pasa con él.

**La arquitectura completa está en [`ARQUITECTURA.md`](ARQUITECTURA.md)**:
modelo de datos, rutas, permisos, flujos, seguridad y RGPD. Léelo antes de tocar
código.

---

## Estado

| Pieza | Estado |
|---|---|
| Arquitectura, modelo, rutas, flujos, seguridad | ✅ `ARQUITECTURA.md` |
| Esquema de base de datos (28 tablas) | ✅ `sql/01_esquema.sql` |
| Políticas RLS multi-tenant | ✅ `sql/02_rls.sql` |
| Seed con datos reales de La Taberna y La Viña | ✅ `sql/03_seed.sql` |
| Pruebas de aislamiento contra Postgres real | ✅ 30/30 |
| Aplicación Next.js | ⏳ pendiente |
| Panel | ⏳ pendiente |
| Generador de QR y carteles | ⏳ pendiente (hay implementación propia reutilizable en `fotos-faciles/nucleo/qr.mjs`) |

## Probarlo

No hace falta Supabase ni conexión: se levanta un PostgreSQL desechable, se
aplica todo y se comprueba que el aislamiento funciona de verdad.

```bash
bash pulso-local-ai/herramientas/probar-sql.sh
```

Comprueba, entre otras cosas, que el público ve la carta publicada pero **no
alcanza una sola reserva, feedback, contacto ni consentimiento**; que al caducar
la demo de 7 días el negocio desaparece del público; y que el dueño de un
negocio no ve absolutamente nada del otro.

## Regenerar el seed

La carta de La Taberna (46 platos) y la ficha de La Viña ya estaban verificadas
en `escaparate3d-pro/config/ejemplos/`. El seed se genera de ahí, no se teclea:

```bash
node pulso-local-ai/herramientas/generar-seed.mjs
```

Conserva lo más importante: `confirmado: false` en el JSON se convierte en
`is_demo = true` en la base, y la web lo pinta como dato sin confirmar.

## Las dos demos

| Negocio | Ruta | Plantilla |
|---|---|---|
| La Taberna · The White Bar (Mieres) | `/b/thewhitebar-mieres` | Taberna urbana: menú del día y carta |
| Restaurante La Viña (Cenera) | `/b/la-vina-cenera` | Parrilla y grupos: celebraciones |

Datos de origen: fichas públicas y fotos de sus cartas, recogidos el 2026-09-09.
De La Taberna hay 14 platos con precio confirmado y 30 sin confirmar.

## Tres reglas que el código hace cumplir

1. **No se inventa nada.** Ni un plato, ni un precio, ni un alérgeno, ni un
   horario. Lo que el negocio no ha confirmado va marcado como DEMO y se ve
   marcado en la página. Un alérgeno inventado es un problema sanitario.
2. **Las reseñas no se manipulan.** El botón de Google se enseña con un 1 y con
   un 5, y solo si el negocio ha dado su enlace oficial. Filtrar reseñas por
   puntuación viola las políticas de Google y puede tumbar su ficha.
3. **Nada se confirma solo.** Una reserva nace en `pending`. La web no promete
   una mesa que no puede prometer.

## Antes de publicar con datos reales

Ninguno de estos datos se puede inventar. Bloquean la publicación, no el
desarrollo: se construye con DEMO y se sustituye.

- WhatsApp de cada negocio.
- `review_url` oficial de Google de cada negocio.
- Horario confirmado por el propio local.
- Fotos de los platos.
- Los 30 precios de La Taberna marcados `is_demo`, confirmados uno a uno.
- Dominio `pulsolocal.ai` (**no existe todavía**: hay que comprarlo y apuntarlo
  a Vercel; mientras tanto las demos viven en la URL de Vercel).
- Proyecto de Supabase creado y sus claves puestas.

## Relación con `escaparate3d-pro/`

Son dos productos, no uno duplicado:

- **`escaparate3d-pro/`** es la demo de 180 € que se manda por WhatsApp en frío.
  HTML plano, sin base de datos, lista hoy. Cubre restaurante, inmobiliaria y
  cita previa (peluquería, clínica, taller).
- **Pulso Local AI** es el producto de suscripción: panel, métricas,
  multi-tenant, fidelización y reputación.

El contenido verificado se comparte: el seed sale de los JSON del primero.
