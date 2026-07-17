# Castresana — Inbox inmobiliario

PWA premium para **Asesoría Castresana** (Oviedo). Next.js App Router + TypeScript.
Estética sobria: negro carbón · marrón nogal pulido · beige roto · cobre suave.
Temas oscuro y claro.

> **Estado: fase 1.** Base escalable, layout global, design system, branding y
> página **Inbox** completa con datos mock. Sin backend, sin Firebase, sin login.

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
    globals.css         Design tokens (2 capas, dark/light) + reset + base
    manifest.ts         Manifest PWA idiomático de Next
  components/
    layout/             AppShell · Sidebar · Topbar · MobileNav · ThemeToggle
    branding/           Logo (SVG monograma) · Wordmark
    inbox/              InboxView · LeadList(+Item) · InboxToolbar ·
                        ConversationPanel · MessageComposer ·
                        LeadContextPanel · Timeline
    shared/             Button · IconButton · Badge · Avatar · SearchInput ·
                        SegmentedControl · EmptyState · Icons · SW registrar
  lib/
    utils/              cn · format (€, m², tiempo) · initials
    constants/          nav · stages (embudo) · channels
  hooks/                useTheme · useMediaQuery
  store/                inboxStore (Context + useReducer: selección, filtros,
                        panel activo en móvil)
  types/                Modelo de dominio (Lead, Message, Property, TimelineEvent)
  data/                 Mock realista de Oviedo/Asturias (leads, mensajes,
                        propiedades, timeline) — punto único de acceso

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
