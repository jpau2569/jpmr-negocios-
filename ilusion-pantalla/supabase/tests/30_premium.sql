-- Premium, cancelación y exportación de datos (migración 0005)
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-0000000000f1','activa@x.es'), ('00000000-0000-0000-0000-0000000000f2','cancelada@x.es'),
 ('00000000-0000-0000-0000-0000000000f3','vencida@x.es'), ('00000000-0000-0000-0000-0000000000f4','espera@x.es'),
 ('00000000-0000-0000-0000-0000000000f5','gracia@x.es'),  ('00000000-0000-0000-0000-0000000000f6','sinverificar@x.es'),
 ('00000000-0000-0000-0000-0000000000f7','cancelada-vencida@x.es');
insert into suscripciones (usuario_id,plataforma,producto_id,purchase_token_hash,estado,recibo_verificado,expiracion) values
 ('00000000-0000-0000-0000-0000000000f1','google_play','mensual','h1','activa',true, now()+interval '20 days'),
 ('00000000-0000-0000-0000-0000000000f2','google_play','anual','h2','cancelada',true, now()+interval '40 days'),
 ('00000000-0000-0000-0000-0000000000f3','google_play','mensual','h3','activa',true, now()-interval '1 hour'),
 ('00000000-0000-0000-0000-0000000000f4','google_play','mensual','h4','pausada',true, now()+interval '5 days'),
 ('00000000-0000-0000-0000-0000000000f5','google_play','mensual','h5','en_gracia',true, now()+interval '3 days'),
 ('00000000-0000-0000-0000-0000000000f6','google_play','mensual','h6','activa',false, now()+interval '20 days'),
 ('00000000-0000-0000-0000-0000000000f7','google_play','mensual','h7','cancelada',true, now()-interval '2 days');
do $$ begin
  assert tiene_premium('00000000-0000-0000-0000-0000000000f1'), 'activa → premium';
  assert tiene_premium('00000000-0000-0000-0000-0000000000f2'), 'CANCELADA con tiempo pagado conserva premium (regla de Play)';
  assert not tiene_premium('00000000-0000-0000-0000-0000000000f7'), 'cancelada ya vencida: sin premium';
  assert not tiene_premium('00000000-0000-0000-0000-0000000000f3'), 'vencida: sin premium';
  assert not tiene_premium('00000000-0000-0000-0000-0000000000f4'), 'pausada/en espera: sin premium';
  assert tiene_premium('00000000-0000-0000-0000-0000000000f5'), 'periodo de gracia: premium';
  assert not tiene_premium('00000000-0000-0000-0000-0000000000f6'), 'sin verificar: sin premium';
end $$;

-- el mismo token de compra no puede ligarse a dos cuentas
do $$ begin
  begin insert into suscripciones (usuario_id,plataforma,producto_id,purchase_token_hash,estado,recibo_verificado) values ('00000000-0000-0000-0000-0000000000f6','google_play','mensual','h1','activa',true);
    assert false,'dos cuentas con el mismo token'; exception when unique_violation then null; end;
  begin insert into suscripciones (usuario_id,plataforma,producto_id,estado,recibo_verificado) values ('00000000-0000-0000-0000-0000000000f6','google_play','mensual','activa',true);
    assert false,'Play sin hash de token'; exception when check_violation then null; end;
end $$;

-- sincronizar_plan: refleja el derecho en el perfil (solo service_role)
select set_config('request.jwt.claim.role','service_role',false);
select sincronizar_plan('00000000-0000-0000-0000-0000000000f1'); select sincronizar_plan('00000000-0000-0000-0000-0000000000f3');
select set_config('request.jwt.claim.role','',false);
do $$ begin
  assert (select plan from perfiles where id='00000000-0000-0000-0000-0000000000f1') = 'premium';
  assert (select estado_suscripcion from perfiles where id='00000000-0000-0000-0000-0000000000f1') = 'activa';
  assert (select plan from perfiles where id='00000000-0000-0000-0000-0000000000f3') = 'gratis', 'vencida vuelve a gratis';
end $$;
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ begin
  begin perform sincronizar_plan('00000000-0000-0000-0000-0000000000f1'); assert false,'usuario ejecutó sincronizar_plan'; exception when insufficient_privilege then null; end;
end $$; rollback;

-- exportar_mis_datos: solo lo propio, sin hashes de token, y exige sesión
insert into favoritos select '00000000-0000-0000-0000-0000000000f1', id from wallpapers limit 2;
insert into favoritos select '00000000-0000-0000-0000-0000000000f2', id from wallpapers limit 1;
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',true), set_config('request.jwt.claim.role','authenticated',true);
do $$ declare j jsonb; begin
  j := exportar_mis_datos();
  assert jsonb_array_length(j->'favoritos') = 2, 'exporta solo sus 2 favoritos';
  assert j->'perfil'->>'email' = 'activa@x.es', 'su perfil';
  assert not (j::text like '%h1%'), 'no filtra el hash del token de compra';
  assert not (j::text like '%f2@%' or j::text like '%cancelada@x.es%'), 'no mezcla datos de otro usuario';
  assert jsonb_array_length(j->'suscripciones') = 1;
end $$; rollback;
begin; set local role anon;
do $$ begin begin perform exportar_mis_datos(); assert false,'anon exportó'; exception when insufficient_privilege then null; end; end $$; rollback;

-- borrar la cuenta (cascada de auth.users) elimina TODO lo del usuario
delete from auth.users where id='00000000-0000-0000-0000-0000000000f1';
do $$ begin
  assert (select count(*) from perfiles where id='00000000-0000-0000-0000-0000000000f1') = 0, 'perfil borrado en cascada';
  assert (select count(*) from favoritos where usuario_id='00000000-0000-0000-0000-0000000000f1') = 0, 'favoritos borrados';
  assert (select count(*) from suscripciones where usuario_id='00000000-0000-0000-0000-0000000000f1') = 0, 'suscripciones borradas';
  assert (select count(*) from favoritos where usuario_id='00000000-0000-0000-0000-0000000000f2') = 1, 'los de otro usuario intactos';
end $$;
select 'PREMIUM OK' as resultado;
