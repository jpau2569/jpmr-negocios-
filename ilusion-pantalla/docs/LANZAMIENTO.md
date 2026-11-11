# Lista de lanzamiento en Google Play

Marca cada punto con evidencia. Lo que está ✅ lo he comprobado ejecutándolo; el resto depende de ti o de Android Studio / Play Console.

## Producto
- [ ] Compila en Android Studio y pasan `./gradlew :app:assembleRelease` y `lint` (**nunca he compilado `:app` ni `:core:wallpaper`**).
- [ ] Probado en ≥ 5 móviles reales (incl. Xiaomi/Samsung/Huawei: ahorro agresivo de batería, reinicio, rotación, bloqueo).
- [ ] 40 vídeos reales producidos con `herramientas/video/procesar.mjs` (✅ la herramienta) y subidos desde el panel (✅ el panel compila y tiene tests; subida real sin probar).
- [ ] Licencias de los vídeos documentadas (campos `licencia` y `creditos`) y generador con **uso comercial** confirmado.
- [ ] Iconos, capturas, gráfico de funciones, textos de ficha (ES/EN).

## Legal y Play Console
- [ ] **Política de privacidad publicada en una URL** (partir de `docs/PRIVACIDAD-BORRADOR.md`, revisada por un profesional) y enlazada en la ficha **y dentro de la app** (hoy no hay enlace: falta añadirlo en Perfil y en el paywall).
- [ ] **Términos de uso** publicados y enlazados (idem).
- [ ] Formulario **Seguridad de los datos**: declarar lo que realmente se trata — correo y ID de cuenta (si hay cuenta), compras, ID de instalación aleatorio + eventos de uso (solo con consentimiento), diagnósticos si activas Sentry. Debe coincidir con `docs/ANALITICA.md`.
- [ ] Clasificación de contenido, público objetivo (no infantil), declaración de anuncios (no hay).
- [ ] **Eliminación de cuenta**: Play exige poder borrarla dentro de la app ✅ (`borrar-cuenta`) **y** una URL web para solicitarlo si hay cuentas.
- [ ] Suscripciones: ver `docs/PREMIUM.md`; textos de renovación y cancelación visibles ✅ en el paywall.
- [ ] Firma de la app (Play App Signing) y *keystore* de subida guardada fuera del repositorio.
- [ ] Revisar en la política vigente de Play los requisitos de prueba previa a producción para cuentas de desarrollador nuevas (pruebas cerradas con testers durante un mínimo de días); varían y cambian.

## Infraestructura
- [ ] Proyecto Supabase en región UE; `supabase db push`; desplegar funciones; secretos (`docs/R2.md`, `docs/PREMIUM.md`).
- [ ] Buckets R2 (privado de vídeos + público de imágenes con dominio propio).
- [ ] Programar `purgar_analitica(13)` (pg_cron) y copias de seguridad.
- [ ] Límite de peticiones por IP delante de `analitica` y `verificar-compra` (Cloudflare/WAF).
- [ ] Sentry (o similar) sin datos personales; alertas de errores en funciones.
- [ ] Usuarios admin/editor creados y `perfiles.rol` asignado desde SQL con service_role.

## Verificación automática
`bash ilusion-pantalla/verificar-todo.sh` ejecuta todo lo que se puede comprobar sin credenciales ni Android SDK.
