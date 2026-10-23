-- Consentimiento, borrado, retención y métricas (migración 0004)
\set i1 '\'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\''
\set i2 '\'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\''

-- 1. Consentimiento vigente: sin registro = no; concedido = sí; versión distinta = no; revocado = no
do $$ declare a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; begin
  assert not consentimiento_vigente(a,'analitica','v1'), 'sin registro no hay consentimiento';
  insert into consentimientos (instalacion_id,finalidad,concedido,version_texto) values (a,'analitica',true,'v1');
  assert consentimiento_vigente(a,'analitica','v1'), 'concedido vigente';
  assert not consentimiento_vigente(a,'analitica','v2'), 'texto nuevo exige reconsentir';
  assert not consentimiento_vigente(a,'publicidad','v1'), 'otra finalidad no';
  insert into consentimientos (instalacion_id,finalidad,concedido,version_texto) values (a,'analitica',false,'v1');
  assert not consentimiento_vigente(a,'analitica','v1'), 'revocado: último registro manda';
  insert into consentimientos (instalacion_id,finalidad,concedido,version_texto) values (a,'analitica',true,'v1');
  assert consentimiento_vigente(a,'analitica','v1'), 'vuelve a conceder';
end $$;

-- 2. Datos: i1 abre hoy-8, vuelve +1 y +7, descarga y activa; i2 abre hoy-8 y no vuelve
insert into eventos_analitica (instalacion_id,evento,propiedades_evento,created_at) values
 (:i1,'app_abierta','{"android_sdk":34,"version_app":"0.2.0","primera_vez":true}', now()-interval '8 days'),
 (:i1,'app_abierta','{"android_sdk":34,"version_app":"0.2.0","primera_vez":false}', now()-interval '7 days'),
 (:i1,'app_abierta','{"android_sdk":34,"version_app":"0.2.0","primera_vez":false}', now()-interval '1 day'),
 (:i1,'wallpaper_visto','{"wallpaper_slug":"bosque","origen":"inicio"}', now()-interval '8 days'),
 (:i1,'descarga_completada','{"wallpaper_slug":"bosque","calidad":"q1080","duracion_ms":900}', now()-interval '8 days'),
 (:i1,'wallpaper_activado','{"wallpaper_slug":"bosque","perfil":"estandar"}', now()-interval '8 days'),
 (:i1,'favorito_alternado','{"wallpaper_slug":"bosque","activo":true}', now()-interval '8 days'),
 (:i2,'app_abierta','{"android_sdk":29,"version_app":"0.2.0","primera_vez":true}', now()-interval '8 days'),
 (:i2,'wallpaper_visto','{"wallpaper_slug":"bosque","origen":"explorar"}', now()-interval '8 days');

-- 3. Solo el staff ve métricas; un usuario normal y anon, nada
insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000e1','editor@x.es');
select set_config('request.jwt.claim.role','service_role',false);
update perfiles set rol='editor' where id='00000000-0000-0000-0000-0000000000e1';
select set_config('request.jwt.claim.role','',false);

begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ declare r record; begin
  select * into r from embudo_activacion;
  assert r.abren_app = 2 and r.descargan = 1 and r.activan = 1 and r.pct_activacion = 50.0, 'embudo: ' || r::text;
  select * into r from wallpapers_top where wallpaper_slug='bosque';
  assert r.vistas = 2 and r.descargas = 1 and r.activados = 1 and r.favoritos_altas = 1, 'top: ' || r::text;
  select * into r from retencion_cohortes where cohorte = (now()-interval '8 days')::date;
  assert r.instalaciones = 2 and r.vuelven_d1 = 1 and r.vuelven_d7 = 1, 'retención: ' || r::text;
  assert (select count(*) from uso_por_android) = 2, 'dos versiones de Android';
  assert (select sum(eventos) from metricas_diarias) = 9, 'metricas_diarias suma 9';
end $$; rollback;

begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  assert (select count(*) from embudo_activacion where abren_app > 0) = 0, 'un usuario normal no ve el embudo';
  assert (select count(*) from wallpapers_top) = 0, 'ni el ranking';
  assert (select count(*) from metricas_diarias) = 0, 'ni métricas';
  begin perform borrar_analitica(gen_random_uuid(),'v1'); assert false,'usuario ejecutó borrar_analitica'; exception when insufficient_privilege then null; end;
  begin perform purgar_analitica(1); assert false,'usuario ejecutó purgar'; exception when insufficient_privilege then null; end;
  begin perform consentimiento_vigente(gen_random_uuid(),'analitica','v1'); assert false,'usuario ejecutó consentimiento_vigente'; exception when insufficient_privilege then null; end;
end $$; rollback;
begin; set local role anon;
do $$ begin
  begin perform count(*) from embudo_activacion; assert false,'anon leyó vistas'; exception when insufficient_privilege then null; end;
end $$; rollback;

-- 4. Borrado: elimina SOLO los eventos de la instalación y revoca el consentimiento
do $$ declare n bigint; begin
  n := borrar_analitica('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','v1');
  assert n = 7, 'borró 7 eventos de i1, borró ' || n;
  assert (select count(*) from eventos_analitica where instalacion_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 2, 'i2 intacta';
  assert not consentimiento_vigente('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','analitica','v1'), 'consentimiento revocado tras borrar';
end $$;

-- 5. Retención: purga lo antiguo y no lo reciente
insert into eventos_analitica (instalacion_id,evento,propiedades_evento,created_at) values
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ajuste_cambiado','{"ajuste":"fps"}', now()-interval '14 months'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ajuste_cambiado','{"ajuste":"fps"}', now()-interval '2 months');
do $$ declare n bigint; begin
  n := purgar_analitica(13);
  assert n = 1, 'purgó solo el de 14 meses, purgó ' || n;
  assert (select count(*) from eventos_analitica where evento='ajuste_cambiado') = 1;
  begin perform purgar_analitica(0); assert false,'aceptó 0 meses'; exception when raise_exception then null; end;
end $$;
select 'ANALÍTICA OK' as resultado;
