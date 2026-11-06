-- Row-level security. Principle: the browser (anon / authenticated) can only read what it should see and write only its own drafts.
-- Orders, order items and payments are written ONLY by edge functions using the service role, so a customer can never set their own price.

create or replace function public.current_role_key() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.has_perm(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.active and (
      pr.role = 'owner'
      or p = any (pr.extra_perms)
      or exists (select 1 from public.role_permissions rp where rp.role = pr.role and rp.perm = p)
    )
  )
$$;
revoke all on function public.has_perm(text), public.current_role_key() from public;
grant execute on function public.has_perm(text), public.current_role_key() to anon, authenticated;

-- new auth user -> customer profile (role is never taken from user-supplied metadata)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone) values (new.id, new.email, new.raw_user_meta_data->>'full_name', coalesce(new.phone, new.raw_user_meta_data->>'phone')) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- a customer may edit their own contact details, never role / permissions / active flag
create or replace function public.guard_profile_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.extra_perms is distinct from old.extra_perms or new.active is distinct from old.active) then
    if not (auth.role() = 'service_role' or public.has_perm('admins')) then raise exception 'not allowed to change role, permissions or active flag'; end if;
    if new.role = 'owner' and old.role <> 'owner' and not (auth.role() = 'service_role' or public.current_role_key() = 'owner') then raise exception 'only an owner can create an owner'; end if;
  end if;
  return new;
end $$;
create trigger guard_profile_update before update on public.profiles for each row execute function public.guard_profile_update();

-- audit trail: append-only, written by trigger
create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare rid text;
begin
  rid := coalesce((to_jsonb(case when tg_op = 'DELETE' then old else new end))->>'id', (to_jsonb(case when tg_op = 'DELETE' then old else new end))->>'key', (to_jsonb(case when tg_op = 'DELETE' then old else new end))->>'product_id');
  insert into public.audit_logs (actor, actor_role, action, table_name, row_id, old_row, new_row)
  values (auth.uid(), public.current_role_key(), tg_op, tg_table_name, rid, case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end, case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','products','product_prices','yarn_colours','yarn_inventory','orders','payments','quotations','business_settings','role_permissions','production_jobs'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop; end $$;

-- enable RLS everywhere
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop execute format('alter table public.%I enable row level security', t.tablename); end loop; end $$;

-- ---- access control tables
create policy roles_read on public.roles for select using (public.has_perm('admins'));
create policy perms_read on public.permissions for select using (public.has_perm('admins'));
create policy role_perms_read on public.role_permissions for select using (public.has_perm('admins'));
create policy role_perms_write on public.role_permissions for all using (public.current_role_key() = 'owner') with check (public.current_role_key() = 'owner');

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.has_perm('customers') or public.has_perm('admins'));
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.has_perm('admins')) with check (id = auth.uid() or public.has_perm('admins'));
-- no insert / delete policy: profiles are created by the auth trigger and removed by cascade

-- ---- catalogue: public read of live items, staff write
create policy cat_read on public.categories for select using (true);
create policy cat_write on public.categories for all using (public.has_perm('products')) with check (public.has_perm('products'));
create policy prod_read on public.products for select using (status in ('active','coming_soon') or public.has_perm('products'));
create policy prod_write on public.products for all using (public.has_perm('products')) with check (public.has_perm('products'));
create policy var_read on public.product_variants for select using (active or public.has_perm('products'));
create policy var_write on public.product_variants for all using (public.has_perm('products')) with check (public.has_perm('products'));
create policy price_read on public.product_prices for select using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active') or public.has_perm('pricing'));
create policy price_write on public.product_prices for all using (public.has_perm('pricing')) with check (public.has_perm('pricing'));

-- ---- materials / yarn: colours are public (studio palette), stock and costs are staff-only
create policy mat_staff on public.materials for all using (public.has_perm('products')) with check (public.has_perm('products'));
create policy yarn_read on public.yarn_colours for select using (active or public.has_perm('products'));
create policy yarn_write on public.yarn_colours for all using (public.has_perm('products')) with check (public.has_perm('products'));
create policy yinv_staff on public.yarn_inventory for all using (public.has_perm('products')) with check (public.has_perm('products'));

-- ---- studio
create policy tpl_read on public.design_templates for select using (active or public.has_perm('products'));
create policy tpl_write on public.design_templates for all using (public.has_perm('products')) with check (public.has_perm('products'));
create policy design_own on public.custom_designs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy design_staff on public.custom_designs for select using (public.has_perm('orders'));
create policy asset_own on public.design_assets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy asset_staff on public.design_assets for select using (public.has_perm('orders'));
-- anyone may request a quotation; a signed-in user can only attach it to themselves. Staff manage them.
create policy quote_insert on public.quotations for insert with check (owner_id is null or owner_id = auth.uid());
create policy quote_own on public.quotations for select using (owner_id = auth.uid());
create policy quote_staff_read on public.quotations for select using (public.has_perm('orders'));
create policy quote_staff_write on public.quotations for update using (public.has_perm('orders')) with check (public.has_perm('orders'));
create policy quote_staff_delete on public.quotations for delete using (public.has_perm('orders'));

-- ---- orders: customers read their own; only staff update (status, tracking); inserts come from the service role (bypasses RLS)
create policy order_own on public.orders for select using (customer_id = auth.uid());
create policy order_staff_read on public.orders for select using (public.has_perm('orders') or public.has_perm('production'));
create policy order_staff_update on public.orders for update using (public.has_perm('orders')) with check (public.has_perm('orders'));
create policy oitem_own on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy oitem_staff on public.order_items for select using (public.has_perm('orders') or public.has_perm('production'));
create policy pay_own on public.payments for select using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy pay_staff on public.payments for select using (public.has_perm('orders'));
create policy ship_own on public.shipments for select using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
create policy ship_staff on public.shipments for all using (public.has_perm('orders')) with check (public.has_perm('orders'));

-- ---- production
create policy job_staff on public.production_jobs for all using (public.has_perm('production') or public.has_perm('orders')) with check (public.has_perm('production') or public.has_perm('orders'));
create policy upd_staff on public.production_updates for all using (public.has_perm('production') or public.has_perm('orders')) with check (public.has_perm('production') or public.has_perm('orders'));
create or replace function public.owns_job(job uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.production_jobs j join public.order_items i on i.id = j.order_item_id join public.orders o on o.id = i.order_id where j.id = job and o.customer_id = auth.uid())
$$;
revoke all on function public.owns_job(uuid) from public; grant execute on function public.owns_job(uuid) to authenticated;
create policy upd_customer on public.production_updates for select using (customer_visible and public.owns_job(job_id));

-- ---- engagement
create policy rev_public on public.reviews for select using (approved or author_id = auth.uid() or public.has_perm('orders'));
create policy rev_insert on public.reviews for insert with check (author_id = auth.uid() and approved = false and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid() and o.stage = 12));
create policy rev_staff on public.reviews for update using (public.has_perm('orders')) with check (public.has_perm('orders'));
create policy note_own on public.notifications for select using (user_id = auth.uid());
create policy note_own_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ticket_insert on public.support_tickets for insert with check (owner_id is null or owner_id = auth.uid());
create policy ticket_own on public.support_tickets for select using (owner_id = auth.uid());
create policy ticket_staff on public.support_tickets for all using (public.has_perm('support')) with check (public.has_perm('support'));

-- ---- settings and audit
create policy set_public on public.business_settings for select using (is_public or public.has_perm('settings'));
create policy set_write on public.business_settings for all using (public.has_perm('settings')) with check (public.has_perm('settings'));
create policy audit_read on public.audit_logs for select using (public.has_perm('admins'));
-- audit_logs: no insert/update/delete policy for anyone; the security-definer trigger is the only writer.
revoke update, delete, truncate on public.audit_logs from anon, authenticated;

-- ---- column-level safety: the browser roles never see raw payment payloads
revoke select on public.payments from anon, authenticated;
grant select (id, order_id, provider, amount, currency, status, created_at) on public.payments to authenticated;
revoke insert, update, delete on public.orders, public.order_items, public.payments from anon, authenticated;
grant update (stage, tracking, cancelled, notes, payment_status) on public.orders to authenticated;

-- defence in depth: signed-out visitors may only insert quotation requests and support tickets, nothing else
revoke insert, update, delete, truncate on all tables in schema public from anon;
grant insert on public.quotations, public.support_tickets to anon;
