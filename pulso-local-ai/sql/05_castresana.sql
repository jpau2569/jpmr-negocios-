-- ============================================================================
--  PULSO LOCAL AI — alta de Asesoría Castresana (inmobiliaria)
-- ----------------------------------------------------------------------------
--  Orden: 01_esquema → 02_rls → 03_seed → 04_inmobiliaria → 05_castresana
--
--  Datos facilitados directamente por Pau el 2026-09-15 (es su agencia), con
--  fotos del local. Corrigen dos cosas que estaban mal fichadas en el repo
--  desde antes: el correo y el horario.
--
--  AQUÍ NO HAY NI UN SOLO INMUEBLE, y es deliberado. La cartera se carga
--  pulsando «Sincronizar» en el panel, que lee www.asesoriacastresana.com
--  desde el servidor. Sembrar pisos inventados en la demo de una agencia real
--  sería exactamente el tipo de cosa que no se hace: alguien acabaría
--  enseñándoselo a un cliente.
--
--  El local es, además de inmobiliaria, asesoría fiscal y laboral,
--  administración de fincas y abogado (así lo dice su escaparate). Este
--  espacio cubre SOLO la parte inmobiliaria, que es el cuello de botella que
--  se quiere resolver.
-- ============================================================================

-- Los identificadores NO son aleatorios: salen de uuid(...) en
-- herramientas/comun.mjs, los mismos que usa el respaldo lib/datos-demo.json.
-- Si aquí y allí no coinciden, la cascada Supabase → respaldo devuelve dos
-- versiones distintas del mismo negocio. Hay una prueba que lo vigila.
insert into businesses (id, slug, name, sector, status, trial_ends_at) values (
  'c58209b6-f648-519c-b92d-7eb6b48083a8', 'asesoria-castresana',
  'Asesoría Castresana', 'inmobiliaria', 'trial', now() + interval '7 days')
on conflict (slug) do nothing;

insert into business_settings (
  business_id, tagline, address, phone, phone_alt, phone_alt_label, whatsapp, email,
  website, instagram, facebook, tripadvisor, review_url, opening_hours, theme,
  modules, pending_notes
) values (
  'c58209b6-f648-519c-b92d-7eb6b48083a8',
  'Inmobiliaria en el centro de Oviedo',
  'Calle Cabo Noval, 8 Bajo 2 · 33007 Oviedo (Asturias)',
  -- La agencia tiene DOS móviles con WhatsApp. El botón grande solo puede
  -- apuntar a uno; el otro va de segunda opción junto al fijo. Cuál manda
  -- está pendiente de que lo confirme Pau, y así lo dice pending_notes.
  '+34689929926',
  '+34985210468', 'Oficina (fijo): 985 21 04 68 · Otro WhatsApp: 672 77 57 21',
  '34689929926',
  -- OJO: inmobiliaria@, no asesoria@. Lo que había fichado en el repo estaba mal.
  'inmobiliariacastresana@gmail.com',
  'https://www.asesoriacastresana.com',
  null, null, null,
  null,  -- review_url: PENDIENTE del enlace oficial de Google. Sin él, no hay botón.
  -- Oficina: dos tramos de lunes a viernes, cerrado el fin de semana.
  '[{"dow":0,"ranges":[]},
    {"dow":1,"ranges":[["10:00","14:00"],["17:00","19:00"]]},
    {"dow":2,"ranges":[["10:00","14:00"],["17:00","19:00"]]},
    {"dow":3,"ranges":[["10:00","14:00"],["17:00","19:00"]]},
    {"dow":4,"ranges":[["10:00","14:00"],["17:00","19:00"]]},
    {"dow":5,"ranges":[["10:00","14:00"],["17:00","19:00"]]},
    {"dow":6,"ranges":[]}]'::jsonb,
  -- Dorado sobre negro: es lo que lleva el rótulo del local, así que el cartel
  -- del escaparate no desentona con la fachada.
  '{"fondo":"#11161d","superficie":"#1a222c","acento":"#c9a227","acento2":"#2f6bff","texto":"#eef2f6"}'::jsonb,
  '{"properties":true,"visits":true,"private_listings":true,"valuation":false,
    "feedback":true,"promotions":true,"qr":true,"assistant":false,
    "menu":false,"daily_menu":false,"special_menus":false,"reservations":false,
    "groups":false,"loyalty":false}'::jsonb,
  '["Falta confirmar cuál de los dos móviles (689 92 99 26 o 672 77 57 21) es el WhatsApp principal",
    "Falta el enlace oficial de Google Reviews: sin él no se pinta el botón de reseña",
    "La cartera todavía no está sincronizada desde la web oficial",
    "Ningún inmueble tiene cargada la etiqueta energética, obligatoria en anuncios (RD 390/2021)"]'::jsonb)
on conflict (business_id) do nothing;

insert into trial_settings (business_id, trial_days)
values ('c58209b6-f648-519c-b92d-7eb6b48083a8', 7)
on conflict (business_id) do nothing;

-- ============================================================================
--  LOS QR
-- ----------------------------------------------------------------------------
--  Estos cuatro son los del negocio, no los de cada piso. El QR POR INMUEBLE
--  se genera solo, uno por ficha, cuando la cartera esté sincronizada: es lo
--  que permite saber qué piso mira la gente de noche con la oficina cerrada.
--
--  El de "VENDIDO" es el que más trabaja: convierte un cartel de presumir en
--  captación. Apunta a valoración, que llega en la Fase 2; mientras tanto cae
--  en la portada del espacio, que es un sitio decente y no un 404.
-- ============================================================================

insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '67531121-07e3-504d-afd4-01114acbc6b2', 'c58209b6-f648-519c-b92d-7eb6b48083a8',
  'cas-escap', 'Escaparate (cartera completa)', 'listings', 'window', null)
on conflict (token) do nothing;

insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '1a7aff13-be06-5372-a730-9ca09805014e', 'c58209b6-f648-519c-b92d-7eb6b48083a8',
  'cas-balcon', 'Cartel de balcón (SE VENDE)', 'listings', 'balcony', null)
on conflict (token) do nothing;

insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '7a2ebf09-30b8-5f4e-bc70-e56be902f518', 'c58209b6-f648-519c-b92d-7eb6b48083a8',
  'cas-vendido', 'Cartel VENDIDO (¿cuánto vale el tuyo?)', 'valuation', 'sold_sign', null)
on conflict (token) do nothing;

insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  'e231adc1-0fc8-5845-b2dc-0961a414827e', 'c58209b6-f648-519c-b92d-7eb6b48083a8',
  'cas-tarjeta', 'Tarjeta y carpeta de documentación', 'landing', 'other', null)
on conflict (token) do nothing;
