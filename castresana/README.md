# Castresana — Inbox inmobiliario

PWA premium para **Asesoría Castresana** (Oviedo). Next.js App Router + TypeScript.
Estética sobria: negro carbón · marrón nogal pulido · beige roto · cobre suave.
Temas oscuro y claro.

> **Estado: fase 4.** Inbox + Explorer + fichas + **Panel comercial**, con
> **arquitectura Firebase completa** (Auth, Firestore, Storage, FCM): la app
> funciona en **modo demo** sin configurar nada y pasa a datos reales al
> rellenar `.env.local`. Esquema en `docs/FIRESTORE.md`.

## Firebase

- **Modo dual**: sin variables de entorno → modo demo con seeds locales;
  con `.env.local` (ver `.env.example`) → Auth email/password + Firestore.
- **Capa de repositorios** (`src/lib/repositories/`): `leadsRepository`,
  `propertiesRepository`, `conversationsRepository`, `dashboardRepository`.
  La UI nunca toca el SDK: la fuente (Firestore/seeds) se decide dentro.
- **Rutas privadas**: grupo `(protected)` con `AuthGate` (demo pasa;
  con Firebase, sin sesión → `/login`).
- **Push (FCM)**: `usePushNotifications` + `public/firebase-messaging-sw.js`
  (config por querystring, sin claves hardcodeadas). La campana de la topbar
  activa el permiso cuando hay proyecto configurado.
- **Reglas e índices**: `firestore.rules` + `firestore.indexes.json`
  (desplegar con `firebase deploy --only firestore`). Endurecimientos
  pendientes documentados en `docs/FIRESTORE.md`.
- **Seeds**: `npm run seed` (12 leads, 16 propiedades, 2 agentes,
  conversaciones+mensajes, 5 visitas, tareas, notificaciones, matching);
  `npm run seed:clear` para limpiar (pide `--force` fuera del emulador).
  Con emulador: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed`.

## Puesta en marcha

```bash
cd castresana
npm install
npm run dev        # http://localhost:3000 → redirige a /inbox
```

```bash
npm run build      # build de producción
npm run start      # sirve el build
npm run typecheck  # tsc --noEmit
```

## Arquitectura

```
src/
  app/                  Rutas (App Router)
    layout.tsx          Fuentes, metadata, anti-FOUC de tema, AppShell
    page.tsx            / → redirect a /inbox
    inbox/page.tsx      Server component: resuelve datos → InboxView
    explorer/page.tsx   Descubrimiento visual: hero + rails horizontales
    properties/[id]/    Ficha de inmueble (SSG con generateStaticParams)
    globals.css         Design tokens (2 capas, dark/light) + reset + base
    manifest.ts         Manifest PWA idiomático de Next
  components/
    layout/             AppShell · Sidebar · Topbar · MobileNav · ThemeToggle
    branding/           Logo (SVG monograma) · Wordmark
    inbox/              InboxView · LeadList(+Item) · InboxToolbar ·
                        ConversationPanel · MessageComposer ·
                        LeadContextPanel · Timeline
    explorer/           ExplorerHero · PropertyRail · PropertyCard ·
                        PropertyFeaturedCard · VideoThumbCard ·
                        RecommendationRail · SectionHeader
    properties/         PropertyGallery · PropertySummary · PropertySpecs ·
                        PropertyDescription · PropertyActions ·
                        RelatedProperties · RelatedLeads · PropertyTimeline
    shared/             Button · IconButton · Badge · Avatar · SearchInput ·
                        SegmentedControl · EmptyState · MediaFrame · Icons ·
                        SW registrar
  lib/
    utils/              cn · format (€, m², tiempo) · initials
    constants/          nav · stages (embudo) · channels
  hooks/                useTheme · useMediaQuery
  store/                inboxStore (Context + useReducer: selección, filtros,
                        panel activo en móvil)
  types/                Modelo de dominio (Lead, Message, Property,
                        PropertyVideo, TimelineEvent)
  data/                 Mock realista de Oviedo/Asturias — punto único de
                        acceso: leads, mensajes, mock-properties (14 inmuebles),
                        mock-videos, mock-recommendations (rails + matching
                        lead↔propiedad, futuro motor con IA)

public/
  icons/                Iconos PWA (SVG any + maskable)
  offline.html          Página de reserva sin conexión
  sw.js                 SW básico: precache mínimo + fallback offline
```

### Principios

- **La UI nunca importa datos directamente**: todo pasa por `src/data` (hoy mock).
  Al conectar Firebase solo cambia esa capa.
- **Tokens en dos capas**: primitivas (`--c-*`) → semánticos (`--bg-*`, `--text-*`,
  `--stage-*`…). Los componentes consumen solo semánticos, por eso el tema claro
  es un bloque de overrides y todo lo demás funciona igual.
- **Responsive real**: desktop = 3 columnas (lista · conversación · contexto);
  tablet = 2 (contexto bajo demanda); móvil = 1 panel cada vez gestionado por el
  store + nav inferior.
- **Estados del embudo** (`nuevo → seguimiento → visita → oferta → cerrado`) con
  color propio vía tokens `--stage-*`, consumidos por `Badge stage={...}`.

## Tipografía

**Fraunces** (serif editorial, títulos y marca) + **Manrope** (sans humanista, UI),
servidas con `next/font` (self-hosted, sin peticiones a terceros).

## PWA (fase 1)

- `manifest.ts` → `/manifest.webmanifest` enlazado automáticamente.
- `sw.js` básico: precachea `offline.html` + iconos; navegaciones con fallback
  offline; **sin caché de datos todavía**. Registro solo en producción.
- Siguiente fase: app shell precache + runtime caching (Workbox/serwist).

## Hoja de ruta

1. Propiedades (galería con exploración visual tipo carrusel)
2. Firebase (Auth + Firestore) sustituyendo `src/data`
3. PWA completa (instalable, offline real, push)
4. Agenda e informes
