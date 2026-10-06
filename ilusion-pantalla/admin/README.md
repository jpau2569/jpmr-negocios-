# Ilusión Pantalla · Panel de administración

Next.js (App Router) + TypeScript estricto + Tailwind 4 + `@supabase/supabase-js`. Tema oscuro con los colores de `../design/tokens.json`. Interfaz en español.

## Variables (solo públicas)
Copia `.env.local.example` a `.env.local` (no se versiona):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Nunca pongas aquí la `service_role` ni claves de R2: el navegador solo usa la anon key y la seguridad real es la RLS (`es_staff()` / `es_admin()`). El panel solo añade una puerta de UX (consulta `perfiles.rol`; si no es admin/editor muestra «Sin permiso» y cierra sesión).

## Comandos
```
npm install
npm run dev          # desarrollo
npx tsc --noEmit     # tipos
npm run lint
npx vitest run       # lógica pura de src/lib
npm run build
```

## Despliegue en Vercel
1. Importar el repo con *Root Directory* = `ilusion-pantalla/admin` (framework Next.js detectado).
2. Añadir las dos variables `NEXT_PUBLIC_*` en Settings → Environment Variables.
3. En las funciones de Supabase, `CORS_ORIGIN` debe ser el dominio del panel, y el CORS del bucket R2 debe permitir `PUT` con `Content-Type` desde ese origen (ver `../supabase/R2.md`).
4. Crear el usuario en Supabase Auth y poner su `perfiles.rol` a `admin` o `editor` desde el SQL Editor.

## Contratos que respeta
- `admin-subida`: `{slug,tipo,calidad?,codec?,mime,bytes}`; el vídeo exige `calidad` y `codec` (`h264|hevc`) y la clave es `videos/<slug>/<calidad>-<codec>.mp4`. `src/lib/archivo.ts` es espejo de `claveSubida` (vídeo ≤150 MB, imágenes ≤5 MB) y valida antes de pedir la URL. Si la clave devuelta no coincide con la esperada, cancela.
- Reemplazar un vídeo de la misma calidad+códec pide confirmación y actualiza la fila (unique `wallpaper_id, calidad, codec`).
- Publicar: exige vídeo, thumbnail, póster, título, categoría, licencia y créditos (si la licencia no es `original-propia`); pone `fecha_publicacion` (se conserva si ya existía).
- El slug no se edita tras crear el wallpaper (da nombre a los archivos subidos).
- «Quitar» un vídeo o eliminar un wallpaper borra filas, **no** objetos de R2 (el contrato no tiene función de borrado).

## Qué NO está probado
- Login real, RLS, subida real a R2 (CORS, PUT firmado), lectura de las vistas de métricas y los flujos de escritura: no hay Supabase ni R2 en este entorno. Solo se ha verificado: tipos, lint, tests unitarios de la lógica pura, compilación y que `/login` se sirve.
- No hay tests de interfaz (Playwright) ni revisión visual en 390/1280 px; la accesibilidad (etiquetas, foco, áreas de 44 px) está construida pero sin auditar con herramienta.
- `crypto.subtle` exige HTTPS (o localhost) y carga todo el vídeo en memoria para calcular el SHA-256 (hasta 150 MB).
