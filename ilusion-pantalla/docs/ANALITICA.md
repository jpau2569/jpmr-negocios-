# Analítica con consentimiento

## Principios
1. **Sin consentimiento no se mide nada**: ni en el móvil (la cola no escribe), ni en el servidor (descarta lo que llegue sin consentimiento vigente).
2. **Sin datos personales**: no hay texto libre en ningún evento. Solo enums, números, booleanos y slugs del catálogo. Lo buscado nunca sale del móvil (solo *cuántos* resultados).
3. **Pseudónimo mínimo**: un UUID aleatorio por instalación, creado al aceptar. No se guarda IP, user-agent, usuario ni identificador publicitario.
4. **Rechazar cuesta lo mismo que aceptar** (botones del mismo peso) y la app funciona igual.
5. **Revocable y borrable** desde Perfil → Privacidad. Conservación máxima: 13 meses.

## Qué se mide (lista cerrada)
Fuente de verdad: [`supabase/functions/_shared/eventos.json`](../supabase/functions/_shared/eventos.json). Un test en Node (servidor) y otro en Kotlin (app) fallan si se desincronizan; añadir un evento exige tocar el JSON, la clase en `Eventos.kt` y subir `consentimiento_version` si cambia lo que se mide.

`app_abierta · wallpaper_visto · busqueda · favorito_alternado · descarga_iniciada · descarga_completada · descarga_fallida · wallpaper_aplicado · wallpaper_activado · ajuste_cambiado`

## Flujo
```
app ──(registrar)──▶ ColaEventos (disco, máx. 500, solo si hay consentimiento)
app ──(sincronizar: al abrir / al salir)──▶ Edge Function `analitica`
        1. borrados y revocaciones pendientes   2. alta del consentimiento   3. eventos en lotes de 50
Edge Function ──▶ valida (lista cerrada) ──▶ consentimiento_vigente() ──▶ límite diario ──▶ eventos_analitica
```
- Cambiar el **texto** de consentimiento (`consentimiento_version` + `TextoLegal.VERSION`) invalida los consentimientos anteriores: la app vuelve a preguntar.
- Tras revocar, volver a aceptar crea un **identificador nuevo**: un borrado pendiente nunca alcanza datos nuevos (cubierto por test).

## Puesta en marcha
```
supabase db push                                  # incluye 0004_analitica.sql
supabase functions deploy analitica
# Retención: programar la purga diaria (Supabase → Database → Extensions → pg_cron):
select cron.schedule('purgar-analitica', '15 3 * * *', $$select purgar_analitica(13)$$);
```
Métricas para el panel (solo staff, vistas con RLS): `embudo_activacion`, `retencion_cohortes` (D1/D7), `wallpapers_top`, `metricas_diarias`, `uso_por_android`.

## Qué NO está resuelto (honesto)
- **Reenvío en segundo plano**: se sincroniza al abrir y al salir de la app, no con WorkManager. Si el usuario no vuelve a abrirla, lo último queda en la cola.
- **Tiempo de reproducción del wallpaper** (métrica pedida): requiere que el servicio de wallpaper registre sesiones; no está en esta entrega.
- **Conversión a Premium / paywall**: llegan con Billing (Fase 4).
- **Spam de instalaciones falsas**: quien fabrique UUID puede inflar métricas (el límite diario es por instalación). Mitigación recomendada: regla de *rate limiting* por IP en Cloudflare/Supabase delante de la función. Las métricas son orientativas, no contables.
- **Las Edge Functions no se han ejecutado** (no hay Deno aquí): se prueba la lógica compartida, no el despliegue.
- **El texto legal es un borrador** ([PRIVACIDAD-BORRADOR.md](PRIVACIDAD-BORRADOR.md)). Lo revisa un profesional antes de publicar en Google Play (Data Safety debe coincidir con esto).
