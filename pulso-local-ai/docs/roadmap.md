# Siguientes funcionalidades, en orden

El orden es el de valor por esfuerzo: primero lo que permite cobrar, después lo
que ahorra tiempo al agente, y al final lo que exige integrarse con terceros.

## 1. Stripe y suscripciones · *alto valor, esfuerzo medio*

Checkout desde `/trial-expired/[slug]`, webhook que pasa `businesses.status` a
`active`, portal de cliente y planes en `subscriptions`. Hoy la conversión de
demo a cliente es un botón en `/admin`: funciona, pero no escala más allá de las
ventas que cierres a mano.

**Antes de tocarlo**: `subscriptions` ya tiene `plan`, `status`, `price_cents` y
`external_ref` esperando el `customer_id` de Stripe.

## 2. WhatsApp Cloud API con consentimiento · *alto valor, alto cuidado*

Plantillas aprobadas por Meta, envío solo a quien lo consintió y **confirmación
explícita del administrador** antes de cada campaña. El MVP ya prepara el
borrador; esto lo enviaría.

**Requisito que no se negocia**: `consent_records` debe tener una entrada de tipo
`comunicaciones_comerciales`, distinta de la del lead. Consentir que te llamen por
una consulta no es consentir recibir campañas.

## 3. Google Calendar para visitas · *valor medio, esfuerzo medio*

OAuth por negocio, crear el evento al confirmar una visita y guardar el id en
`visit_requests.calendar_event_id` (la columna ya está). Con doble confirmación:
el agente autoriza la conexión una vez y confirma cada evento.

## 4. RAG real para el asistente · *valor medio*

Sustituir la coincidencia por palabras por embeddings sobre
`ai_knowledge_entries` (pgvector en Supabase) más un LLM con el contexto
recuperado. `buscarRespuesta()` está aislada en `src/lib/asistente.ts` justo para
poder cambiarla sin tocar nada más.

**Lo que no cambia**: `requiereProfesional()` sigue teniendo la última palabra, y
el modelo solo ve material aprobado.

## 5. Notificaciones y app instalable · *valor medio, esfuerzo bajo*

PWA con notificaciones push al agente cuando entra un lead o una visita. El
manifiesto ya está; falta el service worker y la suscripción push.

## 6. Sincronización con portales y CRM · *valor alto, esfuerzo alto*

Importar y exportar con Idealista, Fotocasa e Inmoweb. Requiere un mapeador por
portal y una cola de reintentos. Empezar por **exportar** (publicar una vez,
salir en todos) antes que por importar.

## 7. Tours virtuales propios · *valor medio*

Hoy `property_media` acepta una URL de tour externo. Lo siguiente es alojar
recorridos propios (fotos 360 encadenadas) para no depender de terceros.

## 8. Firma digital · *valor alto en asesoría, esfuerzo alto*

Hojas de encargo y autorizaciones firmadas desde el móvil, con sellado de tiempo.
Necesita proveedor cualificado (eIDAS) y una revisión legal seria.

## 9. Automatizaciones de seguimiento · *valor alto, alto cuidado*

Secuencias tipo «propietario que pidió valoración y no respondió: recordatorio a
los 3 días». Depende del punto 2: sin consentimiento de comunicaciones, no hay
secuencia.

## 10. Gestión documental segura · *valor medio*

Nota simple, certificado energético, ITE, escrituras. Bucket privado con URLs
firmadas de caducidad corta y registro de accesos.

---

## Mejoras pequeñas que caben antes

- **Campañas que se envían** (hoy solo borradores): reutilizar `campaign_audiences`.
- **Traspaso de leads entre agentes** con notificación.
- **Duplicar un negocio entero** como plantilla, no solo servicios y FAQs.
- **Modo oscuro** en la landing pública (los tokens ya están; falta el conmutador).
- **Reordenar fotos** arrastrando en el gestor de medios.
- **Alertas automáticas** al comprador cuando entra un inmueble que encaja con su
  `buyer_request` (con su consentimiento).
- **Informe mensual en PDF** para el propietario del inmueble: cuántas visitas ha
  tenido su piso y cuántos contactos ha generado.
