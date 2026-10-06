# Premium con Google Play — puesta en marcha

## Cómo funciona (y por qué es seguro)
```
App ──compra──▶ Google Play ──token──▶ App ──token + sesión──▶ verificar-compra ──▶ Play Developer API
                                                                    │ valida: producto nuestro · compra ligada a ESTA cuenta · token no usado por otra
                                                                    ▼
                                                     suscripciones (service_role) ──▶ sincronizar_plan() ──▶ perfiles.plan
Play ──Pub/Sub──▶ notificacion-play ──▶ refresca renovaciones, cancelaciones, reembolsos, fallos de cobro
App ──descarga──▶ wallpaper-url ──▶ tiene_premium(uid) ──▶ URL firmada de R2 (10 min)
```
- La app **nunca** concede Premium por sí sola: solo cuenta la respuesta del servidor.
- La compra se liga a la cuenta con `setObfuscatedAccountId(sha256("ilusion:"+uid))`; el servidor lo exige (un token robado no sirve en otra cuenta).
- Se guarda el **hash** del token, no el token.
- Quien cancela **conserva el acceso hasta el fin de lo pagado** (regla de Play; cubierto por test SQL y TS). En espera de pago o pausada: sin acceso.
- El servidor reconoce (*acknowledge*) la compra; si no se reconoce en 3 días Google la reembolsa.

## Configuración (una vez)
1. **Play Console** → crear la app `es.ilusionpantalla.app` → Monetizar → Suscripciones → crear `ilusion_premium_mensual` e `ilusion_premium_anual` (los IDs deben ser exactamente esos, o cambiar `Contenedor.PRODUCTOS` y el secreto `PLAY_PRODUCTOS`).
2. **Cuenta de servicio**: Google Cloud → IAM → crear cuenta de servicio → clave JSON. En Play Console → Usuarios y permisos → invitarla con permisos *Ver información financiera* y *Gestionar pedidos y suscripciones*. (Tarda hasta ~24 h en propagarse.)
3. **Notificaciones en tiempo real**: Play Console → Monetización → Configuración de monetización → tema de Pub/Sub; en Google Cloud crear la suscripción *push* con endpoint  
   `https://<proyecto>.supabase.co/functions/v1/notificacion-play?k=<PLAY_RTDN_SECRET>` (secreto aleatorio ≥ 24 caracteres).
4. Secretos y despliegue:
   ```
   supabase secrets set PLAY_PACKAGE_NAME=es.ilusionpantalla.app \
     PLAY_PRODUCTOS=ilusion_premium_mensual,ilusion_premium_anual \
     PLAY_RTDN_SECRET=<aleatorio> GOOGLE_PLAY_SA_JSON="$(cat clave-cuenta-servicio.json)"
   supabase db push
   supabase functions deploy verificar-compra notificacion-play borrar-cuenta wallpaper-url
   ```
5. Probar con **testers de licencia** (Play Console → Configuración → Pruebas de licencia): las compras de prueba no cobran y se renuevan en minutos.

## NO verificado todavía (necesita tus credenciales reales)
- Los nombres de campo de `subscriptionsv2` están tomados de la documentación de Google y cubiertos por tests con respuestas **simuladas**; hay que probar una compra real de tester antes de publicar.
- Las Edge Functions no se han ejecutado (no hay Deno aquí); sí la lógica compartida que usan.
- La API `billing-ktx 7.1.1` y la firma de `queryProductDetailsAsync` hay que confirmarlas al compilar en Android Studio (la 8.x cambió el tipo del callback).
- Inicio de sesión con Google (Credential Manager): **no implementado**; hoy solo correo + contraseña.
