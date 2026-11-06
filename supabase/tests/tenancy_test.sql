-- Multi-tenant isolation tests. Self-contained: runs inside one transaction and ROLLS BACK at the end by raising
-- 'TENANCY_TESTS_PASSED n'. Works on the local Postgres (with 00_shim.sql) and on a real Supabase project (via SQL editor / MCP).
create or replace function pg_temp.as_user(uid uuid, q text, scalar boolean default false) returns text language plpgsql as $f$
declare n bigint; v text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), true);
  perform set_config('request.jwt.claim.role', case when uid is null then 'anon' else 'authenticated' end, true);
  perform set_config('request.jwt.claims', case when uid is null then '{"role":"anon"}' else json_build_object('sub', uid, 'role', 'authenticated')::text end, true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
  begin
    if scalar and q ~* '^\s*insert' then execute q into v; reset role; return coalesce(v, 'null');
    elsif scalar then execute 'select (' || q || ')::text' into v; reset role; return coalesce(v, 'null');
    elsif q ~* '^\s*select' then execute 'select count(*) from (' || q || ') s' into n; reset role; return n::text;
    else execute q; get diagnostics n = row_count; reset role; return 'ok:' || n; end if;
  exception when others then reset role; return 'err:' || sqlstate; end;
end $f$;
grant execute on function pg_temp.as_user(uuid, text, boolean) to public;

do $t$
declare
  alice uuid := '00000000-0000-0000-0000-00000000f001'; bob uuid := '00000000-0000-0000-0000-00000000f002'; carol uuid := '00000000-0000-0000-0000-00000000f003'; sam uuid := '00000000-0000-0000-0000-00000000f004';
  hax uuid := '00000000-0000-0000-0000-00000000f005';
  ab uuid; bb uuid; ay uuid; by_ uuid; ac uuid; bc uuid; ad uuid; cd uuid; n int := 0; got text;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  insert into auth.users (id, email, raw_user_meta_data) values
    (alice, 'alice@x.test', '{"account_type":"rugmaker","full_name":"Alice"}'), (bob, 'bob@x.test', '{"account_type":"rugmaker"}'),
    (carol, 'carol@x.test', '{}'), (sam, 'sam@x.test', '{"account_type":"rugmaker"}'), (hax, 'hax@x.test', '{"account_type":"admin","role":"owner"}');
  perform set_config('request.jwt.claim.role', '', true);

  -- helper macro as inline checks
  -- 1. signup
  got := (select account_type || '/' || role from profiles where id = alice); if got <> 'rugmaker/customer' then raise exception 'FAIL signup rugmaker: %', got; end if; n := n + 1;
  got := (select account_type || '/' || role from profiles where id = hax); if got <> 'customer/customer' then raise exception 'FAIL signup metadata must not grant admin/owner: %', got; end if; n := n + 1;

  -- 2. creating businesses
  got := pg_temp.as_user(carol, $q$select public.create_business('Carol Rugs','Carol','+94','LK','LKR')$q$, true); if got <> 'err:42501' then raise exception 'FAIL customer created business: %', got; end if; n := n + 1;
  got := pg_temp.as_user(null, $q$select public.create_business('Anon','x','+94','LK','LKR')$q$, true); if got not like 'err:%' then raise exception 'FAIL anon created business: %', got; end if; n := n + 1;
  ab := pg_temp.as_user(alice, $q$select public.create_business('Alice Tufting','Alice','+94771111111','LK','LKR','{"city":"Colombo"}')$q$, true)::uuid;
  bb := pg_temp.as_user(bob, $q$select public.create_business('Bob Rugs','Bob','+94772222222','AE','AED')$q$, true)::uuid;
  got := pg_temp.as_user(alice, $q$select public.create_business('Second','Alice','+94','LK','LKR')$q$, true); if got <> 'err:23505' then raise exception 'FAIL second business allowed: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, 'insert into businesses (name) values (''Direct'')'); if got not like 'err:%' then raise exception 'FAIL direct business insert: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, 'select 1 from businesses'); if got <> '1' then raise exception 'FAIL alice sees % businesses', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, 'select 1 from businesses'); if got <> '1' then raise exception 'FAIL bob sees % businesses', got; end if; n := n + 1;
  got := pg_temp.as_user(carol, 'select 1 from businesses'); if got <> '0' then raise exception 'FAIL carol sees businesses: %', got; end if; n := n + 1;
  got := pg_temp.as_user(null, 'select 1 from businesses'); if got <> '0' then raise exception 'FAIL anon sees businesses: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format('update businesses set name = ''Hijacked'' where id = %L', bb)); if got <> 'ok:0' then raise exception 'FAIL alice edited bob business: %', got; end if; n := n + 1;

  -- 3. yarn library isolation
  ay := pg_temp.as_user(alice, format($q$insert into biz_yarns (business_id, code, name, hex, reorder_kg) values (%L,'A-1','Alice Red','#CC0000', 9) returning id$q$, ab), true)::uuid;
  if ay is null then raise exception 'FAIL alice yarn insert'; end if;
  by_ := pg_temp.as_user(bob, format($q$insert into biz_yarns (business_id, code, name, hex) values (%L,'B-1','Bob Blue','#0000CC') returning id$q$, bb), true)::uuid;
  got := pg_temp.as_user(bob, 'select 1 from biz_yarns'); if got <> '1' then raise exception 'FAIL bob sees % yarns', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, format($q$insert into biz_yarns (business_id, code, name, hex) values (%L,'X','intruder','#000000')$q$, ab)); if got <> 'err:42501' then raise exception 'FAIL bob wrote into alice business: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format('update biz_yarns set name = ''x'' where id = %L', by_)); if got <> 'ok:0' then raise exception 'FAIL alice edited bob yarn: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format('delete from biz_yarns where id = %L', by_)); if got <> 'ok:0' then raise exception 'FAIL alice deleted bob yarn: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format($q$insert into biz_yarns (business_id, code, name, hex) values (%L,'A-2','bad hex','red')$q$, ab)); if got <> 'err:23514' then raise exception 'FAIL bad hex accepted: %', got; end if; n := n + 1;
  got := pg_temp.as_user(carol, 'select 1 from biz_yarns'); if got <> '0' then raise exception 'FAIL customer sees yarns'; end if; n := n + 1;

  -- 4. stock: estimated vs actual
  perform pg_temp.as_user(alice, format($q$insert into yarn_movements (business_id, yarn_id, kind, kg) values (%L,%L,'purchase',10)$q$, ab, ay));
  perform pg_temp.as_user(alice, format($q$insert into yarn_movements (business_id, yarn_id, kind, kg) values (%L,%L,'estimated_use',3)$q$, ab, ay));
  got := pg_temp.as_user(alice, format('select stock_kg from biz_yarns where id = %L', ay), true); if got::numeric <> 10 then raise exception 'FAIL estimated use changed stock: %', got; end if; n := n + 1;
  perform pg_temp.as_user(alice, format($q$insert into yarn_movements (business_id, yarn_id, kind, kg) values (%L,%L,'actual_use',2)$q$, ab, ay));
  got := pg_temp.as_user(alice, format('select stock_kg from biz_yarns where id = %L', ay), true); if got::numeric <> 8 then raise exception 'FAIL actual use stock: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format($q$select estimated_use_kg || '/' || actual_use_kg || '/' || low_stock from v_yarn_stock where id = %L$q$, ay), true); if got <> '3.000/2.000/true' then raise exception 'FAIL stock view: %', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, 'select 1 from v_yarn_stock'); if got <> '1' then raise exception 'FAIL bob sees alice in stock view: %', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, format($q$insert into yarn_movements (business_id, yarn_id, kind, kg) values (%L,%L,'purchase',5)$q$, bb, ay)); if got <> 'err:42501' then raise exception 'FAIL cross-tenant movement: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format($q$insert into yarn_movements (business_id, yarn_id, kind, kg) values (%L,%L,'purchase',-5)$q$, ab, ay)); if got <> 'err:23514' then raise exception 'FAIL negative purchase accepted: %', got; end if; n := n + 1;

  -- 5. cross-tenant references
  bc := pg_temp.as_user(bob, format($q$insert into biz_customers (business_id, name) values (%L,'Bob Client') returning id$q$, bb), true)::uuid;
  ac := pg_temp.as_user(alice, format($q$insert into biz_customers (business_id, name, email) values (%L,'Alice Client','c@x.test') returning id$q$, ab), true)::uuid;
  got := pg_temp.as_user(alice, format($q$insert into biz_projects (business_id, customer_id, title) values (%L,%L,'steal')$q$, ab, bc)); if got <> 'err:42501' then raise exception 'FAIL project referenced other tenant customer: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format($q$insert into biz_projects (business_id, customer_id, title) values (%L,%L,'Logo rug')$q$, ab, ac)); if got <> 'ok:1' then raise exception 'FAIL own project insert: %', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, 'select 1 from biz_customers'); if got <> '1' then raise exception 'FAIL bob sees % customers', got; end if; n := n + 1;

  -- 6. members and roles
  got := pg_temp.as_user(alice, format($q$select public.add_business_member(%L,'sam@x.test','staff')$q$, ab), true); if got like 'err:%' then raise exception 'FAIL owner add member: %', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, 'select 1 from biz_yarns'); if got <> '1' then raise exception 'FAIL staff cannot read yarns: %', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, format($q$insert into biz_yarns (business_id, code, name, hex) values (%L,'S-1','staff yarn','#111111')$q$, ab)); if got <> 'err:42501' then raise exception 'FAIL staff wrote yarn library: %', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, format($q$insert into biz_projects (business_id, title) values (%L,'staff project')$q$, ab)); if got <> 'ok:1' then raise exception 'FAIL staff cannot add project: %', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, format($q$insert into yarn_movements (business_id, yarn_id, kind, kg) values (%L,%L,'actual_use',1)$q$, ab, ay)); if got <> 'ok:1' then raise exception 'FAIL staff cannot record use: %', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, format($q$select public.add_business_member(%L,'bob@x.test','manager')$q$, ab), true); if got <> 'err:42501' then raise exception 'FAIL staff added member: %', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, format($q$select public.add_business_member(%L,'bob@x.test','manager')$q$, ab), true); if got <> 'err:42501' then raise exception 'FAIL outsider added self: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format($q$select public.add_business_member(%L,'bob@x.test','owner')$q$, ab), true); if got <> 'err:22023' then raise exception 'FAIL second owner via add_member: %', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, 'select 1 from business_members'); if got <> '2' then raise exception 'FAIL staff sees % members', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, format($q$update business_members set role = 'owner' where business_id = %L$q$, ab)); if got not like 'err:%' then raise exception 'FAIL member role update allowed: %', got; end if; n := n + 1;

  -- 7. designs, personal and shared, with history
  cd := pg_temp.as_user(carol, $q$insert into custom_designs (owner_id, name, doc) values (auth.uid(), 'Carol logo', '{"v":1}') returning id$q$, true)::uuid;
  ad := pg_temp.as_user(alice, format($q$insert into custom_designs (owner_id, business_id, name, doc) values (auth.uid(), %L, 'Team design', '{"v":1}') returning id$q$, ab), true)::uuid;
  got := pg_temp.as_user(alice, 'select 1 from custom_designs'); if got <> '1' then raise exception 'FAIL alice sees % designs', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, 'select 1 from custom_designs'); if got <> '1' then raise exception 'FAIL staff cannot see shared design: %', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, 'select 1 from custom_designs'); if got <> '0' then raise exception 'FAIL outsider sees designs: %', got; end if; n := n + 1;
  got := pg_temp.as_user(carol, 'select 1 from custom_designs'); if got <> '1' then raise exception 'FAIL carol sees % designs', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, format($q$insert into custom_designs (owner_id, business_id, name, doc) values (auth.uid(), %L, 'x', '{}')$q$, ab)); if got <> 'err:42501' then raise exception 'FAIL design into other business: %', got; end if; n := n + 1;
  perform pg_temp.as_user(sam, format($q$update custom_designs set doc = '{"v":2}' where id = %L$q$, ad));
  got := pg_temp.as_user(alice, format('select 1 from design_versions where design_id = %L', ad)); if got <> '2' then raise exception 'FAIL version history: % rows', got; end if; n := n + 1;
  got := pg_temp.as_user(bob, format('select 1 from design_versions where design_id = %L', ad)); if got <> '0' then raise exception 'FAIL outsider reads history'; end if; n := n + 1;
  got := pg_temp.as_user(alice, format('select 1 from design_versions where design_id = %L', cd)); if got <> '0' then raise exception 'FAIL alice reads carol history'; end if; n := n + 1;

  -- 8. audit
  got := pg_temp.as_user(alice, 'select 1 from audit_logs where business_id is not null'); if got::int < 3 then raise exception 'FAIL owner audit rows: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format('select 1 from audit_logs where business_id = %L', bb)); if got <> '0' then raise exception 'FAIL alice reads bob audit'; end if; n := n + 1;
  got := pg_temp.as_user(sam, 'select 1 from audit_logs'); if got <> '0' then raise exception 'FAIL staff reads audit'; end if; n := n + 1;
  got := pg_temp.as_user(alice, 'delete from audit_logs'); if got not like 'err:%' then raise exception 'FAIL audit delete allowed: %', got; end if; n := n + 1;

  -- 9. profile guards and owner claim
  got := pg_temp.as_user(alice, 'update profiles set role = ''owner'' where id = auth.uid()'); if got not like 'err:%' then raise exception 'FAIL self promote: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, 'update profiles set account_type = ''customer'' where id = auth.uid()'); if got not like 'err:%' then raise exception 'FAIL account_type edit: %', got; end if; n := n + 1;
  got := pg_temp.as_user(carol, 'select public.become_rugmaker()', true); if got like 'err:%' then raise exception 'FAIL become_rugmaker: %', got; end if;
  got := (select account_type from profiles where id = carol); if got <> 'rugmaker' then raise exception 'FAIL carol not rugmaker'; end if; n := n + 1;
  perform set_config('xaro.trusted', '1', true); update profiles set role = 'customer' where role = 'owner'; perform set_config('xaro.trusted', '', true); -- start from a database with no owner (rolled back at the end)
  insert into business_settings (key, value, is_public) values ('owner_email', '"boss@x.test"', false);
  insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000f0b0', 'boss@x.test', '{}');
  got := (select role from profiles where email = 'boss@x.test'); if got <> 'customer' then raise exception 'FAIL unconfirmed email claimed owner: %', got; end if; n := n + 1;
  update auth.users set email_confirmed_at = now() where email = 'boss@x.test';
  got := (select role from profiles where email = 'boss@x.test'); if got <> 'owner' then raise exception 'FAIL verified owner not promoted: %', got; end if; n := n + 1;
  insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ('00000000-0000-0000-0000-00000000f0b1', 'Boss@X.test', '{}', now());
  got := (select count(*)::text from profiles where role = 'owner'); if got <> '1' then raise exception 'FAIL more than one owner claimed: %', got; end if; n := n + 1;

  -- 10. storage
  got := pg_temp.as_user(alice, format($q$insert into storage.objects (bucket_id, name) values ('design-originals', '%s/a.png')$q$, alice)); if got <> 'ok:1' then raise exception 'FAIL own personal upload: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format($q$insert into storage.objects (bucket_id, name) values ('design-originals', '%s/a.png')$q$, bob)); if got <> 'err:42501' then raise exception 'FAIL upload into other user folder: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, format($q$insert into storage.objects (bucket_id, name) values ('business-assets', 'b/%s/logo.png')$q$, ab)); if got <> 'ok:1' then raise exception 'FAIL own business upload: %', got; end if; n := n + 1;
  got := pg_temp.as_user(sam, format($q$select 1 from storage.objects where name = 'b/%s/logo.png'$q$, ab)); if got <> '1' then raise exception 'FAIL staff cannot read business file'; end if; n := n + 1;
  got := pg_temp.as_user(bob, format($q$select 1 from storage.objects where name = 'b/%s/logo.png'$q$, ab)); if got <> '0' then raise exception 'FAIL outsider reads business file'; end if; n := n + 1;
  got := pg_temp.as_user(bob, format($q$insert into storage.objects (bucket_id, name) values ('business-assets', 'b/%s/evil.png')$q$, ab)); if got <> 'err:42501' then raise exception 'FAIL outsider uploaded into business: %', got; end if; n := n + 1;
  got := pg_temp.as_user(alice, $q$insert into storage.objects (bucket_id, name) values ('business-assets', 'b/not-a-uuid/x.png')$q$); if got <> 'err:42501' then raise exception 'FAIL malformed business path accepted: %', got; end if; n := n + 1;
  got := pg_temp.as_user(null, 'select 1 from storage.objects'); if got <> '0' then raise exception 'FAIL anon lists storage: %', got; end if; n := n + 1;
  got := (select count(*)::text from storage.buckets where public); if got <> '0' then raise exception 'FAIL public bucket exists: %', got; end if; n := n + 1;

  raise exception 'TENANCY_TESTS_PASSED %', n;
end $t$;
