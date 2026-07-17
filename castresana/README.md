# Castresana — Inbox inmobiliario

PWA premium para **Asesoría Castresana** (Oviedo). Next.js App Router + TypeScript.
Estética sobria: negro carbón · marrón nogal pulido · beige roto · cobre suave.
Temas oscuro y claro.

> **Estado: fase 6.** Inbox + Explorer + fichas + Panel + Firebase (demo/real)
> + capa IA + **automatización comercial**: motor de workflows, WhatsApp y
> email con plantillas, agenda de visitas, tareas automáticas, documentos
> imprimibles y activity center. Esquema Firestore en `docs/FIRESTORE.md`.

## Automatización comercial

- **Motor de workflows** (`lib/automation/`): triggers detectados sobre el
  estado del sistema (lead nuevo, caliente sin respuesta, visita solicitada/
  confirmada, silencio 48 h, captación con demanda, vendedor detectado) ×
  condiciones con motivo × acciones que producen **artefactos reales**
  (tareas, alertas, visitas, recordatorios). Runs auditables con detalle;
  los omitidos explican qué condición falló. Con Cloud Functions, los
  mismos triggers pasarán a dispararse por eventos.
- **WhatsApp y email** (`lib/integrations/`): providers como interfaz
  (mock hoy; Twilio/Meta/Resend = otra implementación en ruta de servidor),
  plantillas es-ES con variables `{{x}}` que **nunca se rellenan inventando**
  (los huecos quedan visibles), registro de envíos con estados de entrega.
- **Documentos** (`lib/documents/`): generadores → contenido estructurado →
  HTML imprimible sobrio (imprimir = PDF). Ficha de inmueble, resumen de
  lead, resumen de visita y propuesta listos; contratos marcados «en
  preparación» (requieren revisión legal antes de activarse).
- **Activity center** (`activityService`): timeline unificado por lead —
  mensajes, WhatsApp/email con estado, tareas, visitas, hitos y workflows.
- **UI**: plantillas en el composer del Inbox (botón 📄), historia comercial
  + tareas + visitas + documentos + automatizaciones en la ficha de lead,
  agenda de visitas agrupada y bloque «Automatización» en el dashboard
  (workflows disparados, tareas vencidas, rendimiento por canal, leads sin
  tocar). Preferencias en `lib/constants/automation.ts`.

## Capa de IA comercial

- **Nivel 1 (activo)**: heurística determinista en `src/lib/ai/` — todo
  resultado lleva **razones cortas visibles** (cero cajas negras):
  `scoreLead` (0-100 + señales), `classifyIntent` (7 intenciones + confianza),
  `summarizeLead` (briefing verificable), `suggestReply` (7 tipos de
  plantilla contextual), `recommendNextAction` (árbol priorizado),
  `matchProperty` (encaje presupuesto/zona/extras/urgencia),
  `generateAlerts` (6 tipos con severidad).
- **Nivel 2 (preparado)**: `lib/ai/provider.ts` define la interfaz
  `AIProvider`; conectar Claude/OpenAI/Gemini = otra implementación de la
  misma interfaz. Regla: el LLM redacta/resume; scoring y matching siguen
  siendo deterministas y auditables.
- **Servicios**: `aiLeadService` (LeadInsights agregado por lead),
  `aiDashboardService` (pulso comercial: prioridades, alertas,
  oportunidades, demanda por inmueble, carga por agente, tips del día).
- **UI**: score en la lista del Inbox; resumen + siguiente acción + encaje
  con stock en el panel del lead; chips de respuesta sugerida sobre el
  composer; leads compatibles con score en la ficha de inmueble; bloque
  «IA comercial» en el dashboard.

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
