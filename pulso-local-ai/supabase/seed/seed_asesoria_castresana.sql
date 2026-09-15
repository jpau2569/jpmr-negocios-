-- ============================================================================
--  PULSO LOCAL AI — Seed de demostración · ASESORÍA CASTRESANA
-- ----------------------------------------------------------------------------
--  IMPORTANTE — QUÉ ES REAL Y QUÉ NO:
--
--   · Datos REALES (facilitados por el negocio): nombre, dirección, teléfonos,
--     web y áreas de actividad.
--   · Datos de DEMOSTRACIÓN (`is_demo_data = true`): los 6 inmuebles, sus fotos,
--     precios y características, los leads, las opiniones y toda la analítica.
--     No representan inmuebles realmente disponibles ni métricas reales.
--
--  Ninguna reseña, certificación, valoración o disponibilidad ha sido inventada
--  y presentada como real. La interfaz pinta el distintivo «Datos de
--  demostración» siempre que `is_demo_data` sea true.
--
--  Ejecutar DESPUÉS de las migraciones:  npm run db:seed
-- ============================================================================

begin;

-- --- Plantilla reutilizable «Inmobiliaria y Asesoría Local» -------------------
insert into public.business_templates (id, slug, name, vertical, description, theme, modules, content)
values (
  '11111111-0000-4000-8000-000000000001',
  'inmobiliaria-asesoria-local',
  'Inmobiliaria y Asesoría Local',
  'inmobiliaria_asesoria',
  'Punto de captación y seguimiento en cada cartel, vivienda, escaparate, dossier y visita.',
  jsonb_build_object(
    'marca', '#0E2A3F', 'acento', '#C2A06A', 'fondo', '#F6F7F9', 'texto', '#101828', 'modo', 'claro'
  ),
  jsonb_build_object(
    'inmuebles', true, 'servicios', true, 'valoracion', true, 'buscar_vivienda', true,
    'opinion', true, 'asistente_ia', true, 'qr', true, 'campanas', true
  ),
  jsonb_build_object(
    'hero_title', '¿Quieres vender, comprar, alquilar o gestionar tu vivienda?',
    'hero_subtitle', 'Te ayudamos con un asesoramiento personalizado. Cuéntanos qué necesitas y te contactaremos.'
  )
)
on conflict (slug) do update set name = excluded.name, theme = excluded.theme,
  modules = excluded.modules, content = excluded.content;

-- --- El negocio ---------------------------------------------------------------
insert into public.businesses (
  id, name, slug, business_type, template_id, status, logo_url, cover_url,
  description, tagline, founded_note, phone, whatsapp_phone, email,
  address, city, postal_code, country, latitude, longitude,
  website_url, social_links, opening_hours, theme, modules, is_demo_data, trial_ends_at
) values (
  '22222222-0000-4000-8000-000000000001',
  'Asesoría Castresana',
  'asesoria-castresana',
  'inmobiliaria_asesoria',
  '11111111-0000-4000-8000-000000000001',
  'trial',
  null,
  '/demo/portada-oviedo.svg',
  'Asesoramiento jurídico, fiscal y laboral, administración de fincas y gestión inmobiliaria personalizada en Oviedo.',
  'Asesoramiento personalizado e inmobiliaria en Oviedo.',
  'Fundada en 1993',
  '985 210 468',
  '689 929 926',
  null,
  'Calle Cabo Noval, 8 Bajo 2',
  'Oviedo',
  '33007',
  'ES',
  null,
  null,
  'https://asesoriacastresana.com',
  jsonb_build_object(),
  jsonb_build_object(
    'aviso', 'Horario de ejemplo: edítalo desde el panel antes de publicar.',
    'lunes_viernes', '09:00 – 14:00 y 16:00 – 19:00',
    'sabado', 'Cerrado',
    'domingo', 'Cerrado'
  ),
  jsonb_build_object('marca', '#0E2A3F', 'acento', '#C2A06A', 'fondo', '#F6F7F9', 'texto', '#101828', 'modo', 'claro'),
  jsonb_build_object('inmuebles', true, 'servicios', true, 'valoracion', true, 'buscar_vivienda', true,
                     'opinion', true, 'asistente_ia', true, 'qr', true, 'campanas', true),
  true,
  now() + interval '7 days'
)
on conflict (slug) do update set
  name = excluded.name, phone = excluded.phone, whatsapp_phone = excluded.whatsapp_phone,
  address = excluded.address, city = excluded.city, postal_code = excluded.postal_code,
  website_url = excluded.website_url, tagline = excluded.tagline, founded_note = excluded.founded_note,
  description = excluded.description, theme = excluded.theme, modules = excluded.modules,
  opening_hours = excluded.opening_hours, cover_url = excluded.cover_url;

-- --- Demo de 7 días y ajustes -------------------------------------------------
insert into public.trial_settings (business_id, trial_days, reactivation_phone, reactivation_url, retain_data_days, show_public_badge)
values ('22222222-0000-4000-8000-000000000001', 7, null, null, 30, false)
on conflict (business_id) do update set trial_days = excluded.trial_days;

insert into public.business_settings (
  business_id, google_review_url, review_request_high, review_request_low,
  hero_title, hero_subtitle, valuation_mode, valuation_manual_note,
  ai_assistant_enabled, ai_assistant_name, show_demo_badge
) values (
  '22222222-0000-4000-8000-000000000001',
  null,  -- El enlace oficial de Google lo pega el propietario desde el panel. No se inventa.
  'Si quieres, puedes compartir tu experiencia públicamente en Google.',
  'Gracias por indicarnos cómo podemos mejorar. Nuestro equipo puede revisarlo contigo.',
  '¿Quieres vender, comprar, alquilar o gestionar tu vivienda?',
  'Te ayudamos con un asesoramiento personalizado. Cuéntanos qué necesitas y te contactaremos.',
  'personalizada',
  'Cada inmueble es distinto. Preferimos revisar los datos y darte una valoración hecha por una persona, no un número automático.',
  true,
  'Castresana 24/7',
  true
)
on conflict (business_id) do update set
  hero_title = excluded.hero_title, hero_subtitle = excluded.hero_subtitle,
  review_request_high = excluded.review_request_high, review_request_low = excluded.review_request_low,
  valuation_manual_note = excluded.valuation_manual_note, ai_assistant_name = excluded.ai_assistant_name;

insert into public.subscriptions (business_id, plan, status, price_cents, current_period_end, notes)
values ('22222222-0000-4000-8000-000000000001', 'demo', 'trialing', 0, now() + interval '7 days',
        'Demo de 7 días creada desde la plantilla Inmobiliaria y Asesoría Local.')
on conflict do nothing;

-- --- Textos legales (PLANTILLA TÉCNICA, pendiente de revisión profesional) ----
insert into public.legal_text_versions (business_id, kind, version, body, is_current) values
('22222222-0000-4000-8000-000000000001', 'consentimiento_lead', 'v1',
 'Al enviar este formulario autorizas a Asesoría Castresana a tratar tus datos con la única finalidad de atender tu solicitud y ponerse en contacto contigo. No se cederán a terceros. Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo al responsable del tratamiento. AVISO: este contenido es una plantilla técnica y debe ser revisado por un profesional legal antes de publicarse.',
 true),
('22222222-0000-4000-8000-000000000001', 'privacidad', 'v1',
 'Política de privacidad de ejemplo. Debe detallar responsable, finalidad, base jurídica, plazos de conservación, destinatarios y derechos de las personas interesadas. AVISO: este contenido es una plantilla técnica y debe ser revisado por un profesional legal antes de publicarse.',
 true)
on conflict (business_id, kind, version) do update set body = excluded.body;

-- --- Categorías de servicio ---------------------------------------------------
insert into public.service_categories (id, business_id, area, slug, name, description, position) values
('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'inmobiliaria', 'gestion-inmobiliaria',
 'Gestión inmobiliaria', 'Venta, alquiler y valoración de viviendas con acompañamiento en todo el proceso.', 1),
('33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'administracion_fincas', 'administracion-de-fincas',
 'Administración de fincas', 'Gestión de comunidades de propietarios: cuentas, juntas, incidencias y proveedores.', 2),
('33333333-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', 'fiscal', 'asesoria-profesional',
 'Asesoría fiscal, laboral y jurídica', 'Acompañamiento profesional para particulares, autónomos y empresas.', 3)
on conflict (business_id, slug) do update set name = excluded.name, description = excluded.description;

insert into public.services (id, business_id, category_id, slug, name, short_description, description, benefits, cta_label, cta_type, position) values
('44444444-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001',
 'venta-de-vivienda', 'Venta de vivienda',
 'Te acompañamos desde la valoración hasta la firma.',
 'Preparamos la documentación, definimos el precio de salida contigo, publicamos el inmueble y filtramos las visitas para que solo veas compradores reales.',
 '["Valoración previa antes de publicar", "Documentación revisada antes de la firma", "Filtro de visitas y seguimiento de cada interesado"]'::jsonb,
 'Quiero vender', 'formulario', 1),
('44444444-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001',
 'alquiler', 'Alquiler',
 'Buscamos inquilino y ponemos el contrato en regla.',
 'Publicamos, seleccionamos inquilino y preparamos el contrato de arrendamiento y la fianza según la normativa aplicable en cada momento.',
 '["Selección de inquilino", "Contrato y fianza en regla", "Seguimiento durante el arrendamiento"]'::jsonb,
 'Quiero alquilar', 'formulario', 2),
('44444444-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001',
 'valoracion-de-inmueble', 'Valoración de inmueble',
 'Una persona revisa tu caso y te da un rango realista.',
 'Recogemos los datos del inmueble, los contrastamos con lo que se está vendiendo en la zona y te damos un rango de precio explicado, no un número automático.',
 '["La revisa un profesional, no un algoritmo", "Sin compromiso", "Te explicamos de dónde sale el rango"]'::jsonb,
 'Pedir valoración', 'formulario', 3),
('44444444-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000001',
 'compra-de-vivienda', 'Compra de vivienda',
 'Te avisamos cuando aparece lo que buscas.',
 'Nos cuentas qué buscas y en qué zona, y te avisamos cuando entra algo que encaja, antes de que llegue a los portales.',
 '["Búsqueda personalizada", "Aviso de novedades que encajan", "Acompañamiento en la visita"]'::jsonb,
 'Busco vivienda', 'formulario', 4),
('44444444-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000002',
 'administracion-de-comunidades', 'Administración de comunidades',
 'Cuentas claras, juntas ordenadas e incidencias resueltas.',
 'Llevamos la contabilidad de la comunidad, convocamos y levantamos acta de las juntas, y coordinamos a los proveedores cuando hay una incidencia.',
 '["Cuentas al día y accesibles", "Juntas convocadas en plazo", "Un interlocutor para las incidencias"]'::jsonb,
 'Solicitar información', 'formulario', 5),
('44444444-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000003',
 'asesoria-fiscal', 'Asesoría fiscal',
 'Obligaciones fiscales al día, sin sustos.',
 'Revisamos tu situación y te acompañamos con las obligaciones fiscales que te correspondan como particular, autónomo o sociedad.',
 '["Calendario de obligaciones", "Revisión antes de presentar", "Contacto directo con tu asesor"]'::jsonb,
 'Pedir cita', 'cita', 6),
('44444444-0000-4000-8000-000000000007', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000003',
 'asesoria-laboral', 'Asesoría laboral',
 'Nóminas, contratos y seguros sociales.',
 'Gestionamos altas, bajas, contratos, nóminas y seguros sociales, y resolvemos las dudas del día a día de tu plantilla.',
 '["Nóminas y seguros sociales", "Contratos y modificaciones", "Consultas del día a día"]'::jsonb,
 'Pedir cita', 'cita', 7),
('44444444-0000-4000-8000-000000000008', '22222222-0000-4000-8000-000000000001', '33333333-0000-4000-8000-000000000003',
 'asesoria-juridica', 'Asesoría jurídica',
 'Te explicamos tus opciones antes de decidir.',
 'Analizamos tu caso y te explicamos las opciones que tienes y qué implica cada una, para que decidas con la información delante.',
 '["Análisis del caso", "Opciones explicadas en claro", "Acompañamiento en el proceso"]'::jsonb,
 'Pedir cita', 'cita', 8)
on conflict (business_id, slug) do update set name = excluded.name, description = excluded.description,
  short_description = excluded.short_description, benefits = excluded.benefits;

commit;

-- ============================================================================
--  INMUEBLES DE DEMOSTRACIÓN
--  Los seis son ficticios. `is_demo_data = true` hace que la web pinte el aviso
--  «Datos de demostración. Consultar disponibilidad.» en catálogo y ficha.
--  Las fotos son placeholders SVG servidos por la propia aplicación: el
--  administrador los sustituye subiendo fotos reales a Supabase Storage.
-- ============================================================================
begin;

insert into public.properties (
  id, business_id, slug, reference_code, title, operation_type, property_type, status,
  price, currency, municipality, neighborhood, public_address, private_address, show_public_address,
  bedrooms, bathrooms, built_area_m2, usable_area_m2, floor, has_elevator, has_terrace, has_garage,
  energy_rating, year_built, condition_note, short_description, description, conditions_note,
  tags, featured, is_demo_data, published_at
) values
('55555555-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001',
 'piso-3-habitaciones-centro-oviedo', 'DEMO-001',
 'Piso de 3 habitaciones en el centro de Oviedo', 'venta', 'piso', 'disponible',
 189000, 'EUR', 'Oviedo', 'Centro', 'Zona centro', 'Dirección interna de ejemplo (no pública)', false,
 3, 2, 98, 88, '3º', true, true, false,
 'E', 1979, 'buen_estado',
 'Tres habitaciones, ascensor y terraza, a cinco minutos andando de la calle Uría.',
 'Vivienda exterior de 98 m² construidos en pleno centro. Distribuida en salón con salida a terraza, cocina independiente, tres habitaciones y dos baños. Edificio con ascensor. Los datos de este inmueble son de demostración.',
 'La información puede estar sujeta a cambios; consulta disponibilidad y condiciones.',
 array['destacado', 'exclusivo'], true, true, now() - interval '12 days'),

('55555555-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001',
 'atico-con-terraza-oviedo', 'DEMO-002',
 'Ático con terraza de 30 m² en Oviedo', 'venta', 'atico', 'disponible',
 265000, 'EUR', 'Oviedo', 'La Corredoria', null, 'Dirección interna de ejemplo (no pública)', false,
 2, 2, 84, 76, 'Ático', true, true, true,
 'D', 2006, 'reformado',
 'Ático de dos habitaciones con terraza grande y garaje incluido.',
 'Ático en edificio de 2006 con dos habitaciones, dos baños, garaje y trastero. Terraza de unos 30 m² orientada al sur. Los datos de este inmueble son de demostración.',
 'La información puede estar sujeta a cambios; consulta disponibilidad y condiciones.',
 array['nuevo', 'destacado'], true, true, now() - interval '8 days'),

('55555555-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001',
 'casa-con-finca-en-llanera', 'DEMO-003',
 'Casa con finca en Llanera', 'venta', 'casa', 'disponible',
 245000, 'EUR', 'Llanera', 'Posada de Llanera', null, 'Dirección interna de ejemplo (no pública)', false,
 4, 2, 180, 160, null, false, true, true,
 'F', 1998, 'buen_estado',
 'Casa de cuatro habitaciones con finca de 800 m² a quince minutos de Oviedo.',
 'Vivienda unifamiliar de dos plantas con cuatro habitaciones, cocina office, garaje para dos coches y finca cerrada de unos 800 m². Los datos de este inmueble son de demostración.',
 'La información puede estar sujeta a cambios; consulta disponibilidad y condiciones.',
 array['oportunidad'], false, true, now() - interval '20 days'),

('55555555-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000001',
 'local-comercial-a-pie-de-calle-oviedo', 'DEMO-004',
 'Local comercial a pie de calle en Oviedo', 'alquiler', 'local', 'disponible',
 950, 'EUR', 'Oviedo', 'Vallobín', null, 'Dirección interna de ejemplo (no pública)', false,
 0, 1, 120, 115, 'Bajo', false, false, false,
 'en_tramite', 1985, 'a_reformar',
 'Local diáfano de 120 m² con dos escaparates a la calle.',
 'Local en esquina con dos escaparates, aseo y salida de humos pendiente de revisión técnica. Renta mensual. Los datos de este inmueble son de demostración.',
 'La información puede estar sujeta a cambios; consulta disponibilidad y condiciones.',
 array['inversion'], false, true, now() - interval '30 days'),

('55555555-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000001',
 'plaza-de-garaje-centro-oviedo', 'DEMO-005',
 'Plaza de garaje en el centro de Oviedo', 'venta', 'garaje', 'reservado',
 21000, 'EUR', 'Oviedo', 'Centro', null, 'Dirección interna de ejemplo (no pública)', false,
 0, 0, 14, 14, '-1', true, false, true,
 'exento', 1990, 'buen_estado',
 'Plaza amplia en garaje con acceso rodado y portón automático.',
 'Plaza de garaje de 14 m² en planta -1, con acceso cómodo para vehículo mediano. Los datos de este inmueble son de demostración.',
 'La información puede estar sujeta a cambios; consulta disponibilidad y condiciones.',
 array['rebajado'], false, true, now() - interval '25 days'),

('55555555-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000001',
 'piso-amueblado-en-alquiler-gijon', 'DEMO-006',
 'Piso amueblado en alquiler en Gijón', 'alquiler', 'piso', 'disponible',
 780, 'EUR', 'Gijón', 'El Llano', null, 'Dirección interna de ejemplo (no pública)', false,
 2, 1, 70, 63, '4º', true, false, false,
 'E', 1988, 'buen_estado',
 'Dos habitaciones, amueblado y listo para entrar a vivir.',
 'Piso exterior de dos habitaciones, completamente amueblado, con calefacción individual de gas. Renta mensual. Los datos de este inmueble son de demostración.',
 'La información puede estar sujeta a cambios; consulta disponibilidad y condiciones.',
 array['nuevo'], false, true, now() - interval '5 days')
on conflict (business_id, slug) do update set
  title = excluded.title, price = excluded.price, description = excluded.description,
  status = excluded.status, published_at = excluded.published_at, tags = excluded.tags;

-- --- Fotos de ejemplo (placeholders servidos por la app) ----------------------
delete from public.property_media where business_id = '22222222-0000-4000-8000-000000000001';

insert into public.property_media (property_id, business_id, kind, url, alt_text, position, is_cover)
select p.id, p.business_id, 'foto',
       '/demo/inmueble-' || lpad(n::text, 2, '0') || '.svg',
       'Imagen de demostración del inmueble ' || p.reference_code,
       n, n = 1
  from public.properties p
  cross join generate_series(1, 3) as n
 where p.business_id = '22222222-0000-4000-8000-000000000001';

insert into public.property_features (property_id, business_id, label, value, position)
select p.id, p.business_id, f.label, f.value, f.pos
  from public.properties p
  cross join (values
    ('Orientación', 'Sur', 1),
    ('Calefacción', 'Individual', 2),
    ('Conservación', 'Según visita', 3)
  ) as f(label, value, pos)
 where p.business_id = '22222222-0000-4000-8000-000000000001'
on conflict do nothing;

-- --- FAQs ---------------------------------------------------------------------
delete from public.faqs where business_id = '22222222-0000-4000-8000-000000000001';
insert into public.faqs (business_id, question, answer, area, position) values
('22222222-0000-4000-8000-000000000001', '¿Cómo solicito una visita a un inmueble?',
 'Desde la ficha del inmueble, pulsa «Solicitar visita» y déjanos tu teléfono y la franja horaria que mejor te venga. Te confirmamos la cita por teléfono o WhatsApp.', 'inmobiliaria', 1),
('22222222-0000-4000-8000-000000000001', '¿Cómo pido una valoración de mi vivienda?',
 'Entra en «Quiero valorar mi inmueble» y responde a unas preguntas rápidas sobre la vivienda. Un profesional revisa los datos y te contacta. No damos un precio automático.', 'inmobiliaria', 2),
('22222222-0000-4000-8000-000000000001', '¿Qué documentación necesito para vender?',
 'Depende de cada caso. En la primera cita revisamos contigo qué documentos tienes y cuáles hay que pedir, y te decimos dónde se solicita cada uno.', 'inmobiliaria', 3),
('22222222-0000-4000-8000-000000000001', '¿Cómo contacto con la oficina?',
 'Puedes llamar al 985 210 468, escribir por WhatsApp al 689 929 926 o pasarte por la Calle Cabo Noval, 8 Bajo 2, en Oviedo.', 'otros', 4),
('22222222-0000-4000-8000-000000000001', '¿Cómo pido cita para asesoría fiscal, laboral o jurídica?',
 'Pulsa «Solicitar una cita» y dinos qué necesitas y cuándo te viene bien. Te confirmamos el hueco con la persona del área que corresponda.', 'otros', 5),
('22222222-0000-4000-8000-000000000001', '¿Y si no tenéis lo que busco?',
 'Déjanos tu búsqueda en «Busco vivienda» con la zona y el presupuesto. Cuando entre algo que encaje, te avisamos.', 'inmobiliaria', 6),
('22222222-0000-4000-8000-000000000001', '¿Lleváis la administración de comunidades?',
 'Sí, es una de nuestras áreas. Cuéntanos el tamaño de la comunidad y qué necesitáis, y te preparamos una propuesta.', 'administracion_fincas', 7);

-- --- Base de conocimiento aprobada del asistente -------------------------------
delete from public.ai_knowledge_entries where business_id = '22222222-0000-4000-8000-000000000001';
insert into public.ai_knowledge_entries (business_id, title, body, keywords, is_approved, approved_at) values
('22222222-0000-4000-8000-000000000001', 'Dónde estamos',
 'La oficina está en la Calle Cabo Noval, 8 Bajo 2, 33007 Oviedo (Asturias).',
 array['direccion', 'donde', 'oficina', 'llegar', 'ubicacion'], true, now()),
('22222222-0000-4000-8000-000000000001', 'Cómo contactar',
 'Teléfono fijo: 985 210 468. WhatsApp: 689 929 926. Web: asesoriacastresana.com.',
 array['telefono', 'whatsapp', 'contacto', 'llamar', 'escribir'], true, now()),
('22222222-0000-4000-8000-000000000001', 'Qué hacemos',
 'Asesoramiento jurídico, fiscal y laboral, administración de fincas y gestión inmobiliaria personalizada (venta, alquiler y valoración).',
 array['servicios', 'que haceis', 'areas', 'asesoria', 'fincas', 'inmobiliaria'], true, now()),
('22222222-0000-4000-8000-000000000001', 'Cómo funciona la valoración',
 'Rellenas un formulario corto con los datos del inmueble y un profesional lo revisa y te contacta. No damos valoraciones automáticas.',
 array['valoracion', 'tasacion', 'cuanto vale', 'precio de mi casa'], true, now()),
('22222222-0000-4000-8000-000000000001', 'Cómo pedir una visita',
 'Desde la ficha del inmueble, con el botón «Solicitar visita». Nos dices la franja horaria que prefieres y te confirmamos la cita.',
 array['visita', 'ver el piso', 'cita inmueble', 'enseñar'], true, now()),
('22222222-0000-4000-8000-000000000001', 'Horario de atención',
 'El horario publicado en esta página es de ejemplo mientras la demo está activa. Para confirmarlo, llama al 985 210 468.',
 array['horario', 'abierto', 'cuando', 'hora'], true, now());

commit;

-- ============================================================================
--  QR, LEADS, OPINIONES Y ANALÍTICA DE DEMOSTRACIÓN
--  Todo lo de este bloque lleva `is_demo_data = true`. Sirve para que el panel
--  se vea completo en desarrollo. NO son métricas reales de Asesoría Castresana
--  y el panel lo advierte en pantalla.
-- ============================================================================
begin;

delete from public.qr_codes where business_id = '22222222-0000-4000-8000-000000000001';
insert into public.qr_codes (id, business_id, property_id, code, label, location_note, target_type, utm_source, utm_medium, utm_campaign) values
('66666666-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', null,
 'castresana', 'Escaparate de la oficina', 'Cristal de la calle Cabo Noval', 'landing', 'qr', 'escaparate', 'oficina'),
('66666666-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', null,
 'castresana-valoracion', 'Cartel «¿Cuánto vale tu casa?»', 'Mostrador y buzoneo', 'valoracion', 'qr', 'cartel', 'captacion'),
('66666666-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001',
 'castresana-demo-001', 'Cartel en la vivienda DEMO-001', 'Balcón del inmueble', 'inmueble', 'qr', 'cartel', 'venta'),
('66666666-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000001', null,
 'castresana-opinion', 'Tarjeta de opinión tras la visita', 'Se entrega en mano al salir', 'opinion', 'qr', 'tarjeta', 'reputacion'),
('66666666-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000001', null,
 'castresana-fincas', 'Tablón de comunidades', 'Portales administrados', 'administracion_fincas', 'qr', 'cartel', 'fincas');

-- --- Leads de demostración ----------------------------------------------------
delete from public.leads where business_id = '22222222-0000-4000-8000-000000000001' and is_demo_data;
insert into public.leads (business_id, property_id, lead_type, source, qr_id, name, phone, email, message,
                          preferred_contact_time, status, consented_at, legal_text_version, is_demo_data, created_at, metadata)
values
('22222222-0000-4000-8000-000000000001', null, 'seller', 'qr', '66666666-0000-4000-8000-000000000002',
 'Propietario DEMO 1', '600 000 001', null, 'Quiero vender el piso de mis padres en el centro.', 'Tardes',
 'nuevo', now() - interval '2 days', 'v1', true, now() - interval '2 days', '{"demo": true}'::jsonb),
('22222222-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', 'buyer', 'inmueble', '66666666-0000-4000-8000-000000000003',
 'Compradora DEMO 2', '600 000 002', 'demo2@ejemplo.test', 'Me interesa el piso del centro, ¿se puede ver el sábado?', 'Mañanas',
 'contactado', now() - interval '4 days', 'v1', true, now() - interval '4 days', '{"demo": true}'::jsonb),
('22222222-0000-4000-8000-000000000001', null, 'valuation_request', 'qr', '66666666-0000-4000-8000-000000000002',
 'Propietaria DEMO 3', '600 000 003', null, 'Quiero saber por cuánto podría alquilar mi piso.', 'Indiferente',
 'cualificado', now() - interval '6 days', 'v1', true, now() - interval '6 days', '{"demo": true}'::jsonb),
('22222222-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000006', 'tenant', 'web', null,
 'Inquilino DEMO 4', '600 000 004', null, '¿Sigue disponible el piso de Gijón?', 'Tardes',
 'nuevo', now() - interval '1 day', 'v1', true, now() - interval '1 day', '{"demo": true}'::jsonb),
('22222222-0000-4000-8000-000000000001', null, 'community_administration', 'qr', '66666666-0000-4000-8000-000000000005',
 'Presidente DEMO 5', '600 000 005', 'demo5@ejemplo.test', 'Somos una comunidad de 18 vecinos buscando administrador.', 'Mañanas',
 'visita_agendada', now() - interval '9 days', 'v1', true, now() - interval '9 days', '{"demo": true}'::jsonb),
('22222222-0000-4000-8000-000000000001', null, 'tax_labor_legal_consultation', 'qr', '66666666-0000-4000-8000-000000000001',
 'Autónomo DEMO 6', '600 000 006', null, 'Quiero cambiar de asesoría para llevar mis impuestos.', 'Tardes',
 'contactado', now() - interval '11 days', 'v1', true, now() - interval '11 days', '{"demo": true}'::jsonb),
('22222222-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000002', 'investor', 'escaparate', '66666666-0000-4000-8000-000000000001',
 'Inversor DEMO 7', '600 000 007', null, 'Busco producto para alquilar en Oviedo hasta 300.000 €.', 'Indiferente',
 'nuevo', now() - interval '3 days', 'v1', true, now() - interval '3 days', '{"demo": true}'::jsonb),
('22222222-0000-4000-8000-000000000001', null, 'landlord', 'tarjeta', null,
 'Arrendador DEMO 8', '600 000 008', null, 'Quiero poner en alquiler un local en Vallobín.', 'Mañanas',
 'descartado', now() - interval '18 days', 'v1', true, now() - interval '18 days', '{"demo": true}'::jsonb);

-- --- Solicitudes de visita, valoración y demanda ------------------------------
insert into public.visit_requests (business_id, property_id, lead_id, mode, preferred_date, preferred_slot, status, created_at)
select '22222222-0000-4000-8000-000000000001', l.property_id, l.id, 'presencial',
       (current_date + 2), 'Sábado por la mañana', 'pendiente', l.created_at
  from public.leads l
 where l.business_id = '22222222-0000-4000-8000-000000000001' and l.is_demo_data and l.lead_type in ('buyer', 'tenant');

insert into public.valuation_requests (business_id, lead_id, property_type, goal, municipality, neighborhood,
                                       built_area_m2, bedrooms, bathrooms, condition_level, has_elevator, notes, created_at)
select '22222222-0000-4000-8000-000000000001', l.id, 'piso', 'venta', 'Oviedo', 'Centro',
       95, 3, 1, 'a_reformar', true, 'Solicitud de demostración.', l.created_at
  from public.leads l
 where l.business_id = '22222222-0000-4000-8000-000000000001' and l.is_demo_data and l.lead_type in ('seller', 'valuation_request');

insert into public.buyer_requests (business_id, lead_id, operation_type, property_types, zones, budget_max,
                                   min_bedrooms, must_have, timeframe, notes, created_at)
select '22222222-0000-4000-8000-000000000001', l.id, 'venta', array['piso']::public.property_type[],
       array['Oviedo centro', 'La Corredoria'], 300000, 2, array['ascensor', 'terraza'],
       'En los próximos 3 meses', 'Demanda de demostración.', l.created_at
  from public.leads l
 where l.business_id = '22222222-0000-4000-8000-000000000001' and l.is_demo_data and l.lead_type = 'investor';

-- --- Opiniones de demostración ------------------------------------------------
delete from public.feedback where business_id = '22222222-0000-4000-8000-000000000001' and is_demo_data;
insert into public.feedback (business_id, rating, comment, wants_contact, contact_name, contact_phone, status, is_demo_data, created_at)
values
('22222222-0000-4000-8000-000000000001', 5, 'Opinión de demostración: trato cercano y todo explicado.', false, null, null, 'nuevo', true, now() - interval '3 days'),
('22222222-0000-4000-8000-000000000001', 5, 'Opinión de demostración: resolvieron la gestión en una semana.', false, null, null, 'nuevo', true, now() - interval '7 days'),
('22222222-0000-4000-8000-000000000001', 4, 'Opinión de demostración: bien, aunque tardaron en llamar.', false, null, null, 'nuevo', true, now() - interval '10 days'),
('22222222-0000-4000-8000-000000000001', 2, 'Opinión de demostración: esperaba más seguimiento tras la visita.', true, 'Cliente DEMO', '600 000 009', 'nuevo', true, now() - interval '5 days');

-- --- Analítica de demostración -------------------------------------------------
--  30 días de eventos sintéticos. `is_demo_data = true` en todos: el panel los
--  separa de los reales y avisa de que son datos de demostración.
delete from public.analytics_events where business_id = '22222222-0000-4000-8000-000000000001' and is_demo_data;
delete from public.qr_scan_events where business_id = '22222222-0000-4000-8000-000000000001';

insert into public.analytics_events (business_id, qr_id, property_id, session_id, event_type, path, device_kind, utm_source, is_demo_data, created_at)
select '22222222-0000-4000-8000-000000000001',
       (array['66666666-0000-4000-8000-000000000001','66666666-0000-4000-8000-000000000002','66666666-0000-4000-8000-000000000003']::uuid[])[1 + (random() * 2)::int],
       case when tipo in ('property_view', 'property_gallery_view')
            then (select id from public.properties where business_id = '22222222-0000-4000-8000-000000000001' order by random() limit 1)
            else null end,
       'demo-' || md5(random()::text || d::text),
       tipo::public.analytics_event_type,
       '/b/asesoria-castresana',
       (array['movil', 'movil', 'movil', 'escritorio'])[1 + (random() * 3)::int],
       'qr', true,
       (now() - make_interval(days => d) - make_interval(hours => (random() * 12)::int))
  from generate_series(0, 29) as d
  cross join unnest(array[
    'qr_landing_view', 'public_landing_view', 'property_list_view', 'property_view',
    'property_view', 'whatsapp_click', 'call_click', 'valuation_start', 'service_view'
  ]) as tipo
  cross join generate_series(1, 1 + (random() * 2)::int);

insert into public.qr_scan_events (business_id, qr_id, session_id, device_kind, created_at)
select '22222222-0000-4000-8000-000000000001', q.id, 'demo-' || md5(random()::text || d::text), 'movil',
       now() - make_interval(days => d) - make_interval(hours => (random() * 10)::int)
  from generate_series(0, 29) as d
  cross join public.qr_codes q
 where q.business_id = '22222222-0000-4000-8000-000000000001'
   and random() < 0.6;

commit;

-- ============================================================================
--  PASO MANUAL — dar de alta al equipo
-- ----------------------------------------------------------------------------
--  El seed NO crea usuarios: las cuentas se crean por Supabase Auth (invitación
--  o registro). Después, para vincular a una persona con el negocio, ejecuta:
--
--    insert into public.business_members (business_id, user_id, role, display_name)
--    select '22222222-0000-4000-8000-000000000001', id, 'owner', 'Nombre y apellidos'
--      from auth.users where email = 'correo@ejemplo.com';
--
--  Y para nombrar superadministrador del SaaS:
--
--    update public.profiles set is_superadmin = true
--     where id = (select id from auth.users where email = 'correo@ejemplo.com');
-- ============================================================================
