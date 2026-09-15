# Modelo de datos

## La regla

Todo cuelga de `businesses`. Cada tabla de contenido o de datos personales lleva
`business_id not null`, y esa columna es la que usan las políticas RLS. No hay
ninguna tabla «global» con datos de clientes.

## Diagrama de relaciones

```
auth.users ──1:1── profiles ──┐
                              │ (is_superadmin gobierna todo el SaaS)
                              │
business_templates ──1:N── businesses ──┬── business_members ──N:1── profiles
                                        │        (owner · admin · agent · viewer)
                                        ├── business_settings        (1:1)
                                        ├── trial_settings           (1:1)
                                        ├── subscriptions            (1:N)
                                        ├── business_admin_notes     (1:N, solo SaaS)
                                        │
                                        ├── service_categories ──1:N── services
                                        │
                                        ├── properties ──┬── property_media
                                        │                ├── property_features
                                        │                └── property_inquiries
                                        │
                                        ├── leads ──┬── lead_notes
                                        │           ├── lead_assignments
                                        │           └── consent_records
                                        │
                                        ├── visit_requests      ──► leads, properties
                                        ├── valuation_requests  ──► leads
                                        ├── buyer_requests      ──► leads
                                        ├── feedback            ──► properties
                                        │
                                        ├── qr_codes ──┬── qr_scan_events
                                        │              └──► properties
                                        ├── analytics_events    ──► qr_codes, properties
                                        │
                                        ├── campaigns ──1:N── campaign_audiences
                                        ├── faqs
                                        ├── ai_knowledge_entries ──1:N── ai_chat_logs
                                        └── legal_text_versions ──1:N── consent_records
```

## Tablas, una a una

### Núcleo

| Tabla | Para qué | Detalle que importa |
| --- | --- | --- |
| `profiles` | Extiende `auth.users` | `is_superadmin` no lo puede escribir nadie desde la aplicación (`REVOKE UPDATE`) |
| `businesses` | **El tenant** | `status` + `trial_ends_at` (UTC) deciden si se publica |
| `business_members` | Quién pertenece a qué negocio y con qué rol | Es la tabla que consultan todas las políticas |
| `business_templates` | Plantillas de vertical | «Inmobiliaria y Asesoría Local» es una fila |
| `subscriptions`, `trial_settings` | Ciclo comercial | Solo escribe el superadministrador |
| `business_settings` | Enlace de reseñas, textos, asistente | Lo edita el negocio |
| `business_admin_notes` | Notas comerciales del SaaS | **Vive aparte a propósito**: el cliente no debe verlas |

### Contenido

| Tabla | Detalle que importa |
| --- | --- |
| `service_categories`, `services` | `is_published` decide qué sale en la web |
| `properties` | `private_address` (interna) vs `public_address` + `show_public_address` (el administrador decide explícitamente) |
| `property_media` | Un índice único garantiza **una sola portada** por inmueble |
| `property_features` | Características libres, ordenadas |
| `faqs`, `ai_knowledge_entries` | El límite del asistente: solo entra lo aprobado |

### Personas

| Tabla | Detalle que importa |
| --- | --- |
| `leads` | Exige teléfono **o** correo; guarda `consented_at` y `legal_text_version` |
| `lead_notes`, `lead_assignments` | Historial interno y trazabilidad de quién movió qué |
| `visit_requests` | `calendar_event_id` reservado; el MVP no escribe en calendarios |
| `valuation_requests` | `answer_note` la escribe una persona: no hay valoración automática |
| `buyer_requests` | Demanda: zonas, presupuesto, imprescindibles |
| `feedback` | Opinión privada; los datos de contacto solo si se piden |
| `consent_records` | La prueba del consentimiento: versión, fecha, origen y `ip_hash` |
| `legal_text_versions` | Textos versionados; `is_current` marca el vigente |

### Medición

| Tabla | Detalle que importa |
| --- | --- |
| `qr_codes` | `code` es la URL corta impresa; el destino se puede cambiar sin reimprimir |
| `qr_scan_events` | Un escaneo, una fila |
| `analytics_events` | Enum cerrado de tipos; `metadata` sin datos personales |
| `campaigns`, `campaign_audiences` | Solo borradores en el MVP |
| `rate_limit_hits` | Cupo compartido entre instancias (`0011`) |

## Campos clave

**`businesses`** — `id`, `name`, `slug` (único, formato validado), `business_type`,
`status`, `logo_url`, `cover_url`, `description`, `tagline`, `founded_note`,
`phone`, `whatsapp_phone`, `email`, `address`, `city`, `postal_code`, `country`,
`latitude`, `longitude`, `review_url`, `website_url`, `social_links` (JSONB),
`opening_hours` (JSONB), `theme` (JSONB), `modules` (JSONB), `is_demo_data`,
`trial_ends_at`, `created_at`, `updated_at`, `deleted_at`.

**`properties`** — `id`, `business_id`, `agent_id`, `slug`, `reference_code`,
`title`, `operation_type`, `property_type`, `status`, `price`, `currency`,
`municipality`, `neighborhood`, `public_address`, `private_address`,
`show_public_address`, `latitude`, `longitude`, `bedrooms`, `bathrooms`,
`built_area_m2`, `usable_area_m2`, `plot_area_m2`, `floor`, `has_elevator`,
`has_terrace`, `has_garage`, `energy_rating`, `year_built`, `description`,
`short_description`, `conditions_note`, `tags`, `featured`, `is_demo_data`,
`view_count`, `published_at`, `created_at`, `updated_at`, `deleted_at`.

**`leads`** — `id`, `business_id`, `property_id`, `service_id`, `lead_type`,
`source`, `qr_id`, `name`, `phone`, `email`, `message`, `preferred_contact_time`,
`interest_level`, `status`, `assigned_to`, `next_action`, `tags`, `consented_at`,
`legal_text_version`, `is_demo_data`, `metadata` (JSONB), `created_at`,
`updated_at`.

## Índices

Los que de verdad se usan, no los de adorno:

- `businesses`: por `status`, por `trial_ends_at` (solo demos) y por `slug`.
- `properties`: por `(business_id, status)`, publicados por fecha, por slug, por
  operación y tipo, por precio y por municipio.
- `leads`: por `(business_id, created_at desc)`, por estado, por tipo, por
  inmueble y por agente asignado.
- `analytics_events`: por `(business_id, created_at desc)`, por tipo, por
  inmueble y por QR.

## Borrado

Soft delete (`deleted_at`) en `businesses`, `properties`, `services`,
`service_categories` y `qr_codes`. Un inmueble vendido conserva sus leads, sus
visitas y sus estadísticas: borrarlo sería tirar el historial comercial. Un QR
archivado sigue resolviendo (a la landing) porque el cartel sigue en la calle.
