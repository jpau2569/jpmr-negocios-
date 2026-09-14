-- ============================================================================
--  PULSO LOCAL AI — seed
-- ----------------------------------------------------------------------------
--  GENERADO por herramientas/generar-seed.mjs. No editar a mano: vuelve a
--  lanzarlo. Los datos vienen de escaparate3d-pro/config/ejemplos/, que a su
--  vez salen de fichas públicas y de fotos de las cartas.
--
--  is_demo = true significa QUE EL NEGOCIO NO LO HA CONFIRMADO TODAVÍA. La
--  web lo pinta como tal. No se quita hasta que el dueño lo valide.
-- ============================================================================

begin;

-- --- Plantillas de sector ---
insert into business_templates (id, key, name, description, defaults) values (
  'aaf8fe97-f315-553f-ba48-7148971ffc68', 'taberna-urbana', 'Taberna urbana', 'Bar restaurante de ciudad: menú del día, carta y raciones para compartir.', '{"modules":{"daily_menu":true,"menu":true,"reservations":true,"groups":false,"feedback":true,"loyalty":true,"qr":true}}'::jsonb)
on conflict (key) do nothing;
insert into business_templates (id, key, name, description, defaults) values (
  '68fe10f6-3f1f-5123-9ca2-209e10fcf10f', 'parrilla-grupos', 'Parrilla y grupos', 'Restaurante de valle con parrilla, celebraciones y grupos grandes.', '{"modules":{"daily_menu":false,"menu":true,"reservations":true,"groups":true,"events":true,"feedback":true,"loyalty":true,"qr":true}}'::jsonb)
on conflict (key) do nothing;

-- --- Texto legal versionado (sin esto un consentimiento no se puede demostrar) ---
insert into legal_text_versions (id, business_id, kind, version, body) values (
  'ec1e731e-407d-5efd-84a2-4dc6091b2ffa', null, 'marketing_consent', 'v1',
  'Acepto recibir el menú del día, novedades y eventos del negocio por el canal que he indicado. Puedo darme de baja en cualquier momento escribiendo al propio negocio. Mis datos no se ceden a terceros.')
on conflict (business_id, kind, version) do nothing;

-- ==========================================================================
--  La Taberna · The White Bar  (/b/thewhitebar-mieres)
--  Origen de los datos: Fichas públicas del negocio y fotos de su carta y de su pizarra del menú del día, facilitadas por Pau el 2026-09-09.
-- ==========================================================================
insert into businesses (id, slug, name, sector, status, trial_ends_at) values (
  'e3b9828d-0274-5089-94e7-99436aed33c9', 'thewhitebar-mieres', 'La Taberna · The White Bar', 'hosteleria', 'trial', now() + interval '7 days')
on conflict (slug) do nothing;

insert into business_settings (business_id, tagline, address, phone, whatsapp, email, website, instagram, facebook, review_url, opening_hours, theme, modules) values (
  'e3b9828d-0274-5089-94e7-99436aed33c9', 'Cocina de siempre y buen producto en el centro de Mieres', 'Calle Jerónimo Ibrán, 11 · 33600 Mieres (Asturias)', '+34684650516',
  null,  -- pendiente: sin número, el botón no se pinta
  null, null, null, null,
  null,  -- review_url: PENDIENTE de que el negocio dé su enlace oficial de Google
  '[]'::jsonb,  -- horario: en la ficha hay uno, pero sin confirmar por el local
  '{"fondo":"#171012","acento":"#d99a3f","acento2":"#8c2f39","texto":"#f7efe6"}'::jsonb,
  '{"daily_menu":true,"menu":true,"reservations":true,"groups":false,"feedback":true,"loyalty":true,"qr":true}'::jsonb)
on conflict (business_id) do nothing;

insert into trial_settings (business_id, trial_days) values ('e3b9828d-0274-5089-94e7-99436aed33c9', 7)
on conflict (business_id) do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'Entrantes para compartir', null, 0, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'd6ad7e35-cf81-5f1f-a54f-1e504bd082d2', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Patatas tres salsas', 'Alioli, cabrales y brava.', 990,
  array[]::text[], 0, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d6ad7e35-cf81-5f1f-a54f-1e504bd082d2', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d6ad7e35-cf81-5f1f-a54f-1e504bd082d2', 'lacteos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '32dafc0e-fe4e-5b3c-a9a2-2be8b1954090', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Pimientos del Padrón', null, 850,
  array[]::text[], 1, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'c05657dc-80e1-547f-a3dd-cabdc0a032e8', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Jamón ibérico (100 g)', 'Con pan tostado y tomate.', 1990,
  array['recomendado']::text[], 2, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('c05657dc-80e1-547f-a3dd-cabdc0a032e8', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '77fb792c-e69c-59dc-8f73-a2acaea5d5fe', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Tabla de embutidos y queso manchego', 'Chorizo, salchichón y queso manchego.', 990,
  array[]::text[], 3, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('77fb792c-e69c-59dc-8f73-a2acaea5d5fe', 'lacteos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'd795003e-96ed-5309-b6ee-eb5f842609f2', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Tortilla de patata tradicional', 'Con o sin cebolla.', 1490,
  array[]::text[], 4, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d795003e-96ed-5309-b6ee-eb5f842609f2', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '562c1224-ea8e-5774-931c-ae3ca5a9dc83', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Tortilla de patata con cebolla caramelizada y queso de cabra', null, 1750,
  array[]::text[], 5, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('562c1224-ea8e-5774-931c-ae3ca5a9dc83', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('562c1224-ea8e-5774-931c-ae3ca5a9dc83', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'cf133ac9-3af7-5917-9797-31f660b3531c', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Croquetas de jamón ibérico', '8 unidades.', 1150,
  array['recomendado']::text[], 6, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('cf133ac9-3af7-5917-9797-31f660b3531c', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('cf133ac9-3af7-5917-9797-31f660b3531c', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('cf133ac9-3af7-5917-9797-31f660b3531c', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '260c4e06-0979-5203-ba85-21671d54cc5a', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Croquetas de langostinos', '8 unidades.', 1550,
  array[]::text[], 7, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('260c4e06-0979-5203-ba85-21671d54cc5a', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('260c4e06-0979-5203-ba85-21671d54cc5a', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('260c4e06-0979-5203-ba85-21671d54cc5a', 'crustaceos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('260c4e06-0979-5203-ba85-21671d54cc5a', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '8985f90e-b702-52eb-b77c-768fdeacbd30', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Pastel de cabracho', 'Con salsa rosa, mayonesa y biscotes.', 1600,
  array[]::text[], 8, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('8985f90e-b702-52eb-b77c-768fdeacbd30', 'pescado') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('8985f90e-b702-52eb-b77c-768fdeacbd30', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('8985f90e-b702-52eb-b77c-768fdeacbd30', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '301e98ff-95bc-584a-80ce-49f0ed3e91f8', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Gyozas de langostinos', '6 unidades.', 1550,
  array[]::text[], 9, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('301e98ff-95bc-584a-80ce-49f0ed3e91f8', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('301e98ff-95bc-584a-80ce-49f0ed3e91f8', 'crustaceos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('301e98ff-95bc-584a-80ce-49f0ed3e91f8', 'soja') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('301e98ff-95bc-584a-80ce-49f0ed3e91f8', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'f1a7eb69-afb9-5850-a00a-fa7da89b6318', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Chorizo criollo a la brasa con chimichurri', 'Precio por unidad.', 890,
  array[]::text[], 10, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '627162ef-33cb-546f-a58a-3f190c4eb6e0', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Revuelto de setas y gambas', null, 1750,
  array[]::text[], 11, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('627162ef-33cb-546f-a58a-3f190c4eb6e0', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('627162ef-33cb-546f-a58a-3f190c4eb6e0', 'crustaceos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'ff7edcef-f991-5a19-8448-d900170c0edf', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Pan brioche de carrilleras de ternera', 'Mínimo 2 unidades. Precio por unidad.', 750,
  array['recomendado']::text[], 12, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('ff7edcef-f991-5a19-8448-d900170c0edf', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('ff7edcef-f991-5a19-8448-d900170c0edf', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('ff7edcef-f991-5a19-8448-d900170c0edf', 'lacteos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'f7d74788-5087-58d4-bc87-dae1024e7092', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Tacos «La Taberna»', 'Pulled pork, pico de gallo y salsas caseras en tortitas de trigo. Mínimo 2 unidades. Precio por unidad.', 690,
  array['recomendado']::text[], 13, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('f7d74788-5087-58d4-bc87-dae1024e7092', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '41651f61-17b7-5dbb-8811-f2bad4141325', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Croquetas de lacón y grelos', '8 unidades.', 1500,
  array[]::text[], 14, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('41651f61-17b7-5dbb-8811-f2bad4141325', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('41651f61-17b7-5dbb-8811-f2bad4141325', 'lacteos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '563359b5-ce7d-5a1d-a5f2-78d6a8da2f41', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Gyozas de pollo', '8 unidades.', 1400,
  array[]::text[], 15, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('563359b5-ce7d-5a1d-a5f2-78d6a8da2f41', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('563359b5-ce7d-5a1d-a5f2-78d6a8da2f41', 'soja') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'b69cfa40-5ec4-5f10-9b63-f6a49b2edf18', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'f7aac5ec-f7ee-5fa5-97c3-b535fd0c8a21', 'Crujiente de langostino', 'Con alioli de lima, mostaza y miel. 6 unidades.', 1650,
  array[]::text[], 16, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('b69cfa40-5ec4-5f10-9b63-f6a49b2edf18', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('b69cfa40-5ec4-5f10-9b63-f6a49b2edf18', 'crustaceos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('b69cfa40-5ec4-5f10-9b63-f6a49b2edf18', 'huevos') on conflict do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  'c4d24c47-7b8a-5089-a28f-1af0e49faa5d', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'Sartenes', null, 1, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '9583c480-fad4-5a5a-b4d6-1e2375ba0888', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'c4d24c47-7b8a-5089-a28f-1af0e49faa5d', 'Huevos rotos con picadillo', null, 1250,
  array[]::text[], 0, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('9583c480-fad4-5a5a-b4d6-1e2375ba0888', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '31aa10de-f2ff-5961-a4ef-754d07f42582', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'c4d24c47-7b8a-5089-a28f-1af0e49faa5d', 'Huevos rotos con jamón', null, 1350,
  array[]::text[], 1, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('31aa10de-f2ff-5961-a4ef-754d07f42582', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '9fb41317-0f9c-5087-b9db-830a387399d6', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'c4d24c47-7b8a-5089-a28f-1af0e49faa5d', 'Huevos rotos con langostinos', null, 1750,
  array[]::text[], 2, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('9fb41317-0f9c-5087-b9db-830a387399d6', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('9fb41317-0f9c-5087-b9db-830a387399d6', 'crustaceos') on conflict do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  '88b0bf7f-6bf2-57c6-b806-0220236150b3', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'Ensaladas', null, 2, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '12657de3-4c2b-5abf-8e87-74d1f55f157a', 'e3b9828d-0274-5089-94e7-99436aed33c9', '88b0bf7f-6bf2-57c6-b806-0220236150b3', 'Ensalada LTC', 'Lechuga, tomate y cebolla.', 900,
  array[]::text[], 0, 'published', true)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'd4d72b8c-081c-50f6-8ce3-2c3b7f0d1496', 'e3b9828d-0274-5089-94e7-99436aed33c9', '88b0bf7f-6bf2-57c6-b806-0220236150b3', 'Ensalada mixta', 'Lechuga, tomate, cebolla, maíz y huevo.', 1100,
  array[]::text[], 1, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d4d72b8c-081c-50f6-8ce3-2c3b7f0d1496', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '58f0f51b-76e3-53b2-83f0-1d8f73eda3fe', 'e3b9828d-0274-5089-94e7-99436aed33c9', '88b0bf7f-6bf2-57c6-b806-0220236150b3', 'Ensalada de cecina y queso de cabra con mermelada', null, 1500,
  array[]::text[], 2, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('58f0f51b-76e3-53b2-83f0-1d8f73eda3fe', 'lacteos') on conflict do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'Carnes', null, 3, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'd9a4610c-4c5c-52a8-ab1e-792c1c714e01', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Cachopo especial «Taberna»', 'Ternera, jamón, queso de cabra, cebolla caramelizada y jalapeños.', 2800,
  array['recomendado']::text[], 0, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d9a4610c-4c5c-52a8-ab1e-792c1c714e01', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d9a4610c-4c5c-52a8-ab1e-792c1c714e01', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d9a4610c-4c5c-52a8-ab1e-792c1c714e01', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '012874cc-86db-51eb-8f15-ad5ffdd797d8', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Cachopo de ternera tradicional', null, 2450,
  array['recomendado']::text[], 1, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('012874cc-86db-51eb-8f15-ad5ffdd797d8', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('012874cc-86db-51eb-8f15-ad5ffdd797d8', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('012874cc-86db-51eb-8f15-ad5ffdd797d8', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'f83e732c-4415-510e-bbc9-f95c65c60380', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Picaña de ternera asturiana a la piedra', '500 g.', 2350,
  array['recomendado']::text[], 2, 'published', true)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'f8242e29-c62b-54dc-b882-613207794698', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Entrecot de ternera', '400 g.', 2200,
  array[]::text[], 3, 'published', true)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '942139cc-fd98-5243-97c0-1a8e4efaeacc', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Escalopines al cabrales', null, 1600,
  array[]::text[], 4, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('942139cc-fd98-5243-97c0-1a8e4efaeacc', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('942139cc-fd98-5243-97c0-1a8e4efaeacc', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'cebbe16b-13c6-57a7-a10c-abc377e1b1b7', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Costillas al ajillo con pimientos y patatas fritas', null, 1400,
  array[]::text[], 5, 'published', true)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '96809b29-dbbd-594c-9bf8-cb998f77f6bb', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Lacón a la gallega', null, 1400,
  array[]::text[], 6, 'published', true)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '4ff1b2d3-13a4-577b-9da0-faba12ff4a8e', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Pollo al ajillo con patatas fritas', null, 1200,
  array[]::text[], 7, 'published', true)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '0ea20919-154c-5d19-a75a-9c31b33df178', 'e3b9828d-0274-5089-94e7-99436aed33c9', '56606d02-d212-5a16-8ffc-b7ebfe27caf6', 'Callos caseros', 'En temporada. Media ración, 10,00 €.', 1600,
  array[]::text[], 8, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('0ea20919-154c-5d19-a75a-9c31b33df178', 'gluten') on conflict do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  '5b42d725-5d52-59c0-9390-c93e8394ec55', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'Pescados', null, 4, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '34aa01b6-153b-589d-bdb2-30910aa7aedd', 'e3b9828d-0274-5089-94e7-99436aed33c9', '5b42d725-5d52-59c0-9390-c93e8394ec55', 'Calamares fritos de potera', null, 2150,
  array['recomendado']::text[], 0, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('34aa01b6-153b-589d-bdb2-30910aa7aedd', 'moluscos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('34aa01b6-153b-589d-bdb2-30910aa7aedd', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'a1f4f1c2-f92e-5c5a-9742-4c8d0a5813ee', 'e3b9828d-0274-5089-94e7-99436aed33c9', '5b42d725-5d52-59c0-9390-c93e8394ec55', 'Migas de bacalao al estilo «Taberna»', null, 2350,
  array[]::text[], 1, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('a1f4f1c2-f92e-5c5a-9742-4c8d0a5813ee', 'pescado') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'b5a462c8-5b02-5e52-883b-17bef5187223', 'e3b9828d-0274-5089-94e7-99436aed33c9', '5b42d725-5d52-59c0-9390-c93e8394ec55', 'Fritos de bacalao', null, 2200,
  array[]::text[], 2, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('b5a462c8-5b02-5e52-883b-17bef5187223', 'pescado') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('b5a462c8-5b02-5e52-883b-17bef5187223', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '4d15370b-c114-582f-b1af-53e4b88e1fd1', 'e3b9828d-0274-5089-94e7-99436aed33c9', '5b42d725-5d52-59c0-9390-c93e8394ec55', 'Chipirones fritos con alioli', null, 1800,
  array[]::text[], 3, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('4d15370b-c114-582f-b1af-53e4b88e1fd1', 'moluscos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('4d15370b-c114-582f-b1af-53e4b88e1fd1', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('4d15370b-c114-582f-b1af-53e4b88e1fd1', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '855299a7-ce1f-5b38-8a2b-14152e020037', 'e3b9828d-0274-5089-94e7-99436aed33c9', '5b42d725-5d52-59c0-9390-c93e8394ec55', 'Chipirones a la sidra', null, 1700,
  array[]::text[], 4, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('855299a7-ce1f-5b38-8a2b-14152e020037', 'moluscos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'd1a36b7b-9c12-595c-a6d8-8ebcf1ff3874', 'e3b9828d-0274-5089-94e7-99436aed33c9', '5b42d725-5d52-59c0-9390-c93e8394ec55', 'Fritos de merluza', null, 1600,
  array[]::text[], 5, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d1a36b7b-9c12-595c-a6d8-8ebcf1ff3874', 'pescado') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d1a36b7b-9c12-595c-a6d8-8ebcf1ff3874', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'd9d482e6-8b6d-5daa-a8fd-90c4847272ce', 'e3b9828d-0274-5089-94e7-99436aed33c9', '5b42d725-5d52-59c0-9390-c93e8394ec55', 'Mejillones marineros a la vinagreta', null, 900,
  array[]::text[], 6, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('d9d482e6-8b6d-5daa-a8fd-90c4847272ce', 'moluscos') on conflict do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  '1d65789c-d272-5b0d-b86a-0be6163e0421', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'Postres caseros', null, 5, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '99aeea46-4d78-51f2-a539-1bf7b36c407c', 'e3b9828d-0274-5089-94e7-99436aed33c9', '1d65789c-d272-5b0d-b86a-0be6163e0421', 'Torrija de Baileys con helado', null, 650,
  array['recomendado']::text[], 0, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('99aeea46-4d78-51f2-a539-1bf7b36c407c', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('99aeea46-4d78-51f2-a539-1bf7b36c407c', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('99aeea46-4d78-51f2-a539-1bf7b36c407c', 'huevos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '38126d4c-929d-5ae0-b9bd-ee6a41818d49', 'e3b9828d-0274-5089-94e7-99436aed33c9', '1d65789c-d272-5b0d-b86a-0be6163e0421', 'Leche frita con helado', null, 650,
  array[]::text[], 1, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('38126d4c-929d-5ae0-b9bd-ee6a41818d49', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('38126d4c-929d-5ae0-b9bd-ee6a41818d49', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('38126d4c-929d-5ae0-b9bd-ee6a41818d49', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '6bb0d9e7-7a90-57fa-be72-2c7854c5899a', 'e3b9828d-0274-5089-94e7-99436aed33c9', '1d65789c-d272-5b0d-b86a-0be6163e0421', 'Tarta de queso con helado de frutos rojos', null, 600,
  array[]::text[], 2, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('6bb0d9e7-7a90-57fa-be72-2c7854c5899a', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('6bb0d9e7-7a90-57fa-be72-2c7854c5899a', 'huevos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('6bb0d9e7-7a90-57fa-be72-2c7854c5899a', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '89544a39-1910-5f4f-9076-5ffe586d1f97', 'e3b9828d-0274-5089-94e7-99436aed33c9', '1d65789c-d272-5b0d-b86a-0be6163e0421', 'Tarta de la abuela', null, 600,
  array[]::text[], 3, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('89544a39-1910-5f4f-9076-5ffe586d1f97', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('89544a39-1910-5f4f-9076-5ffe586d1f97', 'gluten') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '8c823eaf-a9be-58fd-b649-d78c9ad578d6', 'e3b9828d-0274-5089-94e7-99436aed33c9', '1d65789c-d272-5b0d-b86a-0be6163e0421', 'Tarta de turrón', null, 600,
  array[]::text[], 4, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('8c823eaf-a9be-58fd-b649-d78c9ad578d6', 'lacteos') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('8c823eaf-a9be-58fd-b649-d78c9ad578d6', 'frutos_de_cascara') on conflict do nothing;

-- QR de este negocio (el token viaja en la URL: /b/thewhitebar-mieres?qr=<token>)
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '534fbc5d-c0d2-566b-9a08-99a30212fb2a', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'twb-mesa', 'Mesas', 'landing', 'table', null)
on conflict (token) do nothing;
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '9bd01f1a-b8a3-555b-9298-6dec81ceb9cb', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'twb-barra', 'Barra', 'daily_menu', 'bar', null)
on conflict (token) do nothing;
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '3e808c31-bd0b-5c8e-b4c4-4ea5246e2f18', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'twb-ticket', 'Ticket', 'review', 'ticket', null)
on conflict (token) do nothing;
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '08d1144e-c35f-5e74-9dfd-ce598e1d75e2', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'twb-escap', 'Escaparate', 'menu', 'window', null)
on conflict (token) do nothing;
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  'a5522f0b-769d-5410-90fb-83790cad2784', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'twb-redes', 'Redes sociales', 'landing', 'social', null)
on conflict (token) do nothing;

-- --- Menú del día de MUESTRA (el real lo carga el negocio cada día) ---
insert into daily_menus (id, business_id, service_date, price_cents, includes_drink, notes, status, is_demo) values (
  '560a2bdd-e524-523b-8727-ffebe59c6e50', 'e3b9828d-0274-5089-94e7-99436aed33c9', current_date, null, true,
  'Menú de muestra para enseñar cómo funciona la sección. El negocio carga el de cada día desde el panel. Formato y precio reales se toman de su pizarra una vez confirmados.',
  'published', true)
on conflict (business_id, service_date) do nothing;
insert into daily_menu_items (id, daily_menu_id, course, name, position) values (
  '424c5bfc-b068-58ad-98ee-249b9480e005', '560a2bdd-e524-523b-8727-ffebe59c6e50', 'primero', 'Primero de muestra', 0)
on conflict (id) do nothing;
insert into daily_menu_items (id, daily_menu_id, course, name, position) values (
  '4d088169-109a-5e55-9b4d-2a794f561209', '560a2bdd-e524-523b-8727-ffebe59c6e50', 'primero', 'Otro primero de muestra', 1)
on conflict (id) do nothing;
insert into daily_menu_items (id, daily_menu_id, course, name, position) values (
  '0592339e-285c-5c99-a416-6f334b88592a', '560a2bdd-e524-523b-8727-ffebe59c6e50', 'segundo', 'Segundo de muestra', 2)
on conflict (id) do nothing;
insert into daily_menu_items (id, daily_menu_id, course, name, position) values (
  '89cfd78a-fbb9-5919-b345-803d1dff7c9e', '560a2bdd-e524-523b-8727-ffebe59c6e50', 'segundo', 'Otro segundo de muestra', 3)
on conflict (id) do nothing;
insert into daily_menu_items (id, daily_menu_id, course, name, position) values (
  '28c64ea6-fe3f-5500-a70c-3e07c4eac0e1', '560a2bdd-e524-523b-8727-ffebe59c6e50', 'postre', 'Postre de muestra', 4)
on conflict (id) do nothing;

-- --- Formatos de menú tomados de su carta y su pizarra ---
insert into special_menus (id, business_id, kind, name, description, price_cents, status, is_demo) values (
  'e377e4f8-f8bd-560f-845c-7a018033e967', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'other',
  'Menú del día · de lunes a viernes', 'Primero, segundo y postre. Incluye pan, agua o vino. Cambia cada día: el de la foto llevaba pote asturiano, arroz con pulpo, tosta de setas con cebolla caramelizada o ensalada César de primero; y fritos de merluza, manitas de cerdo, hamburguesa al cabrales o escalopines al cabrales de segundo.', 1400, 'published', true)
on conflict (id) do nothing;
insert into special_menus (id, business_id, kind, name, description, price_cents, status, is_demo) values (
  'a484bfbe-958d-50e6-aa8c-68a466b9af61', 'e3b9828d-0274-5089-94e7-99436aed33c9', 'weekend',
  'Menú del día · sábados y domingos', 'Primero, segundo y postre. Incluye pan, agua o vino. Cambia cada día: el de la foto llevaba pote asturiano, arroz con pulpo, tosta de setas con cebolla caramelizada o ensalada César de primero; y fritos de merluza, manitas de cerdo, hamburguesa al cabrales o escalopines al cabrales de segundo.', 1600, 'published', true)
on conflict (id) do nothing;

-- ==========================================================================
--  Restaurante La Viña  (/b/la-vina-cenera)
--  Origen de los datos: Fichas públicas del negocio (Facebook, cylex, qdq, listae) consultadas el 2026-09-09.
-- ==========================================================================
insert into businesses (id, slug, name, sector, status, trial_ends_at) values (
  'd8406b62-63ab-5511-99bf-3af5ab602235', 'la-vina-cenera', 'Restaurante La Viña', 'hosteleria', 'trial', now() + interval '7 days')
on conflict (slug) do nothing;

insert into business_settings (business_id, tagline, address, phone, whatsapp, email, website, instagram, facebook, review_url, opening_hours, theme, modules) values (
  'd8406b62-63ab-5511-99bf-3af5ab602235', 'Cocina asturiana desde 1962, en el Valle de Cuna y Cenera', 'Ctra. de Cenera, 1 · 33615 Cenera, Mieres (Asturias)', '+34985426690',
  null,  -- pendiente: sin número, el botón no se pinta
  'Restaurantelagarlavina@gmail.com', null, 'https://www.instagram.com/restaurantelavinacenera/', 'https://www.facebook.com/p/Restaurante-La-Vi%C3%B1a-Cenera-100076182274701/',
  null,  -- review_url: PENDIENTE de que el negocio dé su enlace oficial de Google
  '[]'::jsonb,  -- horario: en la ficha hay uno, pero sin confirmar por el local
  '{"fondo":"#140e0b","acento":"#d98324","acento2":"#8fbf6a","texto":"#f7f0e8"}'::jsonb,
  '{"daily_menu":false,"menu":true,"reservations":true,"groups":true,"events":true,"feedback":true,"loyalty":true,"qr":true}'::jsonb)
on conflict (business_id) do nothing;

insert into trial_settings (business_id, trial_days) values ('d8406b62-63ab-5511-99bf-3af5ab602235', 7)
on conflict (business_id) do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  '7a3d4bbe-8f68-5e0d-a201-8f2323ae3bbf', 'd8406b62-63ab-5511-99bf-3af5ab602235', 'Especialidades de la casa', null, 0, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '10e375ef-e6b2-52f6-a658-3412d9018b30', 'd8406b62-63ab-5511-99bf-3af5ab602235', '7a3d4bbe-8f68-5e0d-a201-8f2323ae3bbf', 'Lechazo al horno', 'Asado lento, la especialidad más citada de la casa.', 2400,
  array['recomendado']::text[], 0, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '43b1c07e-d8fc-5474-9214-2a47fd7ef842', 'd8406b62-63ab-5511-99bf-3af5ab602235', '7a3d4bbe-8f68-5e0d-a201-8f2323ae3bbf', 'Cordero a la estaca', 'A la brasa, servido a la mesa.', 2600,
  array['recomendado']::text[], 1, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '839afedb-d06b-5c58-8ab9-e479133b8014', 'd8406b62-63ab-5511-99bf-3af5ab602235', '7a3d4bbe-8f68-5e0d-a201-8f2323ae3bbf', 'Lacón con cachelos', 'Con patata cocida y pimentón.', 1600,
  array['recomendado']::text[], 2, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '91adbf21-df68-5521-bbe5-8a29e303f9ea', 'd8406b62-63ab-5511-99bf-3af5ab602235', '7a3d4bbe-8f68-5e0d-a201-8f2323ae3bbf', 'Callos caseros', 'Guisados en casa, del día.', 1400,
  array['recomendado']::text[], 3, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('91adbf21-df68-5521-bbe5-8a29e303f9ea', 'gluten') on conflict do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  '0b78ad2c-7c1d-5329-8f2f-2f937c634c89', 'd8406b62-63ab-5511-99bf-3af5ab602235', 'Para picar', null, 1, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'f0a54687-6f04-581f-82f2-c8fcf0557396', 'd8406b62-63ab-5511-99bf-3af5ab602235', '0b78ad2c-7c1d-5329-8f2f-2f937c634c89', 'Tabla de quesos asturianos', 'Plato de muestra: lo confirma el restaurante.', 1200,
  array[]::text[], 0, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('f0a54687-6f04-581f-82f2-c8fcf0557396', 'lacteos') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'c50cc473-e40d-58ce-b6a4-4fe6f0c3ebe3', 'd8406b62-63ab-5511-99bf-3af5ab602235', '0b78ad2c-7c1d-5329-8f2f-2f937c634c89', 'Chorizo a la sidra', 'Plato de muestra: lo confirma el restaurante.', 900,
  array[]::text[], 1, 'published', true)
on conflict (id) do nothing;

insert into menu_categories (id, business_id, name, description, position, status, is_demo) values (
  '0f02543f-66c5-5ed0-b525-298469a6a7e0', 'd8406b62-63ab-5511-99bf-3af5ab602235', 'Postres', null, 2, 'published', false)
on conflict (id) do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  '57d7d97c-2724-5810-9652-7a58838bd2d9', 'd8406b62-63ab-5511-99bf-3af5ab602235', '0f02543f-66c5-5ed0-b525-298469a6a7e0', 'Casadielles', 'Postre asturiano citado en la carta de la casa.', 500,
  array['recomendado']::text[], 0, 'published', false)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('57d7d97c-2724-5810-9652-7a58838bd2d9', 'gluten') on conflict do nothing;
insert into menu_item_allergens (item_id, allergen) values ('57d7d97c-2724-5810-9652-7a58838bd2d9', 'frutos_de_cascara') on conflict do nothing;
insert into menu_items (id, business_id, category_id, name, description, price_cents, tags, position, status, is_demo) values (
  'f0e9b612-e25e-58b2-8ef4-7069716302d5', 'd8406b62-63ab-5511-99bf-3af5ab602235', '0f02543f-66c5-5ed0-b525-298469a6a7e0', 'Arroz con leche', 'Postre de muestra: lo confirma el restaurante.', 500,
  array[]::text[], 1, 'published', true)
on conflict (id) do nothing;
insert into menu_item_allergens (item_id, allergen) values ('f0e9b612-e25e-58b2-8ef4-7069716302d5', 'lacteos') on conflict do nothing;

-- QR de este negocio (el token viaja en la URL: /b/la-vina-cenera?qr=<token>)
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '65b366c3-4d05-5346-9e0b-0dde91cadcef', 'd8406b62-63ab-5511-99bf-3af5ab602235', 'lv-mesa', 'Mesas', 'landing', 'table', null)
on conflict (token) do nothing;
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '3895c4a4-9d67-5030-acff-b11f663e101e', 'd8406b62-63ab-5511-99bf-3af5ab602235', 'lv-grupos', 'Cartel de grupos', 'group', 'window', null)
on conflict (token) do nothing;
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '99f81975-9036-5172-9d74-8205c66d641c', 'd8406b62-63ab-5511-99bf-3af5ab602235', 'lv-ticket', 'Ticket', 'review', 'ticket', null)
on conflict (token) do nothing;
insert into qr_codes (id, business_id, token, label, target, location, location_ref) values (
  '380eb270-d289-5598-9d38-ec209eec9947', 'd8406b62-63ab-5511-99bf-3af5ab602235', 'lv-redes', 'Redes sociales', 'landing', 'social', null)
on conflict (token) do nothing;

commit;

-- ============================================================================
--  RESUMEN
--   La Taberna · The White Bar : 6 categorías, 44 platos (30 sin confirmar)
--   Restaurante La Viña        : 3 categorías, 8 platos (3 sin confirmar)
--
--  PENDIENTE antes de publicar con datos reales (no lo puede inventar nadie):
--   · WhatsApp de cada negocio
--   · review_url oficial de Google de cada negocio
--   · Horario confirmado por el local
--   · Fotos de los platos
--   · Precios marcados is_demo, confirmados uno a uno
-- ============================================================================
