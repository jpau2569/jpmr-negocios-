# Ilusión Pantalla — *Tu pantalla cobra vida.*

Plataforma de wallpapers animados. V1 = Android (vídeo en bucle, freemium). Ver [`docs/FASE-0-DESCUBRIMIENTO.md`](docs/FASE-0-DESCUBRIMIENTO.md).

```
ilusion-pantalla/
├─ android/                  Gradle multi-módulo
│  ├─ core/rendimiento/      Lógica pura (JVM): pausas, FPS, calidad adaptativa, selección de archivo  ✅ testeada
│  ├─ core/wallpaper/        WallpaperService + Media3                                                  ⚠ sin compilar
│  └─ app/                   Compose, tema, navegación, intent de "Aplicar"                             ⚠ sin compilar
├─ supabase/
│  ├─ migrations/            0001 núcleo · 0002 Pro · 0003 IA + marketplace (todo con RLS)
│  ├─ functions/             wallpaper-url (descarga firmada) · admin-subida (subida firmada) · _shared (SigV4, reglas)
│  ├─ R2.md                  Puesta en marcha de Cloudflare R2
│  ├─ seed.sql               Generado desde content/
│  └─ tests/                 run.sh levanta un Postgres temporal y prueba migraciones + RLS
├─ content/                  catalogo-inicial.json (40) · validar-catalogo.mjs · generar-seed.mjs
├─ design/                   tokens.json + verificar-tokens.mjs (coherencia con el tema y contraste WCAG)
└─ docs/
```

## Comandos

| Qué | Comando |
|---|---|
| Probar BD (necesita PostgreSQL ≥ 14 instalado) | `bash ilusion-pantalla/supabase/tests/run.sh` |
| Firma R2 + reglas de acceso | `node ilusion-pantalla/supabase/tests/r2.test.ts` |
| Validar catálogo | `node ilusion-pantalla/content/validar-catalogo.mjs` |
| Regenerar seed | `node ilusion-pantalla/content/generar-seed.mjs` |
| Tokens de diseño | `node ilusion-pantalla/design/verificar-tokens.mjs` |
| Tests de rendimiento (JDK 17+) | `cd ilusion-pantalla/android && gradle :core:rendimiento:test` |
| App Android | Abrir `ilusion-pantalla/android` en Android Studio (genera `local.properties` con el SDK) |

## Puesta en marcha de Supabase

1. Crear proyecto Supabase (región UE). 2. `supabase db push` (o pegar las 3 migraciones en el SQL Editor, en orden). 3. Pegar `seed.sql`. 4. Variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY` en la app; `SERVICE_ROLE` **solo** en Edge Functions, nunca en el cliente).

Los wallpapers del seed entran como **borrador**: se publican desde el panel cuando el vídeo real está subido.
