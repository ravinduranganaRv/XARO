-- RLS and trigger tests. Run after the shim + migrations. Any failed assertion raises and exits non-zero.
\set ON_ERROR_STOP on
set client_min_messages = warning;

select set_config('request.jwt.claim.role', 'service_role', false);
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test', '{"role":"owner","full_name":"Owner"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'mgr@x.test', '{}'),
 ('00000000-0000-0000-0000-0000000000c1', 'prod@x.test', '{}'),
 ('00000000-0000-0000-0000-0000000000d1', 'cust.a@x.test', '{"role":"owner"}'),
 ('00000000-0000-0000-0000-0000000000d2', 'cust.b@x.test', '{}');
do $$ begin
  assert (select role from profiles where email = 'cust.a@x.test') = 'customer', 'metadata must NOT grant a role';
end $$;
update profiles set role = 'owner' where email = 'owner@x.test';
update profiles set role = 'manager' where email = 'mgr@x.test';
update profiles set role = 'production' where email = 'prod@x.test';

insert into products (id, sku, name, status) values ('10000000-0000-0000-0000-000000000001','CK','Custom Keyboard','active'), ('10000000-0000-0000-0000-000000000002','XM','Mousepad','coming_soon'), ('10000000-0000-0000-0000-000000000003','DRAFT1','Hidden','draft');
insert into product_prices values ('10000000-0000-0000-0000-000000000001','LK','LKR',5000), ('10000000-0000-0000-0000-000000000002','LK','LKR',1000);
insert into orders (id, ref, customer_id, name, email, country, currency, subtotal, total) values
 ('20000000-0000-0000-0000-00000000000a','XO-A','00000000-0000-0000-0000-0000000000d1','A','cust.a@x.test','LK','LKR',5000,5000),
 ('20000000-0000-0000-0000-00000000000b','XO-B','00000000-0000-0000-0000-0000000000d2','B','cust.b@x.test','LK','LKR',5000,5000);
insert into order_items (id, order_id, sku, name, qty, unit_price) values ('30000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-00000000000a','CK','Custom Keyboard',1,5000);
insert into payments (order_id, provider, provider_ref, amount, currency, status, raw) values ('20000000-0000-0000-0000-00000000000a','stripe','pi_1',5000,'LKR','succeeded','{"secret":"x"}');
insert into production_jobs (id, order_item_id) values ('40000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-00000000000a');
insert into production_updates (job_id, stage, note, customer_visible) values ('40000000-0000-0000-0000-00000000000a',6,'Tufting started',true), ('40000000-0000-0000-0000-00000000000a',6,'Internal: yarn shortage',false);
insert into yarn_colours (id, name, hex) values ('XY-1','Jet Black','#0B0B0B');
insert into yarn_inventory (yarn_id, kg_on_hand, cost_per_kg) values ('XY-1', 10, 12);
select set_config('request.jwt.claim.role', '', false);

-- helper: run a statement as a user and report row count or the error class
create or replace function pg_temp.as_user(uid text, q text) returns text language plpgsql as $f$
declare n int; begin
  perform set_config('request.jwt.claim.sub', coalesce(uid,''), true);
  execute case when uid is null then 'set local role anon' else 'set local role authenticated' end;
  begin
    if q ~* '^\s*select' then execute 'select count(*) from (' || q || ') s' into n; reset role; return n::text;
    else execute q; get diagnostics n = row_count; reset role; return 'ok:' || n; end if;
  exception when others then reset role; return 'err:' || sqlstate; end; end $f$;
grant execute on function pg_temp.as_user(text, text) to public;

create or replace function pg_temp.expect(label text, got text, want text) returns void language plpgsql as $f$ begin
  if got is distinct from want then raise exception 'FAIL % -> got %, wanted %', label, got, want; end if; raise notice 'pass: %', label; end $f$;

\set A '00000000-0000-0000-0000-0000000000d1'
\set B '00000000-0000-0000-0000-0000000000d2'
\set OWN '00000000-0000-0000-0000-0000000000a1'
\set MGR '00000000-0000-0000-0000-0000000000b1'
\set PRD '00000000-0000-0000-0000-0000000000c1'

-- anonymous visitor
select pg_temp.expect('anon sees live + coming-soon products only', pg_temp.as_user(null, 'select 1 from products'), '2');
select pg_temp.expect('anon sees price of active product only', pg_temp.as_user(null, 'select 1 from product_prices'), '1');
select pg_temp.expect('anon cannot read orders', pg_temp.as_user(null, 'select 1 from orders'), '0');
select pg_temp.expect('anon cannot read audit log', pg_temp.as_user(null, 'select 1 from audit_logs'), '0');
select pg_temp.expect('anon cannot read yarn stock', pg_temp.as_user(null, 'select 1 from yarn_inventory'), '0');
select pg_temp.expect('anon can request a quotation', pg_temp.as_user(null, $q$insert into quotations (name,email) values ('Guest','g@x.test')$q$), 'ok:1');
select pg_temp.expect('anon cannot read quotations back', pg_temp.as_user(null, 'select 1 from quotations'), '0');
select pg_temp.expect('anon cannot insert order', pg_temp.as_user(null, $q$insert into orders (ref,name,email,country,currency,subtotal,total) values ('X','x','x@x','LK','LKR',1,1)$q$), 'err:42501');
select pg_temp.expect('anon cannot change prices', pg_temp.as_user(null, $q$update product_prices set amount = 1$q$), 'err:42501');

-- customer A
select pg_temp.expect('A sees only own profile', pg_temp.as_user(:'A', 'select 1 from profiles'), '1');
select pg_temp.expect('A can edit own phone', pg_temp.as_user(:'A', $q$update profiles set phone = '+94771234567' where id = auth.uid()$q$), 'ok:1');
select pg_temp.expect('A cannot promote self', pg_temp.as_user(:'A', $q$update profiles set role = 'owner' where id = auth.uid()$q$), 'err:P0001');
select pg_temp.expect('A cannot grant self perms', pg_temp.as_user(:'A', $q$update profiles set extra_perms = '{admins}' where id = auth.uid()$q$), 'err:P0001');
select pg_temp.expect('A cannot edit B profile', pg_temp.as_user(:'A', $q$update profiles set full_name = 'hacked' where id = '00000000-0000-0000-0000-0000000000d2'$q$), 'ok:0');
select pg_temp.expect('A sees only own order', pg_temp.as_user(:'A', 'select 1 from orders'), '1');
select pg_temp.expect('A sees own order items', pg_temp.as_user(:'A', 'select 1 from order_items'), '1');
select pg_temp.expect('A cannot create an order (price tampering)', pg_temp.as_user(:'A', $q$insert into orders (ref,customer_id,name,email,country,currency,subtotal,total) values ('X',auth.uid(),'a','a@x','LK','LKR',1,1)$q$), 'err:42501');
select pg_temp.expect('A cannot edit own order total', pg_temp.as_user(:'A', $q$update orders set total = 1$q$), 'err:42501');
select pg_temp.expect('A cannot mark order delivered (RLS hides the row from update)', pg_temp.as_user(:'A', $q$update orders set stage = 12$q$), 'ok:0');
select pg_temp.expect('A can read payment status', pg_temp.as_user(:'A', 'select status from payments'), '1');
select pg_temp.expect('A cannot read raw payment payload', pg_temp.as_user(:'A', 'select raw from payments'), 'err:42501');
select pg_temp.expect('A saves own design', pg_temp.as_user(:'A', $q$insert into custom_designs (owner_id,name,doc) values (auth.uid(),'mine','{}')$q$), 'ok:1');
select pg_temp.expect('A cannot save design as B', pg_temp.as_user(:'A', $q$insert into custom_designs (owner_id,name,doc) values ('00000000-0000-0000-0000-0000000000d2','x','{}')$q$), 'err:42501');
select pg_temp.expect('B cannot see A design', pg_temp.as_user(:'B', 'select 1 from custom_designs'), '0');
select pg_temp.expect('A sees customer-visible updates only', pg_temp.as_user(:'A', 'select 1 from production_updates'), '1');
select pg_temp.expect('A cannot review undelivered order', pg_temp.as_user(:'A', $q$insert into reviews (order_id,author_id,rating) values ('20000000-0000-0000-0000-00000000000a', auth.uid(), 5)$q$), 'err:42501');
select pg_temp.expect('A cannot read audit log', pg_temp.as_user(:'A', 'select 1 from audit_logs'), '0');
select pg_temp.expect('A cannot read yarn stock', pg_temp.as_user(:'A', 'select 1 from yarn_inventory'), '0');
select pg_temp.expect('A cannot edit audit log', pg_temp.as_user(:'A', 'delete from audit_logs'), 'err:42501');

-- delivered order allows a review, which stays hidden until approved
update orders set stage = 12 where ref = 'XO-A';
select pg_temp.expect('A reviews delivered order', pg_temp.as_user(:'A', $q$insert into reviews (order_id,author_id,rating,body) values ('20000000-0000-0000-0000-00000000000a', auth.uid(), 5, 'great')$q$), 'ok:1');
select pg_temp.expect('A cannot self-approve review', pg_temp.as_user(:'A', $q$insert into reviews (order_id,author_id,rating,approved) values ('20000000-0000-0000-0000-00000000000b', auth.uid(), 5, true)$q$), 'err:42501');
select pg_temp.expect('public cannot see unapproved review', pg_temp.as_user(null, 'select 1 from reviews'), '0');

-- manager: products, prices, orders yes; admins/audit no
select pg_temp.expect('manager reads all orders', pg_temp.as_user(:'MGR', 'select 1 from orders'), '2');
select pg_temp.expect('manager changes a price', pg_temp.as_user(:'MGR', $q$update product_prices set amount = 5500 where country = 'LK' and product_id = '10000000-0000-0000-0000-000000000001'$q$), 'ok:1');
select pg_temp.expect('manager sees draft product', pg_temp.as_user(:'MGR', 'select 1 from products'), '3');
select pg_temp.expect('manager reads yarn stock', pg_temp.as_user(:'MGR', 'select 1 from yarn_inventory'), '1');
select pg_temp.expect('manager cannot read audit log', pg_temp.as_user(:'MGR', 'select 1 from audit_logs'), '0');
select pg_temp.expect('manager cannot promote anyone (row not updatable)', pg_temp.as_user(:'MGR', $q$update profiles set role = 'admin' where email = 'cust.b@x.test'$q$), 'ok:0');
select pg_temp.expect('manager cannot edit settings', pg_temp.as_user(:'MGR', $q$insert into business_settings (key,value) values ('x','1')$q$), 'err:42501');
select pg_temp.expect('manager updates order stage', pg_temp.as_user(:'MGR', $q$update orders set stage = 3 where ref = 'XO-B'$q$), 'ok:1');
select pg_temp.expect('manager cannot change order total', pg_temp.as_user(:'MGR', $q$update orders set total = 1 where ref = 'XO-B'$q$), 'err:42501');

-- production staff: board yes, prices/yarn no
select pg_temp.expect('production sees all updates', pg_temp.as_user(:'PRD', 'select 1 from production_updates'), '2');
select pg_temp.expect('production cannot change prices', pg_temp.as_user(:'PRD', $q$update product_prices set amount = 1$q$), 'ok:0');
select pg_temp.expect('production cannot read yarn costs', pg_temp.as_user(:'PRD', 'select 1 from yarn_inventory'), '0');

-- owner and audit
select pg_temp.expect('owner reads audit log', (select (pg_temp.as_user(:'OWN', $q$select 1 from audit_logs where table_name = 'product_prices' and action = 'UPDATE'$q$)::int >= 1)::text), 'true');
select pg_temp.expect('audit records who changed the price', (select count(*)::text from audit_logs where table_name = 'product_prices' and actor = :'MGR'::uuid and (new_row->>'amount')::numeric = 5500), '1');
select pg_temp.expect('owner cannot rewrite audit log', pg_temp.as_user(:'OWN', $q$update audit_logs set action = 'x'$q$), 'err:42501');
select pg_temp.expect('owner cannot delete audit log', pg_temp.as_user(:'OWN', 'delete from audit_logs'), 'err:42501');
select pg_temp.expect('owner can create an admin', pg_temp.as_user(:'OWN', $q$update profiles set role = 'admin' where email = 'cust.b@x.test'$q$), 'ok:1');
select pg_temp.expect('role change is audited', (select count(*)::text from audit_logs where table_name = 'profiles' and action = 'UPDATE' and actor = :'OWN'::uuid), '1');
\echo ALL RLS TESTS PASSED
