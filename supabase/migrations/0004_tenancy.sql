-- Multi-tenant rug maker workspaces. Every tenant table carries business_id; RLS ties access to business_members.
-- Customers and rug makers are separate account types; staff roles for the XARO store remain in profiles.role.

alter table public.profiles add column account_type text not null default 'customer' check (account_type in ('customer','rugmaker'));
alter table public.audit_logs add column business_id uuid;
create index on public.audit_logs (business_id, at desc);

-- ---------- tenancy ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 120), owner_name text check (char_length(owner_name) <= 120),
  email text, phone text check (char_length(phone) <= 30), country char(2), currency char(3), address jsonb not null default '{}', logo_path text,
  settings jsonb not null default '{}', created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')), created_at timestamptz not null default now(), primary key (business_id, user_id)
);
create unique index one_owner_per_business on public.business_members (business_id) where role = 'owner';
create index on public.business_members (user_id);

create or replace function private.is_member(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members m where m.business_id = b and m.user_id = auth.uid())
$$;
create or replace function private.can_write(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members m where m.business_id = b and m.user_id = auth.uid() and m.role in ('owner','manager'))
$$;
create or replace function private.is_owner(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.business_members m where m.business_id = b and m.user_id = auth.uid() and m.role = 'owner')
$$;
revoke all on function private.is_member(uuid), private.can_write(uuid), private.is_owner(uuid) from public;
grant execute on function private.is_member(uuid), private.can_write(uuid), private.is_owner(uuid) to anon, authenticated; -- they return false when nobody is signed in

-- ---------- designs (personal for customers, shared inside a business for rug makers) ----------
create table public.design_folders (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, business_id uuid references public.businesses(id) on delete cascade,
  parent_id uuid references public.design_folders(id) on delete cascade, name text not null check (char_length(name) between 1 and 80), created_at timestamptz not null default now()
);
-- the studio's earlier custom_designs table becomes the shared designs table
alter table public.custom_designs add column business_id uuid references public.businesses(id) on delete cascade;
alter table public.custom_designs add column folder_id uuid references public.design_folders(id) on delete set null;
alter table public.custom_designs add column template_id text;
alter table public.custom_designs add column original_path text;
alter table public.custom_designs drop constraint custom_designs_status_check;
alter table public.custom_designs add constraint custom_designs_status_check check (status in ('draft','submitted','approved','active','archived'));
alter table public.custom_designs add constraint design_name_len check (char_length(name) between 1 and 120);
alter table public.custom_designs add constraint design_doc_size check (pg_column_size(doc) <= 4000000);
create index on public.custom_designs (business_id); create index on public.custom_designs (folder_id);

create or replace function private.can_see_design(d uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.custom_designs x where x.id = d and ((x.business_id is null and x.owner_id = auth.uid()) or (x.business_id is not null and private.is_member(x.business_id))))
$$;
revoke all on function private.can_see_design(uuid) from public; grant execute on function private.can_see_design(uuid) to anon, authenticated;

create table public.design_versions (
  id bigint generated always as identity primary key, design_id uuid not null references public.custom_designs(id) on delete cascade, version int not null,
  doc jsonb not null, created_by uuid, created_at timestamptz not null default now(), unique (design_id, version)
);
-- history of each save (last 50 versions); updated_at is maintained separately
create or replace function private.snapshot_design() returns trigger language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if tg_op = 'UPDATE' and new.doc is not distinct from old.doc then return null; end if;
  select coalesce(max(version), 0) + 1 into v from public.design_versions where design_id = new.id;
  insert into public.design_versions (design_id, version, doc, created_by) values (new.id, v, new.doc, auth.uid());
  delete from public.design_versions where design_id = new.id and version <= v - 50;
  return null;
end $$;
create trigger snapshot_design after insert or update on public.custom_designs for each row execute function private.snapshot_design();
create or replace function private.touch_updated() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger touch_design before update on public.custom_designs for each row execute function private.touch_updated();

-- original uploads and exports: the file itself lives in private storage, this table records it
alter table public.design_assets add column business_id uuid references public.businesses(id) on delete cascade;
alter table public.design_assets add column kind text not null default 'original' check (kind in ('original','export','thumb','sheet','logo'));
alter table public.design_assets drop constraint design_assets_mime_check;
alter table public.design_assets add constraint design_assets_mime_check check (mime in ('image/png','image/jpeg','image/webp','application/pdf'));

-- ---------- the rug maker's own business data ----------
create table public.biz_customers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120), email text, phone text, address jsonb not null default '{}', notes text check (char_length(notes) <= 4000), created_at timestamptz not null default now()
);
create table public.biz_yarns (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null check (char_length(code) between 1 and 40), name text not null check (char_length(name) between 1 and 80), manufacturer text, material text,
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'), price_per_kg numeric(12,2) check (price_per_kg >= 0), stock_kg numeric(12,3) not null default 0, reorder_kg numeric(12,3) check (reorder_kg >= 0),
  supplier text, availability text not null default 'unknown' check (availability in ('unknown','in-stock','low','out','discontinued')), active boolean not null default true,
  created_at timestamptz not null default now(), unique (business_id, code)
);
create table public.biz_palettes (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, name text not null check (char_length(name) between 1 and 80),
  colours jsonb not null default '[]', created_at timestamptz not null default now()
);
create table public.biz_projects (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, customer_id uuid references public.biz_customers(id) on delete set null,
  design_id uuid references public.custom_designs(id) on delete set null, title text not null check (char_length(title) between 1 and 160),
  status text not null default 'enquiry' check (status in ('enquiry','quoted','confirmed','in_production','finished','delivered','cancelled')), due_date date, notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.biz_quotations (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, project_id uuid references public.biz_projects(id) on delete set null,
  customer_id uuid references public.biz_customers(id) on delete set null, ref text not null, lines jsonb not null default '[]', currency char(3) not null, subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')), valid_until date, notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(), unique (business_id, ref)
);
create table public.biz_orders (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, project_id uuid references public.biz_projects(id) on delete set null,
  quotation_id uuid references public.biz_quotations(id) on delete set null, customer_id uuid references public.biz_customers(id) on delete set null, ref text not null, currency char(3) not null,
  total numeric(12,2) not null default 0 check (total >= 0), paid numeric(12,2) not null default 0 check (paid >= 0),
  status text not null default 'open' check (status in ('open','in_production','ready','delivered','cancelled')), due_date date, notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(), unique (business_id, ref)
);
create table public.production_sheets (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, project_id uuid references public.biz_projects(id) on delete set null,
  design_id uuid references public.custom_designs(id) on delete set null, title text not null, spec jsonb not null default '{}', pdf_path text, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
-- calculator configuration: each business sets its own rates and formulas. Empty by default: nothing is invented.
create table public.biz_rates (business_id uuid primary key references public.businesses(id) on delete cascade, rates jsonb not null default '{}', updated_at timestamptz not null default now());
-- yarn movements keep ESTIMATED use apart from ACTUAL use; only purchases, actual use and adjustments change stock
create table public.yarn_movements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, yarn_id uuid not null references public.biz_yarns(id) on delete cascade,
  kind text not null check (kind in ('purchase','estimated_use','actual_use','adjustment')), kg numeric(12,3) not null, project_id uuid references public.biz_projects(id) on delete set null,
  note text check (char_length(note) <= 500), created_by uuid references public.profiles(id), at timestamptz not null default now(),
  check ((kind in ('purchase','actual_use','estimated_use') and kg > 0) or (kind = 'adjustment' and kg <> 0))
);
create index on public.biz_customers (business_id); create index on public.biz_yarns (business_id); create index on public.biz_projects (business_id); create index on public.biz_quotations (business_id);
create index on public.biz_orders (business_id); create index on public.yarn_movements (business_id, yarn_id); create index on public.production_sheets (business_id);
create trigger touch_project before update on public.biz_projects for each row execute function private.touch_updated();

-- a movement must refer to a yarn of the SAME business (stops cross-tenant references)
create or replace function private.apply_movement() returns trigger language plpgsql security definer set search_path = public as $$
declare ybiz uuid;
begin
  select business_id into ybiz from public.biz_yarns where id = new.yarn_id;
  if ybiz is distinct from new.business_id then raise exception 'yarn belongs to another business' using errcode = '42501'; end if;
  if new.kind = 'purchase' then update public.biz_yarns set stock_kg = stock_kg + new.kg where id = new.yarn_id;
  elsif new.kind = 'actual_use' then update public.biz_yarns set stock_kg = stock_kg - new.kg where id = new.yarn_id;
  elsif new.kind = 'adjustment' then update public.biz_yarns set stock_kg = stock_kg + new.kg where id = new.yarn_id; end if;
  return new;
end $$;
create trigger apply_movement after insert on public.yarn_movements for each row execute function private.apply_movement();

-- cross-tenant reference guard for projects/quotes/orders/sheets: referenced customer/design/project must be in the same business
create or replace function private.same_business() returns trigger language plpgsql security definer set search_path = public as $$
declare j jsonb := to_jsonb(new); b uuid := (to_jsonb(new)->>'business_id')::uuid;
begin
  if j->>'customer_id' is not null and not exists (select 1 from public.biz_customers c where c.id = (j->>'customer_id')::uuid and c.business_id = b) then raise exception 'customer belongs to another business' using errcode = '42501'; end if;
  if j->>'project_id' is not null and not exists (select 1 from public.biz_projects c where c.id = (j->>'project_id')::uuid and c.business_id = b) then raise exception 'project belongs to another business' using errcode = '42501'; end if;
  if j->>'quotation_id' is not null and not exists (select 1 from public.biz_quotations c where c.id = (j->>'quotation_id')::uuid and c.business_id = b) then raise exception 'quotation belongs to another business' using errcode = '42501'; end if;
  if j->>'design_id' is not null and not exists (select 1 from public.custom_designs c where c.id = (j->>'design_id')::uuid and c.business_id = b) then raise exception 'design belongs to another business' using errcode = '42501'; end if;
  return new;
end $$;
do $$ declare t text; begin foreach t in array array['biz_projects','biz_quotations','biz_orders','production_sheets'] loop
  execute format('create trigger same_business_%1$s before insert or update on public.%1$s for each row execute function private.same_business()', t); end loop; end $$;

-- stock view: the owner sees estimated and actual use side by side, and a low-stock flag
create view public.v_yarn_stock with (security_invoker = true) as
select y.id, y.business_id, y.code, y.name, y.hex, y.stock_kg, y.reorder_kg,
  (y.reorder_kg is not null and y.stock_kg <= y.reorder_kg) as low_stock,
  coalesce((select sum(kg) from public.yarn_movements m where m.yarn_id = y.id and m.kind = 'estimated_use'), 0) as estimated_use_kg,
  coalesce((select sum(kg) from public.yarn_movements m where m.yarn_id = y.id and m.kind = 'actual_use'), 0) as actual_use_kg
from public.biz_yarns y;
revoke all on public.v_yarn_stock from anon;

-- ---------- audit: carry business_id, add triggers on tenant tables ----------
create or replace function private.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end); rid text;
begin
  rid := coalesce(r->>'id', r->>'key', r->>'product_id', r->>'business_id');
  insert into public.audit_logs (actor, actor_role, action, table_name, row_id, old_row, new_row, business_id)
  values (auth.uid(), private.current_role_key(), tg_op, tg_table_name, rid, case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end, case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
          case when tg_table_name = 'businesses' then (r->>'id')::uuid else (r->>'business_id')::uuid end);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
do $$ declare t text; begin foreach t in array array['businesses','business_members','biz_yarns','biz_quotations','biz_orders','biz_projects','biz_rates','production_sheets','yarn_movements'] loop
  execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function private.audit_row()', t); end loop; end $$;

-- ---------- profile guard: account_type and role can only change through the vetted functions ----------
create or replace function private.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.extra_perms is distinct from old.extra_perms or new.active is distinct from old.active) then
    if not (auth.role() = 'service_role' or private.has_perm('admins') or coalesce(current_setting('xaro.trusted', true), '') = '1') then raise exception 'not allowed to change role, permissions or active flag'; end if;
    if new.role = 'owner' and old.role <> 'owner' and not (auth.role() = 'service_role' or private.current_role_key() = 'owner' or coalesce(current_setting('xaro.trusted', true), '') = '1') then raise exception 'only an owner can create an owner'; end if;
  end if;
  if new.account_type is distinct from old.account_type and not (auth.role() = 'service_role' or coalesce(current_setting('xaro.trusted', true), '') = '1') then raise exception 'account type can only change through become_rugmaker()'; end if;
  return new;
end $$;

-- ---------- sign-up: customer or rug maker (neither is privileged) and verified-email owner claim ----------
create or replace function private.try_claim_owner(uid uuid, em text, confirmed timestamptz) returns void language plpgsql security definer set search_path = public as $$
declare owner_em text;
begin
  if confirmed is null or em is null then return; end if;
  select lower(value #>> '{}') into owner_em from public.business_settings where key = 'owner_email';
  if owner_em is null or owner_em = '' or lower(em) <> owner_em then return; end if;
  if exists (select 1 from public.profiles where role = 'owner') then return; end if;
  perform set_config('xaro.trusted', '1', true); update public.profiles set role = 'owner' where id = uid; perform set_config('xaro.trusted', '', true);
end $$;
create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare acct text := case when new.raw_user_meta_data->>'account_type' = 'rugmaker' then 'rugmaker' else 'customer' end;
begin
  insert into public.profiles (id, email, full_name, phone, account_type) values (new.id, new.email, left(new.raw_user_meta_data->>'full_name', 120), left(coalesce(new.phone, new.raw_user_meta_data->>'phone'), 30), acct) on conflict do nothing;
  perform private.try_claim_owner(new.id, new.email, new.email_confirmed_at);
  return new;
end $$;
create or replace function private.handle_user_confirmed() returns trigger language plpgsql security definer set search_path = public as $$
begin perform private.try_claim_owner(new.id, new.email, new.email_confirmed_at); return new; end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function private.handle_user_confirmed();

-- ---------- functions the app calls ----------
create or replace function public.create_business(p_name text, p_owner_name text, p_phone text, p_country text, p_currency text, p_address jsonb default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bid uuid; acct text; em text;
begin
  if uid is null then raise exception 'sign in required' using errcode = '28000'; end if;
  select account_type, email into acct, em from public.profiles where id = uid and active;
  if acct is distinct from 'rugmaker' then raise exception 'a rug maker account is required' using errcode = '42501'; end if;
  if exists (select 1 from public.business_members where user_id = uid and role = 'owner') then raise exception 'you already own a business' using errcode = '23505'; end if;
  insert into public.businesses (name, owner_name, email, phone, country, currency, address, created_by)
  values (left(trim(p_name), 120), left(trim(p_owner_name), 120), em, left(p_phone, 30), upper(left(p_country, 2)), upper(left(p_currency, 3)), coalesce(p_address, '{}'), uid) returning id into bid;
  insert into public.business_members (business_id, user_id, role) values (bid, uid, 'owner');
  insert into public.biz_rates (business_id) values (bid);
  return bid;
end $$;
create or replace function public.become_rugmaker() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '28000'; end if;
  perform set_config('xaro.trusted', '1', true); update public.profiles set account_type = 'rugmaker' where id = auth.uid() and role = 'customer'; perform set_config('xaro.trusted', '', true);
end $$;
create or replace function public.add_business_member(p_business uuid, p_email text, p_role text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not private.is_owner(p_business) then raise exception 'only the owner can add members' using errcode = '42501'; end if;
  if p_role not in ('manager','staff') then raise exception 'role must be manager or staff' using errcode = '22023'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email)) and active;
  if uid is null then raise exception 'no account with that email. Ask them to register first' using errcode = '22023'; end if;
  insert into public.business_members (business_id, user_id, role) values (p_business, uid, p_role) on conflict (business_id, user_id) do update set role = excluded.role where public.business_members.role <> 'owner';
end $$;
revoke all on function public.create_business(text,text,text,text,text,jsonb), public.become_rugmaker(), public.add_business_member(uuid,text,text) from public, anon;
grant execute on function public.create_business(text,text,text,text,text,jsonb), public.become_rugmaker(), public.add_business_member(uuid,text,text) to authenticated;

-- ---------- RLS ----------
do $$ declare t record; begin for t in select tablename from pg_tables where schemaname = 'public' loop execute format('alter table public.%I enable row level security', t.tablename); end loop; end $$;

create policy biz_read on public.businesses for select using (private.is_member(id));
create policy biz_update on public.businesses for update using (private.can_write(id)) with check (private.can_write(id));
create policy mem_read on public.business_members for select using (private.is_member(business_id));
create policy mem_owner_delete on public.business_members for delete using (private.is_owner(business_id) and role <> 'owner');

-- designs, folders and assets: members of a business share them; a personal item belongs to one user.
-- owner_id/business_id are fixed at creation (trigger), so nobody can move an item into another tenant.
create or replace function private.immutable_owner() returns trigger language plpgsql as $$
begin new.owner_id := old.owner_id; new.business_id := old.business_id; return new; end $$;
drop policy design_own on public.custom_designs; drop policy design_staff on public.custom_designs;
drop policy asset_own on public.design_assets; drop policy asset_staff on public.design_assets;
do $$ declare t text; begin foreach t in array array['custom_designs','design_folders','design_assets'] loop
  execute format('create policy %1$s_sel on public.%1$s for select using ((business_id is null and owner_id = auth.uid()) or (business_id is not null and private.is_member(business_id)))', t);
  execute format('create policy %1$s_ins on public.%1$s for insert with check (owner_id = auth.uid() and (business_id is null or private.is_member(business_id)))', t);
  execute format('create policy %1$s_upd on public.%1$s for update using ((business_id is null and owner_id = auth.uid()) or (business_id is not null and private.is_member(business_id))) with check ((business_id is null and owner_id = auth.uid()) or (business_id is not null and private.is_member(business_id)))', t);
  execute format('create policy %1$s_del on public.%1$s for delete using ((business_id is null and owner_id = auth.uid()) or (business_id is not null and private.is_member(business_id)))', t);
  execute format('create trigger immutable_owner_%1$s before update on public.%1$s for each row execute function private.immutable_owner()', t);
end loop; end $$;
create policy design_store_staff on public.custom_designs for select using (business_id is null and private.has_perm('orders'));
create policy asset_store_staff on public.design_assets for select using (business_id is null and private.has_perm('orders'));
create policy dver_read on public.design_versions for select using (private.can_see_design(design_id));

-- tenant tables: members read; owner/manager write. Projects, sheets and stock movements may also be written by staff.
do $$ declare t text; begin
  foreach t in array array['biz_customers','biz_yarns','biz_palettes','biz_quotations','biz_orders','biz_rates'] loop
    execute format('create policy %1$s_r on public.%1$s for select using (private.is_member(business_id))', t);
    execute format('create policy %1$s_w on public.%1$s for all using (private.can_write(business_id)) with check (private.can_write(business_id))', t);
  end loop;
  foreach t in array array['biz_projects','production_sheets','yarn_movements'] loop
    execute format('create policy %1$s_r on public.%1$s for select using (private.is_member(business_id))', t);
    execute format('create policy %1$s_w on public.%1$s for all using (private.is_member(business_id)) with check (private.is_member(business_id))', t);
  end loop;
end $$;
create policy audit_business_owner on public.audit_logs for select using (business_id is not null and private.is_owner(business_id));

-- ---------- grants: the browser roles never insert businesses/members directly ----------
revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke insert on public.businesses, public.business_members from authenticated;
revoke update on public.business_members from authenticated;
grant insert on public.quotations, public.support_tickets to anon;
