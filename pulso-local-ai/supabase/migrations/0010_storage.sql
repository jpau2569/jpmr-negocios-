-- ============================================================================
--  PULSO LOCAL AI — 0010 · Supabase Storage
-- ----------------------------------------------------------------------------
--  Un único bucket público de lectura para fotos de inmuebles, logos y portadas.
--  La escritura está cerrada: solo puede subir quien pertenece al negocio, y la
--  primera carpeta de la ruta TIENE que ser su business_id.
--      <business_id>/<property_id>/<archivo>.jpg
--  (`storage.objects.name` no incluye el bucket, así que el primer segmento de
--   la ruta es ya el business_id.)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medios',
  'medios',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists medios_lectura_publica on storage.objects;
create policy medios_lectura_publica on storage.objects for select to anon, authenticated
  using (bucket_id = 'medios');

drop policy if exists medios_escritura_miembros on storage.objects;
create policy medios_escritura_miembros on storage.objects for insert to authenticated
  with check (
    bucket_id = 'medios'
    and public.puede_escribir(((string_to_array(name, '/'))[1])::uuid)
  );

drop policy if exists medios_actualizar_miembros on storage.objects;
create policy medios_actualizar_miembros on storage.objects for update to authenticated
  using (bucket_id = 'medios' and public.puede_escribir(((string_to_array(name, '/'))[1])::uuid));

drop policy if exists medios_borrar_miembros on storage.objects;
create policy medios_borrar_miembros on storage.objects for delete to authenticated
  using (bucket_id = 'medios' and public.puede_administrar(((string_to_array(name, '/'))[1])::uuid));
