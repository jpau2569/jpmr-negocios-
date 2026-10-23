# Ilusión Pantalla — *Tu pantalla cobra vida.*

Plataforma de wallpapers animados. V1 = Android (vídeo en bucle, freemium). Ver [`docs/FASE-0-DESCUBRIMIENTO.md`](docs/FASE-0-DESCUBRIMIENTO.md).

```
ilusion-pantalla/
├─ android/                  Gradle multi-módulo
│  ├─ core/rendimiento/      Lógica pura (JVM): pausas, FPS, calidad adaptativa, selección de archivo  ✅ testeada
│  ├─ core/catalogo/         Cliente Supabase, filtros/búsqueda offline, secciones de Inicio, descargas reanudables, caché ✅ testeada
│  ├─ core/analitica/        Consentimiento, cola persistente, cliente y servicio de analítica ✅ testeada
│  ├─ core/cuenta/           Auth (Supabase), sesión, compras Play, exportar/borrar datos ✅ testeada
│  ├─ core/wallpaper/        WallpaperService + Media3                                                  ⚠ sin compilar
│  └─ app/                   Compose, tema, navegación, intent de "Aplicar"                             ⚠ sin compilar
├─ supabase/
│  ├─ migrations/            0001 núcleo · 0002 Pro · 0003 IA + marketplace (todo con RLS)
│  ├─ functions/             wallpaper-url (descarga firmada) · admin-subida (subida firmada) · _shared (SigV4, reglas)
│  ├─ R2.md
│  ├─ (functions/analitica)  analítica con consentimiento → docs/ANALITICA.md                  Puesta en marcha de Cloudflare R2
│  ├─ seed.sql               Generado desde content/
│  └─ tests/                 run.sh levanta un Postgres temporal y prueba migraciones + RLS
├─ admin/                    Panel Next.js (catálogo, subidas a R2, métricas, reportes, flags) ✅ tipos/lint/tests/build
├─ herramientas/video/       Pipeline ffmpeg: bucle perfecto, variantes, verificación ✅ testeado con vídeo real
├─ content/                  catalogo-inicial.json (40) · validar-catalogo.mjs · generar-seed.mjs
├─ design/                   tokens.json + verificar-tokens.mjs (coherencia con el tema y contraste WCAG)
└─ docs/
```

## Verificar todo de una vez
`bash ilusion-pantalla/verificar-todo.sh`

## Comandos

| Qué | Comando |
|---|---|
| Probar BD (necesita PostgreSQL ≥ 14 instalado) | `bash ilusion-pantalla/supabase/tests/run.sh` |
| Validación de eventos (servidor) | `node ilusion-pantalla/supabase/tests/analitica.test.ts` |
| Firma R2 + reglas de acceso | `node ilusion-pantalla/supabase/tests/r2.test.ts` |
| Validar catálogo | `node ilusion-pantalla/content/validar-catalogo.mjs` |
| Regenerar seed | `node ilusion-pantalla/content/generar-seed.mjs` |
| Tokens de diseño | `node ilusion-pantalla/design/verificar-tokens.mjs` |
| Tests de rendimiento (JDK 17+) | `cd ilusion-pantalla/android && gradle -PsoloJvm :core:rendimiento:test :core:catalogo:test :core:analitica:test :core:cuenta:test` |
| App Android | Abrir `ilusion-pantalla/android` en Android Studio (genera `local.properties` con el SDK) |

## Puesta en marcha de Supabase

1. Crear proyecto Supabase (región UE). 2. `supabase db push` (o pegar las 3 migraciones en el SQL Editor, en orden). 3. Pegar `seed.sql`. 4. Variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY` en la app; `SERVICE_ROLE` **solo** en Edge Functions, nunca en el cliente).

Los wallpapers del seed entran como **borrador**: se publican desde el panel cuando el vídeo real está subido.

## Configurar la app contra tu Supabase
En `android/local.properties` (no versionado):
```
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...   # la clave ANÓNIMA (pública). Nunca la service_role.
```
Sin esto la app muestra "Falta configurar el servidor" en vez de fallar.
