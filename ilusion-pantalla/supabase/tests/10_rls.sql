-- Tests de seguridad (RLS). Cada bloque falla con ASSERT si algo es explotable.
-- Datos base como superusuario
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-00000000000a','ana@x.es'),
 ('00000000-0000-0000-0000-00000000000b','beto@x.es'),
 ('00000000-0000-0000-0000-00000000000c','cris@x.es'),
 ('00000000-0000-0000-0000-0000000000ad','admin@x.es');
select set_config('request.jwt.claim.role','service_role',false);
update perfiles set rol='admin' where id='00000000-0000-0000-0000-0000000000ad';
select set_config('request.jwt.claim.role','',false);

insert into categorias (nombre,slug) values ('Naturaleza','naturaleza-viva');
insert into wallpapers (slug,titulo,categoria_id,es_premium,estado_publicacion,fecha_publicacion) values
 ('gratis-1','Bosque gratis',(select id from categorias limit 1),false,'publicado',now()),
 ('premium-1','Aurora premium',(select id from categorias limit 1),true,'publicado',now()),
 ('borrador-1','Borrador secreto',(select id from categorias limit 1),false,'borrador',null);
insert into wallpaper_archivos (wallpaper_id,calidad,codec,fps,tamano_bytes,storage_bucket,storage_path)
 select id,'q1080','h264',30,1000000,'premium','p/aurora.mp4' from wallpapers where slug='premium-1';
insert into wallpaper_archivos (wallpaper_id,calidad,codec,fps,tamano_bytes,storage_bucket,storage_path)
 select id,'q1080','h264',30,1000000,'publico','g/bosque.mp4' from wallpapers where slug='gratis-1';

-- 1. Anónimo: ve publicados, no borradores; archivos premium NO; gratis sí
begin; set local role anon;
do $$ begin
  assert (select count(*) from wallpapers) = 2, 'anon debe ver 2 publicados';
  assert (select count(*) from wallpapers where slug='borrador-1') = 0, 'anon no ve borradores';
  assert (select count(*) from wallpaper_archivos) = 1, 'anon solo ve archivo de gratis';
  assert (select count(*) from wallpaper_archivos where storage_bucket='premium') = 0, 'anon NO ve rutas premium';
  assert (select count(*) from catalogo_publico) = 2, 'vista pública = 2';
  assert (select count(*) from feature_flags where clave='pro.inmobiliarias' and activo) = 0, 'pro desactivado';
end $$; rollback;

-- 2. Anónimo no puede escribir catálogo, ni leer ni ESCRIBIR analítica/consentimientos (todo va por Edge Function)
begin; set local role anon;
do $$ begin
  begin insert into wallpapers (slug,titulo) values ('hack','Hack'); assert false,'anon insertó wallpaper';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from eventos_analitica; assert false,'anon leyó analítica';
  exception when insufficient_privilege then null; end;
  begin insert into eventos_analitica (evento,propiedades_evento) values ('app_abierta','{}'); assert false,'anon escribió evento directo';
  exception when insufficient_privilege then null; end;
  begin insert into consentimientos (instalacion_id,finalidad,concedido,version_texto) values (gen_random_uuid(),'analitica',true,'x'); assert false,'anon escribió consentimiento';
  exception when insufficient_privilege then null; end;
end $$; rollback;

-- 3. Usuario normal: no se auto-promociona (plan/estado/rol) ni se da premium
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true), set_config('request.jwt.claim.role','authenticated',true);
update perfiles set plan='premium', estado_suscripcion='activa', rol='admin', nombre='Ana' where id=auth.uid();
do $$ begin
  assert (select plan from perfiles where id=auth.uid()) = 'gratis', 'ESCALADA: usuario se dio premium';
  assert (select rol from perfiles where id=auth.uid()) = 'usuario', 'ESCALADA: usuario se hizo admin';
  assert (select nombre from perfiles where id=auth.uid()) = 'Ana', 'puede editar su nombre';
  begin insert into suscripciones (usuario_id,plataforma,producto_id,estado,recibo_verificado) values (auth.uid(),'manual','x','activa',true);
    assert false,'usuario creó su propia suscripción'; exception when insufficient_privilege then null; end;
  assert not tiene_premium(auth.uid()), 'sin premium';
  assert (select count(*) from perfiles) = 1, 'solo ve su perfil';
end $$; rollback;

-- 4. Aislamiento entre usuarios: favoritos / historial
insert into favoritos select '00000000-0000-0000-0000-00000000000b', id from wallpapers where slug='gratis-1';
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  assert (select count(*) from favoritos) = 0, 'Ana no ve favoritos de Beto';
  begin insert into favoritos select '00000000-0000-0000-0000-00000000000b', id from wallpapers limit 1; assert false,'Ana insertó favorito a nombre de Beto';
  exception when insufficient_privilege or check_violation then null; end;
  insert into favoritos select auth.uid(), id from wallpapers where slug='gratis-1';
  assert (select count(*) from favoritos) = 1;
end $$; rollback;

-- 5. Suscripción verificada (service_role) → premium; vencida → no
insert into suscripciones (usuario_id,plataforma,producto_id,purchase_token_hash,estado,recibo_verificado,expiracion) values
 ('00000000-0000-0000-0000-00000000000b','google_play','mensual','tb','activa',true, now()+interval '10 days'),
 ('00000000-0000-0000-0000-00000000000c','google_play','mensual','tc','activa',true, now()-interval '1 day');
do $$ begin
  assert tiene_premium('00000000-0000-0000-0000-00000000000b'), 'Beto premium';
  assert not tiene_premium('00000000-0000-0000-0000-00000000000c'), 'Cris vencida no premium';
  assert not tiene_premium('00000000-0000-0000-0000-00000000000a'), 'Ana no premium';
end $$;

-- 6. Staff/Admin gestiona catálogo; usuario normal no
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ad',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  assert (select count(*) from wallpapers) = 3, 'admin ve borradores';
  update wallpapers set titulo='Editado por admin' where slug='borrador-1';
  assert (select titulo from wallpapers where slug='borrador-1')='Editado por admin','admin edita';
  update feature_flags set activo=true where clave='studio.ia';
  assert (select activo from feature_flags where clave='studio.ia'),'admin cambia flags';
end $$; rollback;
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true), set_config('request.jwt.claim.role','authenticated',true);
update wallpapers set titulo='Hackeado';
update feature_flags set activo=true;
do $$ begin
  assert (select count(*) from wallpapers where titulo='Hackeado')=0,'usuario editó catálogo';
  assert (select count(*) from feature_flags where activo and clave='pro.inmobiliarias')=0,'usuario cambió flags';
end $$; rollback;

-- 7. PRO: multiempresa, roles y aislamiento
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',true), set_config('request.jwt.claim.role','authenticated',true);
select crear_empresa('Inmo Ana','inmo-ana') as emp \gset
do $$ declare e uuid := (select id from empresas where slug='inmo-ana'); begin
  assert rol_en(e) = 'propietario', 'creador = propietario';
  insert into propiedades (empresa_id,referencia,operacion,titulo) values (e,'R1','venta','Ático centro');
end $$;
commit;
-- Ana invita a Beto como visualizador y a Cris como agente (como superusuario para simplificar)
insert into miembros_empresa select id,'00000000-0000-0000-0000-00000000000b','visualizador' from empresas where slug='inmo-ana';
insert into miembros_empresa select id,'00000000-0000-0000-0000-00000000000c','agente' from empresas where slug='inmo-ana';
-- Empresa rival
insert into empresas (id,nombre,slug) values ('11111111-1111-1111-1111-111111111111','Rival','rival');
insert into miembros_empresa select id,'00000000-0000-0000-0000-0000000000ad','propietario' from empresas where slug='rival';
insert into propiedades (empresa_id,referencia,operacion,titulo) select id,'X9','venta','Secreto rival' from empresas where slug='rival';

begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  assert (select count(*) from propiedades) = 1, 'visualizador ve solo la suya';
  assert (select count(*) from propiedades where referencia='X9')=0, 'FUGA entre empresas';
  update propiedades set titulo='Cambiado' ; assert (select count(*) from propiedades where titulo='Cambiado')=0,'visualizador editó';
  begin insert into propiedades (empresa_id,referencia,operacion,titulo) select id,'R2','venta','Nueva' from empresas where slug='inmo-ana'; assert false,'visualizador insertó';
  exception when insufficient_privilege then null; end;
  begin insert into propiedades (empresa_id,referencia,operacion,titulo) values ('11111111-1111-1111-1111-111111111111','R3','venta','Intrusa'); assert false,'insertó en empresa ajena';
  exception when insufficient_privilege then null; end;
end $$; rollback;
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  insert into propiedades (empresa_id,referencia,operacion,titulo) select id,'R4','alquiler','Piso agente' from empresas where slug='inmo-ana';
  assert (select count(*) from propiedades)=2,'agente crea y ve';
  delete from propiedades where referencia='R4'; assert (select count(*) from propiedades where referencia='R4')=1,'agente NO borra (solo admin)';
  begin insert into miembros_empresa values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'propietario'); assert false,'auto-asignación a empresa ajena';
  exception when insufficient_privilege then null; end;
end $$; rollback;

-- 8. Créditos IA: solo se lee el propio saldo
insert into creditos_ia (usuario_id,delta,motivo) values ('00000000-0000-0000-0000-00000000000a',50,'regalo');
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  begin perform saldo_creditos('00000000-0000-0000-0000-00000000000a', null); assert false,'leyó saldo ajeno'; exception when raise_exception then null; end;
  begin insert into creditos_ia (usuario_id,delta,motivo) values (auth.uid(),9999,'regalo'); assert false,'se regaló créditos'; exception when insufficient_privilege then null; end;
  assert (select count(*) from creditos_ia)=0,'no ve créditos ajenos';
end $$; rollback;

-- 9. Restricciones de datos
do $$ begin
  begin insert into wallpapers (slug,titulo,estado_publicacion) values ('sin-fecha','Sin fecha','publicado'); assert false,'publicado sin fecha';
  exception when check_violation then null; end;
  begin insert into wallpaper_archivos (wallpaper_id,calidad,codec,fps,tamano_bytes,storage_bucket,storage_path)
    select id,'q720','h264',30,999999999,'b','p' from wallpapers limit 1; assert false,'archivo > 150MB aceptado';
  exception when check_violation then null; end;
  begin insert into eventos_analitica (evento) values ('MAL EVENTO'); assert false,'evento inválido';
  exception when check_violation then null; end;
end $$;
select 'RLS OK' as resultado;
