# Castresana

PWA inmobiliaria **premium** construida con **Next.js (App Router) + TypeScript**.
Estética sobria: negro carbón, marrón nogal pulido, beige roto y cobre suave.

> Estado: **andamiaje inicial**. Estructura, layout global de 3 paneles, design
> system, componentes base y la página **Inbox** con datos mock. Sin backend.

## Puesta en marcha

```bash
cd castresana
npm install
npm run dev      # http://localhost:3000  (redirige a /inbox)
```

Scripts útiles:

```bash
npm run build      # build de producción
npm run start      # sirve el build
npm run typecheck  # comprobación de tipos (tsc --noEmit)
npm run lint       # linter de Next
```

## Estructura

```
castresana/
├── public/
│   ├── manifest.webmanifest     # manifest PWA
│   ├── sw.js                    # service worker PLACEHOLDER (sin caché aún)
│   └── icons/                   # iconos de la app (SVG)
└── src/
    ├── app/                     # rutas (App Router)
    │   ├── layout.tsx           # layout raíz: fuentes, metadata PWA, AppShell
    │   ├── page.tsx             # raíz → redirige a /inbox
    │   ├── globals.css          # reset + base + import de tokens
    │   ├── inbox/               # ✅ Inbox con datos mock
    │   ├── explorer/            # base
    │   ├── dashboard/           # base (KPIs)
    │   ├── properties/[id]/     # base (detalle propiedad)
    │   └── leads/[id]/          # base (detalle lead)
    ├── components/
    │   ├── layout/              # AppShell, NavRail, Workspace (3 paneles), PanelHeader, Page
    │   ├── ui/                  # Button, Badge, Card, Avatar, SearchField, Stat, EmptyState…
    │   ├── inbox/               # InboxView, ConversationItem, MessageThread, InboxContext
    │   └── icons/               # set de iconos SVG inline
    ├── data/                    # datos mock (mockInbox.ts)
    ├── lib/                     # utilidades (cn, format, channelMeta, registerServiceWorker)
    ├── styles/                  # tokens.css (design tokens)
    └── types/                   # tipos de dominio (Lead, Property, Conversation…)
```

## Design system

Dos capas de tokens en `src/styles/tokens.css`:

1. **Primitivas** — paleta cruda (`--c-carbon-*`, `--c-walnut-*`, `--c-beige-*`, `--c-copper-*`).
2. **Semánticos** — intención de uso (`--bg-*`, `--text-*`, `--accent-*`, `--border-*`…).

Los componentes consumen **solo tokens semánticos**. Tipografía: *Fraunces*
(display, serif editorial) + *Inter* (UI). Estilado con **CSS Modules** por
componente para mantener el CSS acotado y sin colisiones.

### Layout de 3 paneles

`AppShell` = `NavRail` (barra de iconos) + área de trabajo. Las páginas usan
`Workspace`, que ofrece tres columnas con scroll independiente:

```
[ NavRail ] [ lista (opc.) | principal | contexto (opc.) ]
```

El Inbox usa las tres: lista de conversaciones · hilo de mensajes · ficha del lead.

## PWA

- `manifest.webmanifest` con iconos, tema carbón y accesos directos.
- `sw.js` es un **placeholder**: instala/activa pero **no cachea nada** todavía.
  El registro (solo en producción) está en `src/lib/registerServiceWorker.ts`.
- Siguiente paso PWA: estrategia de caché real (App Shell + runtime caching),
  preferiblemente con Workbox / serwist.

## Próximos pasos sugeridos

1. Conectar catálogo real de propiedades en **Explorer**.
2. Datos reales de leads y conversaciones (backend / Firebase — **aún no añadido**).
3. Caché offline real en el service worker.
4. Gráficos del Dashboard (embudo, actividad).
